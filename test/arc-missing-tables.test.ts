import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SEVERITIES, EVENT_KINDS, BEHAVIOR_PATTERNS } from "@/lib/constants";
import { createComment, createEvidence } from "@/lib/data/repo";

/**
 * Guards 20260702010000_arc_missing_tables.sql — the six tables repo.ts
 * queries in live mode that the foundational ARC migrations never created
 * (evidence_files, comments, event_cells, behavior_cells, gateway_rejects,
 * staged_records). Same philosophy as schema-consistency.test.ts: the SQL's
 * CHECK constraints must exactly match the app's runtime enums, and every
 * table must be RLS-locked through in_tenant(). That file's guard only parses
 * the foundational migrations, so this one covers the follow-up file.
 */
const sql = readFileSync(
  fileURLToPath(new URL("../supabase/migrations/20260702010000_arc_missing_tables.sql", import.meta.url)),
  "utf8",
);

const TABLES = [
  "evidence_files",
  "comments",
  "event_cells",
  "behavior_cells",
  "gateway_rejects",
  "staged_records",
] as const;

// Extract every  in ('a','b',...)  list from the SQL as a set of string values.
function extractCheckSets(source: string): Set<string>[] {
  const sets: Set<string>[] = [];
  const re = /in\s*\(\s*('(?:[^']|'')*'(?:\s*,\s*'(?:[^']|'')*')*)\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const values = m[1]
      .split(",")
      .map((v) => v.trim().replace(/^'|'$/g, "").replace(/''/g, "'"));
    sets.push(new Set(values));
  }
  return sets;
}

const checkSets = extractCheckSets(sql);
const key = (values: readonly string[]) => [...values].sort().join("|");
const schemaHasExactSet = (values: readonly string[]) =>
  checkSets.some((s) => key([...s]) === key(values));

describe("ARC missing-tables migration matches the app", () => {
  it.each(TABLES)("creates %s", (table) => {
    expect(sql).toMatch(new RegExp(`create table if not exists public\\.${table}`, "i"));
  });

  it.each(TABLES)("enables RLS on %s", (table) => {
    expect(sql).toMatch(new RegExp(`alter table public\\.${table}\\s+enable row level security`, "i"));
  });

  it.each(TABLES)("tenant-isolates %s reads and writes via in_tenant()", (table) => {
    const policies = [...sql.matchAll(new RegExp(`create policy \\S+\\s+on public\\.${table}[^;]+;`, "gi"))].map((m) => m[0]);
    expect(policies.length).toBeGreaterThanOrEqual(2); // read + write
    for (const p of policies) expect(p).toMatch(/in_tenant\(tenant_id\)/);
    expect(policies.some((p) => /for all/i.test(p) && /with check/i.test(p))).toBe(true);
  });

  const enumCases: [string, readonly string[]][] = [
    ["severity", SEVERITIES],
    ["event kind", EVENT_KINDS],
    ["behavior pattern", BEHAVIOR_PATTERNS],
    // EvidenceFile["kind"] in src/lib/types.ts — no runtime constant exists.
    ["evidence kind", ["photo", "video", "document", "note"]],
    ["gateway record kind", ["safety_cell", "event_cell"]],
    ["gateway reject status", ["blocked", "resolved"]],
  ];

  it.each(enumCases)("schema defines a CHECK matching %s", (_label, values) => {
    expect(schemaHasExactSet(values)).toBe(true);
  });
});

describe("mock mode keeps deterministic counter ids after the newId() refactor", () => {
  // Live mode now generates real uuids (the ARC tables have uuid primary keys
  // and nextId()'s counter resets per cold start); mock mode must be unchanged
  // so fixtures and tests stay deterministic.
  it("createComment returns a cm-mock-* id", async () => {
    const cm = await createComment("cell_001", "id determinism probe", "u_sup");
    expect(cm).not.toBeNull();
    expect(cm!.id).toMatch(/^cm-mock-\d+$/);
  });

  it("createEvidence returns an ev-mock-* id", async () => {
    const ev = await createEvidence({ cell_id: "cell_001", kind: "note", name: "probe" }, "u_sup");
    expect(ev.id).toMatch(/^ev-mock-\d+$/);
  });
});
