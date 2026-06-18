import { NextRequest, NextResponse } from "next/server";
import { getCells, createCell, getSessionUser, AuthorizationError, GatewayRejectionError, type CellFilter } from "@/lib/data/repo";
import { safetyCellSchema } from "@/lib/schemas";
import { MOCK_MODE, serverSecrets } from "@/lib/env";
import { z } from "zod";

// Carried photo/evidence metadata, validated so untrusted client input can't
// flow into createEvidence on approval. Invalid evidence is simply dropped.
const evidenceArraySchema = z.array(
  z.object({ kind: z.enum(["photo", "document", "permit", "note", "sensor", "form"]), name: z.string().min(1), summary: z.string().optional() }),
);

// GET /api/cells — list Safety Cells for map filters (manual Appendix A).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const filter: CellFilter = {
    site_id: sp.get("site_id") ?? undefined,
    status: sp.get("status") ?? undefined,
    severity: sp.get("severity") ?? undefined,
    task: sp.get("task") ?? undefined,
    owner_id: sp.get("owner_id") ?? undefined,
  };
  const cells = await getCells(filter);
  return NextResponse.json({ cells });
}

// POST /api/cells — create a Safety Cell.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = safetyCellSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.flatten() }, { status: 400 });
  }
  const ev = evidenceArraySchema.safeParse((body as { evidence?: unknown })?.evidence);
  const evidence = ev.success ? ev.data : undefined;
  let cell;
  try {
    cell = await createCell(parsed.data, (await getSessionUser()).id, { evidence });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: "forbidden", detail: e.message }, { status: 403 });
    if (e instanceof GatewayRejectionError) return NextResponse.json({ error: "rejected", rejections: e.rejections }, { status: 422 });
    throw e;
  }

  // Generate the semantic embedding in live mode (best-effort; never blocks the
  // create on an embedding failure).
  if (!MOCK_MODE && serverSecrets().openaiKey) {
    try {
      const { embedAndStoreCell } = await import("@/lib/ai/embeddings");
      await embedAndStoreCell(cell);
    } catch {
      /* embedding is non-critical */
    }
  }

  // Every create is held for human review (staged), in both mock and live mode.
  return NextResponse.json({ cell, pending: true }, { status: 201 });
}
