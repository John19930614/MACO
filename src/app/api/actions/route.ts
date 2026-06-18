import { NextRequest, NextResponse } from "next/server";
import { getActions, createAction, updateAction, getSessionUser, AuthorizationError } from "@/lib/data/repo";
import { actionSchema } from "@/lib/schemas";
import { withAuthz } from "@/lib/api/guard";

// GET /api/actions?cell_id= — list corrective/preventive actions.
export async function GET(req: NextRequest) {
  const cellId = req.nextUrl.searchParams.get("cell_id") ?? undefined;
  const actions = await getActions(cellId);
  return NextResponse.json({ actions });
}

// POST /api/actions — create an action.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const action = await createAction(parsed.data, (await getSessionUser()).id);
    return NextResponse.json({ action }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: "forbidden", detail: e.message }, { status: 403 });
    throw e;
  }
}

// PATCH /api/actions — update status / closure.
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const { id, ...patch } = body;
  return withAuthz(async () => {
    const action = await updateAction(id, patch, (await getSessionUser()).id);
    if (!action) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ action });
  });
}
