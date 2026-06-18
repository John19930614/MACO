"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { SafetyCell, CausalEdge, Site } from "@/lib/types";
import { SEVERITIES, EDGE_META, RISK_OBJECT_META, RISK_OBJECT_TYPES, type Severity, type EdgeType, type RiskObjectType } from "@/lib/constants";
import { buildCellLinks, articulationPoints, bridges } from "@/lib/arc/linkage";
import type { RiskGraph } from "@/lib/risk/objects";

/**
 * IMPORTANT: react-force-graph-3d renders with three.js/WebGL, whose Color
 * parser does NOT understand CSS custom properties (`var(--…)`). Every color we
 * hand it must be a literal hex/rgb string — so we mirror the design tokens
 * from globals.css and constants.ts as concrete hex values here.
 */
const SEV_HEX: Record<Severity, string> = {
  low: "#1f9d55",
  medium: "#d9a400",
  high: "#e02424",
  critical: "#b80a0a",
};
const CLOSED_HEX = "#6b7280";
const LINCHPIN_HEX = "#facc15"; // gold — articulation points
const BRIDGE_HEX = "#f43f5e"; // rose — cut edges
const SHARED_LINK_HEX = "#3b4a6b"; // faint shared-attribute link
const BG = "#0b1020";

const PLATFORM_PALETTE = ["#2f7fd6", "#c2521f", "#3f7d18", "#9a6cff", "#16a3bd", "#d08a14"];
const SEV_LABEL: Record<Severity, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
// Base node radius per risk-object type (severity adds a small bump on top).
const RISK_SIZE: Record<RiskObjectType, number> = { precursor: 5, control: 3, failure: 3.5, behavior: 4.5, event: 5, learning: 3 };

type View = "cells" | "risk";

interface GNode {
  id: string;
  label: string; // styled HTML shown in the hover tooltip
  color: string;
  val: number;
  cellId: string | null; // navigation target (the precursor cell), if any
  // cell-view extras
  sevColor?: string;
  platformColor?: string;
  linchpin?: boolean;
}
interface GLink {
  source: string;
  target: string;
  color: string;
  w: number;
  causal: boolean;
  bridge: boolean;
}
interface FGProps {
  width: number;
  height: number;
  graphData: { nodes: GNode[]; links: GLink[] };
  backgroundColor: string;
  showNavInfo: boolean;
  nodeColor: (n: GNode) => string;
  nodeVal: (n: GNode) => number;
  nodeLabel: (n: GNode) => string;
  nodeOpacity: number;
  nodeResolution: number;
  linkColor: (l: GLink) => string;
  linkWidth: (l: GLink) => number;
  linkOpacity: number;
  linkDirectionalParticles: (l: GLink) => number;
  linkDirectionalParticleWidth: number;
  linkDirectionalParticleSpeed: number;
  linkDirectionalParticleColor: (l: GLink) => string;
  enableNodeDrag: boolean;
  onNodeClick: (n: GNode) => void;
}

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-[#0b1020] text-slate-500">Loading 3D space…</div>,
}) as unknown as ComponentType<FGProps>;

