import { NextRequest, NextResponse } from "next/server";
import { getBundle, updateCell, getSessionUser } from "@/lib/data/repo";
import { withAuthz } from "@/lib/api/guard";

// GET /api/cells/[id] — full bundle (cell + proofs + evidence + findings + actions).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getBundle(id);
  if (!bundle) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ bundle });
}

// PATCH /api/cells/[id] — update a Safety Cell.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patch = await req.json().catch(() => ({}));
  return withAuthz(async () => {
    const cell = await updateCell(id, patch, (await getSessionUser()).id);
    if (!cell) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ cell });
  });
}
