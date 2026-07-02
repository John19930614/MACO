"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { Badge, RiskLevelBadge } from "./badges";
import { EmptyStateCard } from "./states";
import { decideArtifact, applyApprovedArtifact } from "@/lib/actions/devcenter";
import { ARTIFACT_TYPE_META, ARTIFACT_STATUS_META } from "@/lib/devcenter/labels";
import { checkPath } from "@/lib/devcenter/path-safety";
import { Code2, Copy, Check, AlertTriangle, Smile, Loader2, ShieldCheck, Lock, FileCheck2, Ban } from "lucide-react";
import type { DevArtifact } from "@/lib/devcenter/types";

/**
 * Code draft artifacts (Phase 8). Shows the draft code/SQL/test/doc with a copy
 * button, a plain-English explanation, an experience note, and — on live tasks —
 * Approve / Reject / Request revision. Nothing here is applied to the project.
 */
export function ArtifactViewer({ artifacts, actionable = false }: { artifacts: DevArtifact[]; actionable?: boolean }) {
  const drafts = artifacts.filter((a) => a.artifact_type);
  if (drafts.length === 0) return null;

  return (
    <Card>
      <CardHeader title="Code drafts" subtitle="Draft code, SQL, tests and docs to review — none of this is applied to the project" right={<Code2 className="h-4 w-4 text-slate-300" />} />
      <div className="space-y-4 p-4">
        {drafts.length === 0 ? (
          <EmptyStateCard title="No code drafts yet" description="Drafts appear here once the team reaches the code-draft stage." />
        ) : (
          drafts.map((a) => <DraftRow key={a.id} artifact={a} actionable={actionable} />)
        )}
      </div>
    </Card>
  );
}

function DraftRow({ artifact: a, actionable }: { artifact: DevArtifact; actionable: boolean }) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const s = (a.structured ?? {}) as Record<string, unknown>;
  const type = a.artifact_type ? ARTIFACT_TYPE_META[a.artifact_type] : null;
  const status = ARTIFACT_STATUS_META[a.status];
  const pendingReview = a.status === "draft" || a.status === "needs_review" || a.status === "revised";
  const dangerous = a.risk_level === "high" || a.risk_level === "critical";
  const [applyMsg, setApplyMsg] = useState<string | null>(null);
  const pathSafety = checkPath(a.path);

  const apply = () =>
    start(async () => {
      setApplyMsg(null);
      const r = await applyApprovedArtifact(a.id);
      setApplyMsg(r.message ?? null);
    });

  const copy = async () => {
    try { await navigator.clipboard.writeText(a.content ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  const decide = (decision: "approve" | "reject" | "revise") =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("artifact_id", a.id);
      fd.set("decision", decision);
      const r = await decideArtifact({ ok: false }, fd);
      if (!r.ok) setError(r.error ?? "Something went wrong.");
    });

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {type && <Badge label={type.label} tone={type.tone} />}
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{a.title}</span>
          </div>
          {a.path && <p className="mt-0.5 font-mono text-[11px] text-slate-400">{a.path}</p>}
          {a.created_by && <p className="text-[11px] text-slate-400">by {a.created_by}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {a.approval_required && <Badge label="Needs approval" tone="violet" />}
          {a.risk_level && <RiskLevelBadge level={a.risk_level} />}
          <Badge label={status.label} tone={status.tone} />
        </div>
      </div>

      {/* Plain-English explanation */}
      {a.description && (
        <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">What this does</p>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{a.description}</p>
        </div>
      )}

      {/* Code block + copy */}
      {a.content && (
        <div className="relative mt-2">
          <button type="button" onClick={copy} className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-slate-700/80 px-2 py-1 text-[11px] font-medium text-slate-100 transition hover:bg-slate-600">
            {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
          </button>
          <pre className="overflow-auto rounded bg-slate-900/95 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-slate-200">{a.content}</pre>
        </div>
      )}

      {/* Details: where, files, tests */}
      <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {strField(s.where_it_goes) && <Detail label="Where it goes" value={strField(s.where_it_goes)} />}
        {listField(s.files_affected) && <Detail label="Files affected" value={listField(s.files_affected)} />}
        {strField(s.tests_needed) && <Detail label="Tests needed" value={strField(s.tests_needed)} />}
      </div>

      {/* Experience impact */}
      {strField(s.ux_improved) && (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-violet-50 px-3 py-2 text-xs text-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
          <Smile className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span><span className="font-semibold">Experience: </span>{strField(s.ux_improved)}</span>
        </div>
      )}

      {/* Risk warning */}
      {(dangerous || a.approval_required) && pendingReview && (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{dangerous ? "Higher-risk change. " : ""}This draft will not be applied to the project until you approve it.</span>
        </div>
      )}

      {/* Approve / reject / request revision */}
      {actionable && pendingReview && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          {error && <span className="text-[11px] text-red-500">{error}</span>}
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          <button type="button" disabled={pending} onClick={() => decide("revise")}
            className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-950/50 dark:text-amber-300">Request revision</button>
          <button type="button" disabled={pending} onClick={() => decide("reject")}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300">Reject</button>
          <button type="button" disabled={pending} onClick={() => decide("approve")}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">Approve</button>
        </div>
      )}

      {/* Phase 12 — apply an approved draft to the working area */}
      {a.status === "approved" && (
        <div className="mt-2 rounded-md border border-slate-200 p-2.5 dark:border-slate-700">
          {/* Path safety indicator */}
          {pathSafety.allowed ? (
            <p className="flex items-center gap-1.5 text-[11px] text-emerald-600"><ShieldCheck className="h-3.5 w-3.5" /> Allowed area — safe to apply ({a.path})</p>
          ) : pathSafety.dangerous ? (
            <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Dangerous path — {pathSafety.reason}</p>
          ) : (
            <p className="flex items-start gap-1.5 text-[11px] text-slate-500"><Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {pathSafety.reason}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">Applies to a safe staging area — never your real codebase.</span>
            {actionable ? (
              <div className="flex items-center gap-2">
                {applyMsg && <span className="text-[11px] text-slate-500">{applyMsg}</span>}
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                <button type="button" disabled={pending || (!pathSafety.allowed && !pathSafety.dangerous)} onClick={apply}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
                  <FileCheck2 className="h-3.5 w-3.5" /> Apply to working area
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Lock className="h-3 w-3" /> Open a live task to apply</span>
            )}
          </div>
        </div>
      )}

      {a.status === "applied" && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600"><FileCheck2 className="h-3.5 w-3.5" /> Applied to the working area (no real file changed).</p>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-semibold text-slate-400">{label}: </span>
      <span className="text-slate-600 dark:text-slate-300">{value}</span>
    </div>
  );
}
function strField(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function listField(v: unknown): string {
  return Array.isArray(v) ? v.map(String).join(", ") : "";
}
