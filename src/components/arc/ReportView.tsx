"use client";

import { useState } from "react";
import { Printer, Download } from "lucide-react";

export interface ReportData {
  generatedAt: string;
  kpis: { total: number; open: number; highOpen: number; gapRate: number; actionClosure: number };
  topRisks:      { id: string; title: string; severity: string; risk: number; site: string }[];
  missingProof:  { control: string; status: string; cell: string }[];
  overdueActions:{ title: string; due: string; cell: string }[];
  clusters:      { gap: string; cells: number; covered: boolean }[];
  byGap:         { label: string; count: number }[];
}

const PROOF_TONE: Record<string, string> = {
  missing:        "bg-red-100 text-red-700",
  expired:        "bg-orange-100 text-orange-700",
  conflicting:    "bg-red-100 text-red-700",
  not_checked:    "bg-slate-100 text-slate-600",
  weak_proof:     "bg-lime-100 text-lime-700",
  proven:         "bg-emerald-100 text-emerald-700",
  not_applicable: "bg-slate-100 text-slate-600",
};

const SEV_COLOR: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#94a3b8",
};

export function ReportView({ data, title }: { data: ReportData; title: string }) {
  const [showSections, setShowSections] = useState({
    summary: true, risks: true, proof: true, actions: true, clusters: true, trends: true,
  });

  function exportCsv() {
    const rows = data.topRisks.map((r) => [r.id, r.title, r.severity, String(r.risk), r.site]);
    const text = [["id", "title", "severity", "risk_score", "site"], ...rows]
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8;" }));
    const a   = document.createElement("a");
    a.href    = url;
    a.download = `safetyiq-cells-${data.generatedAt.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="iq-scroll flex-1 overflow-y-auto">
      {/* Controls toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-6 py-3 print:hidden">
        <span className="text-xs font-medium text-slate-500">Sections:</span>
        {Object.entries(showSections).map(([k, v]) => (
          <label key={k} className="flex items-center gap-1 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={v}
              onChange={(e) => setShowSections((s) => ({ ...s, [k]: e.target.checked }))}
              className="accent-blue-600"
            />
            {k.replace(/_/g, " ")}
          </label>
        ))}
        <div className="ml-auto flex gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> Cells CSV
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Printer className="h-4 w-4" /> Print / Save PDF
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-5 p-6">
        {/* Report header */}
        <div className="border-b border-slate-200 pb-3">
          <h1 className="text-2xl font-black text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">
            SafetyIQ risk intelligence report · generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>

        {showSections.summary && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Executive summary</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: "Total cells",    value: data.kpis.total,                    color: undefined     },
                { label: "Open",           value: data.kpis.open,                     color: "#3b82f6"     },
                { label: "High-risk open", value: data.kpis.highOpen,                 color: "#f97316"     },
                { label: "Proof-gap rate", value: `${data.kpis.gapRate}%`,            color: "#eab308"     },
                { label: "Action closure", value: `${data.kpis.actionClosure}%`,      color: "#22c55e"     },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-400">{s.label}</div>
                  <div
                    className="mt-1 text-2xl font-bold"
                    style={s.color ? { color: s.color } : { color: "#1e293b" }}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {showSections.risks && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Highest open risks</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {data.topRisks.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: SEV_COLOR[r.severity] ?? "#94a3b8" }} />
                  <span className="min-w-0 flex-1 truncate text-slate-700">{r.title}</span>
                  <span className="text-xs text-slate-500">{r.site}</span>
                  <span className="w-8 text-right font-semibold text-slate-700">{r.risk}</span>
                </div>
              ))}
              {data.topRisks.length === 0 && (
                <p className="px-4 py-3 text-xs text-slate-400">None.</p>
              )}
            </div>
          </div>
        )}

        {showSections.proof && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Controls missing proof</h3>
              <p className="text-xs text-slate-500">Weak / missing / expired / conflicting</p>
            </div>
            <div className="divide-y divide-slate-50">
              {data.missingProof.slice(0, 12).map((p, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50">
                  <span className="min-w-0 flex-1 truncate text-slate-700">{p.control}</span>
                  <span className="truncate text-xs text-slate-500">{p.cell}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${PROOF_TONE[p.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {p.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
              {data.missingProof.length === 0 && (
                <p className="px-4 py-3 text-xs text-slate-400">All controls proven.</p>
              )}
            </div>
          </div>
        )}

        {showSections.actions && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Overdue actions</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {data.overdueActions.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50">
                  <span className="min-w-0 flex-1 truncate text-slate-700">{a.title}</span>
                  <span className="truncate text-xs text-slate-500">{a.cell}</span>
                  <span className="text-xs text-red-600">due {a.due}</span>
                </div>
              ))}
              {data.overdueActions.length === 0 && (
                <p className="px-4 py-3 text-xs text-slate-400">No overdue actions.</p>
              )}
            </div>
          </div>
        )}

        {showSections.trends && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Trend snapshot — by control gap</h3>
            </div>
            <div className="space-y-1.5 p-4">
              {data.byGap.map((g) => {
                const max = Math.max(1, ...data.byGap.map((x) => x.count));
                return (
                  <div key={g.label} className="flex items-center gap-2">
                    <span className="w-28 truncate text-xs capitalize text-slate-500">{g.label}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
                      <div className="h-full rounded bg-amber-400" style={{ width: `${(g.count / max) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right text-xs font-semibold text-slate-700">{g.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="pt-4 text-center text-[11px] text-slate-400">
          SafetyIQ — Reliance Predictive Safety Technologies
        </p>
      </div>
    </div>
  );
}
