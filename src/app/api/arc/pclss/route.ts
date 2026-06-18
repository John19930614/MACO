import { NextRequest, NextResponse } from "next/server";
import { getPclssRuns } from "@/lib/data/repo";
import { runPclss } from "@/lib/arc/pclss-engine";

// GET /api/arc/pclss — Proactive Continuous Learning Safety System run log.
export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get("site_id") ?? undefined;
  const runs = await getPclssRuns(siteId);
  return NextResponse.json({ runs });
}

// POST /api/arc/pclss — trigger a proactive run now. Scans open cells + proof
// gaps and queues pending pre-emptive findings for human review.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const siteId = body?.site_id as string | undefined;
  const result = await runPclss(siteId);
  return NextResponse.json(
    { run: result.run, queued: result.findings.length, signals: result.signalsFound },
    { status: 201 },
  );
}