export function Web3D({ cells, edges, sites, riskGraph }: { cells: SafetyCell[]; edges: CausalEdge[]; sites: Site[]; riskGraph?: RiskGraph }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState<View>("cells");
  const [colorBy, setColorBy] = useState<"severity" | "platform">("severity");
  const [highlight, setHighlight] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const platformColor = useMemo(() => {
    const m = new Map<string, string>();
    sites.forEach((s, i) => m.set(s.id, PLATFORM_PALETTE[i % PLATFORM_PALETTE.length]));
    return m;
  }, [sites]);
  const siteName = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);

  // ── Cell-web dataset (Safety Cells + causal/attribute links) ───────────────
  const cellData = useMemo(() => {
    const links = buildCellLinks(cells, edges, 2);
    const ids = cells.map((c) => c.id);
    const linchpins = new Set(articulationPoints(ids, links));
    const bridgeSet = new Set(bridges(ids, links).map(([a, b]) => `${a}|${b}`));

    const nodes: GNode[] = cells.map((c) => {
      const sevColor = c.status === "closed" ? CLOSED_HEX : SEV_HEX[c.severity];
      const platColor = c.status === "closed" ? CLOSED_HEX : platformColor.get(c.site_id) ?? "#64748b";
      const isLinchpin = linchpins.has(c.id);
      const subtitle = [
        `<span style="color:${sevColor}">●</span> ${SEV_LABEL[c.severity]}`,
        esc(siteName.get(c.site_id) ?? ""),
        isLinchpin ? `<span style="color:${LINCHPIN_HEX}">★ linchpin</span>` : "",
      ].filter(Boolean).join(" &middot; ");
      return {
        id: c.id,
        label: tooltip(esc(c.title), subtitle),
        color: colorBy === "severity" ? sevColor : platColor,
        val: (2 + c.risk_score / 16) * (isLinchpin ? 1.7 : 1),
        cellId: c.id,
        sevColor,
        platformColor: platColor,
        linchpin: isLinchpin,
      };
    });

    const glinks: GLink[] = links.map((l) => {
      const causal = l.kinds.includes("causal");
      const isBridge = bridgeSet.has(`${l.source}|${l.target}`);
      const color = isBridge ? BRIDGE_HEX : causal ? EDGE_META[l.causalType as EdgeType]?.color ?? "#94a3b8" : SHARED_LINK_HEX;
      return { source: l.source, target: l.target, color, w: (causal ? 1.2 : 0.5) + l.weight * 0.35 + (isBridge ? 1.5 : 0), causal, bridge: isBridge };
    });

    return { nodes, links: glinks, linchpins: linchpins.size, bridges: bridgeSet.size };
  }, [cells, edges, colorBy, platformColor, siteName]);

  // ── Risk-objects dataset (six-object framework graph) ──────────────────────
  const riskData = useMemo(() => {
    if (!riskGraph) return { nodes: [] as GNode[], links: [] as GLink[] };
    const typeOf = new Map(riskGraph.objects.map((o) => [o.id, o.type]));
    const nodes: GNode[] = riskGraph.objects.map((o) => {
      const color = RISK_OBJECT_META[o.type].color;
      const sevBump = o.severity ? { low: 0, medium: 1, high: 2, critical: 3 }[o.severity] : 0;
      return {
        id: o.id,
        label: tooltip(esc(o.title), `<span style="color:${color}">●</span> ${RISK_OBJECT_META[o.type].label} &middot; ${esc(o.subtitle)}`),
        color,
        val: RISK_SIZE[o.type] + sevBump,
        cellId: o.cellId,
      };
    });
    const links: GLink[] = riskGraph.links.map((l) => {
      const color = RISK_OBJECT_META[typeOf.get(l.source) ?? "precursor"].color;
      return { source: l.source, target: l.target, color, w: 0.8, causal: false, bridge: false };
    });
    return { nodes, links };
  }, [riskGraph]);

  const active = view === "risk" ? riskData : cellData;

  const presentSeverities = useMemo(() => {
    const open = new Set(cells.filter((c) => c.status !== "closed").map((c) => c.severity));
    return SEVERITIES.filter((s) => open.has(s));
  }, [cells]);
  const hasClosed = useMemo(() => cells.some((c) => c.status === "closed"), [cells]);

  const nodeColor = (n: GNode) => (view === "cells" && highlight && n.linchpin ? LINCHPIN_HEX : n.color);
  const linkColor = (l: GLink) => (view === "cells" && highlight && l.bridge ? BRIDGE_HEX : l.color);

  return (
    <div ref={ref} className="relative min-h-0 flex-1 bg-[#0b1020]">
      <ForceGraph3D
        width={size.w}
        height={size.h}
        graphData={active}
        backgroundColor={BG}
        showNavInfo={false}
        nodeColor={nodeColor}
        nodeVal={(n) => n.val}
        nodeLabel={(n) => n.label}
        nodeOpacity={0.95}
        nodeResolution={18}
        linkColor={linkColor}
        linkWidth={(l) => l.w}
        linkOpacity={0.5}
        linkDirectionalParticles={(l) => (l.causal ? 3 : 0)}
        linkDirectionalParticleWidth={1.6}
        linkDirectionalParticleSpeed={0.006}
        linkDirectionalParticleColor={(l) => l.color}
        enableNodeDrag={false}
        onNodeClick={(n) => n.cellId && router.push(`/cells/${n.cellId}`)}
      />

      {/* Header / controls */}
      <div className="pointer-events-auto absolute left-4 top-4 w-64 rounded-xl border border-white/10 bg-black/45 px-3 py-2.5 text-xs text-slate-200 backdrop-blur">
        <div className="flex gap-1">
          {(["cells", "risk"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              disabled={v === "risk" && !riskGraph}
              className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium ${view === v ? "bg-sky-500 text-white" : "bg-white/10 text-slate-300 hover:bg-white/20"} disabled:opacity-40`}
            >
              {v === "cells" ? "Cell web" : "Risk objects"}
            </button>
          ))}
        </div>

        {view === "cells" ? (
          <>
            <div className="mt-2 font-semibold">{cells.length} cells · {cellData.links.length} links</div>
            <div className="mt-0.5 text-[11px] text-slate-400">{sites.length} platforms · {cellData.linchpins} linchpins · {cellData.bridges} bridges</div>
            <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Color nodes by</div>
            <div className="mt-1 flex gap-1">
              {(["severity", "platform"] as const).map((m) => (
                <button key={m} onClick={() => setColorBy(m)} className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium capitalize ${colorBy === m ? "bg-sky-500 text-white" : "bg-white/10 text-slate-300 hover:bg-white/20"}`}>{m}</button>
              ))}
            </div>
            <label className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-300">
              <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} className="accent-yellow-400" />
              Highlight linchpins &amp; bridges
            </label>
          </>
        ) : (
          <>
            <div className="mt-2 font-semibold">{riskData.nodes.length} risk objects · {riskData.links.length} links</div>
            <div className="mt-0.5 text-[11px] text-slate-400">Reliance Risk Intelligence Framework · §6</div>
          </>
        )}

        <div className="mt-1 text-[10px] text-slate-500">Drag to orbit · scroll to zoom · click a node to open its cell</div>
      </div>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl border border-white/10 bg-black/45 px-3 py-2.5 text-[11px] text-slate-200 backdrop-blur">
        {view === "risk" ? (
          <div className="flex flex-col gap-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Risk objects</div>
            {RISK_OBJECT_TYPES.map((t) => (
              <Swatch key={t} color={RISK_OBJECT_META[t].color} label={`${RISK_OBJECT_META[t].label} · ${riskGraph?.counts[t] ?? 0}`} />
            ))}
          </div>
        ) : colorBy === "severity" ? (
          <div className="flex flex-col gap-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Severity</div>
            {presentSeverities.map((s) => (
              <Swatch key={s} color={SEV_HEX[s]} label={SEV_LABEL[s]} />
            ))}
            {hasClosed && <Swatch color={CLOSED_HEX} label="Closed" />}
            <div className="mt-2 border-t border-white/10 pt-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Links</div>
              <LineKey color="#e02424" label="Causal (flowing)" />
              <LineKey color={SHARED_LINK_HEX} label="Shared attribute" />
              <LineKey color={BRIDGE_HEX} label="Bridge — sole connector" />
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: LINCHPIN_HEX }} />
                <span className="text-slate-300">★ Linchpin — fix first</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Platform</div>
            {sites.map((s) => (
              <Swatch key={s.id} color={platformColor.get(s.id) ?? "#64748b"} label={s.name} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function tooltip(title: string, subtitle: string): string {
  return `<div style="max-width:300px;padding:9px 12px;border-radius:12px;background:rgba(11,16,32,0.94);border:1px solid rgba(255,255,255,0.16);box-shadow:0 6px 18px rgba(0,0,0,0.55);font-family:inherit;color:#f1f5f9;pointer-events:none">
    <div style="font-size:16px;font-weight:700;line-height:1.3">${title}</div>
    <div style="margin-top:5px;font-size:13px;font-weight:500;color:#cbd5e1">${subtitle}</div>
  </div>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="max-w-[200px] truncate text-slate-300">{label}</span>
    </div>
  );
}

function LineKey({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block h-0.5 w-4 rounded" style={{ background: color }} />
      <span className="text-slate-300">{label}</span>
    </div>
  );
}
