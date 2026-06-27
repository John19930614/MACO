import { Card, CardHeader } from "@/components/ui/primitives";
import { ApprovalStatusBadge, RiskLevelBadge } from "./badges";
import { EmptyStateCard } from "./states";
import { ApprovalActions } from "./ApprovalActions";
import { APPROVAL_TYPE_LABEL } from "@/lib/devcenter/labels";
import { relativeTime } from "@/lib/utils";
import { ShieldQuestion, Lock } from "lucide-react";
import type { DevApproval } from "@/lib/devcenter/types";

/**
 * The human approval gate. Shows each request the AI team raised before doing
 * something risky, with a plain-English summary of exactly what would change.
 *
 * PHASE 2: the Approve / Reject buttons are intentionally disabled — no real
 * action can be taken yet. Deciding approvals becomes active in a later phase.
 */
export function ApprovalCenter({
  approvals,
  title = "Approvals",
  subtitle = "Risky actions the AI team needs you to approve before it continues",
  actionable = false,
}: {
  approvals: DevApproval[];
  title?: string;
  subtitle?: string;
  /** When true, render real Approve/Reject buttons (live tasks). */
  actionable?: boolean;
}) {
  const pending = approvals.filter((a) => a.status === "pending");
  const decided = approvals.filter((a) => a.status !== "pending");

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={subtitle}
        right={pending.length > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            {pending.length} waiting
          </span>
        ) : undefined}
      />
      <div className="p-4">
        {approvals.length === 0 ? (
          <EmptyStateCard
            icon={<ShieldQuestion className="h-6 w-6" />}
            title="No approvals needed"
            description="When an agent wants to do something risky, the request shows up here for your decision."
          />
        ) : (
          <div className="space-y-3">
            {[...pending, ...decided].map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {APPROVAL_TYPE_LABEL[a.approval_type]}
                      </span>
                      <RiskLevelBadge level={a.risk_level} />
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">{a.summary}</p>
                  </div>
                  <ApprovalStatusBadge status={a.status} />
                </div>

                {a.proposed_change && (
                  <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">What would change</p>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{a.proposed_change}</p>
                  </div>
                )}

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-400">
                    {a.requested_by ? `Asked by ${a.requested_by}` : "Requested"} · {relativeTime(a.created_at)}
                    {a.status !== "pending" && a.decided_by ? ` · decided by ${a.decided_by}` : ""}
                  </p>
                  {a.status === "pending" && (
                    actionable ? (
                      <ApprovalActions approvalId={a.id} />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <Lock className="h-3 w-3" /> Open this task to approve
                        </span>
                        <button type="button" disabled className="cursor-not-allowed rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400 dark:bg-slate-800">Reject</button>
                        <button type="button" disabled className="cursor-not-allowed rounded-lg bg-emerald-200/60 px-3 py-1.5 text-xs font-semibold text-emerald-700/60 dark:bg-emerald-900/40 dark:text-emerald-300/60">Approve</button>
                      </div>
                    )
                  )}
                  {a.status !== "pending" && a.decision_note && (
                    <p className="text-[11px] italic text-slate-400">“{a.decision_note}”</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
