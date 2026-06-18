import { NextRequest, NextResponse } from "next/server";
import { getHslReadings } from "@/lib/data/repo";

// GET /api/arc/hsl — Human Signal Layer readings (the six dimensions).
export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get("site_id") ?? undefined;
  const readings = await getHslReadings(siteId);
  return NextResponse.json({ readings });
}
