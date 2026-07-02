import { NextRequest, NextResponse } from "next/server";
import { requireSuperadmin, opsServiceClient } from "@/lib/ops/auth";
import { runGatewayPipeline } from "@/lib/gateway/pipeline";

// GET /api/ops — read-only live signals for the internal Ops Console
// (SafetyIQ-Admin-Console.html). Superadmin-only. Returns a single bundle;
// every section fails soft (null + reason) so one failure never blanks the page.
//
// Auth: the operator's own Supabase JWT (Authorization: Bearer <jwt>), or
// CRON_SECRET for a CLI/uptime probe. See src/lib/ops/auth.ts.

const CORS: Record<string, string> = {
  // Bearer-token auth (not cookies) → wildcard origin is safe; no credentials.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Cache-Control": "no-store",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const auth = await requireSuperadmin(req);
  if (!auth.ok) {
    const headers: Record<string, string> =
      auth.retryAfterSeconds !== undefined
        ? { ...CORS, "Retry-After": String(auth.retryAfterSeconds) }
        : CORS;
    return NextResponse.json({ error: auth.reason }, { status: auth.status, headers });
  }

  const out: {
    generatedAt: string;
    via: string;
    health: { overall: string } | null;
    migrations: { count: number; latest: string | null; applied: { version: string; name: string }[] } | null;
    gate: Record<string, unknown> | null;
    rls: Record<string, unknown> | null;
  } = { generatedAt: new Date().toISOString(), via: auth.via, health: null, migrations: null, gate: null, rls: null };

  // health — same gateway pipeline /api/health runs
  try {
    const report = await runGatewayPipeline();
    out.health = { overall: report.overall };
  } catch {
    out.health = null;
  }

  const svc = opsServiceClient();

  // migrations — applied list via the service-role-only SECURITY DEFINER reader
  if (svc) {
    try {
      const { data } = await svc.rpc("ops_migrations");
      const rows = (data as { version: string; name: string }[] | null) || [];
      out.migrations = { count: rows.length, latest: rows.length ? rows[rows.length - 1].name : null, applied: rows };
    } catch {
      out.migrations = null;
    }

    // gate + rls — latest CI-written row from ops_gate_status
    try {
      const { data } = await svc
        .from("ops_gate_status")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);
      const g = data?.[0];
      if (g) {
        out.gate = { typecheck: g.typecheck, build: g.build, test: g.test, system: g.system, sha: g.sha, branch: g.branch, at: g.created_at, source: g.source };
        out.rls = { tenancy: g.tenancy, live: g.live, at: g.created_at };
      }
    } catch {
      /* ops_gate_status not present yet (F3 migration unapplied) → leave null */
    }
  }

  return NextResponse.json(out, { headers: CORS });
}
