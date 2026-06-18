"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ClipboardCheck, X } from "lucide-react";
import { completeWorkspaceTask } from "@/lib/actions/ehs";

interface Props {
  taskId: string;
  taskTitle: string;
  completedById: string;
  completedByName: string;
}

export function CompleteTaskButton({ taskId, taskTitle, completedById, completedByName }: Props) {
  const [open, setOpen]       = useState(false);
  const [done, setDone]       = useState(false);
  const [notes, setNotes]     = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!notes.trim()) return;
    setPending(true);
    await completeWorkspaceTask(taskId, completedById, notes);
    setDone(true);
    setOpen(false);
    setPending(false);
    router.refresh();
  }

  if (done) {
    return (
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <CheckCircle className="h-3.5 w-3.5" />
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Mark complete"
        title="Complete task"
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 text-transparent transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-500"
      >
        <CheckCircle className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-bold text-slate-800">Complete Task</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500 leading-snug max-w-xs">{taskTitle}</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit}>
              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                    Completed By
                  </label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 font-medium">
                    {completedByName}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                    Completion Notes <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    required
                    rows={4}
                    placeholder="Describe what was done, any observations, materials used, or outcome. This becomes the audit record."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
                  />
                  <div className="mt-1 text-[10.5px] text-slate-400">
                    Required — this note is saved as evidence for audit review.
                  </div>
                </div>

                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-[11.5px] text-blue-700 leading-snug">
                  <strong>Completion date & time</strong> will be recorded automatically as{" "}
                  <strong>{new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</strong>.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !notes.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  {pending ? "Saving…" : "Mark Complete & Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
