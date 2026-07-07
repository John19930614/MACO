"use client";

// Client view for the Risk Score Reliability screen. Plain-English summary,
// accuracy/drift explainer, indicator-weight history, and a verifiable log of
// AI Gateway triggers. Every term non-technical users might not know ("drift",
// "accuracy") has an accessible explainer that opens on click AND keyboard
// focus (native <details>), never hover-only. Status uses icon + word, never
// color alone.

import type {
  RiskReliabilityData,
  ReliabilityRiskRow,
  ReliabilityTriggerRow,
} from "@/lib/actions/phase-3-ai-agent";

const BAND_LABEL: Record<string, { icon: string; label: string }> = {
  green:  { icon: "🟢", label: "Low risk" },
  amber:  { icon: "🟡", label: "Watch" },
  orange: { icon: "🟠", label: "Elevated" },
  red:    { icon: "🔴", label: "Act now" },
};

const TRIGGER_LABEL: Record<string, string> = {
  band_crossing: "Risk band crossed a danger line",
  multi_indicator_degrade: "2+ indicators worsened at once",
};

function BandBadge({ bandKey }: { bandKey: string | null }) {
  if (!bandKey) return <span className="text-slate-400">—</span>;
  const meta = BAND_LABEL[bandKey] ?? { icon: "⚪", label: bandKey };
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span aria-hidden>{meta.icon}</span> {meta.label}
    </span>
  );
}

function Explainer({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <details className="group inline-block align-baseline">
      <summary className="cursor-pointer list-none text-xs font-medium text-blue-600 underline decoration-dotted underline-offset-2 hover:text-blue-700 focus:outline focus:outline-2 focus:outline-blue-400 dark:text-blue-400">
        What does “{term}” mean?
      </summary>
      <p className="mt-1 max-w-md rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        {children}
      </p>
    </details>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
      {children}
    </div>
  );
}

