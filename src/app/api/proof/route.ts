import { NextRequest, NextResponse } from "next/server";
import { updateProofStatus, getSessionUser } from "@/lib/data/repo";
import { proofUpdateSchema } from "@/lib/schemas";
import { withAuthz } from "@/lib/api/guard";

// PATCH /api/proof — change a control proof status. Only supervisors+ in live
// mode; the change is always recorded in the audit log (manual §5.9, §8.2).
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = proofUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { id, status, evidence_summary, expires_at, reason } = parsed.data;
  return withAuthz(async () => {
    const proof = await updateProofStatus(id, status, (await getSessionUser()).id, { evidence_summary, expires_at, reason });
    if (!proof) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ proof });
  });
}
