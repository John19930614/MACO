"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { Badge } from "./badges";
import { decideReviewGate } from "@/lib/actions/devcenter";
import { REVIEW_GATE_META, REVIEW_STATUS_META } from "@/lib/devcenter/labels";
import { ShieldCheck, Check, X, AlertTriangle, Loader2, History } from "lucide-react";
import type { DevReviewGate, ReviewGateType } from "@/lib/devcenter/types";

const REQUIRED: ReviewGateType[] = ["qa", "security", "experience", "documentation"];
const cleared = (s: string) => s === "passed" || s === "waived_by_admin";

/**
 * The required review gates for a task. Each gate shows its checklist and status.
 * Failed/needs-changes gates block release until they pass or you waive them.
 * Experience and Plain-English reviews are shown as first-class, like QA/Security.
 */
export function ReviewChecklistPanel({ gates, actionable = false }: { gates: DevReviewGate[]; actionable?: boolean }) {
  if (gates.length === 0) return null;
  const blocking = gates.filter((g) => g.status === "failed" || g.status === "needs_revision");
  const requiredCleared = REQUIRED.filter((t) => gates.find((g) => g.gate_type === t && cleared(g.status))).length;

  return (
    <Card>
      <CardHeader
        title="Required reviews"
        subtitle="These must pass (or be waived) before the task can move toward release"
        right={<span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500"><ShieldCheck className="h-4 w-4 text-slate-300" /> {requiredCleared}/{REQUIRED.length} required cleared</span>}
      />
      <div className="space-y-3 p-4">
        {blocking.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span><span className="font-semibold">{blocking.length} review{blocking.length > 1 ? "s" : ""} need attention.</span> Fix the items below, or waive the review, before this task can be released.</span>
          </div>
        )}

        {gates.map((g) => <GateCard key={g.id} gate={g} actionable={actionable} />)}
      </div>
    </Card>
  );
}

function GateCard({ gate: g, actionable }: { gate: DevReviewGate; actionable: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const meta = REVIEW_GATE_META[g.gate_type];
  const status = REVIEW_STATUS_META[g.status];
  const open = g.status === "failed" || g.status === "needs_revision" || g.status === "pending";

  const decide = (decision: "waive" | "revise") =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("gate_id", g.id);
      fd.set("decision", decision);
      const r = await decideReviewGate({ ok: false }, fd);
      if (!r.ok) setError(r.error ?? "Something went wrong.");
    });

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{meta.label}</h4>
          <p className="text-[11px] text-slate-400">{g.agent_name ?? meta.agent}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {typeof g.score === "number" && <span className="text-[11px] font-medium text-slate-400">{g.score}/100</span>}
          <Badge label={status.label} tone={status.tone} />
        </div>
      </div>

      {g.summary && <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{g.summary}</p>}

      {/* Checklist */}
      {g.checklist.length > 0 && (
        <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {g.checklist.map((c, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs">
              {c.passed
                ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                : <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />}
              <span className={c.passed ? "text-slate-500 dark:text-slate-400" : "text-amber-700 dark:text-amber-300"}>
                {c.label}{c.note ? ` — ${c.note}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Required fixes */}
      {g.required_fixes.length > 0 && (
        <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 dark:bg-amber-950/40">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Required fixes</p>
          <ul className="mt-0.5 space-y-0.5">
            {g.required_fixes.map((f, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-amber-800 dark:text-amber-300"><span>•</span> {f}</li>
            ))}
          </ul>
        </div>
      )}

      {/* History */}
      {g.decided_by && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-slate-400">
          <History className="h-3 w-3" /> {status.label} by {g.decided_by}
        </p>
      )}

      {/* Actions */}
      {actionable && open && (
        <div className="mt-2 flex items-center justify-end gap-2">
          {error && <span className="text-[11px] text-red-500">{error}</span>}
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          <button type="button" disabled={pending} onClick={() => decide("revise")}
            className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-950/50 dark:text-amber-300">Request revision</button>
          <button type="button" disabled={pending} onClick={() => decide("waive")}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300">Waive</button>
        </div>
      )}
    </div>
  );
}
