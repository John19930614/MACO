import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serverSecrets } from "@/lib/env";
import { runGatewayHealthCheck } from "@/lib/gateway/agent";

/**
 * Daily AI Gateway Agent health check. Wired to a Vercel Cron (see vercel.json)
 * so the agent monitors the gateway on its own clock and logs a snapshot per
 * tenant for trend history.
 *
 * Protected by CRON_SECRET (fail-closed). Uses the service-role key to read each
 * tenant's gateway dataset and persist the snapshot (gateway_agent_health_log is
 * admin-only under RLS; the service role bypasses it).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const auth = req.headers.get("authorization");
  const provided = req.nextUrl.searchParams.get("secret");
  if (auth !== `Bearer ${secret}` && provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { serviceRoleKey } = serverSecrets();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !url) {
    return NextResponse.json({ error: "service role key not configured" }, { status: 503 });
  }

  const svc = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { data: tenants } = await svc.from("tenants").select("id, name");

  const results: { tenant: string; status: string; findings: number }[] = [];
  for (const t of tenants ?? []) {
    try {
      const snap = await runGatewayHealthCheck({ persist: true, generatedBy: "daily-cron", client: svc, tenantId: t.id });
      results.push({ tenant: t.name ?? t.id, status: snap.overall_status, findings: snap.findings.length });
    } catch {
      results.push({ tenant: t.name ?? t.id, status: "error", findings: 0 });
    }
  }

  return NextResponse.json({ ok: true, tenants_checked: results.length, results });
}
