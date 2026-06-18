import { getAiFindings, getPredictabilityRuns, latestPredictabilityRun } from "@/lib/data/ehsRepo";
import { PageHeader, Stat, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { RiskLevelBadge, ReviewStatusBadge } from "@/components/ui/badges";
import type { RiskLevel } from "@/lib/constants";
import type { AiAnalysisOutput } from "@/lib/types";

const JOB_LABEL: Record<string, string> = {
  chemical_hazard_analysis:  "Chemical Hazard Analysis",
  compliance_gap_detection:  "Compliance Gap Detection",
  training_gap_analysis:     "Training Gap Analysis",
  risk_score_prediction:     "Risk Score Prediction",
  incident_pattern_analysis: "Incident Pattern Analysis",
  waste_classification:      "Waste Classification",
};

const STAGE_STYLE: Record<string, string> = {
  scan:     "bg-slate-100 text-slate-600",
  detect:   "bg-blue-100 text-blue-700",
  forecast: "bg-violet-100 text-violet-700",
  alert:    "bg-red-100 text-red-700 iq-pulse",
  learn:    "bg-emerald-100 text-emerald-700",
};

function fmt(s: string) {
  return new Date(s).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default async function AiPage() {
  const findings  = await getAiFindings();
  const runs      = await getPredictabilityRuns();
  const latestRun = await latestPredictabilityRun();

  const pending  = findings.filter((f) => f.review_status === "pending").length;
  const accepted = findings.filter((f) => f.review_status === "accepted").length;
  const rejected = findings.filter((f) => f.review_status === "rejected").length;

  const sortedRuns = [...runs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="AI Findings"
        subtitle="Predictability Engine output — scan → detect → forecast → alert → learn"
        actions={
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
            Run P-Engine Scan
          </button>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total Findings"  value={findings.length}  hint="All P-Engine output"  />
          <Stat label="Pending Review"  value={pending}          hint="Human review needed"   accent="#7c3aed" />
          <Stat label="Accepted"        value={accepted}         hint="Validated by team"     accent="#10b981" />
          <Stat label="Rejected"        value={rejected}         hint="Dismissed findings"    accent="#94a3b8" />
        </div>

        {/* Latest run status */}
        {latestRun && (
          <div className="mb-5 flex items-start gap-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-violet-900">P-Engine — Last Run</span>
                <Pill className={STAGE_STYLE[latestRun.stage] ?? "bg-slate-100 text-slate-600"}>
                  {latestRun.stage}
                </Pill>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-violet-700 sm:grid-cols-4">
                <div><span className="font-medium">Items scanned:</span> {latestRun.items_scanned}</div>
                <div><span className="font-medium">Signals found:</span> {latestRun.signals_found}</div>
                {latestRun.forecast_data && (
                  <>
                    <div>
                      <span className="font-medium">30-day forecast:</span>{" "}
                      {latestRun.forecast_data.predicted_compliance_score_30d}%
                    </div>
                    <div>
                      <span className="font-medium">Trend:</span>{" "}
                      {latestRun.forecast_data.compliance_trend}
                    </div>
                  </>
                )}
              </div>
              <div className="mt-1 text-xs text-violet-500">{fmt(latestRun.created_at)}</div>
            </div>
          </div>
        )}

        {/* P-Engine run history */}
        <Card className="mb-5">
          <CardHeader title="P-Engine Run History" subtitle={`${runs.length} runs`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Run Date</th>
                  <th className="px-4 py-2.5 text-left">Stage</th>
                  <th className="px-4 py-2.5 text-center">Scanned</th>
                  <th className="px-4 py-2.5 text-center">Signals</th>
                  <th className="px-4 py-2.5 text-center">30-day Forecast</th>
                  <th className="px-4 py-2.5 text-left">Trend</th>
                  <th className="px-4 py-2.5 text-left">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedRuns.map((r) => {
                  const forecast = r.forecast_data?.predicted_compliance_score_30d;
                  const trend    = r.forecast_data?.compliance_trend;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs tabular-nums text-slate-600">{fmt(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <Pill className={STAGE_STYLE[r.stage] ?? "bg-slate-100 text-slate-600"}>{r.stage}</Pill>
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-slate-700">{r.items_scanned}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-slate-700">{r.signals_found}</td>
                      <td className="px-4 py-3 text-center">
                        {forecast != null ? (
                          <span className={`text-sm font-bold ${forecast < 70 ? "text-red-600" : forecast < 85 ? "text-amber-600" : "text-emerald-600"}`}>
                            {forecast}%
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs capitalize text-slate-600">{trend ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-64 line-clamp-1">{r.summary}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* AI findings */}
        <Card>
          <CardHeader
            title="AI Findings"
            subtitle={`${findings.length} total · ${pending} pending review`}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Finding</th>
                  <th className="px-4 py-2.5 text-left">Job</th>
                  <th className="px-4 py-2.5 text-left">Source</th>
                  <th className="px-4 py-2.5 text-left">Risk Level</th>
                  <th className="px-4 py-2.5 text-left">Risk Score</th>
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {findings.map((f) => {
                  const output = f.output as AiAnalysisOutput | null;
                  return (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 max-w-64">
                        <div className="font-medium text-slate-800">
                          {JOB_LABEL[f.job] ?? f.job} — {f.source_type.replace(/_/g, " ")}
                        </div>
                        {output?.plain_language_summary && (
                          <div className="mt-0.5 text-xs text-slate-400 line-clamp-2">
                            {output.plain_language_summary}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Pill className="bg-violet-50 text-violet-700 text-xs">
                          {JOB_LABEL[f.job] ?? f.job}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 capitalize">
                        {f.source_type.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3">
                        {output?.risk_level ? (
                          <RiskLevelBadge level={output.risk_level as RiskLevel} />
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                        {output?.risk_score != null ? `${output.risk_score}/100` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                        {new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <ReviewStatusBadge status={f.review_status} />
                      </td>
                    </tr>
                  );
                })}
                {findings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                      No AI findings. Run the P-Engine to generate findings.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
