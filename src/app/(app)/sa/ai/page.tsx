import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight } from "lucide-react";
import { PageHeader, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { runGatewayPipeline } from "@/lib/gateway/pipeline";
import type { CheckStatus } from "@/lib/gateway/pipeline";

const JOB_CONFIGS = [
  { job: "chemical_hazard_analysis",   label: "Chemical Hazard Analysis",  trigger: "Chemical inventory update",    frequency: "On change",  model: "claude-sonnet-4-6", enabled: true  },
  { job: "compliance_gap_detection",   label: "Compliance Gap Detection",   trigger: "Legal register review",        frequency: "Weekly",     model: "claude-sonnet-4-6", enabled: true  },
  { job: "training_gap_analysis",      label: "Training Gap Analysis",      trigger: "Training records change",      frequency: "Daily",      model: "claude-sonnet-4-6", enabled: true  },
  { job: "risk_score_prediction",      label: "Risk Score Prediction",      trigger: "P-Engine schedule",            frequency: "Daily",      model: "claude-sonnet-4-6", enabled: true  },
  { job: "incident_pattern_analysis",  label: "Incident Pattern Analysis",  trigger: "After incident report",        frequency: "On change",  model: "claude-sonnet-4-6", enabled: true  },
  { job: "waste_classification",       label: "Waste Classification",       trigger: "New waste stream added",       frequency: "On change",  model: "claude-sonnet-4-6", enabled: false },
];

const STATUS_TONE = {
  pass: {
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
    text: "text-emerald-800", bg: "bg-emerald-50", border: "border-emerald-200", label: "All checks passing",
  },
  warn: {
    icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
    text: "text-amber-800", bg: "bg-amber-50", border: "border-amber-200", label: "Warnings detected",
  },
  fail: {
    icon: <XCircle className="h-5 w-5 text-red-600" />,
    text: "text-red-800", bg: "bg-red-50", border: "border-red-200", label: "Check failures — records being blocked",
  },
};

export default async function SAAIPage() {
  const report = await runGatewayPipeline().catch(() => null);
  const overall = report?.overall ?? "warn";
  const tone = STATUS_TONE[overall];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="AI Model Configuration"
        subtitle="P-Engine job configuration, model selection, AI Gateway status, and prompt management"
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">

        {/* Prompt version banner */}
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800">
          <strong>PROMPT_VERSION:</strong> <code className="rounded bg-violet-100 px-1.5 py-0.5 font-mono text-xs">safetyiq-ehs-2026-06-17</code>
          {" · "}
          <strong>Model:</strong> <code className="rounded bg-violet-100 px-1.5 py-0.5 font-mono text-xs">claude-sonnet-4-6</code>
          {" · "}
          <strong>Provider:</strong> Anthropic
        </div>

        {/* AI Gateway utility checks */}
        <Card className="mb-5">
          <CardHeader
            title="AI Gateway — EHS Data Validation"
            subtitle="3-stage validation pipeline runs live over all EHS records — schema, business rules, anomaly & quality"
          />
          <div className="px-4 pb-4">
            {report ? (
              <>
                {/* Overall status banner */}
                <div className={`mb-3 flex items-center gap-3 rounded-xl border px-4 py-3 ${tone.bg} ${tone.border}`}>
                  {tone.icon}
                  <div className="flex-1">
                    <div className={`text-sm font-bold ${tone.text}`}>{tone.label}</div>
                    <div className="text-xs text-slate-500">
                      {report.counts.pass} pass · {report.counts.warn} warn · {report.counts.fail} fail · {report.rejectQueue.length} blocked · mode: {report.mode}
                    </div>
                  </div>
                  <Link
                    href="/gateway"
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                  >
                    Full report <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                {/* Gateway status per-stage */}
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {report.gateways.map((g, i) => {
                    const t = STATUS_TONE[g.status];
                    return (
                      <div key={g.id} className={`rounded-lg border px-3 py-2 ${t.bg} ${t.border}`}>
                        <div className={`text-[10px] font-bold uppercase tracking-wide ${t.text}`}>Gateway {i + 1}</div>
                        <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-700">{g.name}</div>
                        <div className={`mt-0.5 text-[10px] font-semibold ${t.text}`}>{g.status.toUpperCase()}</div>
                      </div>
                    );
                  })}
                </div>

                {/* EHS record counts */}
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {[
                    { label: "Incidents",     value: report.stats.incidents },
                    { label: "Open CAPAs",    value: report.stats.openCapas,       warn: report.stats.openCapas > 5 },
                    { label: "Risk Assmts",   value: report.stats.riskAssessments },
                    { label: "Active Audits", value: report.stats.activeAudits },
                    { label: "Chemicals",     value: report.stats.chemicals },
                    { label: "Equipment",     value: report.stats.equipment },
                  ].map(({ label, value, warn }) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-center">
                      <div className={`text-lg font-bold ${warn ? "text-amber-600" : "text-slate-800"}`}>{value}</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
                    </div>
                  ))}
                </div>

                {report.rejectQueue.length > 0 && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <div className="text-xs font-semibold text-red-800">
                      {report.rejectQueue.length} record(s) blocked from the EHS Database — review in the{" "}
                      <Link href="/gateway" className="underline hover:no-underline">AI Gateway</Link>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Gateway health check unavailable — ensure the EHS data layer is connected.
              </div>
            )}
          </div>
        </Card>

        {/* P-Engine Job Configuration */}
        <Card>
          <CardHeader title="P-Engine Job Configuration" subtitle="AI analysis jobs and triggers" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Job</th>
                  <th className="px-4 py-2.5 text-left">Trigger</th>
                  <th className="px-4 py-2.5 text-left">Frequency</th>
                  <th className="px-4 py-2.5 text-left">Model</th>
                  <th className="px-4 py-2.5 text-left">Enabled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {JOB_CONFIGS.map((j) => (
                  <tr key={j.job} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{j.label}</div>
                      <div className="mt-0.5 text-xs font-mono text-slate-400">{j.job}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{j.trigger}</td>
                    <td className="px-4 py-3">
                      <Pill className="bg-blue-50 text-blue-700 text-xs">{j.frequency}</Pill>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{j.model}</td>
                    <td className="px-4 py-3">
                      <Pill className={j.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}>
                        {j.enabled ? "Enabled" : "Disabled"}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
