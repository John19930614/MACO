/**
 * ETL import core (pure, testable). Transforms rows from an existing platform's
 * export (CSV) into validated AMAYA Safety Cell inputs, keeping a legacy id for
 * traceability and producing a reconciliation report. The same zod schema the
 * app uses validates every row, so bad data is rejected — not silently imported.
 * See docs/migration-plan.md.
 */
import { safetyCellSchema, type SafetyCellInput } from "@/lib/schemas";

export interface EtlMapping {
  /** AMAYA field name -> source column header. */
  fields: Record<string, string>;
  /** Per-field value translations (e.g. severity "1" -> "low"). */
  valueMaps?: Record<string, Record<string, string>>;
  /** Fallbacks when a source value is missing. */
  defaults?: Record<string, string | number>;
  /** Source column holding the original record id (for legacy_id traceability). */
  legacyIdColumn?: string;
}

export interface EtlResult {
  inputs: SafetyCellInput[];
  legacyIds: string[]; // aligned 1:1 with inputs
  rejected: { row: number; legacyId: string; issues: string[] }[];
  report: { read: number; valid: number; invalid: number };
}

/** Minimal RFC-4180-ish CSV parser (handles quotes, embedded commas/newlines). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const pushField = () => { record.push(field); field = ""; };
  const pushRecord = () => { rows.push(record); record = []; };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") pushField();
    else if (ch === "\n") { pushField(); pushRecord(); }
    else field += ch;
  }
  if (field.length > 0 || record.length > 0) { pushField(); pushRecord(); }
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const o: Record<string, string> = {};
      header.forEach((h, idx) => (o[h] = (r[idx] ?? "").trim()));
      return o;
    });
}

export function mapRowsToCells(rows: Record<string, string>[], mapping: EtlMapping): EtlResult {
  const f = mapping.fields ?? {};
  const vm = mapping.valueMaps ?? {};
  const def = mapping.defaults ?? {};

  const get = (row: Record<string, string>, field: string): string | undefined => {
    const col = f[field];
    let raw = col !== undefined ? row[col] : undefined;
    if (raw !== undefined && raw !== "" && vm[field]) raw = vm[field][raw] ?? raw;
    if (raw === undefined || raw === "") {
      const d = def[field];
      return d === undefined ? undefined : String(d);
    }
    return raw;
  };

  const inputs: SafetyCellInput[] = [];
  const legacyIds: string[] = [];
  const rejected: EtlResult["rejected"] = [];

  rows.forEach((row, i) => {
    const legacyId = (mapping.legacyIdColumn && row[mapping.legacyIdColumn]) || `row-${i + 1}`;
    const likelihoodRaw = get(row, "likelihood");
    const candidate = {
      site_id: get(row, "site_id"),
      location_id: get(row, "location_id"),
      title: get(row, "title"),
      description: get(row, "description"),
      task: get(row, "task"),
      crew: get(row, "crew") ?? null,
      company: get(row, "company") ?? null,
      permit_ref: get(row, "permit_ref") ?? null,
      severity: get(row, "severity"),
      likelihood: likelihoodRaw === undefined ? undefined : Number(likelihoodRaw),
      status: get(row, "status") ?? "open",
      hazard_genome: {
        energySource: get(row, "energySource"),
        exposureType: get(row, "exposureType"),
        trigger: get(row, "trigger"),
        controlGap: get(row, "controlGap"),
        environment: get(row, "environment"),
      },
    };
    const parsed = safetyCellSchema.safeParse(candidate);
    if (parsed.success) {
      inputs.push(parsed.data);
      legacyIds.push(legacyId);
    } else {
      rejected.push({ row: i + 1, legacyId, issues: parsed.error.issues.map((x) => `${x.path.join(".") || "(root)"}: ${x.message}`) });
    }
  });

  return { inputs, legacyIds, rejected, report: { read: rows.length, valid: inputs.length, invalid: rejected.length } };
}
