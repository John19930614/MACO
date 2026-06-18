import { NextRequest, NextResponse } from "next/server";
import { revalidateReject, dismissReject, getSessionUser } from "@/lib/data/repo";
import { withAuthz } from "@/lib/api/guard";
import { z } from "zod";

const schema = z.object({ id: z.string().min(1), action: z.enum(["revalidate", "dismiss"]) });

// PATCH /api/gateway/rejects — steward action on a blocked record: re-run the
// gateway over its stored payload (and write it if it now admits), or dismiss it.
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });

  return withAuthz(async () => {
    if (parsed.data.action === "dismiss") {
      const r = await dismissReject(parsed.data.id);
      if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ ok: true, resolved: true });
    }
    const res = await revalidateReject(parsed.data.id, (await getSessionUser()).id);
    if (!res) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(res);
  });
}
