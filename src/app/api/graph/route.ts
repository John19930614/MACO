import { NextRequest, NextResponse } from "next/server";
import { getCells, getEdges } from "@/lib/data/repo";

// GET /api/graph — nodes (cells) + edges for the causality view (manual §5.11).
export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get("site_id") ?? undefined;
  const [cells, edges] = await Promise.all([getCells({ site_id: siteId }), getEdges(siteId)]);
  return NextResponse.json({ nodes: cells, edges });
}
