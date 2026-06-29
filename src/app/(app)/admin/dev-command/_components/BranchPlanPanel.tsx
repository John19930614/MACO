"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { RiskLevelBadge } from "./badges";
import { requestGithubApproval } from "@/lib/actions/devcenter";
import { GitBranch, ShieldAlert, CheckCircle2, Loader2, Lock } from "lucide-react";
import type { DevGithubSettings, RiskLevel } from "@/lib/devcenter/types";

/**
 * The prepared GitHub branch plan + the "Request GitHub Branch Approval" button.
 * Requesting only creates approval requests — no branch is created and nothing is
 * pushed or deployed.
 */
export function BranchPlanPanel({
  settings, branch, risk, approvedArtifacts, taskId, actionable, alreadyRequested,
}: {
  settings: DevGithubSettings;
  branch: string;
  risk: { level: RiskLevel; notes: string[] };
  approvedArtifacts: { id: string; title: string; path: string | null }[];
  taskId: string;
  actionable: boolean;
  alreadyRequested: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader title="GitHub branch plan" subtitle="Prepared only — no branch is created and nothing is pushed without your approval" right={<GitBranch className="h-4 w-4 text-slate-300" />} />
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          <Field label="Repository" value={`${settings.repo_owner ?? "—"}/${settings.repo_name ?? "—"}`} />
          <Field label="Protected branch (never pushed to)" value={settings.protected_branch} />
          <Field label="Branch name" value={branch} mono />
          <Field label="Naming rule" value={settings.branch_naming_format} mono />
        </div>

        {/* Release risk summary */}
        <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Release risk</span>
            <RiskLevelBadge level={risk.level} />
          </div>
          <ul className="mt-1 space-y-0.5">
            {risk.notes.map((n, i) => <li key={i} className="text-xs text-slate-600 dark:text-slate-300">• {n}</li>)}
          </ul>
        </div>

        {/* Approved artifacts ready for branch */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Approved items ready for the branch</p>
          {approvedArtifacts.length === 0 ? (
            <p className="mt-0.5 text-xs text-slate-400">None approved yet — approve the code drafts first.</p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {approvedArtifacts.map((a) => (
                <li key={a.id} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  {a.title}{a.path ? ` — ${a.path}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Request approval */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
          <p className="text-[11px] text-slate-400">{alreadyRequested ? "GitHub approvals have been requested — decide them in the Approval Center." : "This asks for your approval; it creates no branch and pushes nothing."}</p>
          {actionable ? (
            <div className="flex items-center gap-2">
              {result && <span className="text-[11px] text-emerald-600">{result}</span>}
              <button
                type="button" disabled={pending || alreadyRequested}
                onClick={() => start(async () => { const r = await requestGithubApproval(taskId); setResult(r.message ?? null); })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
                Request GitHub Branch Approval
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Lock className="h-3 w-3" /> Open a live task to request</span>
          )}
        </div>
      </div>
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="font-semibold text-slate-400">{label}: </span>
      <span className={`text-slate-600 dark:text-slate-300 ${mono ? "font-mono text-[11px]" : ""}`}>{value}</span>
    </div>
  );
}
