import { NextResponse } from "next/server";
import { getProfiles } from "@/lib/data/repo";

// GET /api/profiles — users (for owner assignment dropdowns).
export async function GET() {
  const profiles = await getProfiles();
  return NextResponse.json({ profiles });
}