export function RiskReliabilityView({ data }: { data: RiskReliabilityData }) {
  const { scores, triggerLog, indicators, reviewSummary, mock } = data;
  const reviewedPct = reviewSummary.total > 0 ? Math.round((reviewSummary.accurate / reviewSummary.total) * 100) : null;

  // Plain-English health read-out. We deliberately do NOT fabricate an accuracy
  // percentage: Phase 1 stores predictions, not outcomes, so true accuracy/drift
  // can't be computed yet. What we CAN report is human-review agreement.
  const summaryLine =
    reviewSummary.total === 0
      ? "No EHS-lead reviews recorded yet — accuracy can't be judged until recommendations have been reviewed."
      : reviewedPct !== null && reviewedPct >= 80
        ? `Looking good: EHS leads marked ${reviewedPct}% of reviewed recommendations “accurate.”`
        : `Needs attention: only ${reviewedPct}% of reviewed recommendations were marked “accurate.” Consider tuning the prompt/context before relying on them.`;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Risk Score Reliability</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Is the risk model working well right now? This page shows how recent predictions have held up, whether the
          model may be drifting off target, and a verifiable log of every gateway trigger.
        </p>
      </div>

      <div className="iq-scroll flex-1 space-y-6 overflow-y-auto p-6">
        {mock && (
          <div className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
            Demo mode — no live database is connected, so the tables below are empty. On a connected environment this
            page fills in automatically as risk scores, triggers, and reviews accumulate.
          </div>
        )}

        {/* Plain-English summary box */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-900/10">
          <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-200">Is the risk model working well right now?</h2>
          <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">{summaryLine}</p>
          <div className="mt-2 flex flex-wrap gap-4">
            <Explainer term="accuracy">
              “Accuracy” here means: when the model flagged a site as higher risk, did something the EHS lead agreed
              was worth acting on actually turn up? We measure it through EHS-lead reviews of the recommendations —
              not an automatic score — because the system records predictions, not yet their real-world outcomes.
            </Explainer>
            <Explainer term="drift">
              “Drift” means the model’s predictions gradually become less useful over time — for example, if site
              conditions change but the indicator weights don’t. A falling share of “accurate” reviews over successive
              weeks is the early warning sign to watch here.
            </Explainer>
          </div>
        </div>

        {/* Review agreement summary */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Reviews recorded</p>
            <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{reviewSummary.total}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">✅ Accurate</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{reviewSummary.accurate}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">✏️ Needs edit</p>
            <p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-300">{reviewSummary.needsEdit}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-900/10">
            <p className="text-xs font-medium uppercase tracking-wide text-red-600 dark:text-red-400">❌ Inaccurate</p>
            <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-300">{reviewSummary.inaccurate}</p>
          </div>
        </div>

        {/* Verifiable trigger log */}
        <SectionCard
          title="AI Gateway Trigger Log (independently verifiable)"
          subtitle="When a risk score crosses a danger line or several indicators worsen at once, the system quietly notes it here. It does NOT send any alert — a human decides separately whether to act. Sending alerts is Phase 4."
        >
          {triggerLog.length === 0 ? (
            <EmptyRow>No triggers logged yet. Rows appear here after risk scores accumulate enough history to compare.</EmptyRow>
          ) : (
            <TriggerTable rows={triggerLog} />
          )}
        </SectionCard>

        {/* Score history */}
        <SectionCard title="Recent risk scores" subtitle="The most recent scores across all tenants (newest first).">
          {scores.length === 0 ? (
            <EmptyRow>No risk scores yet. Once scores are calculated, their history appears here.</EmptyRow>
          ) : (
            <ScoreTable rows={scores} />
          )}
        </SectionCard>

        {/* Indicator-weight history */}
        <SectionCard
          title="Indicator weights"
          subtitle="How much each leading indicator currently counts toward a site's score. An EHS lead can retune these; changes here are what to watch when investigating drift."
        >
          {indicators.length === 0 ? (
            <EmptyRow>No indicators configured.</EmptyRow>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-700">
                    <th className="py-2 pr-4">Indicator</th>
                    <th className="py-2 pr-4">Weight</th>
                    <th className="py-2 pr-4">Active</th>
                    <th className="py-2">Last updated</th>
                  </tr>
                </thead>
                <tbody>
                  {indicators.map((i) => (
                    <tr key={i.key} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">{i.label}</td>
                      <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-100">{i.weight}</td>
                      <td className="py-2 pr-4">{i.active ? "✅ Yes" : "⛔ No"}</td>
                      <td className="py-2 text-slate-500 dark:text-slate-400">{new Date(i.updatedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function ScoreTable({ rows }: { rows: ReliabilityRiskRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-700">
            <th className="py-2 pr-4">Site</th>
            <th className="py-2 pr-4">Score</th>
            <th className="py-2 pr-4">Band</th>
            <th className="py-2 pr-4">Date</th>
            <th className="py-2">AI recommendation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">{r.siteName}</td>
              <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-100">{r.rawScore.toFixed(1)}</td>
              <td className="py-2 pr-4"><BandBadge bandKey={r.bandKey} /></td>
              <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">{new Date(r.scoreDate).toLocaleDateString()}</td>
              <td className="py-2">{r.hasRecommendation ? "✅ Generated" : "— Not yet"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TriggerTable({ rows }: { rows: ReliabilityTriggerRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-700">
            <th className="py-2 pr-4">Site</th>
            <th className="py-2 pr-4">Why it fired</th>
            <th className="py-2 pr-4">Band change</th>
            <th className="py-2 pr-4">Indicators worsened</th>
            <th className="py-2">When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">{r.siteName}</td>
              <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">{TRIGGER_LABEL[r.triggerReason] ?? r.triggerReason}</td>
              <td className="py-2 pr-4">
                {r.fromBand || r.toBand ? (
                  <span className="inline-flex items-center gap-1">
                    <BandBadge bandKey={r.fromBand} /> <span aria-hidden>→</span> <BandBadge bandKey={r.toBand} />
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                {r.indicatorsDegraded.length ? r.indicatorsDegraded.join(", ") : "—"}
              </td>
              <td className="py-2 text-slate-500 dark:text-slate-400">{new Date(r.triggeredAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
