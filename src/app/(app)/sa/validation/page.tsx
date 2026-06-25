import { ShieldCheck, AlertTriangle, ClipboardCheck, Bot } from "lucide-react";
import { DarkPageHeader, DarkCard, DarkCardHeader } from "@/components/ui/primitives";
import { getCspValidationRuns, getCspReviewSummary, getCspAgent } from "@/lib/csp/repo";
import { CSP_POSITIONING } from "@/lib/csp/defaults";
import ValidationReviewClient from "./ValidationReviewClient";
import BackfillButton from "./BackfillButton";

// CSP-informed EHS Records Validation Agent — superadmin review panel.
// The agent validates records in the background and logs every run; high-stakes
// or low-confidence cases land here for credentialed human sign-off.
export default async function SAValidationPage() {
  const [runs, summary, agent] = await Promise.all([
    getCspValidationRuns(150).catch(() => []),
    getCspReviewSummary().catch(() => ({ pending: 0, urgent: 0, total: 0, autoAccepted: 0 })),
    getCspAgent().catch(() => null),
  ]);

  const cards = [
    { label: "Total Validations", value: summary.total, icon: <ClipboardCheck className="h-4 w-4 text-blue-400" /> },
    { label: "Pending Review", value: summary.pending, icon: <AlertTriangle className="h-4 w-4 text-amber-400" />, warn: summary.pending > 0 },
    { label: "Urgent", value: summary.urgent, icon: <AlertTriangle className="h-4 w-4 text-red-400" />, danger: summary.urgent > 0 },
    { label: "Auto-Accepted", value: summary.autoAccepted, icon: <ShieldCheck className="h-4 w-4 text-emerald-400" /> },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <DarkPageHeader
        title="EHS Records Validation Agent"
        subtitle="CSP-informed background validation with credentialed human review"
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* Positioning / disclaimer banner */}
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-violet-800/50 bg-violet-900/20 p-4 text-sm text-violet-200">
          <Bot className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
          <div>
            <div className="font-semibold text-violet-100">
              {agent?.agent_name ?? "Senior EHS Record Validation Agent"}
              <span className="ml-2 rounded bg-violet-900/60 px-1.5 py-0.5 font-mono text-[11px]">
                {agent?.prompt_version ?? "csp-v1.0"}
              </span>
            </div>
            <p className="mt-1 text-violet-300/90">{agent?.positioning ?? CSP_POSITIONING}</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-white/8 bg-slate-900/60 px-4 py-3">
              <div className="flex items-center gap-2">{c.icon}<span className="text-[11px] uppercase tracking-wide text-slate-400">{c.label}</span></div>
              <div className={`mt-1 text-2xl font-bold ${c.danger ? "text-red-400" : c.warn ? "text-amber-400" : "text-white"}`}>{c.value}</div>
            </div>
          ))}
        </div>

        <DarkCard>
          <DarkCardHeader
            title="Validation Log & Review Queue"
            subtitle="Every background validation run, newest first. Sign off on cases that require qualified review."
            right={<BackfillButton />}
          />
          <div className="p-4">
            {runs.length === 0 ? (
              <div className="rounded-lg border border-white/8 bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-400">
                No validation runs yet. The agent records a run automatically whenever an incident or audit finding is
                created or edited in live mode. Once the database migration is applied, runs appear here.
              </div>
            ) : (
              <ValidationReviewClient runs={runs} />
            )}
          </div>
        </DarkCard>
      </div>
    </div>
  );
}
