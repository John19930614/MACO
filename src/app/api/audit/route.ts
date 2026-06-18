import { NextResponse } from "next/server";
import { getAudit, getProfiles } from "@/lib/data/repo";

// GET /api/audit — activity/audit feed with actor display names.
export async function GET() {
  const [entries, profiles] = await Promise.all([getAudit(), getProfiles()]);
  const name = (uid: string | null) => (uid ? profiles.find((p) => p.id === uid)?.display_name ?? "System" : "System");
  return NextResponse.json({ entries: entries.map((e) => ({ ...e, actor_name: name(e.actor_id) })) });
}
