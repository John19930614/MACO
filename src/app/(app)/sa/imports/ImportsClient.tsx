"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DarkPageHeader, DarkCard, DarkCardHeader, Pill } from "@/components/ui/primitives";
import { X } from "lucide-react";
import { createImportJob } from "@/lib/actions/sa";
import type { ImportJob, TenantSummary } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  complete:    "bg-emerald-900/50 text-emerald-300",
  completed:   "bg-emerald-900/50 text-emerald-300",
  in_progress: "bg-amber-900/50 text-amber-300",
  pending:     "bg-blue-900/50 text-blue-300",
  failed:      "bg-red-900/50 text-red-300",
};

const KINDS = ["Chemical Inventory", "Training Records", "Legal Requirements", "SDS Documents", "Waste Streams", "Inspection Records", "CAPA Records"];
const STATUSES = ["pending", "in_progress", "complete", "failed"];

function fmt(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function NewImportModal({
  tenants,
  onClose,
  onCreated,
}: {
  tenants: TenantSummary[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await createImportJob(null, new FormData(e.currentTarget));
    setSaving(false);
    if (res.ok) {
      onCreated();
      onClose();
    } else {
      setError(res.error || "Failed to log import job.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/60 border border-white/8 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div className="text-sm font-bold text-white">Log Data Import</div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/6"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="rounded-lg bg-slate-800/40 border border-white/5 px-3 py-2 text-[11px] leading-snug text-slate-400">
            This records a manual import in the job log for tracking. No file is uploaded or processed here — enter the details of an import you performed.
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Tenant</label>
            <select name="tenant_id" defaultValue=""
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none">
              <option value="">— Unassigned —</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Data Type</label>
            <select name="kind" defaultValue={KINDS[0]}
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none">
              {KINDS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Filename</label>
              <input name="filename" placeholder="e.g. chemicals_2026.csv"
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-900/50" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Row Count</label>
              <input name="row_count" type="number" min="0" placeholder="0"
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-900/50" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Status</label>
            <select name="status" defaultValue="pending"
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none">
              {STATUSES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          </div>
          {error && <div className="rounded-lg bg-red-900/40 border border-red-800/50 px-3 py-2 text-xs text-red-300">{error}</div>}
          <div className="flex justify-end gap-2 pt-1 border-t border-white/5">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/4">Cancel</button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : "Log Import"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ImportsClient({ jobs, tenants }: { jobs: ImportJob[]; tenants: TenantSummary[] }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast]         = useState("");

  const tenantName = (id: string) => tenants.find(t => t.id === id)?.name ?? (id ? id.slice(0, 8) : "Unassigned");

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  return (
    <div className="flex flex-1 flex-col">
      {showModal && (
        <NewImportModal
          tenants={tenants}
          onClose={() => setShowModal(false)}
          onCreated={() => { flash("Import logged"); router.refresh(); }}
        />
      )}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          ✓ {toast}
        </div>
      )}
      <DarkPageHeader
        title="Data Imports"
        subtitle="Manual import job log — chemicals, training records, documents. Records are tracked here; files are processed outside this view."
        actions={
          <button onClick={() => setShowModal(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            + Log Import
          </button>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <DarkCard>
          <DarkCardHeader title="Import History" subtitle={`${jobs.length} ${jobs.length === 1 ? "job" : "jobs"}`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Tenant</th>
                  <th className="px-4 py-2.5 text-left">Data Type</th>
                  <th className="px-4 py-2.5 text-left">Filename</th>
                  <th className="px-4 py-2.5 text-center">Rows</th>
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                      No imports logged yet — use “Log Import” to record a data import job.
                    </td>
                  </tr>
                )}
                {jobs.map(j => (
                  <tr key={j.id} className="hover:bg-white/4">
                    <td className="px-4 py-3 font-medium text-white">{tenantName(j.tenant_id)}</td>
                    <td className="px-4 py-3 text-sm text-slate-200">{j.kind}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{j.filename || "—"}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-200">{j.row_count > 0 ? j.row_count : "—"}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-300">{fmt(j.created_at)}</td>
                    <td className="px-4 py-3">
                      <Pill className={STATUS_STYLE[j.status] ?? "bg-slate-800 text-slate-400"}>{j.status.replace("_", " ")}</Pill>
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
