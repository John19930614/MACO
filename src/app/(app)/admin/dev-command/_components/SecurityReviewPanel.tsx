"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { Badge } from "./badges";
import { EmptyStateCard } from "./states";
import { resolveSecurityReview, requestSecurityApproval } from "@/lib/actions/devcenter";
import { ShieldCheck, ShieldAlert, Check, AlertTriangle, Loader2 } from "lucide-react";
import type { DevSecurityReview } from "@/lib/devcenter/types";

interface Finding { category?: string; severity?: string; ok?: boolean; note?: string }

const SEV_TONE: Record<string, "neutral" | "warn" | "danger"> = { low: "neutral", medium: "warn", high: "danger", critical: "danger" };
const VERDICT_TONE = { pass: "success", needs_changes: "warn", fail: "danger", pending: "neutral" } as const;
const VERDICT_LABEL = { pass: "Looks safe", needs_changes: "Needs changes", fail: "Critical risk", pending: "Not reviewed" } as const;

/**
 * Security review: ten checks with severity flags. A critical finding blocks the
 * task from completing until it's resolved or a security approval is granted.
 */
export function SecurityReviewPanel({ reviews, taskId, actionable = false }: { reviews: DevSecurityReview[]; taskId: string; actionable?: boolean }) {
  return (
    <Card>
      <CardHeader title="Security review" subtitle="Ten checks for login, data-access, secret, and permission risks" right={<ShieldCheck className="h-4 w-4 text-slate-300" />} />
      <div className="p-4">
        {reviews.length === 0 ? (
          <EmptyStateCard title="No security review yet" description="The security agent reviews the change at the security stage." />
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => <ReviewBlock key={r.id} review={r} taskId={taskId} actionable={actionable} />)}
          </div>
        )}
      </div>
    </Card>
  );
}

function ReviewBlock({ review: r, taskId, actionable }: { review: DevSecurityReview; taskId: string; actionable: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const findings = (Array.isArray(r.findings) ? r.findings : []) as Finding[];
  const isCriticalOpen = r.verdict === "fail" && r.status === "open";

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-300">{r.summary}</p>
        <Badge label={VERDICT_LABEL[r.verdict]} tone={VERDICT_TONE[r.verdict]} />
      </div>

      {/* Critical risk blocker */}
      {isCriticalOpen && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span><span className="font-semibold">Critical security risk.</span> This task can&apos;t complete until it&apos;s reviewed and resolved, or a security approval is granted.</span>
        </div>
      )}

      {/* The checks / findings */}
      {findings.length > 0 && (
        <ul className="mt-2 space-y-1">
          {findings.map((f, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs">
              {f.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />}
              <span className="flex-1 text-slate-600 dark:text-slate-300">
                <span className="font-medium">{f.category}</span>{!f.ok && f.note ? ` — ${f.note}` : ""}
              </span>
              {!f.ok && f.severity && <Badge label={f.severity} tone={SEV_TONE[f.severity] ?? "neutral"} />}
            </li>
          ))}
        </ul>
      )}

      {/* Actions for an open critical review */}
      {actionable && isCriticalOpen && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          {msg && <span className="text-[11px] text-emerald-700 dark:text-emerald-300">{msg}</span>}
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          <button type="button" disabled={pending} onClick={() => start(async () => { const x = await requestSecurityApproval(taskId); setMsg(x.message ?? null); })}
            className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-950/50 dark:text-amber-300">Request security approval</button>
          <button type="button" disabled={pending} onClick={() => start(async () => { await resolveSecurityReview(r.id); })}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">Mark reviewed &amp; resolve</button>
        </div>
      )}
    </div>
  );
}
