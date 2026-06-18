import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  SEVERITIES,
  CELL_STATUSES,
  PROOF_STATUSES,
  EDGE_TYPES,
  REVIEW_STATUSES,
  ROLES,
} from "@/lib/constants";
import { HSL_DIMENSIONS } from "@/lib/arc/arc";

/**
 * Schema ↔ code consistency. The migration SQL's CHECK constraints are the
 * database's source of truth; the constants in src/lib are the app's. If they
 * drift, a real-database cutover breaks (inserts rejected, filters silently
 * empty). This test reads the actual migration file and proves every runtime
 * enum is backed by an identical CHECK list in the DB schema.
 *
 * This runs in mock mode but validates the LIVE schema — closing the biggest
 * gap between "works on fixtures" and "works on Postgres".
 */
const sql = readFileSync(
  fileURLToPath(new URL("../supabase/migrations/0001_init.sql", import.meta.url)),
  "utf8",
);

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

function key(values: readonly string[]): string {
  return [...values].sort().join("|");
}

/** True if the SQL contains a CHECK list exactly equal to `values`. */
function schemaHasExactSet(values: readonly string[]): boolean {
  const target = key(values);
  return checkSets.some((s) => key([...s]) === target);
}

describe("migration SQL is consistent with app constants", () => {
  const cases: [string, readonly string[]][] = [
    ["severity", SEVERITIES],
    ["cell status", CELL_STATUSES],
    ["control proof status", PROOF_STATUSES],
    ["causal edge type", EDGE_TYPES],
    ["review status", REVIEW_STATUSES],
    ["roles", ROLES],
    ["HSL dimensions", HSL_DIMENSIONS.map((d) => d.key)],
  ];

  it.each(cases)("schema defines a CHECK matching %s", (_label, values) => {
    expect(schemaHasExactSet(values)).toBe(true);
  });

  it("found a reasonable number of CHECK lists (sanity)", () => {
    expect(checkSets.length).toBeGreaterThanOrEqual(7);
  });

  it("RLS migration enables row level security on the core tables", () => {
    const rls = readFileSync(
      fileURLToPath(new URL("../supabase/migrations/0002_rls.sql", import.meta.url)),
      "utf8",
    );
    for (const table of ["safety_cells", "control_proofs", "causal_edges", "ai_findings", "actions", "audit_log"]) {
      expect(rls).toMatch(new RegExp(`alter table\\s+${table}\\s+enable row level security`, "i"));
    }
  });
});

describe("multi-tenancy is wired into the schema", () => {
  it("init migration creates the tenants table and tenant_id columns", () => {
    expect(sql).toMatch(/create table if not exists tenants/i);
    for (const tbl of ["safety_cells", "control_proofs", "causal_edges", "ai_findings", "actions", "hsl_signals", "exp_captures", "pclss_runs"]) {
      expect(sql).toMatch(new RegExp(`alter table\\s+${tbl}\\s+add column if not exists tenant_id`, "i"));
    }
  });

  it("RLS defines tenant-isolation helpers and applies them to policies", () => {
    const rls = readFileSync(
      fileURLToPath(new URL("../supabase/migrations/0002_rls.sql", import.meta.url)),
      "utf8",
    );
    expect(rls).toMatch(/function current_tenant_id/i);
    expect(rls).toMatch(/function in_tenant/i);
    // tenant-scoped read policies must actually use the helper
    expect(rls).toMatch(/in_tenant\(tenant_id\)/i);
    // VELA stays cross-tenant
    expect(rls).toMatch(/read_vela on vela_insights/i);
  });
});

describe("pgvector embeddings migration", () => {
  const emb = readFileSync(
    fileURLToPath(new URL("../supabase/migrations/0003_embeddings.sql", import.meta.url)),
    "utf8",
  );
  it("enables vector, defines cell_embeddings and the match_cells function", () => {
    expect(emb).toMatch(/create extension if not exists vector/i);
    expect(emb).toMatch(/create table if not exists cell_embeddings/i);
    expect(emb).toMatch(/embedding\s+vector\(1536\)/i);
    expect(emb).toMatch(/function match_cells/i);
    expect(emb).toMatch(/where e\.tenant_id = match_tenant/i); // tenant-scoped search
  });
});
