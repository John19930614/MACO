/**
 * Platform Review — live signals (server-only).
 *
 * Everything here is computed fresh per request so "Run review" is a real
 * health check, not a re-read of a static catalog:
 *   • gate       — the latest CI-written ops_gate_status row (real typecheck/
 *                  test/build/system-test results for a commit).
 *   • migrations — the build-time local migration manifest diffed against what
 *                  prod actually has applied (ops_migrations() reader), with
 *                  schema probes for hand-applied migrations that left no
 *                  history record.
 *   • rls        — dev_rls_status() probe: every public table must have RLS.
 *   • findings   — open rows from dev_review_findings, written by the automated
 *                  review pipeline (codified scans + the Claude review pass).
 *
 * Every reader degrades to null/[] on any failure (mock mode, missing table or
 * function before the migration is applied, network) so the review page always
 * renders.
 */
import "server-only";
import { MOCK_MODE } from "@/lib/env";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { LOCAL_MIGRATIONS, SCHEMA_PROBES } from "./migrationManifest.generated";
import type {
  ReviewFinding,
  GateSignal,
  MigrationsSignal,
  RlsSignal,
} from "./platform-review";
import { getFindingById, buildLiveFindings } from "./platform-review";

// ── CI gate (Build & Type Health) ─────────────────────────────────────────────

export async function getGateSignal(): Promise<GateSignal | null> {
  if (MOCK_MODE) return null;
  const client = createServiceRoleClient();
  if (!client) return null;
  try {
    const { data } = await client
      .from("ops_gate_status")
      .select("typecheck, test, build, system, sha, branch, created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    const g = data?.[0];
    if (!g) return null;
    return {
      typecheck: g.typecheck, test: g.test, build: g.build, system: g.system,
      sha: g.sha, branch: g.branch, at: g.created_at,
    };
  } catch {
    return null;
  }
}

// ── Migration drift (DB & Migration Integrity) ────────────────────────────────

export async function getMigrationsSignal(): Promise<MigrationsSignal | null> {
  if (MOCK_MODE) return null;
  const client = createServiceRoleClient();
  if (!client) return null;
  try {
    const { data } = await client.rpc("ops_migrations");
    const rows = (data as { version: string; name: string }[] | null) ?? [];
    if (!rows.length) return null; // reader unavailable ≠ nothing applied
    const prodNames = new Set(rows.map((r) => r.name));

    const pending: MigrationsSignal["pending"] = [];
    let probedApplied = 0;
    for (const m of LOCAL_MIGRATIONS) {
      if (prodNames.has(m.prodName)) continue;
      // No history record — probe the live schema for hand-applied migrations.
      const probe = SCHEMA_PROBES[m.name];
      if (probe) {
        const q = client
          .from(probe.table)
          .select(probe.kind === "column" ? probe.column! : "*", { head: true, count: "exact" })
          .limit(0);
        const { error } = await q;
        if (!error) {
          probedApplied++;
          continue;
        }
      }
      pending.push({ filename: m.filename, name: m.name });
    }
    return {
      localCount: LOCAL_MIGRATIONS.length,
      appliedCount: LOCAL_MIGRATIONS.length - pending.length,
      probedApplied,
      pending,
    };
  } catch {
    return null;
  }
}

// ── RLS coverage (Security & Tenant Isolation) ────────────────────────────────

export async function getRlsSignal(): Promise<RlsSignal | null> {
  if (MOCK_MODE) return null;
  const client = createServiceRoleClient();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc("dev_rls_status");
    if (error || !data) return null; // function absent until the migration lands
    const rows = data as { table_name: string; rls_enabled: boolean }[];
    return {
      total: rows.length,
      disabled: rows.filter((r) => !r.rls_enabled).map((r) => r.table_name),
    };
  } catch {
    return null;
  }
}

// ── Pipeline findings (dev_review_findings) ───────────────────────────────────

interface DbFindingRow {
  finding_key: string;
  check_key: ReviewFinding["check"];
  title: string;
  detail: string;
  recommendation: string;
  severity: ReviewFinding["severity"];
  source: "scan" | "ai";
  module: string;
  who_uses_it: string | null;
  priority: ReviewFinding["priority"];
  risk_level: ReviewFinding["risk_level"];
  effort: ReviewFinding["effort"];
  where_hint: string | null;
  success_criteria: string;
}

function mapDbFinding(row: DbFindingRow): ReviewFinding {
  return {
    id: row.finding_key,
    check: row.check_key,
    title: row.title,
    detail: row.detail,
    recommendation: row.recommendation,
    severity: row.severity,
    source: row.source,
    module: row.module,
    who_uses_it: row.who_uses_it ?? undefined,
    priority: row.priority,
    risk_level: row.risk_level,
    effort: row.effort,
    where: row.where_hint ?? undefined,
    success_criteria: row.success_criteria,
  };
}

/** Open findings written by the automated review pipeline (newest first). */
export async function getPipelineFindings(): Promise<ReviewFinding[]> {
  if (MOCK_MODE) return [];
  const client = createServiceRoleClient();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from("dev_review_findings")
      .select("*")
      .eq("status", "open")
      .order("last_seen_at", { ascending: false });
    if (error || !data) return []; // table absent until the migration lands
    return (data as DbFindingRow[]).map(mapDbFinding);
  } catch {
    return [];
  }
}

/** When the pipeline last wrote anything (open or resolved) — shown in the UI. */
export async function getLastPipelineRunAt(): Promise<string | null> {
  if (MOCK_MODE) return null;
  const client = createServiceRoleClient();
  if (!client) return null;
  try {
    const { data } = await client
      .from("dev_review_findings")
      .select("last_seen_at")
      .order("last_seen_at", { ascending: false })
      .limit(1);
    return (data?.[0]?.last_seen_at as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve a finding id from ANY source — curated catalog, pipeline table, or a
 * live-synthesized finding — for task prefill and dismissal. Async because the
 * non-curated sources live in the database / live signals.
 */
export async function findReviewFinding(id: string): Promise<ReviewFinding | undefined> {
  const curated = getFindingById(id);
  if (curated) return curated;

  if (id.startsWith("live-")) {
    const [migrations, rls] = await Promise.all([getMigrationsSignal(), getRlsSignal()]);
    return buildLiveFindings(migrations, rls).find((f) => f.id === id);
  }

  if (MOCK_MODE) return undefined;
  const client = createServiceRoleClient();
  if (!client) return undefined;
  try {
    const { data } = await client
      .from("dev_review_findings")
      .select("*")
      .eq("finding_key", id)
      .maybeSingle();
    return data ? mapDbFinding(data as DbFindingRow) : undefined;
  } catch {
    return undefined;
  }
}
