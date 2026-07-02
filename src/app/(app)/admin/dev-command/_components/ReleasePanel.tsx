"use client";

import { useActionState, useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { DeploymentStatusBadge } from "./badges";
import { updateDeployment, requestProductionApproval } from "@/lib/actions/devcenter";
import { DEPLOYMENT_STATUS_META } from "@/lib/devcenter/labels";
import { Rocket, Check, X, Loader2, ShieldAlert, Lock, ExternalLink } from "lucide-react";
import type { DevDeployment, DeploymentStatus } from "@/lib/devcenter/types";
import type { ChecklistItem } from "@/lib/devcenter/release";

// Statuses the operator can set manually (preview tracking + the gated release).
const SETTABLE: DeploymentStatus[] = [
  "not_started", "branch_created", "pr_created", "preview_pending", "preview_ready",
  "preview_failed", "approved_for_production", "production_released", "rolled_back", "cancelled",
];

export function ReleasePanel({
  deployment, checklist, taskId, actionable, productionRequested,
}: {
  deployment: DevDeployment | null;
  checklist: ChecklistItem[];
  taskId: string;
  actionable: boolean;
  productionRequested: boolean;
}) {
  const [state, formAction, saving] = useActionState(updateDeployment, { ok: false } as { ok: boolean; error?: string });
  const [pending, start] = useTransition();
  const [prodMsg, setProdMsg] = useState<string | null>(null);
  const cleared = checklist.filter((c) => c.passed).length;

  return (
    <Card>
      <CardHeader title="Release & preview" subtitle="Track the preview and request a production release. Production is never deployed automatically." right={<Rocket className="h-4 w-4 text-slate-300" />} />
      <div className="space-y-4 p-4">
        {/* Deployment status + preview tracking */}
        {deployment ? (
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="deployment_id" value={deployment.id} />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-500 dark:text-slate-400">Branch:</span>
              <span className="font-mono text-xs text-slate-700 dark:text-slate-200">{deployment.branch ?? "—"}</span>
              <DeploymentStatusBadge status={deployment.status} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Preview URL</span>
                <input name="preview_url" defaultValue={deployment.preview_url ?? ""} placeholder="https://preview-….vercel.app" disabled={!actionable}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Status</span>
                <select name="status" defaultValue={deployment.status} disabled={!actionable}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  {SETTABLE.map((s) => <option key={s} value={s}>{DEPLOYMENT_STATUS_META[s].label}</option>)}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Deployment notes / rollback plan</span>
              <textarea name="notes" defaultValue={deployment.notes ?? ""} rows={2} disabled={!actionable}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
            </label>
            {actionable && (
              <div className="flex items-center justify-end gap-2">
                {state.error && <span className="text-[11px] text-red-500">{state.error}</span>}
                {state.ok && !saving && <span className="text-[11px] text-emerald-600">Saved.</span>}
                <button type="submit" disabled={saving} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </form>
        ) : (
          <p className="text-sm text-slate-400">No release prepared yet. Run the workflow to the release stage to prepare a branch and deployment record.</p>
        )}

        {/* Release checklist */}
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Release checklist — {cleared}/{checklist.length} done</p>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-start gap-1.5 text-xs">
                {c.passed ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />}
                <span className={c.passed ? "text-slate-600 dark:text-slate-300" : "text-slate-400"}>{c.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Production release — approval required, never automatic */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2.5 dark:bg-amber-950/40">
          <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Production is never deployed automatically. Requesting only creates an approval for you to decide.
          </p>
          {actionable ? (
            <div className="flex items-center gap-2">
              {prodMsg && <span className="text-[11px] text-emerald-700 dark:text-emerald-300">{prodMsg}</span>}
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
              <button type="button" disabled={pending || productionRequested}
                onClick={() => start(async () => { const r = await requestProductionApproval(taskId); setProdMsg(r.message ?? null); })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60">
                <Rocket className="h-4 w-4" /> {productionRequested ? "Production approval requested" : "Request production release approval"}
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Lock className="h-3 w-3" /> Open a live task</span>
          )}
        </div>

        {deployment?.preview_url && (
          <a href={deployment.preview_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
            Open preview <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </Card>
  );
}
