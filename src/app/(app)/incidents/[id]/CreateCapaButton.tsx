"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X, Zap } from "lucide-react";
import { addCapaFromIncident } from "@/lib/actions/ehs";
import type { Incident } from "@/lib/types";
import type { Severity } from "@/lib/constants";

interface Props {
  incident: Incident;
}

export function CreateCapaButton({ incident }: Props) {
  const [open, setOpen]       = useState(false);
  const [done, setDone]       = useState(incident.status === "capa_open");
  const [pending, setPending] = useState(false);
  const [title, setTitle]     = useState(`CAPA: ${incident.title}`);
  const [description, setDescription] = useState(
    incident.description ? `Incident: ${incident.description}` : "",
  );
  const [severity, setSeverity] = useState(incident.severity ?? "medium");
  const [dueDate, setDueDate]   = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("description", description);
    fd.set("severity", severity);
    fd.set("kind", "corrective");
    if (dueDate) fd.set("due_date", dueDate);
    await addCapaFromIncident(incident.id, fd);
    setDone(true);
    setOpen(false);
    setPending(false);
    router.refresh();
  }

  if (done) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700">
        <Zap className="h-3.5 w-3.5" />
        CAPA Created
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
      >
        <Zap className="h-3.5 w-3.5" />
        Create CAPA
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-bold text-slate-800">Create CAPA from Incident</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500 leading-snug max-w-sm line-clamp-2">
                  {incident.title}
                </div>
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

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none resize-none"
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

                <div className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2.5 text-[11.5px] text-orange-700 leading-snug">
                  This will create a linked CAPA and update the incident status to <strong>CAPA Open</strong>.
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
