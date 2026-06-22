"use client";

import { useState, useMemo } from "react";
import type { SafetyCell, ControlProof, CausalEdge, SafetyAction, AiFinding, Site } from "@/lib/types";

const ACCENT: Record<string, string> = {
  cell:    "#3b82f6",
  proof:   "#22c55e",
  edge:    "#a855f7",
  action:  "#eab308",
  finding: "#14b8a6",
  site:    "#f97316",
};

export function DataSpaceView({ cells, proofs, edges, actions, findings, sites }: {
  cells:    SafetyCell[];
  proofs:   ControlProof[];
  edges:    CausalEdge[];
  actions:  SafetyAction[];
  findings: AiFinding[];
  sites:    Site[];
}) {
  const [selectedId, setSelectedId] = useState(cells[0]?.id ?? "");

  const cell         = cells.find((c) => c.id === selectedId);
  const site         = sites.find((s) => s.id === cell?.site_id);
  const cellProofs   = proofs.filter((p) => p.cell_id === selectedId);
  const outEdges     = edges.filter((e) => e.source_cell_id === selectedId);
  const inEdges      = edges.filter((e) => e.target_cell_id === selectedId);
  const cellActions  = actions.filter((a) => a.cell_id === selectedId);
  const cellFindings = findings.filter((f) => f.cell_id === selectedId);

  const groups = useMemo(() => [
    { key: "proof",   label: "Control Proofs", items: cellProofs,   color: ACCENT.proof   },
    { key: "action",  label: "Actions",        items: cellActions,  color: ACCENT.action  },
    { key: "finding", label: "AI Findings",    items: cellFindings, color: ACCENT.finding },
    { key: "out",     label: "Causes →",       items: outEdges,     color: ACCENT.edge    },
    { key: "in",      label: "← Effects",      items: inEdges,      color: ACCENT.edge    },
  ], [cellProofs, cellActions, cellFindings, outEdges, inEdges]);

  function itemLabel(key: string, item: unknown): string {
    if (key === "proof")   return (item as ControlProof).control + " · " + (item as ControlProof).status;
    if (key === "action")  return (item as SafetyAction).title + " · " + (item as SafetyAction).status;
    if (key === "finding") return (item as AiFinding).input_summary;
    if (key === "out")     return "→ " + (cells.find((c) => c.id === (item as CausalEdge).target_cell_id)?.title ?? (item as CausalEdge).target_cell_id);
    if (key === "in")      return "← " + (cells.find((c) => c.id === (item as CausalEdge).source_cell_id)?.title ?? (item as CausalEdge).source_cell_id);
    return "";
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left sidebar — cell selector */}
      <div className="w-72 shrink-0 overflow-auto border-r border-slate-200 bg-white p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Select Cell</div>
        <div className="space-y-1">
          {cells.map((c) => {
            const severityColor = { critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#94a3b8" }[c.severity];
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full rounded-lg border px-2 py-1.5 text-left text-xs transition ${
                  c.id === selectedId
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: severityColor }} />
                  <span className="truncate font-medium">{c.title}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main panel */}
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {cell ? (
          <>
            {/* Selected cell header */}
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">Safety Cell</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{cell.title}</div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                <span>Severity: <span className="font-medium text-slate-800">{cell.severity}</span></span>
                <span>Status: <span className="font-medium text-slate-800">{cell.status.replace(/_/g, " ")}</span></span>
                <span>Risk: <span className="font-medium text-slate-800">{cell.risk_score}</span></span>
                <span>Site: <span className="font-medium text-slate-800">{site?.name ?? cell.site_id}</span></span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Genome: {cell.hazard_genome.exposureType} · {cell.hazard_genome.energySource} · {cell.hazard_genome.trigger} · gap: {cell.hazard_genome.controlGap}
              </div>
            </div>

            {/* Entity groups */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {groups.map((g) => (
                <div key={g.key} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />
                    <span className="text-xs font-semibold text-slate-800">{g.label}</span>
                    <span className="ml-auto text-xs text-slate-400">{g.items.length}</span>
                  </div>
                  {g.items.length === 0 ? (
                    <p className="text-[11px] text-slate-400">None</p>
                  ) : (
                    <div className="space-y-1">
                      {g.items.map((item, i) => (
                        <div key={i} className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                          {itemLabel(g.key, item)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-slate-400">Select a cell to inspect its entity graph.</p>
        )}
      </div>
    </div>
  );
}
