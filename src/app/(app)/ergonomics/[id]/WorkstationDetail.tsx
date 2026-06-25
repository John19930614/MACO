"use client";

import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Users,
  Calendar,
  Building2,
  Activity,
  FileText,
  ChevronRight,
  Wrench,
} from "lucide-react";
import { Card, CardHeader, Pill } from "@/components/ui/primitives";
import type { ErgonomicsWorkstation, ErgonomicsJobTask, CapaAction, Incident } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function riskColor(level: ErgonomicsWorkstation["risk_level"]) {
  const map: Record<string, string> = {
    critical: "bg-red-100 text-red-700 border border-red-200",
    high:     "bg-orange-100 text-orange-700 border border-orange-200",
    medium:   "bg-amber-100 text-amber-700 border border-amber-200",
    low:      "bg-emerald-100 text-emerald-700",
  };
  return map[level] ?? "bg-slate-100 text-slate-600";
}

function riskBanner(level: ErgonomicsWorkstation["risk_level"]) {
  const map: Record<string, string> = {
    critical: "#ef4444",
    high:     "#f97316",
    medium:   "#f59e0b",
    low:      "#10b981",
  };
  return map[level] ?? "#94a3b8";
}

function statusColor(s: string) {
  const map: Record<string, string> = {
    compliant:           "bg-emerald-100 text-emerald-700",
    needs_improvement:   "bg-amber-100 text-amber-700",
    non_compliant:       "bg-red-100 text-red-700",
    assessment_due:      "bg-orange-100 text-orange-700",
    controlled:          "bg-emerald-100 text-emerald-700",
    review_required:     "bg-amber-100 text-amber-700",
    controls_pending:    "bg-red-100 text-red-700",
  };
  return map[s] ?? "bg-slate-100 text-slate-600";
}

