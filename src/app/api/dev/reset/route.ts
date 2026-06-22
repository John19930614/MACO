import { NextResponse } from "next/server";
import { MOCK_MODE } from "@/lib/env";
import { resetStore } from "@/lib/data/store";

// POST /api/dev/reset — wipe and re-seed the in-memory mock store.
// Only active in MOCK_MODE; returns 404 in production.
export async function POST() {
  if (!MOCK_MODE) {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }
  resetStore();
  return NextResponse.json({ ok: true, message: "Demo data reset to initial state." });
}
