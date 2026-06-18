import { NextRequest, NextResponse } from "next/server";
import { extractCellDraftSmart } from "@/lib/ai/extract-llm";
import { z } from "zod";

const schema = z.object({ text: z.string().min(8, "Describe the observation in a sentence or two") });

// POST /api/ai/extract-cell — EXP "Convert": free text/transcript → draft cell.
// Uses the live LLM when configured, falling back to the deterministic
// heuristic in mock mode or on any model error. Output is a DRAFT only.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.flatten() }, { status: 400 });
  }
  const result = await extractCellDraftSmart(parsed.data.text);
  return NextResponse.json({ result });
}
