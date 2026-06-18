"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ReactFlow, Background, Controls, Handle, Position, type Node, type Edge, type NodeProps } from "@xyflow/react";
import type { SafetyCell, CausalEdge } from "@/lib/types";
import { EDGE_META, SEVERITY_META, type EdgeType } from "@/lib/constants";
import { Check, Ban } from "lucide-react";

type CellNodeData = { cell: SafetyCell };

function CellNode({ data }: NodeProps) {
  const { cell } = data as unknown as CellNodeData;
  const m = SEVERITY_META[cell.severity];
  return (
    <div className="w-52 rounded-lg border bg-white p-2 shadow-md" style={{ borderColor: m.color }}>
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{cell.severity} · {cell.status.replace(/_/g, " ")}</span>
      </div>
      <div className="mt-1 line-clamp-3 text-xs font-medium text-slate-800">{cell.title}</div>
      <div className="mt-1 text-[10px] text-slate-400">{cell.hazard_genome.controlGap} control · risk {cell.risk_score}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { cell: CellNode };

export function CausalityGraph({ siteId }: { siteId: string }) {
  const [cells, setCells] = useState<SafetyCell[]>([]);
  const [edges, setEdges] = useState<CausalEdge[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/graph?site_id=${siteId}`);
    const json = await res.json();
    setCells(json.nodes ?? []);
    setEdges(json.edges ?? []);
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(edge: CausalEdge, review_status: "accepted" | "rejected") {
    await fetch("/api/graph/edges", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: edge.id, review_status }) });
    load();
  }

  const rfNodes: Node[] = useMemo(() => {
    // Deterministic column layout: spread cells across a soft grid.
    const cols = 3;
    return cells.map((c, i) => ({
      id: c.id,
      type: "cell",
      position: { x: (i % cols) * 280 + 40, y: Math.floor(i / cols) * 150 + 40 },
      data: { cell: c } as unknown as Record<string, unknown>,
    }));
  }, [cells]);

  const rfEdges: Edge[] = useMemo(
    () =>
      edges
        .filter((e) => e.review_status !== "rejected")
        .map((e) => {
          const pending = e.ai_generated && e.review_status === "pending";
          return {
            id: e.id,
            source: e.source_cell_id,
            target: e.target_cell_id,
            label: EDGE_META[e.type as EdgeType]?.label,
            animated: pending,
            style: {
              stroke: EDGE_META[e.type as EdgeType]?.color ?? "#999",
              strokeWidth: 2,
              strokeDasharray: pending ? "6 4" : undefined,
            },
            labelStyle: { fontSize: 10, fill: "#475569" },
          } satisfies Edge;
        }),
    [edges],
  );

  const pending = edges.filter((e) => e.review_status === "pending");

  return (
    <div className="relative flex-1">
      <ReactFlow nodes={rfNodes} edges={rfEdges} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}>
        <Background color="#cbd5e1" gap={20} />
        <Controls />
      </ReactFlow>

      {/* Pending review panel */}
      {pending.length > 0 && (
        <div className="absolute right-4 top-4 z-10 w-80 rounded-xl border border-violet-200 bg-white/95 p-3 shadow-xl backdrop-blur">
          <div className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            {pending.length} AI-proposed link{pending.length > 1 ? "s" : ""} · pending review
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">Causal claims become part of the official record only after a human approves them.</p>
          <div className="amaya-scroll mt-2 max-h-72 space-y-2 overflow-y-auto">
            {pending.map((e) => {
              const src = cells.find((c) => c.id === e.source_cell_id);
              const tgt = cells.find((c) => c.id === e.target_cell_id);
              return (
                <div key={e.id} className="rounded-lg border border-slate-200 p-2">
                  <div className="text-[11px] font-medium" style={{ color: EDGE_META[e.type as EdgeType]?.color }}>
                    {EDGE_META[e.type as EdgeType]?.label} · {Math.round(e.confidence * 100)}%
                  </div>
                  <div className="mt-0.5 text-xs text-slate-600">
                    <span className="font-medium">{src?.title.slice(0, 36)}…</span> → <span className="font-medium">{tgt?.title.slice(0, 36)}…</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">{e.rationale}</p>
                  <div className="mt-1.5 flex gap-2">
                    <button onClick={() => review(e, "accepted")} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white">
                      <Check className="h-3 w-3" /> Accept
                    </button>
                    <button onClick={() => review(e, "rejected")} className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700">
                      <Ban className="h-3 w-3" /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
