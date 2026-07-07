"use client";

// Two-person sign-off panel for the Predictive Risk go-live gate. Rendered on
// the dashboard only while status === 'preview', and only for users who can act
// on at least one step. Step 1 (EHS lead) is gated by canManage(); Step 2
// (superadmin) is gated by the isSuperadmin flag resolved server-side — NOTE
// there is no "superadmin" role value in this platform; a superadmin is a
// profile with tenant_id IS NULL (see @/lib/auth/session#isSuperadmin), so it
// arrives here as a boolean prop, never as currentUserRole.

import { useState, useTransition } from "react";
import { canManage, type Role } from "@/lib/constants";
import { approveGoLiveStep } from "@/lib/actions/predictive-risk-engine";

type Props = {
  ehsLeadApprovedAt: string | null;
  superadminApprovedAt: string | null;
  currentUserRole: string;
  isSuperadmin: boolean;
  /** Tenant being approved — required for the superadmin step (they have none of their own). */
  tenantId?: string | null;
  onApproved?: () => void;
};

export function Phase1Go({
  ehsLeadApprovedAt,
  superadminApprovedAt,
  currentUserRole,
  isSuperadmin,
  tenantId,
  onApproved,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function approve(step: "ehs_lead" | "superadmin") {
    setError(null);
    startTransition(async () => {
      const res = await approveGoLiveStep(step, step === "superadmin" ? tenantId ?? undefined : undefined);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onApproved?.();
    });
  }

  const canApproveEhsLead = canManage(currentUserRole as Role);
  const canApproveSuperadmin = isSuperadmin;

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
      <p className="font-medium text-amber-900 dark:text-amber-200">Before this goes live for your team</p>
      <p className="mt-0.5 text-sm text-amber-800/80 dark:text-amber-200/70">
        Two people sign off — an EHS lead and a Reliance superadmin. The dashboard flips to Live automatically once both are recorded.
      </p>
      <ol className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
        <li className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Step 1 — EHS lead review:</span>
          {ehsLeadApprovedAt ? (
            <span className="text-emerald-700 dark:text-emerald-400">
              ✅ Approved on {new Date(ehsLeadApprovedAt).toLocaleDateString()}
            </span>
          ) : canApproveEhsLead ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => approve("ehs_lead")}
              className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Approve"}
            </button>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">Waiting on EHS lead</span>
          )}
        </li>
        <li className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Step 2 — Superadmin approval:</span>
          {superadminApprovedAt ? (
            <span className="text-emerald-700 dark:text-emerald-400">
              ✅ Approved on {new Date(superadminApprovedAt).toLocaleDateString()}
            </span>
          ) : canApproveSuperadmin ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => approve("superadmin")}
              className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Approve"}
            </button>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">Waiting on superadmin</span>
          )}
        </li>
      </ol>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
