"use client";

import { useMemo } from "react";
import { ReactFlow, Background, Controls, Handle, Position, type Node, type Edge, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SafetyCell, CausalEdge } from "@/lib/types";
import { EDGE_META, SEVERITY_META, type EdgeType } from "@/lib/constants";

type CellNodeData = { cell: SafetyCell };

function CellNode({ data }: NodeProps) {
  const { cell } = data as unknown as CellNodeData;
  const m = SEVERITY_META[cell.severity as keyof typeof SEVERITY_META];
  return (
    <div className="w-52 rounded-lg border bg-slate-900 p-2 shadow-md" style={{ borderColor: m?.color ?? "#64748b" }}>
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: m?.color ?? "#64748b" }} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{cell.severity} · {cell.status.replace(/_/g, " ")}</span>
      </div>
      <div className="mt-1 line-clamp-3 text-xs font-medium text-white">{cell.title}</div>
      <div className="mt-1 text-[10px] text-slate-500">{cell.hazard_genome.controlGap} · risk {cell.risk_score}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { cell: CellNode };

export function CausalityMap({ cells, edges }: { cells: SafetyCell[]; edges: CausalEdge[] }) {
  const rfNodes: Node[] = useMemo(() => {
    const cols = 3;
    return cells.map((c, i) => ({
      id: c.id,
      type: "cell",
      position: { x: (i % cols) * 300 + 40, y: Math.floor(i / cols) * 160 + 40 },
      data: { cell: c } as unknown as Record<string, unknown>,
    }));
  }, [cells]);

  const rfEdges: Edge[] = useMemo(() =>
    edges
      .filter((e) => e.review_status !== "rejected")
      .map((e) => {
        const pending = e.ai_generated && e.review_status === "pending";
        const meta = EDGE_META[e.type as EdgeType];
        return {
          id: e.id,
          source: e.source_cell_id,
          target: e.target_cell_id,
          label: meta?.label,
          animated: pending,
          style: {
            stroke: meta?.color ?? "#64748b",
            strokeWidth: 2,
            strokeDasharray: pending ? "6 4" : undefined,
          },
          labelStyle: { fontSize: 10, fill: "#94a3b8" },
        } satisfies Edge;
      }),
  [edges]);

  const pendingCount = edges.filter((e) => e.ai_generated && e.review_status === "pending").length;

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e3a5f" gap={20} />
        <Controls />
      </ReactFlow>
      {pendingCount > 0 && (
        <div className="absolute right-4 top-4 z-10 rounded-xl border border-violet-800/50 bg-violet-900/80 px-3 py-2 text-xs text-violet-300 backdrop-blur">
          {pendingCount} AI-proposed link{pendingCount > 1 ? "s" : ""} pending review (dashed)
        </div>
      )}
    </div>
  );
}
