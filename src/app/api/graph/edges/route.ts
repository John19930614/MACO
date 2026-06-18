import { NextRequest, NextResponse } from "next/server";
import { createEdge, reviewEdge, getSessionUser } from "@/lib/data/repo";
import { causalEdgeSchema, edgeReviewSchema } from "@/lib/schemas";
import { withAuthz } from "@/lib/api/guard";

// POST /api/graph/edges — create a manual (human-authored) causal edge.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = causalEdgeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.flatten() }, { status: 400 });
  }
  return withAuthz(async () => {
    const edge = await createEdge(parsed.data, (await getSessionUser()).id, false);
    return NextResponse.json({ edge }, { status: 201 });
  });
}

// PATCH /api/graph/edges — accept, reject, or edit a (usually AI-proposed) edge.
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = edgeReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { id, review_status, type, rationale } = parsed.data;
  return withAuthz(async () => {
    const edge = await reviewEdge(id, review_status, (await getSessionUser()).id, { type, rationale });
    if (!edge) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ edge });
  });
}
