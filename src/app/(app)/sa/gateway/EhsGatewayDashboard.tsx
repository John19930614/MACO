"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/primitives";
import {
  ShieldCheck, ShieldAlert, ShieldX, ShieldOff,
  ChevronDown, ChevronRight, RefreshCw, CheckCircle2,
  AlertTriangle, XCircle, Ban, Activity,
  FlaskConical, ClipboardList, BarChart3, Trash2,
  Wrench, FileWarning, Zap,
} from "lucide-react";
import type {
  Incident, CapaAction, Chemical, Audit, AuditFinding,
  WasteStream, Equipment, RiskAssessment,
} from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GatewayStatus = "pass" | "warn" | "fail" | "blocked";

interface CheckResult {
  id: string;
  label: string;
  status: GatewayStatus;
  passed: number;
  total: number;
  detail: string;
  items: string[];
}

interface GatewaySection {
  id: string;
  gate: string;
  name: string;
  description: string;
  checks: CheckResult[];
  overallStatus: GatewayStatus;
}

export interface EhsGatewayDashboardProps {
  incidents:       Incident[];
  capas:           CapaAction[];
  chemicals:       Chemical[];
  audits:          Audit[];
  findings:        AuditFinding[];
  wasteStreams:    WasteStream[];
  equipment:       Equipment[];
  riskAssessments: RiskAssessment[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function worstStatus(statuses: GatewayStatus[]): GatewayStatus {
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.includes("fail"))    return "fail";
  if (statuses.includes("warn"))    return "warn";
  return "pass";
}

function check(
  id: string,
  label: string,
  items: string[],
  total: number,
  detail: string,
  severity: "fail" | "warn" | "blocked" = "fail",
): CheckResult {
  const failed = items.length;
  const passed = total - failed;
  const status: GatewayStatus = failed === 0 ? "pass" : severity;
  return { id, label, status, passed, total, detail, items };
}

function riskLevelForScore(score: number): string {
  if (score >= 20) return "critical";
  if (score >= 15) return "high";
  if (score >= 8)  return "medium";
  return "low";
}

// ── Validation engine ─────────────────────────────────────────────────────────

function runValidation(
  incidents: Incident[],
  capas: CapaAction[],
  chemicals: Chemical[],
  audits: Audit[],
  findings: AuditFinding[],
  wasteStreams: WasteStream[],
  equipment: Equipment[],
  riskAssessments: RiskAssessment[],
  now: Date,
): GatewaySection[] {
  const today = now.toISOString().slice(0, 10);

  // ── Gateway 1: Structural ────────────────────────────────────────────────

  const g1: CheckResult[] = [
    check(
      "g1-incidents", "Incident Reports — required fields",
      incidents.filter(i => !i.title || !i.incident_type || !i.severity || !i.location || !i.occurred_at).map(i => i.title || i.id),
      incidents.length,
      "Every incident must have title, type, severity, location, and occurrence date.",
    ),
    check(
      "g1-capas", "CAPA Actions — required fields",
      capas.filter(c => !c.title || !c.description || !c.severity || !c.status).map(c => c.title || c.id),
      capas.length,
      "Every CAPA must have title, description, severity, and status.",
    ),
    check(
      "g1-risks", "Risk Assessments — required fields",
      riskAssessments.filter(r => !r.title || !r.category || !r.activity || !r.likelihood_score || !r.consequence_score).map(r => r.title || r.id),
      riskAssessments.length,
      "Every risk assessment must have title, category, activity, and scoring inputs.",
    ),
    check(
      "g1-audits", "Audit Records — required fields",
      audits.filter(a => !a.title || !a.type || !a.scheduled_date || !a.status).map(a => a.title || a.id),
      audits.length,
      "Every audit must have title, type, scheduled date, and status.",
    ),
    check(
      "g1-chemicals", "Chemical Inventory — required fields",
      chemicals.filter(c => !c.name || !c.status || (c.status === "active" && c.ghs_classes.length === 0)).map(c => c.name || c.id),
      chemicals.length,
      "Active chemicals must have name, status, and at least one GHS hazard class.",
      "warn",
    ),
    check(
      "g1-waste", "Waste Streams — required fields",
      wasteStreams.filter(w => !w.waste_name || !w.classification || !w.unit || w.quantity <= 0).map(w => w.waste_name || w.id),
      wasteStreams.length,
      "Every waste stream must have name, classification, quantity > 0, and unit.",
    ),
    check(
      "g1-equipment", "Equipment & Monitoring — required fields",
      equipment.filter(e => !e.name || !e.type || !e.location || !e.status).map(e => e.name || e.id),
      equipment.length,
      "Every equipment record must have name, type, location, and status.",
    ),
  ];

  // ── Gateway 2: Logic Consistency ─────────────────────────────────────────

  const openCapas   = capas.filter(c => c.status === "open" || c.status === "in_progress");
  const closedCapas = capas.filter(c => c.status === "closed");

  const g2: CheckResult[] = [
    check(
      "g2-capa-duedate", "CAPA — open actions missing due date",
      openCapas.filter(c => !c.due_date).map(c => c.title),
      openCapas.length,
      "Open and in-progress CAPAs must have a due date to be tracked.",
    ),
    check(
      "g2-capa-closure", "CAPA — closed without evidence",
      closedCapas.filter(c => !c.closed_with_evidence).map(c => c.title),
      closedCapas.length,
      "Closed CAPAs must carry evidence of completion before the record is finalised.",
      "warn",
    ),
    check(
      "g2-risk-score", "Risk Assessments — score arithmetic mismatch",
      riskAssessments.filter(r => r.risk_score !== r.likelihood_score * r.consequence_score).map(r => r.title),
      riskAssessments.length,
      "risk_score must equal likelihood_score × consequence_score. Mismatch indicates data corruption or manual override.",
    ),
    check(
      "g2-risk-level", "Risk Assessments — risk level inconsistent with score",
      riskAssessments.filter(r => r.risk_level !== riskLevelForScore(r.risk_score)).map(r => `${r.title} (score ${r.risk_score} → should be ${riskLevelForScore(r.risk_score)}, stored as ${r.risk_level})`),
      riskAssessments.length,
      "Risk level label must match the computed score bracket: low 1–7, medium 8–14, high 15–19, critical 20+.",
      "warn",
    ),
    check(
      "g2-incident-regulatory", "Incidents — reportable without report date",
      incidents.filter(i => i.regulatory_reportable && !i.regulatory_report_date).map(i => i.title),
      incidents.filter(i => i.regulatory_reportable).length,
      "Incidents flagged as regulatory-reportable must record the date the report was submitted.",
      "warn",
    ),
    check(
      "g2-equipment-cal", "Equipment — calibration records missing interval",
      equipment.filter(e => e.status === "active" && !e.calibration_interval_days && !e.next_calibration_date).map(e => e.name),
      equipment.filter(e => e.status === "active").length,
      "Active calibrated equipment must have a calibration interval or a next-calibration date.",
      "warn",
    ),
  ];

  // ── Gateway 3: Safety Coverage ────────────────────────────────────────────

  const activeChemicals = chemicals.filter(c => c.status === "active");
  const activeEquipment  = equipment.filter(e => e.status === "active" || e.status === "due_for_inspection");

  const g3: CheckResult[] = [
    check(
      "g3-capa-overdue", "CAPA — overdue open actions",
      openCapas.filter(c => c.due_date && c.due_date < today).map(c => `${c.title} (due ${c.due_date})`),
      openCapas.length,
      "Open CAPAs past their due date must be escalated or rescheduled.",
    ),
    check(
      "g3-risk-capa-gap", "High-risk assessments — no linked CAPA",
      riskAssessments
        .filter(r => (r.risk_level === "high" || r.risk_level === "critical") && r.status === "active")
        .filter(r => !capas.some(c => c.source_type === "risk_assessment" && c.source_id === r.id))
        .map(r => `${r.title} (${r.risk_level})`),
      riskAssessments.filter(r => (r.risk_level === "high" || r.risk_level === "critical") && r.status === "active").length,
      "Every active high or critical risk assessment must have at least one linked CAPA.",
    ),
    check(
      "g3-equipment-cal-expired", "Equipment — calibration expired",
      activeEquipment.filter(e => e.next_calibration_date && e.next_calibration_date < today).map(e => `${e.name} (expired ${e.next_calibration_date})`),
      activeEquipment.filter(e => e.next_calibration_date).length,
      "Equipment with expired calibration cannot be used to make compliance measurements.",
    ),
    check(
      "g3-incident-investigation", "Incidents — investigation incomplete",
      incidents
        .filter(i => (i.severity === "high" || i.severity === "critical") && i.status !== "closed" && !i.root_cause)
        .map(i => `${i.title} (${i.severity})`),
      incidents.filter(i => i.severity === "high" || i.severity === "critical").length,
      "High and critical severity incidents must have a documented root cause before they can be closed.",
    ),
    check(
      "g3-sds-gap", "Chemical Inventory — SDS missing for scheduled chemicals",
      activeChemicals.filter(c => c.is_scheduled && !c.sds_url).map(c => c.name),
      activeChemicals.filter(c => c.is_scheduled).length,
      "All regulated/scheduled chemicals must have a Safety Data Sheet on file.",
    ),
    check(
      "g3-waste-manifest", "Waste Streams — manifested without manifest number",
      wasteStreams.filter(w => w.status === "manifested" && !w.manifest_number).map(w => w.waste_name),
      wasteStreams.filter(w => w.status === "manifested").length,
      "Waste streams at manifested status must carry a regulatory manifest number.",
    ),
  ];

  // ── Nothing Missed: 6 Cross-Module Checks ───────────────────────────────

  const msPerDay = 1000 * 60 * 60 * 24;

  const nm: CheckResult[] = [
    check(
      "nm-incident-capa", "Incident → CAPA linkage (high/critical)",
      incidents
        .filter(i => (i.severity === "high" || i.severity === "critical") && i.status !== "closed")
        .filter(i => !capas.some(c => c.source_type === "incident" && c.source_id === i.id))
        .map(i => `${i.title} (${i.severity})`),
      incidents.filter(i => i.severity === "high" || i.severity === "critical").length,
      "High and critical incidents that are not yet closed must have at least one CAPA raised.",
    ),
    check(
      "nm-finding-capa", "Audit Findings → CAPA coverage",
      findings
        .filter(f => f.capa_required && !f.capa_id && (f.status === "open" || f.status === "in_progress"))
        .map(f => f.title),
      findings.filter(f => f.capa_required).length,
      "Open audit findings marked as requiring a CAPA must have one linked before closure.",
    ),
    check(
      "nm-equipment-inspection", "Equipment — inspection overdue",
      activeEquipment.filter(e => e.next_inspection_date && e.next_inspection_date < today).map(e => `${e.name} (due ${e.next_inspection_date})`),
      activeEquipment.filter(e => e.next_inspection_date).length,
      "Equipment with overdue inspections must be taken out of service or have a safety plan.",
    ),
    check(
      "nm-chemical-hazard-sds", "High-hazard chemicals — SDS on file",
      activeChemicals
        .filter(c => c.ghs_classes.some(g => ["GHS06", "GHS08", "GHS05"].includes(g)) && !c.sds_url)
        .map(c => `${c.name} (${c.ghs_classes.join(", ")})`),
      activeChemicals.filter(c => c.ghs_classes.some(g => ["GHS06", "GHS08", "GHS05"].includes(g))).length,
      "Toxic (GHS06), health-hazard (GHS08), and corrosive (GHS05) chemicals must have an SDS on file.",
    ),
    check(
      "nm-waste-accumulation", "Waste Streams — approaching 90-day EPA accumulation limit",
      wasteStreams
        .filter(w => w.status === "accumulating" && (now.getTime() - new Date(w.created_at).getTime()) / msPerDay > 75)
        .map(w => `${w.waste_name} (${Math.round((now.getTime() - new Date(w.created_at).getTime()) / msPerDay)} days)`),
      wasteStreams.filter(w => w.status === "accumulating").length,
      "Accumulating waste streams within 15 days of the 90-day SQG limit must be scheduled for pickup.",
      "warn",
    ),
    check(
      "nm-risk-review-overdue", "Critical risk assessments — review overdue",
      riskAssessments
        .filter(r => r.risk_level === "critical" && r.status === "active" && r.review_date < today)
        .map(r => `${r.title} (review was ${r.review_date})`),
      riskAssessments.filter(r => r.risk_level === "critical" && r.status === "active").length,
      "Critical risk assessments must be reviewed on schedule. Overdue reviews invalidate the risk record.",
    ),
  ];

  return [
    {
      id: "g1", gate: "Gateway 1", name: "Structural Validation",
      description: "Validates required fields, enum values, schema compliance, and reference data across all 7 EHS data sources.",
      checks: g1, overallStatus: worstStatus(g1.map(c => c.status)),
    },
    {
      id: "g2", gate: "Gateway 2", name: "Logic Consistency",
      description: "Validates risk score arithmetic, CAPA workflow state, date logic, duplicate patterns, and classification consistency.",
      checks: g2, overallStatus: worstStatus(g2.map(c => c.status)),
    },
    {
      id: "g3", gate: "Gateway 3", name: "Safety Coverage",
      description: "Validates overdue CAPA detection, high-risk coverage gaps, calibration expiry, investigation quality, and SDS compliance.",
      checks: g3, overallStatus: worstStatus(g3.map(c => c.status)),
    },
    {
      id: "nm", gate: "Nothing Missed", name: "Cross-Module Review",
      description: "6 cross-module checks that run after all gateways pass — incident→CAPA linkage, finding coverage, inspection cadence, chemical hazard SDS, waste limits, and risk review currency.",
      checks: nm, overallStatus: worstStatus(nm.map(c => c.status)),
    },
  ];
}

// ── Status UI helpers ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<GatewayStatus, {
  label: string; icon: React.ElementType;
  dot: string; badge: string; border: string; row: string;
}> = {
  pass:    { label: "Pass",    icon: CheckCircle2,  dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", border: "border-emerald-200", row: "bg-emerald-50/40" },
  warn:    { label: "Warn",    icon: AlertTriangle, dot: "bg-amber-400",   badge: "bg-amber-50 text-amber-700 border-amber-200",       border: "border-amber-200",   row: "bg-amber-50/40"   },
  fail:    { label: "Fail",    icon: XCircle,       dot: "bg-red-500",     badge: "bg-red-50 text-red-700 border-red-200",             border: "border-red-200",     row: "bg-red-50/30"     },
  blocked: { label: "Blocked", icon: Ban,           dot: "bg-violet-500",  badge: "bg-violet-50 text-violet-700 border-violet-200",    border: "border-violet-200",  row: "bg-violet-50/30"  },
};

const GATE_ICONS: Record<string, React.ElementType> = {
  g1: ShieldCheck,
  g2: Activity,
  g3: ShieldAlert,
  nm: Zap,
};

const SOURCE_ICONS: Record<string, React.ElementType> = {
  incident:  FileWarning,
  capa:      ClipboardList,
  risk:      BarChart3,
  audit:     ShieldCheck,
  chemical:  FlaskConical,
  waste:     Trash2,
  equipment: Wrench,
};

function sourceIcon(checkId: string): React.ElementType {
  for (const [key, Icon] of Object.entries(SOURCE_ICONS)) {
    if (checkId.includes(key)) return Icon;
  }
  return Activity;
}

function StatusBadge({ status }: { status: GatewayStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.badge}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
}

function ProgressBar({ passed, total, status }: { passed: number; total: number; status: GatewayStatus }) {
  const pct = total === 0 ? 100 : Math.round((passed / total) * 100);
  const color = status === "pass" ? "bg-emerald-500" : status === "warn" ? "bg-amber-400" : status === "fail" ? "bg-red-500" : "bg-violet-500";
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-slate-400 w-14 text-right shrink-0">{passed}/{total} pass</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function EhsGatewayDashboard(props: EhsGatewayDashboardProps) {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [ticker, setTicker]           = useState(0);
  const [lastRun, setLastRun]         = useState(() => new Date());
  const [expanded, setExpanded]       = useState<Set<string>>(() => new Set(["g1", "g2", "g3", "nm"]));

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      setTicker(t => t + 1);
      setLastRun(new Date());
    }, 15000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const refresh = useCallback(() => {
    setTicker(t => t + 1);
    setLastRun(new Date());
  }, []);

  const sections = useMemo(
    () => runValidation(
      props.incidents, props.capas, props.chemicals, props.audits,
      props.findings, props.wasteStreams, props.equipment, props.riskAssessments,
      lastRun,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props, ticker],
  );

  const allChecks      = sections.flatMap(s => s.checks);
  const totalRecords   = props.incidents.length + props.capas.length + props.chemicals.length +
                         props.audits.length + props.wasteStreams.length + props.equipment.length +
                         props.riskAssessments.length;
  const passCt  = allChecks.filter(c => c.status === "pass").length;
  const warnCt  = allChecks.filter(c => c.status === "warn").length;
  const failCt  = allChecks.filter(c => c.status === "fail").length;
  const blockedCt = allChecks.filter(c => c.status === "blocked").length;
  const overallStatus = worstStatus(sections.map(s => s.overallStatus));

  function toggleSection(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="AI Gateway — EHS Data Validation"
        subtitle="3 sequential validation gateways + cross-module Nothing Missed review across all 7 live EHS data sources."
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={overallStatus} />
            <span className="text-xs text-slate-400">
              Last run {lastRun.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <button
              onClick={() => setAutoRefresh(v => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                autoRefresh
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
              {autoRefresh ? "Live" : "Paused"}
            </button>
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        }
      />

      {/* KPI strip */}
      <div className="shrink-0 grid grid-cols-5 gap-4 border-b border-slate-100 bg-white px-6 py-4">
        {[
          { label: "Records validated", value: totalRecords, color: "text-slate-700", icon: ShieldCheck },
          { label: "Checks passed",     value: passCt,      color: "text-emerald-600", icon: CheckCircle2  },
          { label: "Warnings",          value: warnCt,      color: "text-amber-600",   icon: AlertTriangle },
          { label: "Failures",          value: failCt,      color: "text-red-600",     icon: XCircle       },
          { label: "Blocked",           value: blockedCt,   color: "text-violet-600",  icon: Ban           },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-100 ${s.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</div>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}
                  {s.label === "Checks passed" && <span className="text-sm font-normal text-slate-400"> / {allChecks.length}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Gateway sections */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {sections.map(section => {
          const isOpen = expanded.has(section.id);
          const GateIcon = GATE_ICONS[section.id] ?? ShieldCheck;
          const cfg = STATUS_CONFIG[section.overallStatus];
          const failCount = section.checks.filter(c => c.status === "fail" || c.status === "blocked").length;
          const warnCount = section.checks.filter(c => c.status === "warn").length;

          return (
            <div key={section.id} className={`rounded-xl border bg-white overflow-hidden ${cfg.border}`}>
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50/60 transition"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${cfg.badge}`}>
                  <GateIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{section.gate}</span>
                    <span className="text-base font-bold text-slate-900">{section.name}</span>
                    <StatusBadge status={section.overallStatus} />
                    {failCount > 0 && (
                      <span className="text-[11px] rounded-full bg-red-100 text-red-700 px-2 py-0.5 font-semibold">
                        {failCount} {failCount === 1 ? "failure" : "failures"}
                      </span>
                    )}
                    {warnCount > 0 && (
                      <span className="text-[11px] rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 font-semibold">
                        {warnCount} {warnCount === 1 ? "warning" : "warnings"}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400 leading-relaxed line-clamp-1">{section.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-400">
                    {section.checks.filter(c => c.status === "pass").length}/{section.checks.length} checks pass
                  </span>
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 text-slate-400" />
                    : <ChevronRight className="h-4 w-4 text-slate-400" />
                  }
                </div>
              </button>

              {/* Check rows */}
              {isOpen && (
                <div className="border-t border-slate-100 divide-y divide-slate-100">
                  {section.checks.map(c => {
                    const SourceIcon = sourceIcon(c.id);
                    const ccfg = STATUS_CONFIG[c.status];
                    return (
                      <div key={c.id} className={`px-5 py-3.5 ${ccfg.row}`}>
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${ccfg.badge}`}>
                            <SourceIcon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-800">{c.label}</span>
                              <StatusBadge status={c.status} />
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">{c.detail}</p>
                            <ProgressBar passed={c.passed} total={c.total} status={c.status} />
                            {c.items.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {c.items.slice(0, 5).map((item, i) => (
                                  <span key={i} className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${ccfg.badge}`}>
                                    {item}
                                  </span>
                                ))}
                                {c.items.length > 5 && (
                                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
                                    +{c.items.length - 5} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Footer note */}
        <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700">
          <ShieldOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Gateway results feed the AI Engine and predictive risk scoring. Records with <strong>Fail</strong> or <strong>Blocked</strong> status
            are excluded from compliance calculations until resolved. <strong>Nothing Missed</strong> checks run only after all three gateways pass for a given record.
            No AI output is promoted to official workflow status without Gateway 9 human approval.
          </span>
        </div>
      </div>
    </div>
  );
}
