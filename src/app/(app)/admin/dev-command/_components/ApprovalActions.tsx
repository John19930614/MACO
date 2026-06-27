"use client";

import { useState, useTransition } from "react";
import { decideApproval } from "@/lib/actions/devcenter";
import { Loader2 } from "lucide-react";

/** Real Approve / Reject buttons for a pending approval (the human gate). */
export function ApprovalActions({ approvalId }: { approvalId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const decide = (decision: "approved" | "rejected") =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("approval_id", approvalId);
      fd.set("decision", decision);
      const r = await decideApproval({ ok: false }, fd);
      if (!r.ok) setError(r.error ?? "Something went wrong.");
    });

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[11px] text-red-500">{error}</span>}
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
      <button
        type="button" disabled={pending} onClick={() => decide("rejected")}
        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300"
      >
        Reject
      </button>
      <button
        type="button" disabled={pending} onClick={() => decide("approved")}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        Approve
      </button>
    </div>
  );
}
