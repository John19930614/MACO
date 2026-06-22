import { PCLSS_RUNS, VELA_INSIGHTS, EXP_CAPTURES, ARC_SITES } from "@/lib/data/mock";
import { EXP, PCLSS, VELA } from "@/lib/arc/arc";
import { PageHeader, Card, CardHeader, Stat } from "@/components/ui/primitives";
import type { PclssRun, VelaInsight, ExpCapture } from "@/lib/types";

const STAGE_COLORS: Record<PclssRun["stage"], { badge: string; dot: string }> = {
  anticipate: { badge: "bg-blue-100 text-blue-700",    dot: "bg-blue-500"    },
  hunt:       { badge: "bg-purple-100 text-purple-700", dot: "bg-purple-500"  },
  forecast:   { badge: "bg-amber-100 text-amber-700",   dot: "bg-amber-500"   },
  preempt:    { badge: "bg-red-100 text-red-700",       dot: "bg-red-500"     },
  evolve:     { badge: "bg-teal-100 text-teal-700",     dot: "bg-teal-500"    },
};

function siteNameById(siteId: string): string {
  return ARC_SITES.find((s) => s.id === siteId)?.name ?? siteId;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function sourceLabel(source: ExpCapture["source"]): string {
  const map: Record<ExpCapture["source"], string> = {
    interview:        "Interview",
    ai_interview:     "AI Interview",
    walk_floor:       "Floor Walk",
    incident_debrief: "Incident Debrief",
    manual:           "Manual Entry",
  };
  return map[source] ?? source;
}

export default function IntelligencePage() {
  const sortedRuns = [...PCLSS_RUNS].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const sortedCaptures = [...EXP_CAPTURES].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const totalSignals  = PCLSS_RUNS.reduce((s, r) => s + r.signals_found, 0);
  const totalActions  = PCLSS_RUNS.reduce((s, r) => s + r.actions_proposed, 0);
  const embeddedCount = EXP_CAPTURES.filter((e) => e.embedded).length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={`${PCLSS.code} · ${EXP.code} · ${VELA.code}`}
        subtitle="The proactive engine, the knowledge ghost, and cross-vertical master intelligence."
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* KPI stats */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total Runs"          value={PCLSS_RUNS.length}                     strip="#6366f1" />
          <Stat label="Signals Detected"    value={totalSignals}                           accent="#f97316" strip="#f97316" />
          <Stat label="Actions Proposed"    value={totalActions}                           accent="#22c55e" strip="#22c55e" />
          <Stat label="EXP Captures Embedded" value={`${embeddedCount} / ${EXP_CAPTURES.length}`} accent="#3b82f6" strip="#3b82f6" />
        </div>

        {/* ── Section 1: P-CLSS Runs ── */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{PCLSS.code} Runs</h2>
              <p className="text-xs text-slate-500 mt-0.5">{PCLSS.summary}</p>
            </div>
            <span className="text-xs text-slate-400 tabular-nums">{PCLSS_RUNS.length} runs</span>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 text-left">Stage</th>
                    <th className="px-4 py-2.5 text-left">Site</th>
                    <th className="px-4 py-2.5 text-right">Signals</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                    <th className="hidden lg:table-cell px-4 py-2.5 text-left">Summary</th>
                    <th className="px-4 py-2.5 text-right">Ran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedRuns.map((run) => {
                    const colors = STAGE_COLORS[run.stage];
                    return (
                      <tr key={run.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${colors.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                            {run.stage.charAt(0).toUpperCase() + run.stage.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 truncate max-w-[160px]">
                          {siteNameById(run.site_id)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums">
                          {run.signals_found}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500 tabular-nums">
                          {run.actions_proposed}
                        </td>
                        <td className="hidden lg:table-cell px-4 py-3 text-xs text-slate-500 truncate max-w-xs">
                          {run.summary}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-400 whitespace-nowrap">
                          {formatDate(run.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* ── Section 2: EXP Captures ── */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{EXP.code} Captures</h2>
              <p className="text-xs text-slate-500 mt-0.5">{EXP.summary}</p>
            </div>
            <span className="text-xs text-slate-400 tabular-nums">{EXP_CAPTURES.length} captures</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedCaptures.map((capture) => (
              <Card key={capture.id}>
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      capture.embedded
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {capture.embedded ? "Embedded" : "Capturing"}
                    </span>
                    <span className="text-xs text-slate-400 text-right whitespace-nowrap">
                      {new Date(capture.created_at).toLocaleDateString("en-AU", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </span>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-slate-900 leading-snug">{capture.subject}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{siteNameById(capture.site_id)}</div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{capture.summary}</p>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">Source</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                      {sourceLabel(capture.source)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* ── Section 3: VELA Insights ── */}
        <section>
          <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{VELA.code} — {VELA.title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{VELA.summary}</p>
            </div>
            <span className="text-xs text-slate-400 tabular-nums">{VELA_INSIGHTS.length} patterns</span>
          </div>

          <div className="space-y-4">
            {VELA_INSIGHTS.map((insight: VelaInsight) => {
              const confidencePct = Math.round(insight.confidence * 100);
              const confColor =
                confidencePct >= 80 ? "bg-emerald-500"
                : confidencePct >= 65 ? "bg-amber-500"
                : "bg-slate-400";

              return (
                <Card key={insight.id}>
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {insight.pattern.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </h3>
                        <div className="text-xs text-slate-500">
                          Origin: <span className="text-slate-600">{insight.origin_sector}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right space-y-1">
                        <div className="text-xs text-slate-500">Confidence</div>
                        <div className="text-lg font-bold tabular-nums text-slate-900">{confidencePct}%</div>
                      </div>
                    </div>

                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${confColor}`}
                        style={{ width: `${confidencePct}%` }}
                      />
                    </div>

                    <p className="text-sm text-slate-700 leading-relaxed">{insight.summary}</p>

                    <div className="flex flex-wrap gap-4 pt-1">
                      <div className="space-y-1.5">
                        <div className="text-xs text-slate-500 uppercase tracking-wide">Applies to</div>
                        <div className="flex flex-wrap gap-1.5">
                          {insight.applies_to.map((sector) => (
                            <span
                              key={sector}
                              className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs text-blue-700"
                            >
                              {sector}
                            </span>
                          ))}
                        </div>
                      </div>
                      {insight.regulatory_refs.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-xs text-slate-500 uppercase tracking-wide">Regulatory refs</div>
                          <div className="flex flex-wrap gap-1.5">
                            {insight.regulatory_refs.map((ref) => (
                              <span
                                key={ref}
                                className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs text-slate-600 font-mono"
                              >
                                {ref}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
