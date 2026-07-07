"use client";

import { useState, useTransition } from "react";
import {
  confirmEscalation,
  dismissEscalation,
  type EscalationQueueItem,
} from "@/lib/actions/phase-4-action-response";
import type { EscalationStatus } from "@/lib/types";

// One escalation card per high-risk site. Mobile-first single column (per the
// Human Experience note — this is reviewed on a phone). Status shown as
// word+icon, never colour alone. Two big actions: confirm (notify) and dismiss.
export function Phase4Action({ escalation }: { escalation: EscalationQueueItem }) {
  const [description, setDescription] = useState(escalation.draftCapaDescription);
  const [status, setStatus] = useState<EscalationStatus>(escalation.status);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const recipientLabel = escalation.recipients.join(", ") || "your team";

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const res = await confirmEscalation({
        escalationId: escalation.id,
        recipients: escalation.recipients.length ? escalation.recipients : ["Site EHS team"],
        description,
      });
      if (res.ok) setStatus("confirmed");
      else setError(res.error);
    });
  };

  const handleDismiss = () => {
    setError(null);
    startTransition(async () => {
      const res = await dismissEscalation(escalation.id);
      if (res.ok) setStatus("dismissed");
      else setError(res.error);
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">{escalation.siteName}</h2>
        <StatusBadge status={status} />
      </div>

      <p className="text-sm text-slate-700 dark:text-slate-200">
        This site has crossed into high-risk territory (Red). {escalation.reasonPlainText}
      </p>

      {/* Alert-fatigue guardrail: paging is intentionally paused platform-wide. */}
      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <span aria-hidden>⏸️</span> Automatic notifications are paused for {escalation.siteName} — a manager must review
        and approve before anyone is paged. No phone or SMS alert is sent by this screen.
      </p>

      {status === "needs_review" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
          <label
            htmlFor={`capa-${escalation.id}`}
            className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            Suggested corrective action (needs your review)
          </label>
          <textarea
            id={`capa-${escalation.id}`}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error} What to do next: refresh the page, or contact your admin if this keeps happening.
        </p>
      )}

      {status === "needs_review" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={isPending}
            onClick={handleConfirm}
            className="flex-1 rounded-md bg-red-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {isPending ? "Working…" : "Yes, notify the team"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleDismiss}
            className="rounded-md border border-slate-300 px-4 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Dismiss
          </button>
        </div>
      ) : status === "confirmed" ? (
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <span aria-hidden>✅</span> We notified {recipientLabel}. This is recorded with who and when for the audit trail.
        </p>
      ) : (
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          <span aria-hidden>✖️</span> Dismissed — no notification was sent. This is logged.
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: EscalationStatus }) {
  const map: Record<EscalationStatus, { label: string; icon: string; cls: string }> = {
    needs_review: { label: "Needs review", icon: "⏳", cls: "border-amber-300 text-amber-800 dark:text-amber-200" },
    confirmed: { label: "Notified", icon: "✅", cls: "border-emerald-300 text-emerald-700 dark:text-emerald-300" },
    dismissed: { label: "Dismissed", icon: "✖️", cls: "border-slate-300 text-slate-500 dark:text-slate-400" },
  };
  const s = map[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      <span aria-hidden>{s.icon}</span> {s.label}
    </span>
  );
}
