"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown, ChevronRight, ShieldCheck, AlertTriangle, FileWarning,
  CheckCircle2, XCircle, Bot, Sparkles, PenLine, Hash, Download,
} from "lucide-react";
import { submitCspReviewDecision, rerunCspValidation } from "@/lib/actions/csp";
import type { CspValidationRunRow, CspValidationStatus, CspRiskLevel } from "@/lib/csp/types";

const STATUS_META: Record<CspValidationStatus, { label: string; cls: string }> = {
  accepted: { label: "Auto-Validated", cls: "bg-emerald-900/50 text-emerald-300" },
  accepted_with_minor_corrections: { label: "Auto-Validated (minor)", cls: "bg-teal-900/50 text-teal-300" },
  rejected_incomplete: { label: "Missing Evidence", cls: "bg-amber-900/50 text-amber-300" },
  needs_human_review: { label: "Needs Human Review", cls: "bg-blue-900/50 text-blue-300" },
  potential_regulatory_issue: { label: "Regulatory Review", cls: "bg-orange-900/50 text-orange-300" },
  potential_recordable_or_reportable: { label: "Recordability Review", cls: "bg-red-900/50 text-red-300" },
  system_error: { label: "System Error", cls: "bg-slate-800 text-slate-300" },
};

function exportRunsCsv(runs: CspValidationRunRow[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["date", "tenant", "record_type", "status", "risk_level", "confidence", "human_review_required", "human_review_status", "blockers", "missing_fields", "decision"];
  const rows = runs.map((r) => [
    new Date(r.created_at).toISOString(), r.tenant_name, r.record_type, r.validation_status, r.risk_level,
    r.confidence_score ?? "", r.human_review_required, r.human_review_status,
    r.autonomy_blockers_triggered.map((b) => b.key).join("|"), r.missing_fields.join("|"),
    r.decision ? `${r.decision.decision} by ${r.decision.reviewer_name}` : "",
  ].map(esc).join(","));
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `ehs-validation-log.csv`; a.click();
  URL.revokeObjectURL(url);
}

const RISK_CLS: Record<CspRiskLevel, string> = {
  low: "bg-slate-700 text-slate-200",
  medium: "bg-yellow-900/50 text-yellow-300",
  high: "bg-orange-900/50 text-orange-300",
  critical: "bg-red-900/50 text-red-300",
  sif_potential: "bg-red-950/70 text-red-200",
  idlh_imminent_danger: "bg-red-950 text-red-100",
};

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${className}`}>{children}</span>;
}

export default function ValidationReviewClient({ runs }: { runs: CspValidationRunRow[] }) {
  const [openId, setOpenId] = useState<string | null>(runs.find((r) => r.human_review_required && !r.decision)?.id ?? null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between pb-1">
        <span className="text-xs text-slate-400">{runs.length} validation run(s)</span>
        <button
          onClick={() => exportRunsCsv(runs)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>
      {runs.map((run) => {
        const meta = STATUS_META[run.validation_status] ?? STATUS_META.system_error;
        const open = openId === run.id;
        const awaiting = run.human_review_required && !run.decision;
        return (
          <div key={run.id} className={`rounded-lg border ${awaiting ? "border-amber-700/40 bg-amber-950/10" : "border-white/8 bg-slate-900/40"}`}>
            <button
              onClick={() => setOpenId(open ? null : run.id)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
            >
              {open ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-white">
                    {(run.findings[0]?.finding_title) || run.ai_summary?.slice(0, 60) || `${run.module_name} record`}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
                  <span>{run.tenant_name}</span>
                  <span>·</span>
                  <span className="capitalize">{run.record_type.replace(/_/g, " ")}</span>
                  <span>·</span>
                  <span>{new Date(run.created_at).toLocaleString()}</span>
                </div>
              </div>
              <Chip className={RISK_CLS[run.risk_level]}>{run.risk_level.replace(/_/g, " ")}</Chip>
              <Chip className={meta.cls}>{meta.label}</Chip>
              {run.confidence_score != null && (
                <Chip className="bg-slate-800 text-slate-300">{run.confidence_score}%</Chip>
              )}
              {run.decision ? (
                <Chip className="bg-emerald-900/50 text-emerald-300"><CheckCircle2 className="mr-1 h-3 w-3" />Signed</Chip>
              ) : awaiting ? (
                <Chip className="bg-amber-900/50 text-amber-300"><AlertTriangle className="mr-1 h-3 w-3" />Review</Chip>
              ) : (
                <Chip className="bg-slate-800 text-slate-400">Auto</Chip>
              )}
            </button>

            {open && <RunDetail run={run} />}
          </div>
        );
      })}
    </div>
  );
}

function RunDetail({ run }: { run: CspValidationRunRow }) {
  const router = useRouter();
  const [rerunning, startRerun] = useTransition();

  return (
    <div className="border-t border-white/8 px-3 pb-3 pt-3">
      {/* Agent narrative */}
      <div className="mb-3 rounded-md border border-white/8 bg-slate-900/60 p-3">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-300">
          <Bot className="h-3.5 w-3.5" /> Agent assessment · {run.model_name ?? "deterministic"}
        </div>
        <p className="text-sm text-slate-200">{run.ai_summary || "—"}</p>
        {run.ai_recommendation && <p className="mt-1.5 text-xs text-slate-400"><span className="font-semibold text-slate-300">Recommendation:</span> {run.ai_recommendation}</p>}
        {run.human_review_reason && <p className="mt-1.5 text-xs text-amber-300/90">{run.human_review_reason}</p>}
      </div>

      {/* Autonomy blockers that forced human review */}
      {run.autonomy_blockers_triggered.length > 0 && (
        <div className="mb-3 rounded-md border border-red-800/40 bg-red-950/15 p-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-300">Autonomy blockers triggered</div>
          <div className="flex flex-wrap gap-1.5">
            {run.autonomy_blockers_triggered.map((b) => (
              <span key={b.key} className={`rounded px-2 py-0.5 text-[11px] font-semibold ${b.action === "immediate_escalation" ? "bg-red-900/60 text-red-200" : "bg-amber-900/50 text-amber-300"}`}>
                {b.label}{b.action === "immediate_escalation" ? " ⚠" : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Findings */}
      {run.findings.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {run.findings.map((f) => (
            <div key={f.id} className="flex items-start gap-2 rounded-md border border-white/8 bg-slate-900/40 px-3 py-2">
              <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-100">{f.finding_title}</span>
                  <Chip className={RISK_CLS[f.risk_level]}>{f.risk_level.replace(/_/g, " ")}</Chip>
                  <Chip className="bg-slate-800 text-slate-400">{f.finding_category.replace(/_/g, " ")}</Chip>
                </div>
                {f.finding_description && <p className="mt-0.5 text-xs text-slate-400">{f.finding_description}</p>}
                {f.citation && (
                  <p className="mt-0.5 text-[11px] text-blue-300">
                    {f.source_url ? <a href={f.source_url} target="_blank" rel="noreferrer" className="underline hover:no-underline">{f.citation}</a> : f.citation}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Integrity / metadata row */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" /> input: <code className="font-mono">{run.input_hash?.slice(0, 12) ?? "—"}</code></span>
        <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" /> output: <code className="font-mono">{run.final_output_hash?.slice(0, 12) ?? "—"}</code></span>
        <span>rules: {run.regulatory_triggers.length} trigger(s)</span>
        {run.missing_fields.length > 0 && <span className="text-amber-400">missing: {run.missing_fields.join(", ")}</span>}
      </div>

      {/* AI re-run */}
      <div className="mb-3">
        <button
          onClick={() => startRerun(async () => { await rerunCspValidation(run.id); router.refresh(); })}
          disabled={rerunning}
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-700/50 bg-violet-900/30 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-900/50 disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" /> {rerunning ? "Running AI…" : "Re-validate with AI"}
        </button>
      </div>

      {/* Decision */}
      {run.decision ? (
        <div className="rounded-md border border-emerald-800/40 bg-emerald-950/20 p-3 text-sm">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-300">
            <ShieldCheck className="h-4 w-4" /> {run.decision.decision.replace(/_/g, " ")} by {run.decision.reviewer_name}
            {run.decision.reviewer_credentials && <span className="text-emerald-400/80">({run.decision.reviewer_credentials})</span>}
          </div>
          <p className="mt-1 text-slate-300">{run.decision.decision_summary}</p>
          <p className="mt-1 text-[11px] text-slate-500">Signed {run.decision.signed_at ? new Date(run.decision.signed_at).toLocaleString() : new Date(run.decision.created_at).toLocaleString()}</p>
        </div>
      ) : run.human_review_required ? (
        <SignOffForm run={run} />
      ) : (
        <div className="rounded-md border border-white/8 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
          Auto-accepted by the agent — no human review required. You can still re-validate or sign off manually below.
        </div>
      )}
    </div>
  );
}

function SignOffForm({ run }: { run: CspValidationRunRow }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(submitCspReviewDecision, null as null | { ok: boolean; error?: string });

  // Refresh once the decision is recorded so the signed state renders.
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="rounded-md border border-amber-800/40 bg-amber-950/10 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
        <PenLine className="h-3.5 w-3.5" /> Credentialed human sign-off
      </div>
      <input type="hidden" name="run_id" value={run.id} />
      <input type="hidden" name="tenant_id" value={run.tenant_id} />
      {run.queue_id && <input type="hidden" name="queue_id" value={run.queue_id} />}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input name="reviewer_name" placeholder="Reviewer name" required
          className="rounded-md border border-white/10 bg-slate-900 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500" />
        <input name="reviewer_credentials" placeholder="Credentials (CSP, CIH, CHST…)"
          className="rounded-md border border-white/10 bg-slate-900 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500" />
        <select name="decision" required defaultValue=""
          className="rounded-md border border-white/10 bg-slate-900 px-2.5 py-1.5 text-sm text-white">
          <option value="" disabled>Decision…</option>
          <option value="approved">Approve</option>
          <option value="approved_with_changes">Approve with changes</option>
          <option value="returned_for_correction">Return for correction</option>
          <option value="rejected">Reject</option>
          <option value="escalated">Escalate</option>
        </select>
      </div>
      <textarea name="decision_summary" placeholder="Decision summary (required) — what you reviewed and concluded" required rows={2}
        className="mt-2 w-full rounded-md border border-white/10 bg-slate-900 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500" />
      <textarea name="reviewer_notes" placeholder="Reviewer notes (optional)" rows={1}
        className="mt-2 w-full rounded-md border border-white/10 bg-slate-900 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500" />

      <div className="mt-2 flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
          {pending ? "Signing…" : <><ShieldCheck className="h-3.5 w-3.5" /> Sign &amp; record decision</>}
        </button>
        {state?.error && <span className="inline-flex items-center gap-1 text-xs text-red-400"><XCircle className="h-3.5 w-3.5" />{state.error}</span>}
        <span className="text-[11px] text-slate-500">Recorded with your name, credential, and a timestamped signature.</span>
      </div>
    </form>
  );
}
