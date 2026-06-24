"use client";

import { useState } from "react";
import { DarkPageHeader, DarkCard, DarkCardHeader, Pill } from "@/components/ui/primitives";
import { X, Upload } from "lucide-react";
import { MOCK_MODE } from "@/lib/env";

interface Import {
  id: string; tenant: string; type: string; records: number; status: string; date: string;
}

const MOCK_IMPORTS: Import[] = [
  { id: "imp-001", tenant: "BioStar Research Inc.", type: "Chemical Inventory", records: 8,  status: "complete",     date: "2026-06-10" },
  { id: "imp-002", tenant: "BioStar Research Inc.", type: "Training Records",   records: 14, status: "complete",     date: "2026-06-10" },
  { id: "imp-003", tenant: "BioStar Research Inc.", type: "Legal Requirements", records: 6,  status: "complete",     date: "2026-06-10" },
  { id: "imp-004", tenant: "NovaChem Solutions",    type: "Chemical Inventory", records: 0,  status: "pending",      date: "2026-06-17" },
  { id: "imp-005", tenant: "GenTech Biopharma",     type: "SDS Documents",      records: 23, status: "in_progress",  date: "2026-06-16" },
];

const STATUS_STYLE: Record<string, string> = {
  complete:    "bg-emerald-900/50 text-emerald-300",
  in_progress: "bg-amber-900/50 text-amber-300",
  pending:     "bg-blue-900/50 text-blue-300",
  failed:      "bg-red-900/50 text-red-300",
};

// Demo tenant names for the import-form picker — only offered in MOCK_MODE.
const TENANTS   = MOCK_MODE ? ["BioStar Research Inc.", "NovaChem Solutions", "GenTech Biopharma", "Meridian Diagnostics", "PharmaLink Corp"] : [];
const DATA_TYPES = ["Chemical Inventory", "Training Records", "Legal Requirements", "SDS Documents", "Waste Streams", "Inspection Records", "CAPA Records"];

function fmt(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function NewImportModal({ onClose, onAdd }: { onClose: () => void; onAdd: (i: Import) => void }) {
  const [tenant, setTenant]   = useState(TENANTS[0] ?? "");
  const [type, setType]       = useState(DATA_TYPES[0]);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving]   = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) setFileName(e.target.files[0].name);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    setTimeout(() => {
      onAdd({
        id:      `imp-${Date.now()}`,
        tenant,
        type,
        records: 0,
        status:  "pending",
        date:    today,
      });
      onClose();
    }, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/60 border border-white/8 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div className="text-sm font-bold text-white">New Data Import</div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/6"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Tenant</label>
            <select value={tenant} onChange={e => setTenant(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none">
              {TENANTS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Data Type</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none">
              {DATA_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">File (CSV or Excel)</label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-white/10 px-4 py-5 text-center hover:border-blue-500 hover:bg-blue-900/20">
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="sr-only" />
              <Upload className="h-5 w-5 text-slate-400" />
              <div className="text-left">
                <div className="text-xs font-semibold text-slate-200">{fileName || "Click to select file"}</div>
                <div className="text-[10.5px] text-slate-400">CSV, XLS, XLSX · max 50 MB</div>
              </div>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1 border-t border-white/5">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/4">Cancel</button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Queuing…" : "Start Import"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SAImportsPage() {
  // No import-pipeline backend yet — demo data only in MOCK_MODE; empty in prod.
  const [imports, setImports] = useState<Import[]>(MOCK_MODE ? MOCK_IMPORTS : []);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast]         = useState("");

  function handleAdd(i: Import) {
    setImports(prev => [i, ...prev]);
    setToast(`Import queued for ${i.tenant}`);
    setTimeout(() => setToast(""), 3000);
  }

  return (
    <div className="flex flex-1 flex-col">
      {showModal && <NewImportModal onClose={() => setShowModal(false)} onAdd={handleAdd} />}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          ✓ {toast}
        </div>
      )}
      <DarkPageHeader
        title="Data Imports"
        subtitle="Client data ingestion — chemicals, training records, documents"
        actions={
          <button onClick={() => setShowModal(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            + New Import
          </button>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <DarkCard>
          <DarkCardHeader title="Import History" subtitle={`${imports.length} imports`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Tenant</th>
                  <th className="px-4 py-2.5 text-left">Data Type</th>
                  <th className="px-4 py-2.5 text-center">Records</th>
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {imports.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                      No imports yet — this view will populate once data ingestion is connected.
                    </td>
                  </tr>
                )}
                {imports.map(i => (
                  <tr key={i.id} className="hover:bg-white/4">
                    <td className="px-4 py-3 font-medium text-white">{i.tenant}</td>
                    <td className="px-4 py-3 text-sm text-slate-200">{i.type}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-200">{i.records > 0 ? i.records : "—"}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-300">{fmt(i.date)}</td>
                    <td className="px-4 py-3">
                      <Pill className={STATUS_STYLE[i.status] ?? "bg-slate-800 text-slate-400"}>{i.status.replace("_", " ")}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DarkCard>
      </div>
    </div>
  );
}
