import Link from "next/link";
import {
  AlertTriangle, ShieldCheck, FileText, Clock, Plus, ChevronRight,
} from "lucide-react";
import { PageHeader, Card, CardHeader, Pill } from "@/components/ui/primitives";
import {
  getErgonomicsWorkstations,
  getErgonomicsJobTasks,
  getErgonomicsIncidents,
  getCapaActions,
} from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import type { ErgonomicsWorkstation } from "@/lib/types";
import { ErgonomicsScreening } from "./ErgonomicsScreening";
import { AddWorkstationButton } from "./AddWorkstationButton";
import { AddJobTaskButton } from "./AddJobTaskButton";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
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

function statusColor(s: string) {
  const map: Record<string, string> = {
    compliant:           "bg-emerald-100 text-emerald-700",
    needs_improvement:   "bg-amber-100 text-amber-700",
    non_compliant:       "bg-red-100 text-red-700",
    assessment_due:      "bg-orange-100 text-orange-700",
    controlled:          "bg-emerald-100 text-emerald-700",
    review_required:     "bg-amber-100 text-amber-700",
    controls_pending:    "bg-red-100 text-red-700",
    reported:            "bg-amber-100 text-amber-700",
    under_investigation: "bg-orange-100 text-orange-700",
    capa_open:           "bg-orange-100 text-orange-700",
    closed:              "bg-emerald-100 text-emerald-700",
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ErgonomicsPage() {
  const tenantId = await getEffectiveTenantId();

  const [workstations, jobTasks, ergoIncidents, allCapas] = await Promise.all([
    getErgonomicsWorkstations(tenantId),
    getErgonomicsJobTasks(tenantId),
    getErgonomicsIncidents(tenantId),
    getCapaActions(tenantId),
  ]);

  // Derived metrics
  const highRiskWs    = workstations.filter((w) => w.risk_level === "high" || w.risk_level === "critical");
  const assessmentDue = workstations.filter((w) => w.status === "assessment_due").length;
  const overdueWs     = workstations.filter((w) => w.next_assessment && new Date(w.next_assessment) < new Date());
  const openFindings  = workstations.reduce((sum, w) => sum + w.open_findings, 0);
  const openIncidents = ergoIncidents.filter((i) => i.status === "reported" || i.status === "under_investigation").length;
  const reviewTasks   = jobTasks.filter((t) => t.status === "review_required" || t.status === "controls_pending");
  const ergoCapas     = allCapas.filter(
    (c) => (c.status === "open" || c.status === "in_progress" || c.status === "overdue") &&
           (c.title?.toLowerCase().includes("ergo") || c.description?.toLowerCase().includes("ergon") ||
            c.description?.toLowerCase().includes("strain") || c.description?.toLowerCase().includes("repetitive"))
  );

  // Compliance checklist
  const allWsCompliant = workstations.length > 0 && workstations.every((w) => w.status === "compliant");
  const COMPLIANCE_ITEMS = [
    {
      label: "Workstation Assessment Schedule",
      status: overdueWs.length > 0 ? `${overdueWs.length} assessment${overdueWs.length > 1 ? "s" : ""} overdue` : assessmentDue > 0 ? `${assessmentDue} coming due` : "All workstations current",
      ok: overdueWs.length > 0 ? false : assessmentDue > 0 ? null : true,
    },
    {
      label: "High-Risk Workstations",
      status: highRiskWs.length > 0 ? `${highRiskWs.length} rated high / critical` : "No high-risk workstations",
      ok: highRiskWs.length > 0 ? false : true,
    },
    {
      label: "JHAs — Review Required",
      status: reviewTasks.length > 0 ? `${reviewTasks.length} JHA${reviewTasks.length > 1 ? "s" : ""} need attention` : "All JHAs controlled",
      ok: reviewTasks.length > 0 ? null : true,
    },
    {
      label: "Open Ergonomics Findings",
      status: openFindings > 0 ? `${openFindings} open finding${openFindings > 1 ? "s" : ""}` : "No open findings",
      ok: openFindings > 0 ? false : true,
    },
    {
      label: "Active MSD Incidents",
      status: openIncidents > 0 ? `${openIncidents} under investigation` : "No open incidents",
      ok: openIncidents > 0 ? false : true,
    },
    {
      label: "Open Ergonomics CAPAs",
      status: ergoCapas.length > 0 ? `${ergoCapas.length} corrective action${ergoCapas.length > 1 ? "s" : ""} open` : "All CAPAs closed",
      ok: ergoCapas.length > 0 ? null : true,
    },
    {
      label: "Overall Ergonomics Compliance",
      status: allWsCompliant ? "All workstations compliant" : `${workstations.filter((w) => w.status !== "compliant").length} non-compliant`,
      ok: allWsCompliant,
    },
  ];

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <PageHeader
        title="Ergonomics & MSD Prevention"
        subtitle="Level 1 screenings, workstation assessments, job hazard analyses, and OSHA ergonomics compliance"
        actions={
          <div className="flex items-center gap-2">
            <AddWorkstationButton />
            <AddJobTaskButton />
            <Link
              href="/documents"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" />
              SOP Library
            </Link>
            <Link
              href="/incidents"
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Log MSD Incident
            </Link>
          </div>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-5 space-y-6">

        {/* Metrics strip — matches PredictSafe BIO pattern */}
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[12px] text-slate-600 divide-x divide-slate-200">
          {[
            { label: "Level 1 screenings", value: workstations.length },
            { label: "High or Severe",     value: highRiskWs.length,   highlight: highRiskWs.length > 0 },
            { label: "Level 2 requests",   value: reviewTasks.length,  highlight: reviewTasks.length > 0 },
            { label: "Level 2 inspections",value: assessmentDue,        highlight: assessmentDue > 0 },
          ].map((m) => (
            <div key={m.label} className="pl-4 first:pl-0 flex items-center gap-1.5">
              <span className={`font-bold ${m.highlight ? "text-orange-600" : "text-slate-700"}`}>{m.label}:</span>
              <span className={`font-extrabold ${m.highlight ? "text-orange-600" : "text-slate-800"}`}>{m.value}</span>
            </div>
          ))}
        </div>

        {/* Interactive screening tool */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-[13px] font-bold text-slate-800">Level 1 Ergonomics Screening</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Worker self-assessment — complete to generate an instant risk score and AI insight</p>
            </div>
            <Link
              href="/audits"
              className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11.5px] font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              Schedule Level 2 Audit <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ErgonomicsScreening />
        </div>

        {/* Management section */}
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 flex flex-col gap-5">

            {/* Workstation Assessments */}
            <Card>
              <CardHeader
                title="Workstation Assessments"
                subtitle="Ergonomics risk ratings and inspection schedule by workstation"
                right={
                  <div className="flex items-center gap-3">
                    <AddWorkstationButton />
                    <Link href="/audits" className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline">
                      Schedule audit <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {["Workstation", "Dept", "Workers", "Last Assessed", "Next Due", "Risk", "Status", ""].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {workstations.map((ws) => (
                      <tr key={ws.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-slate-800 text-xs">{ws.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {ws.workstation_code}
                            {ws.open_findings > 0 && ` · ${ws.open_findings} open finding${ws.open_findings > 1 ? "s" : ""}`}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{ws.department}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-700">{ws.worker_count}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{fmtDate(ws.last_assessment)}</td>
                        <td className="px-4 py-2.5 text-xs">
                          <span className={ws.next_assessment && new Date(ws.next_assessment) < new Date() ? "font-semibold text-red-600" : "text-slate-600"}>
                            {fmtDate(ws.next_assessment)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5"><Pill className={riskColor(ws.risk_level)}>{ws.risk_level}</Pill></td>
                        <td className="px-4 py-2.5"><Pill className={statusColor(ws.status)}>{ws.status.replace(/_/g, " ")}</Pill></td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/ergonomics/${ws.id}`}
                            className="flex items-center gap-0.5 text-[11px] font-medium text-blue-600 hover:underline whitespace-nowrap"
                          >
                            View <ChevronRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {workstations.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-6 text-center text-xs text-slate-400">No workstations assessed</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Job Hazard Analyses */}
            <Card>
              <CardHeader
                title="Job Hazard Analyses (JHA)"
                subtitle="Ergonomic hazard type, risk score, and control status per task"
                right={<AddJobTaskButton />}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {["Task", "Department", "Primary Hazard", "Risk Score", "Controls", "Status"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {jobTasks.map((task) => (
                      <tr key={task.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-slate-800 text-xs">{task.task_title}</div>
                          <div className="text-[10px] text-slate-400">{task.task_code}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{task.department}</td>
                        <td className="px-4 py-2.5">
                          <Pill className="bg-violet-100 text-violet-700">{hazardLabel(task.hazard_type)}</Pill>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ${taskRiskColor(task.risk_score)}`}>
                            {task.risk_score}
                          </span>
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
                    {jobTasks.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-400">No job hazard analyses recorded</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-5">

            {/* Compliance summary */}
            <Card>
              <CardHeader title="Ergonomics Compliance" subtitle="Derived from live assessment data" />
              <div className="p-4 space-y-3">
                {COMPLIANCE_ITEMS.map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    {item.ok === true  && <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />}
                    {item.ok === false && <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />}
                    {item.ok === null  && <Clock className="h-4 w-4 shrink-0 text-amber-500" />}
                    <div className="flex-1 text-xs text-slate-700">{item.label}</div>
                    <div className={`text-[11px] font-semibold ${item.ok === true ? "text-emerald-600" : item.ok === false ? "text-red-600" : "text-amber-600"}`}>
                      {item.status}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Risk by hazard type */}
            <Card>
              <CardHeader title="JHA Risk by Hazard Type" subtitle="Highest risk score per category" />
              <div className="p-4 space-y-2">
                {(["repetitive_motion", "awkward_posture", "forceful_exertion", "vibration", "contact_stress", "static_posture"] as const).map((ht) => {
                  const tasks = jobTasks.filter((t) => t.hazard_type === ht);
                  if (tasks.length === 0) return null;
                  const maxScore = Math.max(...tasks.map((t) => t.risk_score));
                  return (
                    <div key={ht} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{hazardLabel(ht)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${taskRiskColor(maxScore)}`}>{maxScore}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Recent MSD incidents */}
            <Card>
              <CardHeader
                title="Recent MSD Incidents"
                subtitle={`${ergoIncidents.length} ergonomics-related event${ergoIncidents.length !== 1 ? "s" : ""}`}
                right={<Link href="/incidents" className="text-xs font-medium text-blue-600 hover:underline">All →</Link>}
              />
              <div className="divide-y divide-slate-50">
                {ergoIncidents.slice(0, 5).map((inc) => (
                  <Link key={inc.id} href={`/incidents/${inc.id}`} className="block px-3 py-2.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-medium text-slate-800 leading-snug">{inc.title}</div>
                      <Pill className={incidentSeverityColor(inc.severity)} style={{ fontSize: "9.5px" }}>{inc.severity}</Pill>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10.5px] text-slate-400">
                      <span className="truncate max-w-[120px]">{inc.location}</span>
                      <span>·</span>
                      <span>{fmtDate(inc.occurred_at)}</span>
                    </div>
                  </Link>
                ))}
                {ergoIncidents.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-slate-400">No ergonomics incidents recorded</div>
                )}
              </div>
            </Card>

            {/* Open CAPAs */}
            {ergoCapas.length > 0 && (
              <Card>
                <CardHeader
                  title="Open Ergonomics CAPAs"
                  subtitle={`${ergoCapas.length} corrective action${ergoCapas.length > 1 ? "s" : ""}`}
                  right={<Link href="/capa" className="text-[11px] font-medium text-blue-600 hover:underline">View all →</Link>}
                />
                <div className="divide-y divide-slate-50">
                  {ergoCapas.slice(0, 4).map((capa) => (
                    <Link key={capa.id} href={`/capa/${capa.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-800 truncate">{capa.title}</div>
                        <div className="text-[10px] text-slate-400">Due: {fmtDate(capa.due_date)}</div>
                      </div>
                      <Pill className={statusColor(capa.status)} style={{ fontSize: "9.5px" }}>{capa.status}</Pill>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
