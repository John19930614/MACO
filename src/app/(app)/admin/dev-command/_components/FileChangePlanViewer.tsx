"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { Badge, RiskLevelBadge } from "./badges";
import { EmptyStateCard } from "./states";
import { decideFilePlan } from "@/lib/actions/devcenter";
import {
  FILE_CHANGE_TYPE_META, FILE_PLAN_STATUS_META, FILE_PLAN_EXPERIENCE_CHECKS,
} from "@/lib/devcenter/labels";
import { AlertTriangle, Loader2, FileCode2, ListChecks } from "lucide-react";
import type { DevFileChangePlan, FileChangeType, RiskLevel } from "@/lib/devcenter/types";

const CHANGE_TYPES: FileChangeType[] = ["create", "modify", "delete", "rename", "migration", "test", "documentation", "config"];
const RISKS: RiskLevel[] = ["low", "medium", "high", "critical"];

/**
 * Proposed file changes for a task — what the team WANTS to change, before any of
 * it is saved. Filter by change type and risk; approve or reject on live tasks.
 * Nothing here is written to disk in this phase.
 */
export function FileChangePlanViewer({
  plans,
  actionable = false,
}: {
  plans: DevFileChangePlan[];
  actionable?: boolean;
}) {
  const [typeFilter, setTypeFilter] = useState<FileChangeType | "all">("all");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");

  const filtered = useMemo(
    () => plans.filter((p) => (typeFilter === "all" || p.change_type === typeFilter) && (riskFilter === "all" || p.risk_level === riskFilter)),
    [plans, typeFilter, riskFilter],
  );

  return (
    <Card>
      <CardHeader title="Proposed file changes" subtitle="What the team wants to change — nothing is saved until you approve" right={<FileCode2 className="h-4 w-4 text-slate-300" />} />
      <div className="p-4">
        {plans.length === 0 ? (
          <EmptyStateCard title="No file changes proposed" description="When the team plans the code, the affected files show up here." />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Select label="Type" value={typeFilter} onChange={(v) => setTypeFilter(v as FileChangeType | "all")}
                options={[["all", "All types"], ...CHANGE_TYPES.map((t) => [t, FILE_CHANGE_TYPE_META[t].label] as [string, string])]} />
              <Select label="Risk" value={riskFilter} onChange={(v) => setRiskFilter(v as RiskLevel | "all")}
                options={[["all", "All risk"], ...RISKS.map((r) => [r, r[0].toUpperCase() + r.slice(1)] as [string, string])]} />
              <span className="ml-auto text-xs text-slate-400">{filtered.length} of {plans.length}</span>
            </div>

            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No changes match those filters.</p>
            ) : (
              <ul className="space-y-3">
                {filtered.map((p) => <PlanRow key={p.id} plan={p} actionable={actionable} />)}
              </ul>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function PlanRow({ plan: p, actionable }: { plan: DevFileChangePlan; actionable: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pendingApproval = p.status === "planned" || p.status === "needs_approval";
  const ctype = FILE_CHANGE_TYPE_META[p.change_type];
  const sstatus = FILE_PLAN_STATUS_META[p.status];

  const decide = (decision: "approved" | "rejected") =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("plan_id", p.id);
      fd.set("decision", decision);
      const r = await decideFilePlan({ ok: false }, fd);
      if (!r.ok) setError(r.error ?? "Something went wrong.");
    });

  return (
    <li className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <Badge label={ctype.label} tone={ctype.tone} />
          <span className="font-mono text-xs text-slate-700 dark:text-slate-200">{p.file_path}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {p.approval_required && <Badge label="Needs approval" tone="violet" />}
          <RiskLevelBadge level={p.risk_level} />
          <Badge label={sstatus.label} tone={sstatus.tone} />
        </div>
      </div>

      {p.proposed_summary && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{p.proposed_summary}</p>}
      {p.rationale && <p className="mt-0.5 text-xs text-slate-400">Why: {p.rationale}</p>}

      {p.diff && (
        <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded bg-slate-900/95 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-200">{p.diff}</pre>
      )}

      {/* Dangerous-change warning */}
      {p.approval_required && pendingApproval && (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Needs human approval — this change won&apos;t happen until you approve it.</span>
        </div>
      )}

      {/* Experience review before approving */}
      {pendingApproval && (
        <div className="mt-2 rounded-md bg-violet-50 px-3 py-2 dark:bg-violet-950/40">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            <ListChecks className="h-3.5 w-3.5" /> Before you approve, consider
          </p>
          <ul className="space-y-0.5">
            {FILE_PLAN_EXPERIENCE_CHECKS.map((q) => (
              <li key={q} className="flex gap-1.5 text-xs text-violet-800 dark:text-violet-300"><span>•</span> {q}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Approve / reject (live tasks only) */}
      {actionable && pendingApproval && (
        <div className="mt-2 flex items-center justify-end gap-2">
          {error && <span className="text-[11px] text-red-500">{error}</span>}
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          <button type="button" disabled={pending} onClick={() => decide("rejected")}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300">Reject</button>
          <button type="button" disabled={pending} onClick={() => decide("approved")}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">Approve</button>
        </div>
      )}
    </li>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