function taskRiskColor(score: number) {
  if (score >= 18) return "bg-red-100 text-red-700";
  if (score >= 12) return "bg-orange-100 text-orange-700";
  if (score >= 7)  return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

function hazardLabel(h: string) {
  return h.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function incidentSeverityColor(s: string) {
  if (s === "critical") return "bg-red-100 text-red-700";
  if (s === "high")     return "bg-orange-100 text-orange-700";
  if (s === "medium")   return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function capaStatusColor(s: string) {
  if (s === "overdue")    return "bg-red-100 text-red-700";
  if (s === "in_progress") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

// ── Risk score bar ─────────────────────────────────────────────────────────────

function RiskBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.round((score / 25) * 100));
  const color =
    score >= 18 ? "#ef4444" :
    score >= 12 ? "#f97316" :
    score >= 7  ? "#f59e0b" :
    "#10b981";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] font-bold w-6 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

// ── Meta row ──────────────────────────────────────────────────────────────────

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-slate-100 text-slate-400 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-xs font-medium text-slate-700 mt-0.5">{value}</div>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  workstation: ErgonomicsWorkstation;
  deptTasks: ErgonomicsJobTask[];
  relatedCapas: CapaAction[];
  recentIncidents: Incident[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WorkstationDetail({ workstation: ws, deptTasks, relatedCapas, recentIncidents }: Props) {
  const isOverdue = ws.next_assessment && new Date(ws.next_assessment) < new Date();
  const banner = riskBanner(ws.risk_level);

  return (
    <div className="flex flex-col overflow-hidden h-full">

      {/* Page header */}
      <div
        className="relative flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4"
        style={{ borderTop: `3px solid ${banner}` }}
      >
        <div className="flex items-start gap-3">
          <Link
            href="/ergonomics"
            className="mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Ergonomics
          </Link>
          <div className="w-px h-4 bg-slate-200 mt-0.5" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900">{ws.name}</h1>
              <Pill className={riskColor(ws.risk_level)}>{ws.risk_level} risk</Pill>
              <Pill className={statusColor(ws.status)}>{ws.status.replace(/_/g, " ")}</Pill>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {ws.workstation_code} &middot; {ws.department}
              {ws.worker_count > 0 && ` · ${ws.worker_count} worker${ws.worker_count !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/audits"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Calendar className="h-4 w-4" />
            Schedule Audit
          </Link>
          <Link
            href="/incidents"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Log MSD Incident
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="iq-scroll flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-3 gap-5">

          {/* Left — main content */}
          <div className="col-span-2 flex flex-col gap-5">

            {/* Assessment overview */}
            <Card>
              <CardHeader
                title="Assessment Overview"
                subtitle="Current ergonomics risk rating and inspection schedule"
              />
              <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-0">
                <MetaRow
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  label="Department"
                  value={ws.department}
                />
                <MetaRow
                  icon={<Users className="h-3.5 w-3.5" />}
                  label="Workers at Station"
                  value={ws.worker_count > 0 ? ws.worker_count : "—"}
                />
                <MetaRow
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Last Assessment"
                  value={fmtDate(ws.last_assessment)}
                />
                <MetaRow
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Next Assessment Due"
                  value={
                    <span className={isOverdue ? "text-red-600 font-semibold" : undefined}>
                      {fmtDate(ws.next_assessment)}
                      {isOverdue && " · OVERDUE"}
                    </span>
                  }
                />
                <MetaRow
                  icon={<Activity className="h-3.5 w-3.5" />}
                  label="Open Findings"
                  value={
                    ws.open_findings > 0
                      ? <span className="text-orange-600 font-semibold">{ws.open_findings} finding{ws.open_findings !== 1 ? "s" : ""} open</span>
                      : <span className="text-emerald-600">No open findings</span>
                  }
                />
                <MetaRow
                  icon={<AlertTriangle className="h-3.5 w-3.5" />}
                  label="Risk Level"
                  value={<Pill className={riskColor(ws.risk_level)}>{ws.risk_level}</Pill>}
                />
              </div>

              {/* Primary hazards */}
              {ws.primary_hazards.length > 0 && (
                <div className="border-t border-slate-100 px-4 py-3">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Primary Hazards</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ws.primary_hazards.map((h) => (
                      <Pill key={h} className="bg-violet-100 text-violet-700">{hazardLabel(h)}</Pill>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {ws.notes && (
                <div className="border-t border-slate-100 px-4 py-3">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Assessment Notes</div>
                  <p className="text-xs text-slate-600 leading-relaxed">{ws.notes}</p>
                </div>
              )}
            </Card>

            {/* JHAs for this department */}
            <Card>
              <CardHeader
                title={`Job Hazard Analyses — ${ws.department}`}
                subtitle={`${deptTasks.length} JHA${deptTasks.length !== 1 ? "s" : ""} in this department`}
                right={
                  <Link
                    href="/ergonomics"
                    className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
                  >
                    All JHAs <ChevronRight className="h-3 w-3" />
                  </Link>
                }
              />
              {deptTasks.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50">
                      <tr>
                        {["Task", "Hazard Type", "Risk Score", "Controls", "Status"].map((h) => (
                          <th key={h} className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {deptTasks.map((task) => (
                        <tr key={task.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-slate-800 text-xs">{task.task_title}</div>
                            <div className="text-[10px] text-slate-400">{task.task_code}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Pill className="bg-violet-100 text-violet-700">{hazardLabel(task.hazard_type)}</Pill>
                          </td>
                          <td className="px-4 py-2.5 w-32">
                            <RiskBar score={task.risk_score} />
                          </td>
                          <td className="px-4 py-2.5 text-[11px] text-slate-500 max-w-[160px]">
                            {task.controls.length > 0
                              ? task.controls.slice(0, 2).join(" · ") + (task.controls.length > 2 ? ` +${task.controls.length - 2}` : "")
                              : <span className="text-red-500 font-medium">No controls recorded</span>
                            }
                          </td>
                          <td className="px-4 py-2.5">
                            <Pill className={statusColor(task.status)}>{task.status.replace(/_/g, " ")}</Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-4 py-6 text-center text-xs text-slate-400">
                  No JHAs recorded for {ws.department}
                </div>
              )}
            </Card>

            {/* Recommendations */}
            <Card>
              <CardHeader
                title="Recommendations"
                subtitle="Suggested actions based on risk level and assessment status"
              />
              <div className="p-4 space-y-3">
                {ws.risk_level === "critical" && (
                  <RecommendationRow
                    icon={<AlertTriangle className="h-4 w-4" />}
                    color="red"
                    title="Immediate intervention required"
                    body="This workstation is rated critical risk. Remove workers or implement interim controls until a formal Level 2 assessment is completed and corrective actions are in place."
                  />
                )}
                {ws.risk_level === "high" && (
                  <RecommendationRow
                    icon={<AlertTriangle className="h-4 w-4" />}
                    color="orange"
                    title="Schedule Level 2 assessment"
                    body="High-risk workstations require a detailed ergonomic evaluation. Prioritize engineering controls and schedule a formal assessment within 30 days."
                  />
                )}
                {(ws.status === "needs_improvement" || ws.status === "non_compliant") && (
                  <RecommendationRow
                    icon={<Wrench className="h-4 w-4" />}
                    color="amber"
                    title="Implement corrective actions"
                    body="Workstation is not fully compliant. Review open findings and create CAPA items to track remediation to closure."
                  />
                )}
                {isOverdue && (
                  <RecommendationRow
                    icon={<Clock className="h-4 w-4" />}
                    color="red"
                    title="Assessment overdue"
                    body={`The scheduled assessment date of ${fmtDate(ws.next_assessment)} has passed. Reschedule immediately to maintain compliance.`}
                  />
                )}
                {ws.open_findings > 0 && (
                  <RecommendationRow
                    icon={<Activity className="h-4 w-4" />}
                    color="orange"
                    title={`${ws.open_findings} open finding${ws.open_findings !== 1 ? "s" : ""} pending`}
                    body="Address and close all open findings before the next scheduled assessment to maintain a compliant status."
                  />
                )}
                {ws.risk_level === "low" && ws.status === "compliant" && !isOverdue && ws.open_findings === 0 && (
                  <RecommendationRow
                    icon={<ShieldCheck className="h-4 w-4" />}
                    color="green"
                    title="Workstation in good standing"
                    body="Risk is low, status is compliant, and no open findings. Continue routine assessments on schedule."
                  />
                )}
                {ws.primary_hazards.length > 0 && (
                  <RecommendationRow
                    icon={<FileText className="h-4 w-4" />}
                    color="blue"
                    title="Review hazard controls"
                    body={`Active hazards: ${ws.primary_hazards.map(hazardLabel).join(", ")}. Verify engineering and administrative controls are documented and effective.`}
                  />
                )}
              </div>
            </Card>
          </div>

          {/* Right sidebar */}
          <div className="flex flex-col gap-5">

            {/* Quick stats */}
            <Card>
              <CardHeader title="At a Glance" />
              <div className="p-4 space-y-3">
                <StatRow label="Risk Level" value={<Pill className={riskColor(ws.risk_level)}>{ws.risk_level}</Pill>} />
                <StatRow label="Status" value={<Pill className={statusColor(ws.status)}>{ws.status.replace(/_/g, " ")}</Pill>} />
                <StatRow
                  label="Open Findings"
                  value={
                    <span className={ws.open_findings > 0 ? "font-bold text-orange-600" : "text-emerald-600 font-medium"}>
                      {ws.open_findings}
                    </span>
                  }
                />
                <StatRow label="Workers" value={ws.worker_count || "—"} />
                <StatRow label="Dept. JHAs" value={deptTasks.length} />
                <StatRow label="Related CAPAs" value={relatedCapas.length} />
              </div>
            </Card>

            {/* Related CAPAs */}
            {relatedCapas.length > 0 && (
              <Card>
                <CardHeader
                  title="Open CAPAs"
                  subtitle="Ergonomics corrective actions"
                  right={
                    <Link href="/capa" className="text-[11px] font-medium text-blue-600 hover:underline">
                      All →
                    </Link>
                  }
                />
                <div className="divide-y divide-slate-50">
                  {relatedCapas.slice(0, 5).map((capa) => (
                    <Link
                      key={capa.id}
                      href={`/capa/${capa.id}`}
                      className="flex items-start gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-800 truncate">{capa.title}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Due: {fmtDate(capa.due_date)}
                        </div>
                      </div>
                      <Pill className={capaStatusColor(capa.status)} style={{ fontSize: "9.5px" }}>
                        {capa.status}
                      </Pill>
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            {/* Recent incidents */}
            <Card>
              <CardHeader
                title="Recent MSD Incidents"
                subtitle="Ergonomics-related events"
                right={
                  <Link href="/incidents" className="text-[11px] font-medium text-blue-600 hover:underline">
                    All →
                  </Link>
                }
              />
              <div className="divide-y divide-slate-50">
                {recentIncidents.length > 0 ? (
                  recentIncidents.map((inc) => (
                    <Link
                      key={inc.id}
                      href={`/incidents/${inc.id}`}
                      className="block px-3 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs font-medium text-slate-800 leading-snug">{inc.title}</div>
                        <Pill className={incidentSeverityColor(inc.severity)} style={{ fontSize: "9.5px" }}>
                          {inc.severity}
                        </Pill>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10.5px] text-slate-400">
                        <span className="truncate max-w-[120px]">{inc.location}</span>
                        <span>·</span>
                        <span>{fmtDate(inc.occurred_at)}</span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="px-3 py-4 text-center text-xs text-slate-400">
                    No ergonomics incidents recorded
                  </div>
                )}
              </div>
            </Card>

            {/* Timestamps */}
            <Card>
              <CardHeader title="Record Info" />
              <div className="p-4 space-y-2.5">
                <StatRow label="Workstation Code" value={<span className="font-mono text-[11px]">{ws.workstation_code}</span>} />
                <StatRow label="Created" value={fmtDate(ws.created_at)} />
                <StatRow label="Last Updated" value={fmtDate(ws.updated_at)} />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-xs font-medium text-slate-800">{value}</span>
    </div>
  );
}

type RecommendationColor = "red" | "orange" | "amber" | "green" | "blue";

function RecommendationRow({
  icon,
  color,
  title,
  body,
}: {
  icon: React.ReactNode;
  color: RecommendationColor;
  title: string;
  body: string;
}) {
  const palette: Record<RecommendationColor, { bg: string; icon: string; title: string }> = {
    red:    { bg: "bg-red-50 border-red-100",    icon: "text-red-500",    title: "text-red-700" },
    orange: { bg: "bg-orange-50 border-orange-100", icon: "text-orange-500", title: "text-orange-700" },
    amber:  { bg: "bg-amber-50 border-amber-100",   icon: "text-amber-500",  title: "text-amber-700" },
    green:  { bg: "bg-emerald-50 border-emerald-100", icon: "text-emerald-500", title: "text-emerald-700" },
    blue:   { bg: "bg-blue-50 border-blue-100",  icon: "text-blue-500",   title: "text-blue-700" },
  };
  const c = palette[color];
  return (
    <div className={`rounded-lg border p-3 flex gap-3 ${c.bg}`}>
      <div className={`shrink-0 mt-0.5 ${c.icon}`}>{icon}</div>
      <div>
        <div className={`text-xs font-semibold ${c.title}`}>{title}</div>
        <div className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{body}</div>
      </div>
    </div>
  );
}
