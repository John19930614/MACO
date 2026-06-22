"use client";

import { useMemo } from "react";
import { ReactFlow, Background, Controls, Handle, Position, type Node, type Edge, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SafetyCell, CausalEdge } from "@/lib/types";
import type { PreventionWebModel } from "@/lib/arc/prevention";
import { SEVERITY_META, EDGE_META, type EdgeType } from "@/lib/constants";

type PData =
  | { variant: "gap"; gap: string; count: number }
  | { variant: "cell"; cell: SafetyCell }
  | { variant: "prev"; label: string; kind: "action" | "recommendation"; status: string };

const GAP_COLOR = "#ef4444";
const PREV_COLOR = "#22c55e";

function PNode({ data }: NodeProps) {
  const d = data as unknown as PData;
  const handles = (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </>
  );
  if (d.variant === "gap") {
    return (
      <div className="w-36 rounded-lg border bg-slate-900 px-2 py-1.5 shadow" style={{ borderColor: GAP_COLOR, borderLeftWidth: 4 }}>
        {handles}
        <div className="font-mono text-[9px] font-semibold" style={{ color: GAP_COLOR }}>CONTROL GAP</div>
        <div className="text-sm font-bold capitalize text-white">{d.gap.replace(/_/g, " ")}</div>
        <div className="text-[10px] text-slate-500">{d.count} cell{d.count === 1 ? "" : "s"}</div>
      </div>
    );
  }
  if (d.variant === "cell") {
    const m = SEVERITY_META[d.cell.severity as keyof typeof SEVERITY_META];
    return (
      <div className="w-52 rounded-lg border bg-slate-900 px-2 py-1.5 shadow" style={{ borderColor: m?.color ?? "#64748b", borderLeftWidth: 4 }}>
        {handles}
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: m?.color ?? "#64748b" }} />
          <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{d.cell.severity} · {d.cell.status.replace(/_/g, " ")}</span>
        </div>
        <div className="line-clamp-2 text-xs font-semibold text-white">{d.cell.title}</div>
        <div className="text-[10px] text-slate-500">risk {d.cell.risk_score}</div>
      </div>
    );
  }
  return (
    <div className="w-52 rounded-lg border bg-slate-900 px-2 py-1.5 shadow" style={{ borderColor: PREV_COLOR, borderLeftWidth: 4, borderStyle: "solid" }}>
      {handles}
      <div className="font-mono text-[9px] font-semibold" style={{ color: PREV_COLOR }}>
        {d.kind === "action" ? "ACTION" : "AI COUNTERFACTUAL"} · {d.status}
      </div>
      <div className="line-clamp-2 text-xs font-medium text-white">{d.label}</div>
    </div>
  );
}

const nodeTypes = { p: PNode };
const COL = { gap: 0, cell: 360, prev: 760 };
const ROW = 110;

export function PreventionWebView({ cells, edges, model }: { cells: SafetyCell[]; edges: CausalEdge[]; model: PreventionWebModel }) {
  const cellById = useMemo(() => new Map(cells.map((c) => [c.id, c])), [cells]);

  const { rfNodes, rfEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const rfEdges: Edge[] = [];
    const cellY = new Map<string, number>();
    let yCursor = 0;

    for (const cluster of model.clusters) {
      const memberCells = cluster.cell_ids.map((id) => cellById.get(id)).filter(Boolean) as SafetyCell[];
      if (memberCells.length === 0) continue;
      const startY = yCursor;
      memberCells.forEach((c, i) => {
        const y = startY + i * ROW;
        cellY.set(c.id, y);
        nodes.push({ id: c.id, type: "p", position: { x: COL.cell, y }, data: { variant: "cell", cell: c } as unknown as Record<string, unknown> });
      });
      const gapY = startY + ((memberCells.length - 1) * ROW) / 2;
      const gapId = `gap_${cluster.gap}`;
      nodes.push({ id: gapId, type: "p", position: { x: COL.gap, y: gapY }, data: { variant: "gap", gap: cluster.gap, count: memberCells.length } as unknown as Record<string, unknown> });
      for (const c of memberCells) {
        rfEdges.push({ id: `cl-${gapId}-${c.id}`, source: gapId, target: c.id, style: { stroke: "#334155", strokeWidth: 1.5 } });
      }
      yCursor = startY + memberCells.length * ROW + 48;
    }

    for (const e of edges) {
      if (!cellById.has(e.source_cell_id) || !cellById.has(e.target_cell_id)) continue;
      if (e.review_status === "rejected") continue;
      const pending = e.ai_generated && e.review_status === "pending";
      rfEdges.push({
        id: `cz-${e.id}`,
        source: e.source_cell_id,
        target: e.target_cell_id,
        label: EDGE_META[e.type as EdgeType]?.label,
        animated: pending,
        style: { stroke: EDGE_META[e.type as EdgeType]?.color ?? "#888", strokeWidth: 2, strokeDasharray: pending ? "6 4" : undefined },
        labelStyle: { fontSize: 9, fill: "#94a3b8" },
      });
    }

    const byCell = new Map<string, typeof model.preventions>();
    for (const p of model.preventions) {
      const arr = byCell.get(p.cell_id);
      if (arr) arr.push(p);
      else byCell.set(p.cell_id, [p]);
    }
    for (const [cid, items] of byCell) {
      const base = cellY.get(cid);
      if (base === undefined) continue;
      items.forEach((p, i) => {
        const y = base + (i - (items.length - 1) / 2) * 60;
        nodes.push({ id: p.id, type: "p", position: { x: COL.prev, y }, data: { variant: "prev", label: p.label, kind: p.kind, status: p.status } as unknown as Record<string, unknown> });
        rfEdges.push({ id: `pe-${p.id}`, source: cid, target: p.id, style: { stroke: PREV_COLOR, strokeWidth: 1.5 } });
      });
    }

    return { rfNodes: nodes, rfEdges };
  }, [cells, edges, model, cellById]);

  return (
    <div className="relative h-full w-full">
      <ReactFlow nodes={rfNodes} edges={rfEdges} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }} minZoom={0.1}>
        <Background color="#1e3a5f" gap={22} />
        <Controls />
      </ReactFlow>
      <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 text-[11px] text-slate-400 shadow-lg backdrop-blur">
        <div className="mb-1 font-semibold text-white">Cause → effect → prevention</div>
        <div className="flex items-center gap-1.5 py-0.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: GAP_COLOR }} /> Control-gap cluster (shared cause)</div>
        <div className="flex items-center gap-1.5 py-0.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Safety Cell (severity-colored)</div>
        <div className="flex items-center gap-1.5 py-0.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: PREV_COLOR }} /> Prevention: action</div>
      </div>
    </div>
  );
}
