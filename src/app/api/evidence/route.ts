import { NextRequest, NextResponse } from "next/server";
import { createEvidence, getSessionUser } from "@/lib/data/repo";
import { evidenceSchema } from "@/lib/schemas";
import { withAuthz } from "@/lib/api/guard";

// POST /api/evidence — create metadata record (signed upload is wired in live mode).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = evidenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.flatten() }, { status: 400 });
  }
  return withAuthz(async () => {
    const file = await createEvidence(parsed.data, (await getSessionUser()).id);
    return NextResponse.json({ evidence: file }, { status: 201 });
  });
}
