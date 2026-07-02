"use client";

import { useState, useTransition } from "react";
import { decideApproval } from "@/lib/actions/devcenter";
import { Loader2, AlertTriangle } from "lucide-react";
import type { DevApproval } from "@/lib/devcenter/types";

/**
 * Approve / Reject / Request-revision for an approval, with a decision-notes
 * field and a confirmation step for high-risk approvals. Rejections require a
 * note. Only reachable on live tasks (the page is superadmin-gated).
 */
export function ApprovalActions({ approval }: { approval: DevApproval }) {
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmHighRisk, setConfirmHighRisk] = useState(false);
  const highRisk = approval.risk_level === "high" || approval.risk_level === "critical";

  const submit = (decision: "approved" | "rejected" | "needs_revision") =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("approval_id", approval.id);
      fd.set("decision", decision);
      fd.set("note", notes);
      const r = await decideApproval({ ok: false }, fd);
      if (!r.ok) setError(r.error ?? "Something went wrong.");
      else setConfirmHighRisk(false);
    });

  const onApprove = () => {
    if (highRisk && !confirmHighRisk) { setConfirmHighRisk(true); return; }
    submit("approved");
  };
  const onReject = () => {
    if (!notes.trim()) { setError("Please add a note explaining why you're rejecting this."); return; }
    submit("rejected");
  };

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Decision notes (required if rejecting)…"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {error && <span className="mr-auto text-[11px] text-red-500">{error}</span>}
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
        <button type="button" disabled={pending} onClick={() => submit("needs_revision")}
          className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-950/50 dark:text-amber-300">Request revision</button>
        <button type="button" disabled={pending} onClick={onReject}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300">Reject</button>
        <button type="button" disabled={pending} onClick={onApprove}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">Approve</button>
      </div>

      {/* High-risk confirmation */}
      {confirmHighRisk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmHighRisk(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">High-risk approval</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  You are approving a high-risk platform change. Review the affected files, database tables, and security notes before continuing.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmHighRisk(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">Cancel</button>
              <button type="button" disabled={pending} onClick={() => submit("approved")}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
                {pending ? "Approving…" : "I understand — approve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
