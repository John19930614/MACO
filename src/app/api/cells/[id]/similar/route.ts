import { NextRequest, NextResponse } from "next/server";
import { getSimilarCells, getCell, getCells } from "@/lib/data/repo";
import { MOCK_MODE, serverSecrets } from "@/lib/env";

// GET /api/cells/[id]/similar — EXP knowledge ghost. In live mode with an
// OpenAI key this uses real pgvector semantic similarity (match_cells); other-
// wise it falls back to the deterministic hazard-genome score.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!MOCK_MODE && serverSecrets().openaiKey) {
    try {
      const cell = await getCell(id);
      if (cell) {
        const { getSimilarCellIdsByVector } = await import("@/lib/ai/embeddings");
        const hits = await getSimilarCellIdsByVector(cell, 5);
        const byId = new Map((await getCells()).map((c) => [c.id, c]));
        const similar = hits
          .map((h) => ({ cell: byId.get(h.cell_id), score: h.similarity, reasons: ["semantic (pgvector) match"] }))
          .filter((h) => h.cell);
        return NextResponse.json({ similar, mode: "pgvector" });
      }
    } catch {
      // fall through to genome-based similarity
    }
  }

  const similar = await getSimilarCells(id, 5);
  return NextResponse.json({ similar, mode: "genome" });
}
