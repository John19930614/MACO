"use client";

import { useState } from "react";
import type {
  ComplianceScore, PredictabilityRun, Profile,
  CapaAction, Incident, AiFinding, TrainingRecord, Chemical,
} from "@/lib/types";
import {
  Brain, Globe, Activity, AlertTriangle, Shield, Zap,
  CheckCircle2, Users, TrendingUp, TrendingDown, Minus,
  ClipboardList, FileWarning, Cpu, ChevronRight,
  BarChart3, Target, FlaskConical, GraduationCap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlatformAnalysisDashboardProps {
  moduleScores:     ComplianceScore[];
  overall:          number;
  runs:             PredictabilityRun[];
  profiles:         Profile[];
  capas:            CapaAction[];
  incidents:        Incident[];
  aiFindings:       AiFinding[];
  trainingRecords:  TrainingRecord[];
  chemicals:        Chemical[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

function healthGrade(pct: number) {
  if (pct >= 90) return { grade: "A", color: "text-emerald-400", ring: "border-emerald-400", bg: "bg-emerald-400/10", label: "Excellent" };
  if (pct >= 80) return { grade: "B", color: "text-blue-400",    ring: "border-blue-400",    bg: "bg-blue-400/10",    label: "Good"      };
  if (pct >= 70) return { grade: "C", color: "text-amber-400",   ring: "border-amber-400",   bg: "bg-amber-400/10",   label: "Needs Attention" };
  if (pct >= 60) return { grade: "D", color: "text-orange-400",  ring: "border-orange-400",  bg: "bg-orange-400/10",  label: "At Risk"   };
  return             { grade: "F", color: "text-red-400",     ring: "border-red-400",     bg: "bg-red-400/10",     label: "Critical"  };
}

function barColor(s: number) {
  if (s >= 85) return "bg-emerald-500";
  if (s >= 70) return "bg-amber-400";
  return "bg-red-400";
}

function textColor(s: number) {
  if (s >= 85) return "text-emerald-400";
  if (s >= 70) return "text-amber-400";
  return "text-red-400";
}

function severityColor(s: string) {
  if (s === "critical") return "text-red-400 bg-red-400/10 border-red-400/30";
  if (s === "high")     return "text-orange-400 bg-orange-400/10 border-orange-400/30";
  if (s === "medium")   return "text-amber-400 bg-amber-400/10 border-amber-400/30";
  return "text-slate-400 bg-slate-400/10 border-slate-400/30";
}

function buildGusInsight(props: PlatformAnalysisDashboardProps): string {
  const { overall, capas, incidents, moduleScores, runs, aiFindings, trainingRecords } = props;
  const avgCompliance = Math.round(overall);
  const overdueCapas = capas.filter((c) => c.status === "overdue").length;
  const criticalInc  = incidents.filter((i) => i.severity === "critical" && i.status !== "closed").length;
  const pendingAI    = aiFindings.filter((f) => f.review_status === "pending").length;
  const expiringCerts = trainingRecords.filter((r) => {
    if (!r.expiry_date) return false;
    const days = (new Date(r.expiry_date).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 30;
  }).length;
  const lowestModule = [...moduleScores].sort((a, b) => a.percentage - b.percentage)[0];
  const latestRun = runs.length
    ? [...runs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    : null;
  const { label } = healthGrade(avgCompliance);

  let text = `Tenant compliance is ${label.toLowerCase()} at ${avgCompliance}%. `;

  if (overdueCapas > 0)
    text += `${overdueCapas} CAPA${overdueCapas > 1 ? "s are" : " is"} overdue and require immediate escalation. `;

  if (criticalInc > 0)
    text += `${criticalInc} critical incident${criticalInc > 1 ? "s remain" : " remains"} under investigation — verify regulatory reporting obligations. `;

  if (lowestModule)
    text += `Weakest module platform-wide: ${fmt(lowestModule.module)} at ${Math.round(lowestModule.percentage)}%. `;

  if (pendingAI > 0)
    text += `${pendingAI} AI finding${pendingAI > 1 ? "s" : ""} pending human review — accuracy unverified until reviewed. `;

  if (expiringCerts > 0)
    text += `${expiringCerts} training certification${expiringCerts > 1 ? "s" : ""} expiring within 30 days. `;

  if (latestRun)
    text += `P-Engine at Stage ${latestRun.stage.toUpperCase()} — ${latestRun.signals_found} active signals across ${latestRun.items_scanned} scanned items. `;

  return text.trim();
}

// ── Dark card wrapper ─────────────────────────────────────────────────────────

function DCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-700/50 bg-slate-900/60 ${className ?? ""}`}>
      {children}
    </div>
  );
}

function DCardHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-slate-700/40 px-4 py-3">
      <div>
        <div className="font-mono text-[11px] font-bold tracking-widest text-slate-400 uppercase">{title}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function ModuleBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="font-mono text-[11px] text-slate-400 w-32 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${barColor(score)}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`font-mono text-xs font-bold w-10 text-right ${textColor(score)}`}>{score}%</span>
    </div>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab(props: PlatformAnalysisDashboardProps) {
  const { overall, capas, incidents, aiFindings, profiles } = props;
  const avgCompliance = Math.round(overall);
  const g = healthGrade(avgCompliance);
  const openCapas = capas.filter((c) => ["open","in_progress","overdue"].includes(c.status)).length;
  const openIncidents = incidents.filter((i) => i.status !== "closed").length;
  const pendingAI = aiFindings.filter((f) => f.review_status === "pending").length;
  const gusInsight = buildGusInsight(props);

  const topCapas = [...capas]
    .filter((c) => c.status === "overdue" || (c.status === "open" && c.severity === "critical"))
    .slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Health grade + GUS insight */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Grade circle */}
        <DCard className="flex flex-col items-center justify-center p-6 text-center">
          <div className="font-mono text-[11px] tracking-widest text-slate-400 uppercase mb-3">Platform Health</div>
          <div className={`flex h-24 w-24 items-center justify-center rounded-full border-4 ${g.ring} ${g.bg} mb-3`}>
            <span className={`font-mono text-5xl font-black ${g.color}`}>{g.grade}</span>
          </div>
          <div className={`font-mono text-sm font-bold ${g.color}`}>{g.label}</div>
          <div className="font-mono text-2xl font-black text-white mt-1">{avgCompliance}%</div>
          <div className="font-mono text-[11px] text-slate-400 mt-1">Tenant compliance</div>
        </DCard>

        {/* AI insight */}
        <DCard className="col-span-1 lg:col-span-2 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-6 w-6 items-center justify-center rounded border border-cyan-500/40 bg-cyan-500/10">
              <Brain className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <span className="font-mono text-[11px] font-bold tracking-widest text-cyan-400 uppercase">AI Analysis</span>
            <span className="ml-auto font-mono text-[11px] text-slate-400">v2.6 · auto-generated</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{gusInsight}</p>
        </DCard>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Compliance",      value: `${avgCompliance}%`, sub: g.label,           icon: Globe,         color: "text-cyan-300"  },
          { label: "Open CAPAs",      value: openCapas,           sub: "This tenant",      icon: Shield,        color: "text-amber-400" },
          { label: "Open Incidents",  value: openIncidents,       sub: "This tenant",      icon: AlertTriangle, color: "text-red-400"   },
          { label: "AI Findings",     value: pendingAI,           sub: "Pending review",   icon: Cpu,           color: "text-violet-400"},
        ].map((s) => (
          <DCard key={s.label} className="p-3">
            <s.icon className={`h-3.5 w-3.5 ${s.color} mb-2`} />
            <div className={`font-mono text-3xl font-black ${s.color}`}>{s.value}</div>
            <div className="font-mono text-[11px] tracking-wider text-slate-400 mt-1 uppercase">{s.label}</div>
            <div className="font-mono text-[11px] text-slate-400">{s.sub}</div>
          </DCard>
        ))}
      </div>

      {/* Selected tenant health (live data) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DCard className="p-3">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-xs font-semibold text-slate-200 leading-tight">Selected Tenant</div>
              <div className="font-mono text-[11px] text-slate-400 mt-0.5">{profiles.length} user{profiles.length === 1 ? "" : "s"}</div>
            </div>
            <span className="font-mono text-[11px] font-bold tracking-wide px-1.5 py-0.5 rounded-full border border-emerald-500/40 text-emerald-400 bg-emerald-400/10">
              LIVE
            </span>
          </div>
          <div className={`font-mono text-2xl font-black mb-1 ${textColor(avgCompliance)}`}>{avgCompliance}%</div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-2">
            <div className={`h-full rounded-full ${barColor(avgCompliance)}`} style={{ width: `${avgCompliance}%` }} />
          </div>
          <div className="font-mono text-[11px] text-slate-400">Live compliance score</div>
        </DCard>
      </div>

      {/* Priority actions */}
      {topCapas.length > 0 && (
        <DCard>
          <DCardHead title="Priority Actions — Requires SA Attention" sub="Overdue or critical CAPAs across platform" />
          <div className="divide-y divide-slate-700/30">
            {topCapas.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded border ${severityColor(c.severity)}`}>
                  {c.severity.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">{c.title}</div>
                  <div className="font-mono text-[11px] text-slate-400">
                    {c.due_date ? `Due ${new Date(c.due_date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}` : "No due date"} · {fmt(c.status)}
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              </div>
            ))}
          </div>
        </DCard>
      )}
    </div>
  );
}

