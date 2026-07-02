import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight } from "lucide-react";
import { DarkPageHeader, DarkCard, DarkCardHeader, Pill } from "@/components/ui/primitives";
import { runGatewayPipeline } from "@/lib/gateway/pipeline";
import type { CheckStatus } from "@/lib/gateway/pipeline";
import { PROMPT_VERSION } from "@/lib/env";
import { getPersistedTelemetry } from "@/lib/ai/telemetry";
import { summarizeTelemetry } from "@/lib/analytics/ai";
import { detectAiAnomalies } from "@/lib/analytics/alerts";
import { getGatewayHealthSnapshots } from "@/lib/gateway/agent";

const JOB_CONFIGS = [
  { job: "chemical_hazard_analysis",   label: "Chemical Hazard Analysis",  trigger: "Chemical inventory update",    frequency: "On change",  model: "claude-sonnet-5", enabled: true  },
  { job: "compliance_gap_detection",   label: "Compliance Gap Detection",   trigger: "Legal register review",        frequency: "Weekly",     model: "claude-sonnet-5", enabled: true  },
  { job: "training_gap_analysis",      label: "Training Gap Analysis",      trigger: "Training records change",      frequency: "Daily",      model: "claude-sonnet-5", enabled: true  },
  { job: "risk_score_prediction",      label: "Risk Score Prediction",      trigger: "P-Engine schedule",            frequency: "Daily",      model: "claude-sonnet-5", enabled: true  },
  { job: "incident_pattern_analysis",  label: "Incident Pattern Analysis",  trigger: "After incident report",        frequency: "On change",  model: "claude-sonnet-5", enabled: true  },
  { job: "waste_classification",       label: "Waste Classification",       trigger: "P-Engine scan",                frequency: "On scan",    model: "claude-sonnet-5", enabled: true  },
];

const STATUS_TONE = {
  pass: {
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
    text: "text-emerald-300", bg: "bg-emerald-900/20", border: "border-emerald-800/50", label: "All checks passing",
  },
  warn: {
    icon: <AlertTriangle className="h-5 w-5 text-amber-400" />,
    text: "text-amber-300", bg: "bg-amber-900/20", border: "border-amber-800/50", label: "Warnings detected",
  },
  fail: {
    icon: <XCircle className="h-5 w-5 text-red-400" />,
    text: "text-red-300", bg: "bg-red-900/20", border: "border-red-800/50", label: "Check failures — records being blocked",
  },
};

