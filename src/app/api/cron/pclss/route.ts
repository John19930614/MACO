import { NextRequest, NextResponse } from "next/server";
import { runPclssForAllSites } from "@/lib/arc/pclss-engine";

/**
 * Scheduled P-CLSS run. Wired to a Vercel Cron (see vercel.json) so the
 * proactive engine runs on its own clock — the "always running" part of the
 * Adaptive Risk Continuum, not just a manual button.
 *
 * Protected by CRON_SECRET (fail-closed): Vercel sends
 * `Authorization: Bearer <CRON_SECRET>`. The pipeline runs ONLY when CRON_SECRET
 * is set AND the request presents the matching secret (Authorization header or
 * `?secret=` query param). If CRON_SECRET is unset, or the provided secret does
 * not match, the route returns 401 and does not run the engine.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const auth = req.headers.get("authorization");
  const provided = req.nextUrl.searchParams.get("secret");
  if (auth !== `Bearer ${secret}` && provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await runPclssForAllSites();
  return NextResponse.json({
    ran: results.length,
    queued: results.reduce((n, r) => n + r.findings.length, 0),
    signals: results.reduce((n, r) => n + r.signalsFound, 0),
  });
}
