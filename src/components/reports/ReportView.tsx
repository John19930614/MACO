"use client";

import { useState } from "react";
import { Printer, Download } from "lucide-react";
import { Card, CardHeader, Stat } from "@/components/ui/primitives";
import { SeverityBadge, ProofBadge } from "@/components/ui/badges";
import type { Severity, ProofStatus } from "@/lib/constants";

export interface ReportData {
  generatedAt: string;
  kpis: { total: number; open: number; highOpen: number; gapRate: number; actionClosure: number };
  topRisks: { id: string; title: string; severity: Severity; risk: number; site: string }[];
  missingProof: { control: string; status: ProofStatus; cell: string }[];
  overdueActions: { title: string; due: string; cell: string }[];
  clusters: { gap: string; cells: number; covered: boolean }[];
  coverage: number;
  byGap: { label: string; count: number }[];
  forecast: {
    bands: { green: number; amber: number; orange: number; red: number };
    top: { label: string; site: string; score: number; band: "green" | "amber" | "orange" | "red"; exposure: string | null; recommendation: string }[];
  };
  csv: string[][]; // header + rows
}

const BAND_COLOR: Record<"green" | "amber" | "orange" | "red", string> = { green: "#27500a", amber: "#854f0b", orange: "#b45309", red: "#b80a0a" };

const SECTIONS = [
  ["summary", "Executive summary"],
  ["forecast", "Risk forecast"],
  ["risks", "Highest risks"],
  ["proof", "Controls missing proof"],
  ["actions", "Overdue actions"],
  ["clusters", "Recurring causes & prevention coverage"],
  ["trends", "Trend snapshot"],
] as const;
type SectionKey = (typeof SECTIONS)[number][0];