export default async function SAAIPage() {
  const report = await runGatewayPipeline().catch(() => null);
  const overall = report?.overall ?? "warn";
  const tone = STATUS_TONE[overall];

  const telemetry = await getPersistedTelemetry(200).catch(() => []);
  const tsum = summarizeTelemetry(telemetry);
  const anomalies = detectAiAnomalies(tsum);

  const [gatewayHealth] = await getGatewayHealthSnapshots(1).catch(() => []);
  const ghTone = gatewayHealth?.overall_status === "critical"
    ? { cls: "bg-red-900/20 border-red-800/50 text-red-300", label: "Critical" }
    : gatewayHealth?.overall_status === "degraded"
      ? { cls: "bg-amber-900/20 border-amber-800/50 text-amber-300", label: "Degraded" }
      : { cls: "bg-emerald-900/20 border-emerald-800/50 text-emerald-300", label: "Healthy" };

  return (
    <div className="flex flex-1 flex-col">
      <DarkPageHeader
        title="AI Model Configuration"
        subtitle="P-Engine job configuration, model selection, AI Gateway status, and prompt management"
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">

        {/* Prompt version banner */}
        <div className="mb-4 rounded-xl border bg-violet-900/20 border-violet-800/50 p-4 text-sm text-violet-300">
          <strong>PROMPT_VERSION:</strong> <code className="rounded bg-violet-900/50 px-1.5 py-0.5 font-mono text-xs">{PROMPT_VERSION}</code>
          {" · "}
          <strong>Model:</strong> <code className="rounded bg-violet-900/50 px-1.5 py-0.5 font-mono text-xs">claude-sonnet-5</code>
          {" · "}
          <strong>Provider:</strong> Anthropic
        </div>

        {/* AI Gateway Agent health — cross-surfaced from /sa/gateway */}
        {gatewayHealth && (
          <Link href="/sa/gateway" className={`mb-4 flex items-center justify-between gap-3 rounded-xl border p-4 text-sm ${ghTone.cls} hover:opacity-90`}>
            <span><strong>AI Gateway Agent:</strong> {ghTone.label} — {gatewayHealth.findings.length} maintenance finding(s) · last check {new Date(gatewayHealth.checked_at).toLocaleString()}</span>
            <span className="shrink-0 text-xs underline">View gateway →</span>
          </Link>
        )}

        {/* AI Gateway utility checks */}
        <DarkCard className="mb-5">
          <DarkCardHeader
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
                    <div className="text-xs text-slate-400">
                      {report.counts.pass} pass · {report.counts.warn} warn · {report.counts.fail} fail · {report.rejectQueue.length} blocked · mode: {report.mode}
                    </div>
                  </div>
                  <Link
                    href="/sa/gateway"
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
                        <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-200">{g.name}</div>
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
                    <div key={label} className="rounded-lg border border-white/8 bg-slate-900/60 px-2 py-2 text-center">
                      <div className={`text-lg font-bold ${warn ? "text-amber-400" : "text-white"}`}>{value}</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
                    </div>
                  ))}
                </div>

                {report.rejectQueue.length > 0 && (
                  <div className="mt-3 rounded-lg border bg-red-900/20 border-red-800/50 px-3 py-2">
                    <div className="text-xs font-semibold text-red-300">
                      {report.rejectQueue.length} record(s) blocked from the EHS Database — review in the{" "}
                      <Link href="/sa/gateway" className="underline hover:no-underline">AI Gateway</Link>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-white/8 bg-slate-900/40 px-4 py-3 text-sm text-slate-400">
                Gateway health check unavailable — ensure the EHS data layer is connected.
              </div>
            )}
          </div>
        </DarkCard>

        {/* AI Telemetry & Cost/Drift Alerts */}
        <DarkCard className="mb-5">
          <DarkCardHeader
            title="AI Telemetry & Alerts"
            subtitle="Per-call latency, token cost, and fallback rate — with drift/cost anomaly detection"
          />
          <div className="px-4 pb-4">
            {tsum.calls === 0 ? (
              <div className="rounded-lg border border-white/8 bg-slate-900/40 px-4 py-3 text-sm text-slate-400">
                No AI calls recorded in the current window. Telemetry populates as the engine runs in live mode.
              </div>
            ) : (
              <>
                {anomalies.length > 0 ? (
                  <div className="mb-3 space-y-2">
                    {anomalies.map((a) => {
                      const t = a.severity === "critical" ? STATUS_TONE.fail : STATUS_TONE.warn;
                      return (
                        <div key={a.key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${t.bg} ${t.border}`}>
                          {t.icon}
                          <span className={`text-xs font-semibold ${t.text}`}>{a.severity.toUpperCase()}</span>
                          <span className="text-xs text-slate-300">{a.message}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border bg-emerald-900/20 border-emerald-800/50 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-300">No cost or drift anomalies detected</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[
                    { label: "AI Calls",      value: String(tsum.calls) },
                    { label: "Fallback Rate", value: `${Math.round(tsum.fallbackRate * 100)}%`, warn: tsum.fallbackRate >= 0.25 },
                    { label: "Avg Latency",   value: `${Math.round(tsum.avgMs)}ms`, warn: tsum.avgMs >= 8000 },
                    { label: "Tokens",        value: `${(tsum.totalInputTokens + tsum.totalOutputTokens).toLocaleString()}` },
                    { label: "Est. Cost",     value: `$${tsum.estCostUsd.toFixed(2)}`, warn: tsum.estCostUsd >= 5 },
                  ].map(({ label, value, warn }) => (
                    <div key={label} className="rounded-lg border border-white/8 bg-slate-900/60 px-2 py-2 text-center">
                      <div className={`text-lg font-bold ${warn ? "text-amber-400" : "text-white"}`}>{value}</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </DarkCard>

        {/* P-Engine Job Configuration */}
        <DarkCard>
          <DarkCardHeader title="P-Engine Job Configuration" subtitle="AI analysis jobs and triggers" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Job</th>
                  <th className="px-4 py-2.5 text-left">Trigger</th>
                  <th className="px-4 py-2.5 text-left">Frequency</th>
                  <th className="px-4 py-2.5 text-left">Model</th>
                  <th className="px-4 py-2.5 text-left">Enabled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {JOB_CONFIGS.map((j) => (
                  <tr key={j.job} className="hover:bg-white/4">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{j.label}</div>
                      <div className="mt-0.5 text-xs font-mono text-slate-400">{j.job}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{j.trigger}</td>
                    <td className="px-4 py-3">
                      <Pill className="bg-blue-900/50 text-blue-300 text-xs">{j.frequency}</Pill>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{j.model}</td>
                    <td className="px-4 py-3">
                      <Pill className={j.enabled ? "bg-emerald-900/50 text-emerald-300" : "bg-slate-800 text-slate-400"}>
                        {j.enabled ? "Enabled" : "Disabled"}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DarkCard>
      </div>
    </div>
  );
}
