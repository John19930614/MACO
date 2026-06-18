import { NextRequest, NextResponse } from "next/server";
import { getSimilarOutcomes } from "@/lib/data/repo";

// GET /api/cells/[id]/outcomes — past Event Cells from situations resembling
// this cell ("what happened last time it looked like this"). Genome-based by
// default; live mode upgrades the ranking to event vector similarity.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const outcomes = await getSimilarOutcomes(id, 5);
  return NextResponse.json({ outcomes });
}
