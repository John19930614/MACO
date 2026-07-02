import { Card, CardHeader } from "@/components/ui/primitives";
import { Badge } from "./badges";
import { REVIEW_GATE_META, SCORE_GATE_TYPES } from "@/lib/devcenter/labels";
import { Gauge, Check, X } from "lucide-react";
import type { DevApproval, DevReviewGate } from "@/lib/devcenter/types";

/**
 * The required experience skill layer: the six 1-10 scores, and the rules a task
 * must meet before it can be marked complete (Experience 8+, Plain-English 8+,
 * Security/QA/Documentation passed, final approval).
 */
export function ExperienceScorecard({ gates, approvals }: { gates: DevReviewGate[]; approvals: DevApproval[] }) {
  const scoreGates = SCORE_GATE_TYPES.map((t) => ({ type: t, gate: gates.find((g) => g.gate_type === t) }));
  if (scoreGates.every((s) => !s.gate)) return null;

  const cleared = (t: string) => {
    const g = gates.find((x) => x.gate_type === t);
    return !!g && (g.status === "passed" || g.status === "waived_by_admin");
  };
  const prodApproved = approvals.some((a) => a.approval_type === "production_release" && a.status === "approved");
  const completion = [
    { label: "Experience score 8+", ok: cleared("experience") },
    { label: "Plain-English score 8+", ok: cleared("plain_english") },
    { label: "Security review passed", ok: cleared("security") },
    { label: "QA review passed", ok: cleared("qa") },
    { label: "Documentation review passed", ok: cleared("documentation") },
    { label: "Final human approval", ok: prodApproved },
  ];
  const canComplete = completion.every((c) => c.ok);

  return (
    <Card>
      <CardHeader
        title="Experience scorecard"
        subtitle="Every feature is scored on the experience skill layer — a task can't complete until the rules below are met"
        right={<Gauge className="h-4 w-4 text-slate-300" />}
      />
      <div className="space-y-4 p-4">
        {/* The six scores */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {scoreGates.map(({ type, gate }) => {
            const score = typeof gate?.score === "number" ? gate.score : null;
            const ok = !!gate && (gate.status === "passed" || gate.status === "waived_by_admin");
            return (
              <div key={type} className={`rounded-xl border p-3 ${ok ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{REVIEW_GATE_META[type].label}</p>
                <p className="mt-1 text-2xl font-extrabold leading-none text-slate-800 dark:text-white">{score ?? "—"}<span className="text-sm font-semibold text-slate-400">/10</span></p>
                <p className="mt-1 text-[11px] font-medium" >{gate ? (ok ? <span className="text-emerald-600">Passed</span> : <span className="text-amber-600">Needs 8+</span>) : <span className="text-slate-400">Not reviewed yet</span>}</p>
              </div>
            );
          })}
        </div>

        {/* Completion rules */}
        <div className={`rounded-lg border p-3 ${canComplete ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-slate-200 dark:border-slate-700"}`}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Required to mark complete</p>
            <Badge label={canComplete ? "Ready to complete" : "Not ready"} tone={canComplete ? "success" : "neutral"} />
          </div>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {completion.map((c) => (
              <li key={c.label} className="flex items-center gap-1.5 text-xs">
                {c.ok ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <X className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                <span className={c.ok ? "text-slate-600 dark:text-slate-300" : "text-slate-400"}>{c.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
