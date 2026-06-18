"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ReactFlow, Background, Controls, Handle, Position, type Node, type Edge, type NodeProps } from "@xyflow/react";
import type { CellBundle, CausalEdge, SafetyCell } from "@/lib/types";
import { Loader2 } from "lucide-react";

/**
 * Cell Anatomy — a "virtual space" that shows how one Safety Cell stores its
 * data. The cell is the hub; every spoke is a record in another table, labeled
 * with the table that stores it (control_proofs, evidence_files, ai_findings,
 * actions, locations, sites, tenants, causal_edges). It makes the data model
 * tangible and lets you verify a cell's stored data is correct and connected.
 */

interface NodeData {
  table: string;
  title: string;
  fields: [string, string][];
  accent: string;
  hub?: boolean;
}

function DataNode({ data }: NodeProps) {
  const d = data as unknown as NodeData;
  return (
    <div
      className={`rounded-lg border bg-white shadow-md ${d.hub ? "w-60" : "w-48"}`}
      style={{ borderLeft: `4px solid ${d.accent}`, borderColor: d.accent }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <div className="rounded-t-lg px-2 py-1" style={{ background: `${d.accent}14` }}>
        <span className="font-mono text-[10px] font-semibold" style={{ color: d.accent }}>{d.table}</span>
      </div>
      <div className="px-2 py-1.5">
        <div className={`${d.hub ? "text-sm" : "text-xs"} font-semibold text-slate-800 line-clamp-2`}>{d.title}</div>
        <dl className="mt-1 space-y-0.5">
          {d.fields.map(([k, v]) => (
            <div key={k} className="flex gap-1 text-[10px]">
              <dt className="shrink-0 text-slate-400">{k}:</dt>
              <dd className="truncate font-medium text-slate-600">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

const nodeTypes = { data: DataNode };

const ACCENT = {
  hub: "#0c447c",
  context: "#185fa5",
  genome: "#534ab7",
  proof: "#993c1d",
  evidence: "#64748b",
  finding: "#7c3aed",
  action: "#d9a400",
  linked: "#27500a",
};

export function CellAnatomy({ id }: { id: string }) {
  const [bundle, setBundle] = useState<CellBundle | null>(null);
  const [edges, setEdges] = useState<CausalEdge[]>([]);
  const [nodesIndex, setNodesIndex] = useState<SafetyCell[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r1 = await fetch(`/api/cells/${id}`);
    const b = (await r1.json()).bundle as CellBundle | null;
    setBundle(b);
    if (b) {
      const r2 = await fetch(`/api/graph?site_id=${b.site.id}`);
      const g = await r2.json();
      setEdges((g.edges as CausalEdge[]).filter((e) => e.source_cell_id === id || e.target_cell_id === id));
      setNodesIndex(g.nodes as SafetyCell[]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const { rfNodes, rfEdges } = useMemo(() => {
    if (!bundle) return { rfNodes: [] as Node[], rfEdges: [] as Edge[] };
    const c = bundle.cell;
    const spokes: { id: string; rel: string; data: NodeData }[] = [];

    spokes.push({ id: "tenant", rel: "in_tenant", data: { table: "tenants", title: c.tenant_id, fields: [], accent: ACCENT.context } });
    spokes.push({ id: "site", rel: "site_id", data: { table: "sites", title: bundle.site.name, fields: [["vertical", bundle.site.vertical], ["id", bundle.site.id.slice(0, 8)]], accent: ACCENT.context } });
    spokes.push({ id: "loc", rel: "location_id", data: { table: "locations", title: bundle.location.label, fields: [["kind", bundle.location.kind], ["lng,lat", `${bundle.location.lng.toFixed(3)}, ${bundle.location.lat.toFixed(3)}`]], accent: ACCENT.context } });
    spokes.push({ id: "genome", rel: "hazard_genome (jsonb)", data: { table: "safety_cells.hazard_genome", title: "Hazard genome", fields: [["energy", c.hazard_genome.energySource], ["exposure", c.hazard_genome.exposureType], ["trigger", c.hazard_genome.trigger], ["gap", c.hazard_genome.controlGap]], accent: ACCENT.genome } });

    bundle.proofs.forEach((p, i) => spokes.push({ id: `pf${i}`, rel: "control_proofs", data: { table: "control_proofs", title: p.control, fields: [["status", p.status], ["required", String(p.required)]], accent: ACCENT.proof } }));
    bundle.evidence.forEach((e, i) => spokes.push({ id: `ev${i}`, rel: "evidence_files", data: { table: "evidence_files", title: e.name, fields: [["kind", e.kind]], accent: ACCENT.evidence } }));
    bundle.findings.forEach((f, i) => spokes.push({ id: `ai${i}`, rel: "ai_findings", data: { table: "ai_findings", title: `${f.job}`, fields: [["review", f.review_status], ["conf", `${Math.round(f.confidence * 100)}%`]], accent: ACCENT.finding } }));
    bundle.actions.forEach((a, i) => spokes.push({ id: `act${i}`, rel: "actions", data: { table: "actions", title: a.title, fields: [["kind", a.kind], ["status", a.status]], accent: ACCENT.action } }));

    const titleById = new Map(nodesIndex.map((n) => [n.id, n.title]));
    edges.forEach((e, i) => {
      const otherId = e.source_cell_id === c.id ? e.target_cell_id : e.source_cell_id;
      spokes.push({ id: `edge${i}`, rel: `causal_edges · ${e.type}`, data: { table: "causal_edges → safety_cells", title: titleById.get(otherId) ?? otherId, fields: [["type", e.type], ["review", e.review_status]], accent: ACCENT.linked } });
    });

    const R = Math.max(280, spokes.length * 30);
    const nodes: Node[] = [
      {
        id: "cell",
        type: "data",
        position: { x: 0, y: 0 },
        data: { table: "safety_cells", title: c.title, fields: [["id", c.id.slice(0, 10)], ["severity", c.severity], ["status", c.status], ["risk", String(c.risk_score)]], accent: ACCENT.hub, hub: true } as unknown as Record<string, unknown>,
      },
    ];
    const rfEdges: Edge[] = [];
    spokes.forEach((s, i) => {
      const angle = (i / spokes.length) * 2 * Math.PI - Math.PI / 2;
      nodes.push({ id: s.id, type: "data", position: { x: Math.cos(angle) * R, y: Math.sin(angle) * R }, data: s.data as unknown as Record<string, unknown> });
      rfEdges.push({ id: `e-${s.id}`, source: "cell", target: s.id, label: s.rel, style: { stroke: s.data.accent, strokeWidth: 1.5 }, labelStyle: { fontSize: 9, fill: "#475569" }, labelBgStyle: { fill: "#ffffff" } });
    });
    return { rfNodes: nodes, rfEdges };
  }, [bundle, edges, nodesIndex]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!bundle) return <div className="p-6 text-sm text-slate-400">Cell not found.</div>;

  return (
    <ReactFlow nodes={rfNodes} edges={rfEdges} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }} minZoom={0.2}>
      <Background color="#e2e8f0" gap={22} />
      <Controls />
    </ReactFlow>
  );
}
