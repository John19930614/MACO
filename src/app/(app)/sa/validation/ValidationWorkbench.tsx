"use client";

import { useState } from "react";
import { ClipboardList, BadgeCheck } from "lucide-react";
import ValidationReviewClient from "./ValidationReviewClient";
import AgentProfileClient from "./AgentProfileClient";
import BackfillButton from "./BackfillButton";
import type { CspValidationRunRow, CspGuardrail, CspQualification, CspMemoryLesson, CspAutonomyBlocker, CspEvidenceRule, CspEscalationRule, CspModelVersion, CspOverrideLogRow } from "@/lib/csp/types";

export default function ValidationWorkbench({
  runs, guardrails, qualifications, memory, blockers, evidenceRules, escalation, versions, overrides,
}: {
  runs: CspValidationRunRow[];
  guardrails: CspGuardrail[];
  qualifications: CspQualification[];
  memory: CspMemoryLesson[];
  blockers: CspAutonomyBlocker[];
  evidenceRules: CspEvidenceRule[];
  escalation: CspEscalationRule[];
  versions: CspModelVersion[];
  overrides: CspOverrideLogRow[];
}) {
  const [tab, setTab] = useState<"queue" | "profile">("queue");
  const pending = runs.filter((r) => r.human_review_required && !r.decision).length;

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setTab("queue")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${tab === "queue" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}
        >
          <ClipboardList className="h-4 w-4" /> Review Queue
          {pending > 0 && <span className="rounded-full bg-amber-900/60 px-1.5 text-[11px] text-amber-300">{pending}</span>}
        </button>
        <button
          onClick={() => setTab("profile")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${tab === "profile" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}
        >
          <BadgeCheck className="h-4 w-4" /> Agent Profile
          <span className="rounded-full bg-slate-700 px-1.5 text-[11px] text-slate-300">{qualifications.filter((q) => q.status === "active").length}</span>
        </button>
      </div>

      {tab === "queue" ? (
        <div className="rounded-2xl border border-white/8 bg-slate-900/40">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Validation Log &amp; Review Queue</h3>
              <p className="text-xs text-slate-400">Every background validation run, newest first. Sign off on cases that require qualified review.</p>
            </div>
            <BackfillButton />
          </div>
          <div className="p-4">
            {runs.length === 0 ? (
              <div className="rounded-lg border border-white/8 bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-400">
                No validation runs yet. The agent records a run automatically whenever an incident is created or edited.
                Click “Validate existing records” to validate the incidents already on file.
              </div>
            ) : (
              <ValidationReviewClient runs={runs} />
            )}
          </div>
        </div>
      ) : (
        <AgentProfileClient guardrails={guardrails} qualifications={qualifications} memory={memory} blockers={blockers} evidenceRules={evidenceRules} escalation={escalation} versions={versions} overrides={overrides} />
      )}
    </div>
  );
}
