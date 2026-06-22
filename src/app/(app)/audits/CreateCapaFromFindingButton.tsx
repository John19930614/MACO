"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, X, CheckCircle } from "lucide-react";
import { addCapaFromFinding } from "@/lib/actions/ehs";
import type { AuditFinding } from "@/lib/types";
import type { Severity } from "@/lib/constants";

interface Props {
  finding: AuditFinding;
}

export function CreateCapaFromFindingButton({ finding }: Props) {
  const [open, setOpen]       = useState(false);
  const [done, setDone]       = useState(false);
  const [pending, setPending] = useState(false);
  const [title, setTitle]     = useState(`CAPA: ${finding.title}`);
  const [severity, setSeverity] = useState(finding.severity ?? "medium");
  const [dueDate, setDueDate]   = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("description", finding.description ?? "");
    fd.set("severity", severity);
    if (dueDate) fd.set("due_date", dueDate);
    await addCapaFromFinding(finding.title, finding.description ?? "", fd);
    setDone(true);
    setOpen(false);
    setPending(false);
    router.refresh();
  }

  if (done) {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
        <CheckCircle className="h-3 w-3" /> CAPA Created
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-md bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700 hover:bg-orange-100 transition"
        title="Create CAPA from this finding"
      >
        <Zap className="h-3 w-3" />
        CAPA
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-bold text-slate-800">Create CAPA from Finding</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500 line-clamp-2 max-w-xs">{finding.title}</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 px-5 py-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                    CAPA Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                      Severity
                    </label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as Severity)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !title.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  <Zap className="h-3.5 w-3.5" />
                  {pending ? "Creating…" : "Create CAPA"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
