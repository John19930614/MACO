import { NextResponse } from "next/server";
import { getVelaInsights } from "@/lib/data/repo";

// GET /api/arc/vela — VELA cross-vertical master-intelligence insights.
export async function GET() {
  const insights = await getVelaInsights();
  return NextResponse.json({ insights });
}
