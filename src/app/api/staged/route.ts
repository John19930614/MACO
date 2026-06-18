import { NextRequest, NextResponse } from "next/server";
import { getStaged, approveStaged, rejectStaged, getSessionUser } from "@/lib/data/repo";
import { withAuthz } from "@/lib/api/guard";
import { z } from "zod";

// GET /api/staged — gateway-validated records awaiting human review (not yet live).
export async function GET() {
  const staged = await getStaged();
  return NextResponse.json({ staged });
}

const schema = z.object({ id: z.string().min(1), action: z.enum(["approve", "reject"]) });

// PATCH /api/staged — a reviewer admits (approve) a staged record into the live
// Cell Database, or rejects it. Supervisor+ only (withAuthz → 403).
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  return withAuthz(async () => {
    const rec = parsed.data.action === "approve"
      ? await approveStaged(parsed.data.id, (await getSessionUser()).id)
      : await rejectStaged(parsed.data.id, (await getSessionUser()).id);
    if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, kind: rec.kind });
  });
}
