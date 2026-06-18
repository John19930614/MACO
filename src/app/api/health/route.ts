import { NextResponse } from "next/server";
import { runGatewayPipeline } from "@/lib/gateway/pipeline";

// GET /api/health — machine-readable AI Gateway report. Runs every gateway +
// final-review check over the live data and returns the full validation report.
// Suitable for an uptime monitor: HTTP 200 when overall is pass/warn, 503 when
// any hard check fails (a record would be blocked from the Cell Database).
export async function GET() {
  const report = await runGatewayPipeline();
  return NextResponse.json(report, { status: report.overall === "fail" ? 503 : 200 });
}
