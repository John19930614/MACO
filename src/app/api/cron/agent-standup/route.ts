import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serverSecrets } from "@/lib/env";
import { runStandup } from "@/lib/csp/standup";

/**
 * Daily GUS × EHS Validation Agent standup. Wired to a Vercel Cron (see
 * vercel.json) so the two agents "meet" once a day on their own clock and log
 * the gaps/action items they surface.
 *
 * Protected by CRON_SECRET (fail-closed), same contract as the P-CLSS cron.
 * Writes with the service-role key so it can persist the platform-level meeting
 * (csp_agent_meetings is superadmin-only under RLS; the service role bypasses it).
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
  const meeting = await runStandup(svc, { now: Date.now(), generatedBy: "daily-cron", enrich: true });
  return NextResponse.json({
    ok: !!meeting,
    date: meeting?.meeting_date ?? null,
    gaps: meeting?.gaps_found.length ?? 0,
    actions: meeting?.action_items.length ?? 0,
  });
}
