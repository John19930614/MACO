import { NextRequest, NextResponse } from "next/server";
import { runPclssForAllSites } from "@/lib/arc/pclss-engine";

/**
 * Scheduled P-CLSS run. Wired to a Vercel Cron (see vercel.json) so the
 * proactive engine runs on its own clock — the "always running" part of the
 * Adaptive Risk Continuum, not just a manual button.
 *
 * Protected by CRON_SECRET: Vercel sends `Authorization: Bearer <CRON_SECRET>`
 * when that env var is set. If CRON_SECRET is unset (local/dev) the route is
 * open so you can curl it.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const results = await runPclssForAllSites();
  return NextResponse.json({
    ran: results.length,
    queued: results.reduce((n, r) => n + r.findings.length, 0),
    signals: results.reduce((n, r) => n + r.signalsFound, 0),
  });
}
