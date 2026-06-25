import { NextRequest, NextResponse } from "next/server";
import { analyzeCellSchema } from "@/lib/schemas";
import { getCell, getCells, getEdges, saveFinding, createEdge, getSessionUser } from "@/lib/data/repo";
import { withAuthz } from "@/lib/api/guard";
import { analyzeCell } from "@/lib/ai/engine";
import { EDGE_TYPES, type EdgeType } from "@/lib/constants";

const MAX_AI_EDGES = 5;

/**
 * POST /api/ai/analyze-cell — run the Arc Causality Engine for one cell.
 * The finding is stored as PENDING and never mutates official records. Any
 * suggested causal edges are created as pending, AI-generated edges so a human
 * must accept them before they become part of the official safety record.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = analyzeCellSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.flatten() }, { status: 400 });
  }

  return withAuthz(async () => {
  // Resolve the user up front so an unauthenticated request 403s before any
  // analysis runs or a finding is saved.
  const user = (await getSessionUser()).id;

  const cell = await getCell(parsed.data.cell_id);
  if (!cell) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const sameSite = (await getCells({ site_id: cell.site_id })).filter((c) => c.id !== cell.id);
  const finding = await analyzeCell(cell, sameSite);
  await saveFinding(finding);

  const output = finding.output as { suggested_edges?: { target_cell_id: string; type: string; confidence: number; rationale: string }[] };

  // Trust boundary: the model's suggested edges are untrusted input. Only
  // materialize an edge when its target is a real cell in scope, the type is a
  // known edge type, it is not a self-edge, and it doesn't already exist. This
  // prevents a hallucinated target_cell_id from creating a dangling edge.
  const validTargets = new Set(sameSite.map((c) => c.id));
  const existing = new Set((await getEdges(cell.site_id)).map((e) => [e.source_cell_id, e.target_cell_id].sort().join("|")));
  const seen = new Set<string>();
  const createdEdges = [];
  const skipped: { target_cell_id: string; reason: string }[] = [];

  for (const e of output.suggested_edges ?? []) {
    const pairKey = [cell.id, e.target_cell_id].sort().join("|");
    let reason: string | null = null;
    if (e.target_cell_id === cell.id) reason = "self_edge";
    else if (!validTargets.has(e.target_cell_id)) reason = "unknown_or_out_of_scope_target";
    else if (!EDGE_TYPES.includes(e.type as EdgeType)) reason = "unknown_edge_type";
    else if (existing.has(pairKey) || seen.has(pairKey)) reason = "duplicate";
    else if (createdEdges.length >= MAX_AI_EDGES) reason = "edge_cap_reached";

    if (reason) {
      skipped.push({ target_cell_id: e.target_cell_id, reason });
      continue;
    }
    seen.add(pairKey);
    createdEdges.push(
      await createEdge(
        { source_cell_id: cell.id, target_cell_id: e.target_cell_id, type: e.type as EdgeType, confidence: Math.max(0, Math.min(1, e.confidence)), rationale: e.rationale },
        user,
        true,
      ),
    );
  }

  return NextResponse.json({ finding, suggested_edges: createdEdges, skipped_edges: skipped }, { status: 201 });
  });
}
