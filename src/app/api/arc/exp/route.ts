import { NextRequest, NextResponse } from "next/server";
import { getExpCaptures, createExpCapture, getSessionUser } from "@/lib/data/repo";
import { z } from "zod";
import { withAuthz } from "@/lib/api/guard";

// GET /api/arc/exp — EXP knowledge-ghost captures.
export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get("site_id") ?? undefined;
  const captures = await getExpCaptures(siteId);
  return NextResponse.json({ captures });
}

const schema = z.object({
  site_id: z.string().min(1),
  source: z.enum(["interview", "walk_floor", "incident_debrief", "manual"]),
  subject: z.string().min(1),
  summary: z.string().min(1),
  hazard_memory: z
    .object({
      energySource: z.string(),
      exposureType: z.string(),
      trigger: z.string(),
      controlGap: z.string(),
      environment: z.string().optional(),
    })
    .nullable()
    .optional(),
});

// POST /api/arc/exp — log an experience capture (knowledge ghost).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.flatten() }, { status: 400 });
  }
  return withAuthz(async () => {
    const capture = await createExpCapture(parsed.data, (await getSessionUser()).id);
    return NextResponse.json({ capture }, { status: 201 });
  });
}
