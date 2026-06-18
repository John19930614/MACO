import { NextRequest, NextResponse } from "next/server";
import { getFindings, reviewFinding, getSessionUser } from "@/lib/data/repo";
import { z } from "zod";
import { REVIEW_STATUSES } from "@/lib/constants";
import { withAuthz } from "@/lib/api/guard";

// GET /api/ai/findings?cell_id= — list AI findings (pending + reviewed).
export async function GET(req: NextRequest) {
  const cellId = req.nextUrl.searchParams.get("cell_id") ?? undefined;
  const findings = await getFindings(cellId);
  return NextResponse.json({ findings });
}

const reviewSchema = z.object({ id: z.string().min(1), review_status: z.enum(REVIEW_STATUSES) });

// PATCH /api/ai/findings — accept / edit / reject a pending AI finding.
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.flatten() }, { status: 400 });
  }
  return withAuthz(async () => {
    const finding = await reviewFinding(parsed.data.id, parsed.data.review_status, (await getSessionUser()).id);
    if (!finding) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ finding });
  });
}