// ── Tab: Clients ──────────────────────────────────────────────────────────────

function ClientsTab(props: PlatformAnalysisDashboardProps) {
  const { moduleScores, overall, capas, incidents, profiles } = props;
  const biostarModules = [...moduleScores]
    .sort((a, b) => a.percentage - b.percentage)
    .map((s) => ({ module: fmt(s.module), score: Math.round(s.percentage) }));

  const bsOpenCapas = capas.filter((c) => ["open","in_progress","overdue"].includes(c.status)).length;
  const bsOverdueCapas = capas.filter((c) => c.status === "overdue").length;
  const bsOpenInc = incidents.filter((i) => i.status !== "closed").length;
  const bsUsers = profiles.length;

  return (
    <div className="space-y-4">
      {/* Selected tenant — live data */}
      <DCard>
        <DCardHead
          title="Selected Tenant"
          sub="Live compliance for the tenant in this session"
          right={
            <span className="font-mono text-[11px] font-bold tracking-wide px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-400 bg-emerald-400/10">
              ● LIVE
            </span>
          }
        />
        <div className="p-4 grid grid-cols-2 gap-4 sm:grid-cols-4 border-b border-slate-700/30">
          {[
            { label: "Compliance",  value: `${overall}%`, color: textColor(overall) },
            { label: "Open CAPAs",  value: bsOpenCapas,   color: bsOpenCapas > 5 ? "text-red-400" : "text-amber-400" },
            { label: "Overdue",     value: bsOverdueCapas,color: bsOverdueCapas > 0 ? "text-red-400" : "text-emerald-400" },
            { label: "Users",       value: bsUsers,        color: "text-slate-300" },
          ].map((s) => (
            <div key={s.label}>
              <div className={`font-mono text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="font-mono text-[11px] text-slate-400 uppercase tracking-wide mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="p-4">
          <div className="font-mono text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-2">Module Scores — sorted lowest first</div>
          {biostarModules.length === 0 ? (
            <div className="font-mono text-xs text-slate-400">No module scores yet for this tenant.</div>
          ) : (
            biostarModules.map((m) => (
              <ModuleBar key={m.module} label={m.module} score={m.score} />
            ))
          )}
        </div>
      </DCard>
    </div>
  );
}

// ── Tab: Risk & Compliance ────────────────────────────────────────────────────

function RiskTab(props: PlatformAnalysisDashboardProps) {
  const { capas, incidents, aiFindings, trainingRecords, chemicals } = props;

  const HIGH_HAZARD_H = ["H350","H351","H300","H310","H311","H330","H331"];
  const highRiskChems = chemicals.filter(
    (c) => c.is_scheduled || c.hazard_statements.some((h) => HIGH_HAZARD_H.some((hh) => h.startsWith(hh))),
  );

  const openCapas = [...capas]
    .filter((c) => ["open","in_progress","overdue"].includes(c.status))
    .sort((a, b) => {
      const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9);
    });

  const openIncidents = incidents.filter((i) => i.status !== "closed");

  const today = new Date();
  const expiringCerts = trainingRecords.filter((r) => {
    if (!r.expiry_date) return false;
    const days = (new Date(r.expiry_date).getTime() - today.getTime()) / 86400000;
    return days >= 0 && days <= 30;
  });

  const pendingAI = aiFindings.filter((f) => f.review_status === "pending");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Open CAPAs */}
        <DCard>
          <DCardHead title={`Open CAPAs — ${openCapas.length}`} sub="Selected tenant · all statuses" />
          {openCapas.length === 0 ? (
            <div className="p-4 font-mono text-xs text-slate-400">No open CAPAs.</div>
          ) : (
            <div className="divide-y divide-slate-700/30 max-h-64 overflow-y-auto">
              {openCapas.map((c) => (
                <div key={c.id} className="flex items-center gap-2 px-4 py-2.5">
                  <span className={`font-mono text-[11px] font-bold px-1 py-0.5 rounded border shrink-0 ${severityColor(c.severity)}`}>
                    {c.severity.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-slate-200 truncate">{c.title}</div>
                    <div className="font-mono text-[11px] text-slate-400">
                      {fmt(c.status)} · {c.due_date ? new Date(c.due_date).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : "No date"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DCard>

        {/* Open Incidents */}
        <DCard>
          <DCardHead title={`Open Incidents — ${openIncidents.length}`} sub="Selected tenant" />
          {openIncidents.length === 0 ? (
            <div className="p-4 font-mono text-xs text-emerald-400">✓ No open incidents.</div>
          ) : (
            <div className="divide-y divide-slate-700/30 max-h-64 overflow-y-auto">
              {openIncidents.map((i) => (
                <div key={i.id} className="flex items-center gap-2 px-4 py-2.5">
                  <span className={`font-mono text-[11px] font-bold px-1 py-0.5 rounded border shrink-0 ${severityColor(i.severity)}`}>
                    {i.severity.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-slate-200 truncate">{i.title}</div>
                    <div className="font-mono text-[11px] text-slate-400">
                      {fmt(i.status)} · {new Date(i.occurred_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                    </div>
                  </div>
                  {i.regulatory_reportable && (
                    <span className="font-mono text-[11px] text-red-400 border border-red-400/30 px-1 rounded shrink-0">OSHA</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </DCard>

        {/* High-risk chemicals */}
        <DCard>
          <DCardHead title={`High-Risk Chemicals — ${highRiskChems.length}`} sub="Carcinogens, acutely toxic, scheduled substances" />
          {highRiskChems.length === 0 ? (
            <div className="p-4 font-mono text-xs text-slate-400">No high-risk chemicals found.</div>
          ) : (
            <div className="divide-y divide-slate-700/30 max-h-64 overflow-y-auto">
              {highRiskChems.map((c) => (
                <div key={c.id} className="flex items-center gap-2 px-4 py-2.5">
                  <FlaskConical className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-slate-200 truncate">{c.name}</div>
                    <div className="font-mono text-[11px] text-slate-400">
                      {c.hazard_statements.filter((h) => HIGH_HAZARD_H.some((hh) => h.startsWith(hh))).join(", ") || "Scheduled"}
                      {c.is_scheduled && <span className="ml-1 text-red-400">· Scheduled</span>}
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400 shrink-0">{c.quantity} {c.unit}</span>
                </div>
              ))}
            </div>
          )}
        </DCard>

        {/* AI Findings + Expiring Certs */}
        <div className="space-y-3">
          <DCard>
            <DCardHead title={`AI Findings Pending Review — ${pendingAI.length}`} sub="Human verification required" />
            {pendingAI.length === 0 ? (
              <div className="p-3 font-mono text-xs text-emerald-400">✓ All findings reviewed.</div>
            ) : (
              <div className="divide-y divide-slate-700/30 max-h-32 overflow-y-auto">
                {pendingAI.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 px-4 py-2">
                    <Cpu className="h-3 w-3 text-violet-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-slate-300 truncate">{f.input_summary}</div>
                      <div className="font-mono text-[11px] text-slate-400">{Math.round(f.confidence * 100)}% confidence · {f.job}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DCard>
          <DCard>
            <DCardHead title={`Expiring Certifications — ${expiringCerts.length}`} sub="Within 30 days" />
            {expiringCerts.length === 0 ? (
              <div className="p-3 font-mono text-xs text-emerald-400">✓ No certs expiring soon.</div>
            ) : (
              <div className="divide-y divide-slate-700/30 max-h-32 overflow-y-auto">
                {expiringCerts.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 px-4 py-2">
                    <GraduationCap className="h-3 w-3 text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[11px] text-slate-300">Course {r.course_id}</div>
                      <div className="font-mono text-[11px] text-slate-400">
                        Expires {new Date(r.expiry_date!).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DCard>
        </div>
      </div>
    </div>
  );
}

// ── Tab: P-Engine ─────────────────────────────────────────────────────────────

function PEngineTab({ runs }: { runs: PredictabilityRun[] }) {
  const sorted = [...runs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latest = sorted[0];

  const STAGES = ["scan", "detect", "forecast", "alert", "learn"] as const;
  const currentStageIdx = latest ? STAGES.indexOf(latest.stage as typeof STAGES[number]) : -1;

  const totalScanned = runs.reduce((sum, r) => sum + r.items_scanned, 0);
  const totalSignals = runs.reduce((sum, r) => sum + r.signals_found, 0);
  const avgSignals = runs.length ? Math.round(totalSignals / runs.length) : 0;

  return (
    <div className="space-y-4">
      {/* Engine status header */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DCard className="p-4 col-span-1">
          <div className="font-mono text-[11px] tracking-widest text-slate-400 uppercase mb-3">Engine Status</div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-cyan-400" />
            <span className="font-mono text-lg font-bold text-cyan-300">OPERATIONAL</span>
          </div>
          <div className="font-mono text-[11px] text-slate-400 mb-3">
            {latest ? `Last run: ${new Date(latest.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}` : "No runs yet"}
          </div>
          <div className="space-y-1">
            {[
              { label: "Total Runs",      value: runs.length },
              { label: "Items Scanned",   value: totalScanned },
              { label: "Total Signals",   value: totalSignals },
              { label: "Avg Signals/Run", value: avgSignals },
            ].map((s) => (
              <div key={s.label} className="flex justify-between text-[11px]">
                <span className="text-slate-400">{s.label}</span>
                <span className="font-mono font-bold text-slate-200">{s.value}</span>
              </div>
            ))}
          </div>
        </DCard>

        <DCard className="col-span-1 sm:col-span-2 p-4">
          <div className="font-mono text-[11px] tracking-widest text-slate-400 uppercase mb-4">Pipeline Stages</div>
          <div className="flex items-center gap-0">
            {STAGES.map((stage, i) => {
              const isActive = i === currentStageIdx;
              const isPast = i < currentStageIdx;
              return (
                <div key={stage} className="flex-1 flex flex-col items-center relative">
                  {/* Connector line */}
                  {i > 0 && (
                    <div className={`absolute left-0 top-3.5 h-0.5 w-1/2 ${isPast || isActive ? "bg-cyan-500" : "bg-slate-700"}`} />
                  )}
                  {i < STAGES.length - 1 && (
                    <div className={`absolute right-0 top-3.5 h-0.5 w-1/2 ${isPast ? "bg-cyan-500" : "bg-slate-700"}`} />
                  )}
                  {/* Node */}
                  <div className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold font-mono mb-1.5 ${
                    isActive ? "border-cyan-400 bg-cyan-400/20 text-cyan-300"
                    : isPast  ? "border-cyan-600 bg-cyan-600/20 text-cyan-500"
                    :           "border-slate-600 bg-slate-800 text-slate-400"
                  }`}>
                    {isPast ? "✓" : i + 1}
                  </div>
                  <span className={`font-mono text-[11px] uppercase tracking-wide text-center ${
                    isActive ? "text-cyan-400 font-bold" : isPast ? "text-slate-400" : "text-slate-400"
                  }`}>
                    {stage}
                  </span>
                  {isActive && (
                    <span className="font-mono text-[11px] text-cyan-400/70 mt-0.5">← current</span>
                  )}
                </div>
              );
            })}
          </div>
          {latest?.forecast_data && (
            <div className="mt-4 rounded border border-cyan-500/20 bg-cyan-500/5 p-3">
              <div className="font-mono text-[11px] text-cyan-400/70 mb-1 uppercase tracking-wider">Latest Forecast</div>
              <div className="flex items-center gap-4 text-[11px]">
                {latest.forecast_data.compliance_trend && (
                  <div className="flex items-center gap-1">
                    {latest.forecast_data.compliance_trend === "improving" ? (
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    ) : latest.forecast_data.compliance_trend === "declining" ? (
                      <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                    ) : (
                      <Minus className="h-3.5 w-3.5 text-slate-400" />
                    )}
                    <span className="text-slate-300 capitalize">{latest.forecast_data.compliance_trend}</span>
                  </div>
                )}
                {latest.forecast_data.predicted_compliance_score_30d != null && (
                  <div className="text-slate-400">
                    Predicted: <span className="font-bold text-white">{latest.forecast_data.predicted_compliance_score_30d}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DCard>
      </div>

      {/* Run history */}
      <DCard>
        <DCardHead title={`Run History — ${runs.length} total`} sub="Most recent first" />
        {runs.length === 0 ? (
          <div className="p-4 font-mono text-xs text-slate-400">No P-Engine runs yet.</div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {sorted.map((r) => (
              <div key={r.id} className="grid grid-cols-4 gap-3 px-4 py-2.5 text-[11px]">
                <div>
                  <div className="font-mono font-semibold text-slate-200 capitalize">{r.stage}</div>
                  <div className="font-mono text-[11px] text-slate-400">
                    {new Date(r.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-mono font-bold text-cyan-300">{r.items_scanned}</div>
                  <div className="font-mono text-[11px] text-slate-400">scanned</div>
                </div>
                <div className="text-center">
                  <div className={`font-mono font-bold ${r.signals_found > 5 ? "text-amber-400" : "text-emerald-400"}`}>{r.signals_found}</div>
                  <div className="font-mono text-[11px] text-slate-400">signals</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-slate-300">{r.forecast_data?.predicted_compliance_score_30d ?? "—"}{r.forecast_data?.predicted_compliance_score_30d != null ? "%" : ""}</div>
                  <div className="font-mono text-[11px] text-slate-400">forecast</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DCard>
    </div>
  );
}

// ── Tab: Users ────────────────────────────────────────────────────────────────

function UsersTab({ profiles }: { profiles: Profile[] }) {
  const roleCount: Record<string, number> = {};
  profiles.forEach((p) => { roleCount[p.role] = (roleCount[p.role] ?? 0) + 1; });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Role breakdown */}
        <DCard className="p-4">
          <div className="font-mono text-[11px] tracking-widest text-slate-400 uppercase mb-3">Role Distribution</div>
          <div className="space-y-2">
            {Object.entries(roleCount).map(([role, count]) => (
              <div key={role} className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-slate-400 w-28 shrink-0 capitalize">{role.replace(/_/g," ")}</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-cyan-500" style={{ width: `${(count / profiles.length) * 100}%` }} />
                </div>
                <span className="font-mono text-xs font-bold text-slate-300">{count}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-slate-700/30 pt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="font-mono text-xl font-black text-cyan-300">{profiles.length}</div>
              <div className="font-mono text-[11px] text-slate-400 uppercase">Total Users</div>
            </div>
            <div>
              <div className="font-mono text-xl font-black text-emerald-400">
                {profiles.filter((p) => p.active).length}
              </div>
              <div className="font-mono text-[11px] text-slate-400 uppercase">Active</div>
            </div>
          </div>
        </DCard>

        {/* User list */}
        <DCard className="col-span-1 lg:col-span-2">
          <DCardHead title={`Platform Users — ${profiles.length}`} sub="Selected tenant · live data" />
          <div className="divide-y divide-slate-700/30 max-h-80 overflow-y-auto">
            {profiles.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 border border-slate-700 font-mono text-[11px] font-bold text-slate-300">
                  {p.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200">{p.display_name}</div>
                  <div className="font-mono text-[11px] text-slate-400">{p.job_title ?? "—"}</div>
                </div>
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 capitalize shrink-0">
                  {p.role.replace(/_/g," ")}
                </span>
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${p.active ? "bg-emerald-400" : "bg-slate-600"}`} />
              </div>
            ))}
          </div>
        </DCard>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",  label: "Overview",         icon: BarChart3       },
  { id: "clients",   label: "Clients",           icon: Globe           },
  { id: "risk",      label: "Risk & Compliance", icon: AlertTriangle   },
  { id: "pengine",   label: "P-Engine",          icon: Brain           },
  { id: "users",     label: "Users",             icon: Users           },
] as const;

type TabId = typeof TABS[number]["id"];

export function PlatformAnalysisDashboard(props: PlatformAnalysisDashboardProps) {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div className="flex flex-1 flex-col bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded border border-cyan-500/40 bg-cyan-500/10">
            <Brain className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <h1 className="font-mono text-sm font-bold tracking-wide text-white">
              SafetyIQ Platform Analysis
            </h1>
            <p className="font-mono text-[11px] text-slate-400 tracking-wider uppercase">
              Reliance Internal · Cross-tenant intelligence · {new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono text-[11px] text-cyan-400/70 tracking-widest">LIVE</span>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="border-b border-slate-800 px-6">
        <div className="flex gap-0 overflow-x-auto scrollbar-none">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-3 font-mono text-[11px] font-semibold tracking-wide whitespace-nowrap transition-colors ${
                tab === id
                  ? "border-cyan-400 text-cyan-300"
                  : "border-transparent text-slate-400 hover:text-slate-300"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {tab === "overview"  && <OverviewTab  {...props} />}
        {tab === "clients"   && <ClientsTab   {...props} />}
        {tab === "risk"      && <RiskTab      {...props} />}
        {tab === "pengine"   && <PEngineTab   runs={props.runs} />}
        {tab === "users"     && <UsersTab     profiles={props.profiles} />}
      </div>
    </div>
  );
}
