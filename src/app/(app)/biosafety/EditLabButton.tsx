"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil, Microscope } from "lucide-react";
import { updateBiosafetyLab } from "@/lib/actions/ehs";
import type { BiosafetyLab } from "@/lib/types";

const BSL_LEVELS = ["BSL-1", "BSL-2", "BSL-2+", "BSL-3", "BSL-4"];
const STATUSES: BiosafetyLab["status"][] = ["compliant", "minor_gap", "major_gap", "inspection_due"];

export function EditLabButton({ lab }: { lab: BiosafetyLab }) {
  const [open, setOpen]     = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const router              = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd  = new FormData(e.currentTarget);
    const res = await updateBiosafetyLab(lab.id, fd);
    setSaving(false);
    if (!res?.ok) {
      setError(res?.error ?? "Failed to update lab.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => { setError(null); setOpen(true); }}
        className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
      >
        <Pencil className="h-3 w-3" /> Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <Microscope className="h-4 w-4 text-blue-500" />
              <div className="text-sm font-bold text-slate-800">Edit BSL Laboratory</div>
              <button
                onClick={() => setOpen(false)}
                className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
              <div className="text-[11px] text-slate-400">{lab.lab_code}</div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Lab Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  required
                  defaultValue={lab.name}
                  placeholder="e.g. Molecular Biology Lab B"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    BSL Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="bsl_level"
                    defaultValue={lab.bsl_level}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                  >
                    {BSL_LEVELS.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Personnel Count
                  </label>
                  <input
                    name="personnel_count"
                    type="number"
                    min="0"
                    defaultValue={lab.personnel_count}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Status
                  </label>
                  <select
                    name="status"
                    defaultValue={lab.status}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Open Findings
                  </label>
                  <input
                    name="open_findings"
                    type="number"
                    min="0"
                    defaultValue={lab.open_findings}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Next Inspection Date
                </label>
                <input
                  name="next_inspection"
                  type="date"
                  defaultValue={lab.next_inspection ? lab.next_inspection.slice(0, 10) : ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                />
              </div>
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
