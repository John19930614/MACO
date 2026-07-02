"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, X } from "lucide-react";
import { deleteDevTask } from "@/lib/actions/devcenter";

export function DeleteTaskButton({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteDevTask(taskId);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      router.push("/admin/dev-command/tasks");
    });
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete task
      </button>

      {/* Confirmation dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Delete this task?</h2>
              </div>
              <button
                onClick={() => { setOpen(false); setError(null); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This will permanently delete:
              </p>
              <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{taskTitle}</p>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All agent runs, messages, approvals, review gates, test results, and audit entries for this task will also be deleted. <strong className="text-red-600 dark:text-red-400">This cannot be undone.</strong>
              </p>
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-700">
              <button
                onClick={() => { setOpen(false); setError(null); }}
                disabled={pending}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={pending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {pending ? "Deleting…" : "Yes, delete task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