export function ReportView({ data, title }: { data: ReportData; title: string }) {
  const [on, setOn] = useState<Record<SectionKey, boolean>>({ summary: true, forecast: true, risks: true, proof: true, actions: true, clusters: true, trends: true });

  function exportCsv() {
    const text = data.csv.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `amaya-cells-${data.generatedAt.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="amaya-scroll flex-1 overflow-auto">
      {/* Controls (hidden when printing) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-6 py-3 print:hidden">
        <span className="text-xs font-medium text-slate-500">Sections:</span>
        {SECTIONS.map(([k, label]) => (
          <label key={k} className="flex items-center gap-1 text-xs text-slate-600">
            <input type="checkbox" checked={on[k]} onChange={(e) => setOn((s) => ({ ...s, [k]: e.target.checked }))} className="accent-[var(--color-pclss)]" />
            {label}
          </label>
        ))}
        <div className="ml-auto flex gap-2">
          <button onClick={exportCsv} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <Download className="h-4 w-4" /> Cells CSV
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-pclss)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
            <Printer className="h-4 w-4" /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Printable report body */}
      <div className="mx-auto max-w-4xl space-y-5 p-6">
        <div className="border-b border-slate-200 pb-3">
          <h1 className="text-2xl font-black text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">AMAYA safety intelligence report · generated {new Date(data.generatedAt).toLocaleString()}</p>
        </div>

        {on.summary && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Executive summary</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Total cells" value={data.kpis.total} />
              <Stat label="Open" value={data.kpis.open} accent="var(--color-pclss)" />
              <Stat label="High-risk open" value={data.kpis.highOpen} accent="var(--color-sev-high)" />
              <Stat label="Proof-gap rate" value={`${data.kpis.gapRate}%`} accent="var(--color-hsl)" />
              <Stat label="Action closure" value={`${data.kpis.actionClosure}%`} accent="var(--color-curve)" />
            </div>
          </section>
        )}

        {on.forecast && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Risk forecast — what is likely to fail next</h2>
            <div className="mb-3 grid grid-cols-4 gap-3">
              <Stat label="Red" value={data.forecast.bands.red} accent={BAND_COLOR.red} />
              <Stat label="Orange" value={data.forecast.bands.orange} accent={BAND_COLOR.orange} />
              <Stat label="Amber" value={data.forecast.bands.amber} accent={BAND_COLOR.amber} />
              <Stat label="Green" value={data.forecast.bands.green} accent={BAND_COLOR.green} />
            </div>
            <Card>
              <CardHeader title="Top at-risk locations" subtitle="ARC P-CLSS · Anticipate / Forecast" />
              <div className="divide-y divide-slate-100">
                {data.forecast.top.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: BAND_COLOR[f.band] }}>{f.score}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-slate-700">{f.label}</span>
                      <span className="block truncate text-[11px] text-slate-400">{f.site}{f.exposure ? ` · predicted: ${f.exposure.replace(/_/g, " ")}` : ""}</span>
                    </span>
                    <span className="hidden max-w-[260px] truncate text-[11px] text-slate-500 sm:block">{f.recommendation}</span>
                  </div>
                ))}
                {data.forecast.top.length === 0 && <p className="px-4 py-3 text-xs text-slate-400">No at-risk locations forecast.</p>}
              </div>
            </Card>
          </section>
        )}

        {on.risks && (
          <Card>
            <CardHeader title="Highest open risks" />
            <div className="divide-y divide-slate-100">
              {data.topRisks.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <SeverityBadge severity={r.severity} />
                  <span className="min-w-0 flex-1 truncate text-slate-700">{r.title}</span>
                  <span className="text-xs text-slate-400">{r.site}</span>
                  <span className="w-8 text-right font-semibold text-slate-600">{r.risk}</span>
                </div>
              ))}
              {data.topRisks.length === 0 && <p className="px-4 py-3 text-xs text-slate-400">None.</p>}
            </div>
          </Card>
        )}

        {on.proof && (
          <Card>
            <CardHeader title="Controls missing proof" subtitle="Weak / missing / expired / conflicting" />
            <div className="divide-y divide-slate-100">
              {data.missingProof.slice(0, 12).map((p, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-slate-700">{p.control}</span>
                  <span className="truncate text-xs text-slate-400">{p.cell}</span>
                  <ProofBadge status={p.status} />
                </div>
              ))}
              {data.missingProof.length === 0 && <p className="px-4 py-3 text-xs text-slate-400">All controls proven.</p>}
            </div>
          </Card>
        )}

        {on.actions && (
          <Card>
            <CardHeader title="Overdue actions" />
            <div className="divide-y divide-slate-100">
              {data.overdueActions.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-slate-700">{a.title}</span>
                  <span className="truncate text-xs text-slate-400">{a.cell}</span>
                  <span className="text-xs text-red-600">due {a.due}</span>
                </div>
              ))}
              {data.overdueActions.length === 0 && <p className="px-4 py-3 text-xs text-slate-400">No overdue actions.</p>}
            </div>
          </Card>
        )}

        {on.clusters && (
          <Card>
            <CardHeader title="Recurring causes & prevention coverage" subtitle={`${data.coverage}% of control-gap clusters have a prevention attached`} />
            <div className="divide-y divide-slate-100">
              {data.clusters.map((c) => (
                <div key={c.gap} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="min-w-0 flex-1 capitalize text-slate-700">{c.gap} control gap</span>
                  <span className="text-xs text-slate-400">{c.cells} cells</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.covered ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {c.covered ? "covered" : "no prevention"}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {on.trends && (
          <Card>
            <CardHeader title="Trend snapshot — by control gap" />
            <div className="space-y-1.5 p-4">
              {data.byGap.map((g) => {
                const max = Math.max(1, ...data.byGap.map((x) => x.count));
                return (
                  <div key={g.label} className="flex items-center gap-2">
                    <span className="w-28 truncate text-xs capitalize text-slate-600">{g.label}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
                      <div className="h-full rounded bg-[var(--color-hsl)]" style={{ width: `${(g.count / max) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right text-xs font-semibold text-slate-600">{g.count}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <p className="pt-4 text-center text-[10px] text-slate-400">AMAYA — Advanced Mapping AI for Yielding Action · Reliance Predictive Safety Technologies</p>
      </div>
    </div>
  );
}
