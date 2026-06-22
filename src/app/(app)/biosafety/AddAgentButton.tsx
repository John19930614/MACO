"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, FlaskConical } from "lucide-react";
import { createBiohazardAgent } from "@/lib/actions/ehs";
import { playCreateSound } from "@/lib/sounds";

const RISK_CLASSES = ["Risk Group 1", "Risk Group 2", "Risk Group 3", "Risk Group 4"];

export function AddAgentButton() {
  const [open, setOpen]     = useState(false);
  const [saving, setSaving] = useState(false);
  const router              = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    await createBiohazardAgent(null, fd);
    setSaving(false);
    playCreateSound();
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600"
      >
        <Plus className="h-3 w-3" /> Add Agent
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <FlaskConical className="h-4 w-4 text-amber-500" />
              <div className="text-sm font-bold text-slate-800">Register Biological Agent</div>
              <button
                onClick={() => setOpen(false)}
                className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Agent Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="agent_name"
                  required
                  placeholder="e.g. Bacillus anthracis (inactivated)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Risk Classification <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="risk_class"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                  >
                    {RISK_CLASSES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Quantity / Volume
                  </label>
                  <input
                    name="quantity"
                    placeholder="e.g. 50 mL"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Storage Location <span className="text-red-500">*</span>
                </label>
                <input
                  name="storage_location"
                  required
                  placeholder="e.g. BSL-2 Freezer — Lab 1"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                />
              </div>
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
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
                >
                  {saving ? "Registering…" : "Add Agent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
