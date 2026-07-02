"use server";

// Generates plain-language "Quick Summary" text for chemical-inventory records at
// EXPORT TIME ONLY. Never mutates a chemical record. Reuses the existing
// tenant-scoped data layer (getChemicals → RLS-respecting, MOCK_MODE-safe) and the
// provider-agnostic AI gateway (generateStructuredJson). If the AI provider is
// unavailable, misconfigured, or the circuit breaker is open, every row falls back
// to a summary constructed from its own field values — the export always completes.
//
// Returns a { chemicalId → summary } map (plus a record count) so the workbook can
// stay client-side in ChemicalExportButton, matching the app's existing export
// pattern. The workbook is NOT built here.

import { getChemicals } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId, getServerProfileId } from "@/lib/auth/session";
import { addAudit } from "@/lib/data/repo";
import { generateStructuredJson, type JsonSchemaSpec } from "@/lib/ai/provider";
import type { Chemical } from "@/lib/types";

export interface ChemicalSummaryResult {
  /** chemical.id → 1–2 sentence plain-language safety/compliance summary. */
  summaries: Record<string, string>;
  /** Number of chemicals summarised (matches the exported inventory size). */
  recordCount: number;
  /** True if at least one summary came from the AI model rather than the fallback. */
  aiEnriched: boolean;
}

// Batch size per model call — keeps token usage bounded on large inventories and
// limits the blast radius of a single failed call (one chunk falls back, not all).
const CHUNK_SIZE = 20;
const AI_TIMEOUT_MS = 8_000;
const MAX_SUMMARY_LEN = 400;

function fmtDate(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Deterministic summary built only from the chemical's own stored values. Used as
 * the AI fallback and as the guaranteed floor for every row. No invented data.
 */
function buildFallbackSummary(c: Chemical): string {
  const parts: string[] = [];
  parts.push(`${c.name || "Unnamed chemical"}${c.cas_number ? ` (CAS ${c.cas_number})` : ""}.`);
  parts.push(c.sds_url ? "Safety Data Sheet on file." : "Safety Data Sheet MISSING — obtain SDS.");
  const sdsExp = fmtDate(c.sds_expiry);
  if (sdsExp) parts.push(`SDS expires ${sdsExp}.`);
  if (c.is_scheduled) parts.push("Scheduled / DEA-controlled substance.");
  parts.push(`Stored in ${c.storage_location || "an unspecified location"}.`);
  return parts.join(" ").slice(0, MAX_SUMMARY_LEN);
}

/** Only the fields the model is allowed to see — no free-text that could carry a prompt-injection payload beyond these known columns. */
function modelInput(c: Chemical) {
  return {
    id: c.id,
    name: String(c.name ?? "").slice(0, 200),
    cas_number: String(c.cas_number ?? "").slice(0, 40),
    sds_status: c.sds_url ? "on file" : "missing",
    sds_expiry: String(c.sds_expiry ?? "").slice(0, 40),
    scheduled: c.is_scheduled ? "yes" : "no",
    storage_location: String(c.storage_location ?? "").slice(0, 120),
    storage_class: String(c.storage_class ?? "").slice(0, 60),
    hazard_statements: (c.hazard_statements ?? []).slice(0, 12),
  };
}

const SCHEMA: JsonSchemaSpec = {
  name: "chemical_summaries",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summaries: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            summary: { type: "string" },
          },
          required: ["id", "summary"],
        },
      },
    },
    required: ["summaries"],
  },
};

const SYSTEM_PROMPT =
  "You are a safety data assistant for an EHS platform. For each chemical, write a concise 1–2 sentence, plain-language summary of its safety and compliance status for an EHS manager. Use ONLY the provided field values — never invent hazards, dates, or classifications. Return one summary per chemical id.";

/** Summarise one chunk via the AI gateway. Throws on any failure so the caller falls back for the whole chunk. */
async function summariseChunk(chunk: Chemical[]): Promise<Record<string, string>> {
  const user = JSON.stringify({ chemicals: chunk.map(modelInput) });
  const result = await generateStructuredJson({
    system: SYSTEM_PROMPT,
    user,
    schema: SCHEMA,
    maxTokens: 60 * chunk.length + 100,
    timeoutMs: AI_TIMEOUT_MS,
    tier: "triage", // cheap model — this is low-stakes rephrasing of existing data
  });
  const data = result.data as { summaries?: { id?: unknown; summary?: unknown }[] };
  const out: Record<string, string> = {};
  for (const s of data.summaries ?? []) {
    if (typeof s?.id === "string" && typeof s?.summary === "string") {
      out[s.id] = s.summary.trim().slice(0, MAX_SUMMARY_LEN);
    }
  }
  return out;
}

/**
 * Build plain-language summaries for the caller's full chemical inventory.
 * Read-only: fetches via the tenant-scoped repo and writes a single audit entry.
 * Never mutates any chemical record.
 */
export async function exportChemicalSummaries(): Promise<ChemicalSummaryResult> {
  const tenantId = await getEffectiveTenantId();
  const chemicals = await getChemicals(tenantId);

  const summaries: Record<string, string> = {};
  let aiEnriched = false;

  // Guaranteed floor: every row gets a constructed summary first, so a missing AI
  // result (or a partial one) never leaves an empty cell in the export.
  for (const c of chemicals) summaries[c.id] = buildFallbackSummary(c);

  for (let i = 0; i < chemicals.length; i += CHUNK_SIZE) {
    const chunk = chemicals.slice(i, i + CHUNK_SIZE);
    try {
      const aiSummaries = await summariseChunk(chunk);
      for (const c of chunk) {
        const s = aiSummaries[c.id];
        if (s) {
          summaries[c.id] = s;
          aiEnriched = true;
        }
      }
    } catch {
      // AI unavailable / timed out / circuit open — keep this chunk's fallbacks.
    }
  }

  // Single best-effort audit entry. addAudit resolves tenant + is non-fatal on
  // failure and works in both MOCK_MODE and live.
  await addAudit({
    actor_id: await getServerProfileId(),
    action: "chemical.export_summaries",
    entity: "chemical_inventory",
    entity_id: tenantId,
    reason: null,
    detail: { record_count: chemicals.length, ai_enriched: aiEnriched },
  });

  return { summaries, recordCount: chemicals.length, aiEnriched };
}
