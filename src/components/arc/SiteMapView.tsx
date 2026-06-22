"use client";

import { useState } from "react";
import type { Site, SafetyCell, SafetyLocation } from "@/lib/types";

const VERTICAL_COLOR: Record<string, string> = {
  maritime:     "#3b82f6",
  construction: "#f97316",
  chemical:     "#a855f7",
  "oil-gas":    "#ef4444",
};

export function SiteMapView({ sites, cells, locations }: { sites: Site[]; cells: SafetyCell[]; locations: SafetyLocation[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  const cellsBySite = new Map<string, SafetyCell[]>();
  for (const c of cells) {
    const arr = cellsBySite.get(c.site_id) ?? [];
    arr.push(c);
    cellsBySite.set(c.site_id, arr);
  }

  const selectedSite  = sites.find((s) => s.id === selected);
  const selectedCells = selected ? (cellsBySite.get(selected) ?? []) : [];
  const mappable      = sites.filter((s): s is typeof s & { center: [number, number] } => !!s.center);

  const lngMin = (mappable.length ? Math.min(...mappable.map((s) => s.center[0])) : 0) - 5;
  const lngMax = (mappable.length ? Math.max(...mappable.map((s) => s.center[0])) : 10) + 5;
  const latMin = (mappable.length ? Math.min(...mappable.map((s) => s.center[1])) : 0) - 3;
  const latMax = (mappable.length ? Math.max(...mappable.map((s) => s.center[1])) : 10) + 3;

  function toSvg(lng: number, lat: number): [number, number] {
    const x = ((lng - lngMin) / (lngMax - lngMin)) * 780 + 10;
    const y = ((latMax - lat) / (latMax - latMin)) * 380 + 10;
    return [x, y];
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Map — intentionally dark for geographic contrast */}
      <div className="relative flex-1 bg-slate-950">
        <svg viewBox="0 0 800 400" className="h-full w-full" style={{ fontFamily: "inherit" }}>
          <rect width="800" height="400" fill="#0a1628" />
          {[...Array(8)].map((_, i) => (
            <line key={`h${i}`} x1={0} x2={800} y1={50 * i} y2={50 * i} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          ))}
          {[...Array(16)].map((_, i) => (
            <line key={`v${i}`} x1={50 * i} x2={50 * i} y1={0} y2={400} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          ))}
          {mappable.map((site) => {
            const [x, y]    = toSvg(site.center[0], site.center[1]);
            const siteCells = cellsBySite.get(site.id) ?? [];
            const critical  = siteCells.filter((c) => c.severity === "critical").length;
            const high      = siteCells.filter((c) => c.severity === "high").length;
            const siteVertical = (site as Site & { vertical?: string }).vertical ?? "";
            const color     = critical > 0 ? "#ef4444" : high > 0 ? "#f97316" : VERTICAL_COLOR[siteVertical] ?? "#3b82f6";
            const r         = 8 + Math.min(siteCells.length, 20) * 0.8;
            const isSelected = site.id === selected;
            return (
              <g key={site.id} onClick={() => setSelected(site.id === selected ? null : site.id)} style={{ cursor: "pointer" }}>
                <circle cx={x} cy={y} r={r + 6} fill={color} opacity={0.15} />
                <circle cx={x} cy={y} r={r} fill={color} opacity={isSelected ? 1 : 0.75} stroke={isSelected ? "white" : "transparent"} strokeWidth={2} />
                <text x={x} y={y + r + 14} textAnchor="middle" fill="white" fontSize={11} fontWeight="600">{site.name}</text>
                <text x={x} y={y + r + 26} textAnchor="middle" fill={color} fontSize={10} opacity={0.9}>{siteCells.length} cells</text>
              </g>
            );
          })}
        </svg>
        <div className="absolute bottom-4 left-4 flex flex-col gap-1.5">
          {Object.entries(VERTICAL_COLOR).map(([v, c]) => (
            <div key={v} className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
              {v.replace("-", " ")}
            </div>
          ))}
        </div>
      </div>

      {/* Sidebar — light theme */}
      <div className="w-80 shrink-0 overflow-auto border-l border-slate-200 bg-white p-4">
        {selectedSite ? (
          <>
            <div className="mb-3">
              <div className="text-sm font-bold text-slate-900">{selectedSite.name}</div>
              <div className="text-xs text-slate-500">
                {(selectedSite as Site & { vertical?: string }).vertical ?? ""} · {selectedCells.length} Safety Cells
              </div>
            </div>
            <div className="space-y-2">
              {selectedCells.map((c) => {
                const severityColor = { critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#94a3b8" }[c.severity];
                return (
                  <div key={c.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: severityColor }} />
                      <span className="text-[11px] font-semibold uppercase text-slate-500">
                        {c.severity} · {c.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs font-medium text-slate-800">{c.title}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">risk {c.risk_score} · {c.hazard_genome.controlGap}</div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">All Sites</div>
            <div className="space-y-3">
              {sites.map((site) => {
                const siteCells    = cellsBySite.get(site.id) ?? [];
                const critical     = siteCells.filter((c) => c.severity === "critical").length;
                const high         = siteCells.filter((c) => c.severity === "high").length;
                const siteVertical = (site as Site & { vertical?: string }).vertical ?? "";
                return (
                  <button
                    key={site.id}
                    onClick={() => setSelected(site.id)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50 transition shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: VERTICAL_COLOR[siteVertical] ?? "#3b82f6" }} />
                      <span className="text-sm font-semibold text-slate-800">{site.name}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{siteVertical} · {siteCells.length} cells</div>
                    {(critical > 0 || high > 0) && (
                      <div className="mt-1 flex gap-2 text-[11px]">
                        {critical > 0 && <span className="text-red-600">{critical} critical</span>}
                        {high > 0    && <span className="text-orange-500">{high} high</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
