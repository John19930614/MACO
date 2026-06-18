"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ReactFlow, Background, Controls, Handle, Position, type Node, type Edge, type NodeProps, type ReactFlowInstance } from "@xyflow/react";
import { Star, Play, Pause } from "lucide-react";
import type { SafetyCell, CausalEdge, Site } from "@/lib/types";
import type { PreventionWebModel } from "@/lib/arc/prevention";
import { SEVERITY_META, EDGE_META, type EdgeType } from "@/lib/constants";
import { buildCellLinks, layoutForce, connectedComponents, articulationPoints, bridges } from "@/lib/arc/linkage";

const LINCHPIN = "#d9a400";
const BRIDGE = "#dc2626";

const PLATFORM_PALETTE = ["#185fa5", "#993c1d", "#27500a", "#7c3aed", "#0e7490", "#b45309"];
const CLUSTER_PALETTE = ["#185fa5", "#993c1d", "#27500a", "#7c3aed", "#0e7490", "#b45309", "#be185d", "#0f766e"];
const PREV_COLOR = "#27500a";

type WebData = { cell: SafetyCell; color: string; linchpin: boolean };
type HaloData = { radius: number; color: string; label: string; count: number };
type PrevData = { label: string; kind: "action" | "recommendation" };

function WebNode({ data }: NodeProps) {
  const d = data as unknown as WebData;
  return (
    <div className="rounded-lg border bg-white px-2 py-1 shadow-sm" style={{ borderColor: d.linchpin ? LINCHPIN : d.color, borderLeftWidth: 4, width: 168 }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <div className="flex items-center gap-1">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
        <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-700">{d.cell.title}</span>
        {d.linchpin && <Star className="ml-auto h-3 w-3 shrink-0" fill={LINCHPIN} stroke={LINCHPIN} />}
      </div>
    </div>
  );
}

function HaloNode({ data }: NodeProps) {
  const d = data as unknown as HaloData;
  return (
    <div
      className="flex items-start justify-center rounded-full"
      style={{ width: d.radius * 2, height: d.radius * 2, background: `${d.color}12`, border: `1.5px dashed ${d.color}66` }}
    >
      <span className="mt-2 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold capitalize" style={{ color: d.color }}>
        {d.label} · {d.count}
      </span>
    </div>
  );
}

function PrevNode({ data }: NodeProps) {
  const d = data as unknown as PrevData;
  return (
    <div className="rounded-md border bg-white px-1.5 py-1 shadow-sm" style={{ borderColor: PREV_COLOR, borderLeftWidth: 3, borderStyle: d.kind === "recommendation" ? "dashed" : "solid", width: 150 }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="font-mono text-[8px] font-semibold" style={{ color: PREV_COLOR }}>{d.kind === "action" ? "ACTION" : "AI REC"}</div>
      <div className="line-clamp-2 text-[10px] text-slate-600">{d.label}</div>
    </div>
  );
}

const nodeTypes = { web: WebNode, halo: HaloNode, prev: PrevNode };

export function CellWeb({ cells, edges, sites, prevention }: { cells: SafetyCell[]; edges: CausalEdge[]; sites: Site[]; prevention: PreventionWebModel }) {
  const router = useRouter();
  const rfRef = useRef<ReactFlowInstance | null>(null);
  const [threshold, setThreshold] = useState(2);
  const [colorBy, setColorBy] = useState<"severity" | "platform">("severity");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showPrevention, setShowPrevention] = useState(false);

  // Time scrubber — replay the web forming by cell creation date.
  const { minT, maxT } = useMemo(() => {
    const ts = cells.map((c) => new Date(c.created_at).getTime());
    return { minT: ts.length ? Math.min(...ts) : 0, maxT: ts.length ? Math.max(...ts) : 0 };
  }, [cells]);
  const [cursor, setCursor] = useState<number>(maxT);
  const [playing, setPlaying] = useState(false);
  useEffect(() => setCursor(maxT), [maxT]);
  useEffect(() => {
    if (!playing) return;
    const step = Math.max(1, (maxT - minT) / 40);
    const id = setInterval(() => {
      setCursor((c) => {
        if (c >= maxT) { setPlaying(false); return maxT; }
        return Math.min(maxT, c + step);
      });
    }, 220);
    return () => clearInterval(id);
  }, [playing, minT, maxT]);
  const scrubbing = cursor < maxT;

  function focusBox(cx: number, cy: number, r: number) {
    rfRef.current?.fitBounds({ x: cx - r, y: cy - r, width: r * 2, height: r * 2 }, { padding: 0.2, duration: 600 });
  }

  const platformColor = useMemo(() => {
    const m = new Map<string, string>();
    sites.forEach((s, i) => m.set(s.id, PLATFORM_PALETTE[i % PLATFORM_PALETTE.length]));
    return m;
  }, [sites]);

  // Stable graph (does NOT depend on hover/color so layout never recomputes on hover).
  const graph = useMemo(() => {
    const links = buildCellLinks(cells, edges, threshold);
    const ids = cells.map((c) => c.id);
    const pos = layoutForce(ids, links);
    const adj = new Map<string, Set<string>>();
    ids.forEach((id) => adj.set(id, new Set()));
    for (const l of links) {
      adj.get(l.source)?.add(l.target);
      adj.get(l.target)?.add(l.source);
    }
    const cellById = new Map(cells.map((c) => [c.id, c]));
    const linchpins = new Set(articulationPoints(ids, links));
    const bridgeSet = new Set(bridges(ids, links).map(([a, b]) => `${a}|${b}`));
    const components = connectedComponents(ids, links).filter((g) => g.length >= 2);
    const clusters = components.map((members, idx) => {
      const pts = members.map((id) => pos[id]).filter(Boolean);
      const cx = pts.reduce((n, p) => n + p.x, 0) / pts.length;
      const cy = pts.reduce((n, p) => n + p.y, 0) / pts.length;
      const radius = Math.max(120, ...pts.map((p) => Math.hypot(p.x - cx, p.y - cy))) + 90;
      // dominant exposure · control gap among members
      const top = (sel: (c: SafetyCell) => string) => {
        const m = new Map<string, number>();
        members.forEach((id) => { const k = sel(cellById.get(id)!); m.set(k, (m.get(k) ?? 0) + 1); });
        return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
      };
      const label = `${top((c) => c.hazard_genome.exposureType).replace(/_/g, " ")} · ${top((c) => c.hazard_genome.controlGap)}`;
      return { members, cx, cy, radius, label, color: CLUSTER_PALETTE[idx % CLUSTER_PALETTE.length] };
    });
    return { links, pos, adj, clusters, cellById, linchpins, bridgeSet };
  }, [cells, edges, threshold]);

  const { rfNodes, rfEdges } = useMemo(() => {
    const { links, pos, adj, clusters, linchpins, bridgeSet } = graph;
    const neighborhood = hoveredId ? new Set<string>([hoveredId, ...(adj.get(hoveredId) ?? [])]) : null;
    const dim = (lit: boolean) => (neighborhood ? (lit ? 1 : 0.12) : 1);
    const visible = new Set(cells.filter((c) => new Date(c.created_at).getTime() <= cursor).map((c) => c.id));

    const nodes: Node[] = [];

    // Cluster halos — hidden while scrubbing (they describe the full graph).
    if (!scrubbing) {
      clusters.forEach((cl, i) => {
        nodes.push({
          id: `halo_${i}`,
          type: "halo",
          position: { x: cl.cx - cl.radius, y: cl.cy - cl.radius },
          data: { radius: cl.radius, color: cl.color, label: cl.label, count: cl.members.length } as unknown as Record<string, unknown>,
          selectable: false,
          draggable: false,
          zIndex: 0,
          style: { opacity: neighborhood ? 0.5 : 1, pointerEvents: "none" },
        });
      });
    }

    // Cell nodes (positions stay fixed so the web visibly grows during replay).
    for (const c of cells) {
      const color = colorBy === "severity" ? SEVERITY_META[c.severity].color : platformColor.get(c.site_id) ?? "#64748b";
      const lit = !neighborhood || neighborhood.has(c.id);
      const isLinchpin = linchpins.has(c.id);
      nodes.push({
        id: c.id,
        type: "web",
        position: pos[c.id] ?? { x: 0, y: 0 },
        data: { cell: c, color, linchpin: isLinchpin } as unknown as Record<string, unknown>,
        hidden: !visible.has(c.id),
        zIndex: isLinchpin ? 3 : 1,
        style: { opacity: dim(lit), boxShadow: isLinchpin ? `0 0 0 3px ${LINCHPIN}55` : undefined, borderRadius: 8 },
      });
    }

    const rfEdges: Edge[] = links.map((l) => {
      const causal = l.kinds.includes("causal");
      const isBridge = bridgeSet.has(`${l.source}|${l.target}`);
      const color = isBridge ? BRIDGE : causal ? EDGE_META[l.causalType as EdgeType]?.color ?? "#64748b" : "#94a3b8";
      const lit = !neighborhood || l.source === hoveredId || l.target === hoveredId;
      const shown = visible.has(l.source) && visible.has(l.target);
      return {
        id: `${l.source}-${l.target}`,
        source: l.source,
        target: l.target,
        hidden: !shown,
        animated: l.pending && lit,
        style: {
          stroke: color,
          strokeWidth: isBridge ? Math.max(3, 1 + l.weight * 0.5) : Math.min(6, 1 + l.weight * 0.5),
          strokeDasharray: l.pending ? "6 4" : undefined,
          opacity: (isBridge ? 1 : causal ? 0.9 : 0.35) * (lit ? 1 : 0.15),
        },
      };
    });

    // Prevention overlay (folded into the same space).
    if (showPrevention) {
      const byCell = new Map<string, typeof prevention.preventions>();
      for (const p of prevention.preventions) {
        const arr = byCell.get(p.cell_id);
        if (arr) arr.push(p);
        else byCell.set(p.cell_id, [p]);
      }
      for (const [cid, items] of byCell) {
        const base = pos[cid];
        if (!base) continue;
        const lit = !neighborhood || neighborhood.has(cid);
        items.forEach((p, i) => {
          const px = base.x + 150;
          const py = base.y + (i - (items.length - 1) / 2) * 42;
          nodes.push({ id: p.id, type: "prev", position: { x: px, y: py }, data: { label: p.label, kind: p.kind } as unknown as Record<string, unknown>, hidden: !visible.has(cid), zIndex: 2, style: { opacity: dim(lit) } });
          rfEdges.push({ id: `pe-${p.id}`, source: cid, target: p.id, hidden: !visible.has(cid), style: { stroke: PREV_COLOR, strokeWidth: 1.2, opacity: 0.6 * (lit ? 1 : 0.15) } });
        });
      }
    }

    return { rfNodes: nodes, rfEdges };
  }, [graph, cells, hoveredId, colorBy, platformColor, showPrevention, prevention, cursor, scrubbing]);

  return (
    <div className="relative min-h-0 flex-1">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.08}
        proOptions={{ hideAttribution: true }}
        onInit={(inst) => (rfRef.current = inst)}
        onNodeClick={(_e, n) => n.type === "web" && router.push(`/cells/${n.id}`)}
        onNodeMouseEnter={(_e, n) => n.type === "web" && setHoveredId(n.id)}
        onNodeMouseLeave={() => setHoveredId(null)}
      >
        <Background color="#e2e8f0" gap={22} />
        <Controls />
      </ReactFlow>

      <div className="absolute left-4 top-4 z-10 w-64 rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur">
        <div className="font-semibold text-slate-700">{cells.length} cells · {graph.links.length} links · {graph.clusters.length} clusters · {graph.bridgeSet.size} bridges</div>
        <p className="mt-0.5 text-[11px] text-slate-400">Hover a cell to trace its neighborhood. Click to open.</p>

        <label className="mt-2 block text-[11px] font-medium text-slate-500">Link strength ≥ {threshold}</label>
        <input type="range" min={1} max={6} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full accent-[var(--color-pclss)]" />

        <div className="mt-2 flex gap-1">
          {(["severity", "platform"] as const).map((m) => (
            <button key={m} onClick={() => setColorBy(m)} className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium capitalize ${colorBy === m ? "bg-[var(--color-pclss)] text-white" : "bg-slate-100 text-slate-600"}`}>{m}</button>
          ))}
        </div>

        <label className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600">
          <input type="checkbox" checked={showPrevention} onChange={(e) => setShowPrevention(e.target.checked)} className="accent-[var(--color-curve)]" />
          Fold in prevention
        </label>

        {graph.clusters.length > 0 && (
          <div className="mt-2 border-t border-slate-100 pt-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Emergent clusters · click to focus</div>
            <div className="mt-1 space-y-0.5">
              {graph.clusters.slice(0, 6).map((c, i) => (
                <button key={i} onClick={() => focusBox(c.cx, c.cy, c.radius)} className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-[11px] capitalize text-slate-600 hover:bg-slate-100">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c.color }} />
                  <span className="truncate">{c.label}</span>
                  <span className="ml-auto shrink-0 text-slate-400">({c.members.length})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {graph.linchpins.size > 0 && (
          <div className="mt-2 border-t border-slate-100 pt-2">
            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <Star className="h-3 w-3" fill={LINCHPIN} stroke={LINCHPIN} /> Linchpin cells
            </div>
            <p className="text-[10px] text-slate-400">Removing one fragments its cluster — fix these first.</p>
            <div className="mt-1 space-y-0.5">
              {[...graph.linchpins].map((id) => {
                const c = graph.cellById.get(id);
                const p = graph.pos[id];
                if (!c) return null;
                return (
                  <button
                    key={id}
                    onClick={() => { setHoveredId(id); if (p) focusBox(p.x, p.y, 240); }}
                    className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-[11px] text-slate-600 hover:bg-slate-100"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SEVERITY_META[c.severity].color }} />
                    <span className="truncate">{c.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-2 text-[10px] text-slate-400">Thick/colored = causal · faint = shared attribute · dashed = AI pending · ★ linchpin · red = bridge</div>
      </div>

      {/* Time scrubber */}
      {maxT > minT && (
        <div className="absolute bottom-4 left-1/2 z-10 flex w-[520px] max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
          <button
            onClick={() => { if (cursor >= maxT) setCursor(minT); setPlaying((p) => !p); }}
            aria-label={playing ? "Pause replay" : "Play replay"}
            className="rounded-md bg-[var(--color-pclss)] p-1.5 text-white hover:opacity-90"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={minT}
            max={maxT}
            value={cursor}
            onChange={(e) => { setCursor(Number(e.target.value)); setPlaying(false); }}
            className="flex-1 accent-[var(--color-pclss)]"
            aria-label="Replay timeline"
          />
          <span className="w-28 shrink-0 text-right text-[11px] text-slate-500">
            {new Date(cursor).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {cells.filter((c) => new Date(c.created_at).getTime() <= cursor).length}/{cells.length}
          </span>
          {scrubbing && (
            <button onClick={() => { setCursor(maxT); setPlaying(false); }} className="shrink-0 text-[11px] font-medium text-slate-400 hover:text-slate-700">
              all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
