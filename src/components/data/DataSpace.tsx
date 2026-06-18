"use client";

import { useState } from "react";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import type { IntegrityReport } from "@/lib/data/integrity";
import type { Severity } from "@/lib/constants";
import { SeverityBadge } from "@/components/ui/badges";
import { CellAnatomy } from "./CellAnatomy";

interface CellRef { id: string; title: string; severity: Severity; site_id: string }

export function DataSpace({ report, cells, sites }: { report: IntegrityReport; cells: CellRef[]; sites: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState(cells[0]?.id ?? "");
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Table counts */}
      <div className="border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex flex-wrap gap-2">
          {Object.entries(report.counts).map(([table, n]) => (
            <div key={table} className="rounded-lg border border-slate-200 px-2.5 py-1">
              <span className="font-mono text-[10px] text-slate-400">{table}</span>
              <span className="ml-1.5 text-sm font-bold text-slate-700">{n}</span>
            </div>
          ))}
        </div>
        {/* Integrity banner */}
        <div className={`mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${report.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {report.ok ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <div>
            {report.ok ? (
              <span><strong>Database consistent.</strong> {report.checked} records checked — every reference resolves and every child matches its cell&apos;s tenant.</span>
            ) : (
              <div>
                <strong>{report.issues.length} integrity issue(s) found</strong> ({report.checked} records checked):
                <ul className="mt-1 list-inside list-disc text-xs">
                  {report.issues.slice(0, 12).map((i, k) => <li key={k}>{i}</li>)}
                  {report.issues.length > 12 && <li>…and {report.issues.length - 12} more</li>}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cell picker */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-6 py-2">
        <span className="text-xs font-medium text-slate-500">Inspect cell:</span>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="max-w-md flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm">
          {cells.map((c) => (
            <option key={c.id} value={c.id}>{c.title} — {siteName(c.site_id)}</option>
          ))}
        </select>
        {cells.find((c) => c.id === selected) && <SeverityBadge severity={cells.find((c) => c.id === selected)!.severity} />}
      </div>

      {/* Anatomy graph */}
      <div className="relative min-h-0 flex-1 bg-slate-50">
        {selected && <CellAnatomy id={selected} />}
      </div>
    </div>
  );
}
