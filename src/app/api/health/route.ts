import { NextRequest, NextResponse } from "next/server";
import { runGatewayPipeline } from "@/lib/gateway/pipeline";
import { MOCK_MODE } from "@/lib/env";
import { getAuthUser } from "@/lib/supabase/server";

// GET /api/health — machine-readable AI Gateway report. Runs every gateway +
// final-review check over the live data and returns the full validation report.
// Suitable for an uptime monitor: HTTP 200 when overall is pass/warn, 503 when
// any hard check fails (a record would be blocked from the Cell Database).
//
// The full gateway pipeline is expensive, so it only runs for a trusted caller:
// a request carrying the CRON_SECRET (Authorization: Bearer / ?secret=), or an
// authenticated user. Everyone else gets a minimal `{ ok: true }` — still a
// usable liveness probe, but not an unauthenticated DoS amplifier.
async function isTrusted(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const provided = req.nextUrl.searchParams.get("secret");
    if (auth === `Bearer ${secret}` || provided === secret) return true;
  }
  // An authenticated app user may also run the full report.
  if (MOCK_MODE) return false;
  return (await getAuthUser()) !== null;
}

export async function GET(req: NextRequest) {
  if (!(await isTrusted(req))) {
    return NextResponse.json({ ok: true });
  }
  const report = await runGatewayPipeline();
  return NextResponse.json(report, { status: report.overall === "fail" ? 503 : 200 });
}
