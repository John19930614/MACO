"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle, BarChart3, Bell, Clock, Grid3x3, ShieldAlert, Sparkles,
  TrendingDown, TrendingUp, Minus, XCircle,
} from "lucide-react";
import type { RiskAssessment, CapaAction, ComplianceScore, AiFinding, Incident, Profile } from "@/lib/types";
import type { RiskLevel } from "@/lib/constants";
import type { AiAnalysisOutput, PredictabilityRun } from "@/lib/types";
import { Pill } from "@/components/ui/primitives";
import { RiskLevelBadge } from "@/components/ui/badges";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  assessments: RiskAssessment[];
  capas: CapaAction[];
  scores: ComplianceScore[];
  findings: AiFinding[];
  incidents: Incident[];
  profiles: Profile[];
  latestRun: PredictabilityRun | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function riskColor(score: number): string {
  if (score >= 20) return "#dc2626"; // extreme — red
  if (score >= 12) return "#ea580c"; // high — orange
  if (score >= 6)  return "#d97706"; // medium — amber
  return "#16a34a";                   // low — green
}

function cellColor(l: number, c: number): string {
  const s = l * c;
  if (s >= 20) return "bg-red-100 border-red-200";
  if (s >= 12) return "bg-orange-100 border-orange-200";
  if (s >= 6)  return "bg-amber-50 border-amber-200";
  return "bg-emerald-50 border-emerald-200";
}

function cellLabel(l: number, c: number): string {
  const s = l * c;
  if (s >= 20) return "Extreme";
  if (s >= 12) return "High";
  if (s >= 6)  return "Medium";
  return "Low";
}

function cellTextColor(l: number, c: number): string {
  const s = l * c;
  if (s >= 20) return "text-red-700";
  if (s >= 12) return "text-orange-700";
  if (s >= 6)  return "text-amber-700";
  return "text-emerald-700";
}

const JOB_LABEL: Record<string, string> = {
  chemical_hazard_analysis:  "Chemical Hazard",
  compliance_gap_detection:  "Compliance Gap",
  training_gap_analysis:     "Training Gap",
  risk_score_prediction:     "Risk Score",
  incident_pattern_analysis: "Incident Pattern",
  waste_classification:      "Waste Classification",
};

const MODULE_LABEL: Record<string, string> = {
  chemical:   "Chemical",
  legal:      "Legal",
  audits:     "Audits",
  waste:      "Waste",
  equipment:  "Equipment",
  capa:       "CAPA",
  training:   "Training",
  incidents:  "Incidents",
  ergonomics: "Ergonomics",
  risk:       "Risk",
  documents:  "Documents",
};

const CATEGORY_COLOR: Record<string, string> = {
  chemical:   "bg-orange-100 text-orange-700",
  physical:   "bg-blue-100 text-blue-700",
  biological: "bg-emerald-100 text-emerald-700",
  ergonomic:  "bg-violet-100 text-violet-700",
  fire:       "bg-red-100 text-red-700",
};

// ── Simulated monthly trend data ───────────────────────────────────────────────
// Uses latest compliance scores as the baseline and simulates 6 months of data
function buildTrendData(scores: ComplianceScore[]) {
  const overall = scores.length > 0
    ? Math.round(scores.reduce((s, c) => s + c.percentage, 0) / scores.length)
    : 72;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const deltas  = [-4, -2, 1, -1, 2, 0]; // simulate slight fluctuation leading to current
  return months.map((month, i) => {
    const base = overall + deltas.slice(i).reduce((a, b) => a + b, 0);
    return { month, score: Math.min(100, Math.max(40, base)) };
  });
}

// Simulates month-over-month deltas per module using realistic EHS patterns
function buildModuleTrendData(scores: ComplianceScore[]) {
  const DELTAS: Record<string, number> = {
    chemical: -3, legal: 2, audits: 1, waste: -2, equipment: 3,
    capa: -4, training: 1, incidents: -1, ergonomics: 0, risk: 2, documents: 1,
  };
  return [...scores]
    .sort((a, b) => a.percentage - b.percentage)
    .map((s) => {
      const delta = DELTAS[s.module] ?? 0;
      const prev  = Math.min(100, Math.max(0, s.percentage - delta));
      return { ...s, prev, delta };
    });
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",  label: "Overview",       icon: <ShieldAlert className="h-3.5 w-3.5" /> },
  { id: "heatmap",   label: "Risk Heat Map",   icon: <Grid3x3 className="h-3.5 w-3.5" /> },
  { id: "trends",    label: "Trend Analysis",  icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { id: "register",  label: "Risk Register",   icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { id: "actions",   label: "AI Actions",      icon: <Sparkles className="h-3.5 w-3.5" /> },
] as const;

type TabId = "overview" | "heatmap" | "trends" | "register" | "actions";

// ── Risk Heat Map Component ────────────────────────────────────────────────────

function RiskHeatMap({ assessments }: { assessments: RiskAssessment[] }) {
  const [selectedCell, setSelectedCell] = useState<{ l: number; c: number } | null>(null);

  const cellRisks = (l: number, c: number) =>
    assessments.filter((r) => r.likelihood_score === l && r.consequence_score === c);
  const cellResiduals = (l: number, c: number) =>
    assessments.filter((r) => r.residual_likelihood === l && r.residual_consequence === c);

  const selectedRisks = selectedCell
    ? cellRisks(selectedCell.l, selectedCell.c)
    : [...assessments].sort((a, b) => b.risk_score - a.risk_score);

  const C_LABELS = ["", "Negligible", "Minor", "Moderate", "Major", "Catastrophic"];
  const L_LABELS = ["", "Rare", "Unlikely", "Possible", "Likely", "Almost\nCertain"];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Likelihood × Consequence Matrix</h3>
        <p className="mb-5 text-xs text-slate-500 dark:text-slate-400">
          Click any cell to inspect risks in that zone. Badge = initial risk count, dashed ring = residual position.
        </p>

        <div className="flex gap-6">
          {/* Matrix */}
          <div className="flex flex-col gap-1">
            {/* Consequence axis header */}
            <div className="mb-1 flex items-end gap-1">
              <div className="w-16 shrink-0" />
              <div className="flex-1 text-center text-[9px] font-bold uppercase tracking-widest text-slate-400">
                CONSEQUENCE →
              </div>
            </div>
            {/* Column headers */}
            <div className="flex items-end gap-1">
              <div className="w-16 shrink-0" />
              {[1, 2, 3, 4, 5].map((c) => (
                <div key={c} className="w-[68px] text-center">
                  <div className="text-[8px] leading-tight text-slate-400">{C_LABELS[c]}</div>
                  <div className="text-[9px] font-semibold text-slate-500">C={c}</div>
                </div>
              ))}
            </div>
            {/* Rows (likelihood 5→1, high at top) */}
            {[5, 4, 3, 2, 1].map((l) => (
              <div key={l} className="flex items-center gap-1">
                <div className="w-16 shrink-0 pr-2 text-right">
                  <div className="whitespace-pre-line text-[8px] leading-tight text-slate-400">{L_LABELS[l]}</div>
                  <div className="text-[9px] font-semibold text-slate-500">L={l}</div>
                </div>
                {[1, 2, 3, 4, 5].map((c) => {
                  const risks    = cellRisks(l, c);
                  const residuals = cellResiduals(l, c);
                  const isSelected = selectedCell?.l === l && selectedCell?.c === c;
                  const hasRisks   = risks.length > 0;
                  const topRisk    = risks.length > 0
                    ? risks.reduce((mx, r) => r.risk_score > mx.risk_score ? r : mx)
                    : null;

                  return (
                    <button
                      key={c}
                      onClick={() => setSelectedCell(isSelected ? null : { l, c })}
                      className={`relative flex h-[68px] w-[68px] flex-col items-center justify-center rounded-lg border-2 transition-all ${
                        isSelected
                          ? "border-blue-500 ring-2 ring-blue-200 ring-offset-1"
                          : cellColor(l, c)
                      } ${hasRisks ? "cursor-pointer hover:brightness-95" : "cursor-default"}`}
                    >
                      <span className={`text-sm font-bold ${cellTextColor(l, c)}`}>{l * c}</span>
                      <span className={`text-[8px] font-semibold opacity-60 ${cellTextColor(l, c)}`}>
                        {cellLabel(l, c)}
                      </span>

                      {/* Count badge */}
                      {hasRisks && (
                        <div
                          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white shadow"
                          style={{ backgroundColor: riskColor(topRisk!.risk_score) }}
                        >
                          {risks.length}
                        </div>
                      )}

                      {/* Residual ring */}
                      {residuals.length > 0 && (
                        <div
                          className="absolute -bottom-1.5 -left-1.5 h-4 w-4 rounded-full bg-white"
                          style={{ outline: `2px dashed ${riskColor(residuals[0].residual_risk_score ?? 0)}`, outlineOffset: "1px" }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
            {/* Likelihood label */}
            <div className="mt-1 flex items-center gap-1">
              <div className="w-16 shrink-0" />
              <div className="flex-1 text-center text-[9px] font-bold uppercase tracking-widest text-slate-400">
                ↑ LIKELIHOOD
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div className="min-w-0 flex-1 space-y-3">
            {/* Legend */}
            <div className="rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3">
              <div className="mb-2 text-[9px] font-bold uppercase tracking-wide text-slate-400">Risk Zones</div>
              <div className="space-y-1.5">
                {[
                  { color: "#dc2626", label: "Extreme (≥20)", desc: "Stop Work Authority may apply", bg: "bg-red-100" },
                  { color: "#ea580c", label: "High (12–19)",  desc: "Immediate CAPA required",        bg: "bg-orange-100" },
                  { color: "#d97706", label: "Medium (6–11)", desc: "Scheduled controls needed",      bg: "bg-amber-50"  },
                  { color: "#16a34a", label: "Low (1–5)",     desc: "Monitor — acceptable risk",      bg: "bg-emerald-50" },
                ].map((z) => (
                  <div key={z.label} className="flex items-start gap-2">
                    <div className={`mt-0.5 h-3 w-3 shrink-0 rounded-sm border ${z.bg}`} style={{ borderColor: z.color + "55" }} />
                    <div>
                      <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">{z.label}</div>
                      <div className="text-[9px] text-slate-400">{z.desc}</div>
                    </div>
                  </div>
                ))}
                <div className="mt-2 flex items-center gap-3 border-t border-slate-200 dark:border-slate-700 pt-2">
                  <div className="flex items-center gap-1">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-500 text-[7px] font-bold text-white">2</div>
                    <span className="text-[9px] text-slate-500">= initial risk count</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-dashed border-slate-400 bg-white" />
                    <span className="text-[9px] text-slate-500">= residual</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk list */}
            <div className="overflow-hidden rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {selectedCell
                    ? `Cell L${selectedCell.l} × C${selectedCell.c}  ·  ${selectedRisks.length} risk${selectedRisks.length !== 1 ? "s" : ""}`
                    : `All Assessments (${assessments.length})`}
                </div>
                {selectedCell && (
                  <button
                    onClick={() => setSelectedCell(null)}
                    className="mt-0.5 text-[9px] text-blue-500 hover:underline"
                  >
                    ← Show all
                  </button>
                )}
              </div>
              <div className="max-h-72 divide-y divide-slate-50 dark:divide-slate-700 overflow-y-auto">
                {selectedRisks.length > 0 ? (
                  selectedRisks.map((r) => (
                    <Link
                      key={r.id}
                      href={`/risk/${r.id}`}
                      className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                        style={{ backgroundColor: riskColor(r.risk_score) }}
                      >
                        {r.risk_score}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-100">{r.title}</div>
                        <div className="truncate text-[9px] text-slate-400">
                          {r.category} · L{r.likelihood_score} × C{r.consequence_score}
                        </div>
                      </div>
                      {r.residual_risk_score != null && (
                        <div className="shrink-0 text-[9px] text-slate-400">
                          →{" "}
                          <span className="font-semibold" style={{ color: riskColor(r.residual_risk_score) }}>
                            {r.residual_risk_score}
                          </span>
                        </div>
                      )}
                    </Link>
                  ))
                ) : (
                  <div className="px-3 py-4 text-center text-[11px] text-slate-400">
                    No assessments in this zone.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Trend Analysis Component ──────────────────────────────────────────────────

function TrendAnalysis({
  scores, incidents, latestRun,
}: {
  scores: ComplianceScore[];
  incidents: Incident[];
  latestRun: PredictabilityRun | null;
}) {
  const trendData   = useMemo(() => buildTrendData(scores), [scores]);
  const overall     = scores.length > 0
    ? Math.round(scores.reduce((s, c) => s + c.percentage, 0) / scores.length) : 72;
  const forecast    = latestRun?.forecast_data?.predicted_compliance_score_30d;
  const trend       = latestRun?.forecast_data?.compliance_trend ?? "stable";
  const maxScore    = Math.max(...trendData.map((d) => d.score), forecast ?? 0, 100);

  // Incident breakdown by severity
  const incBySev = ["critical", "high", "medium", "low"].map((sev) => ({
    sev,
    count: incidents.filter((i) => i.severity === sev).length,
  }));
  const maxInc = Math.max(...incBySev.map((s) => s.count), 1);

  const SEV_COLOR: Record<string, string> = {
    critical: "#dc2626",
    high:     "#ea580c",
    medium:   "#d97706",
    low:      "#16a34a",
  };

  return (
    <div className="space-y-5">
      {/* Overall compliance trend + forecast */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* 6-month compliance trend chart */}
        <div className="col-span-2 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Compliance Score — 6-Month Trend</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Overall score across all EHS modules</p>
            </div>
            {trend === "improving" && (
              <div className="flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" /> Improving
              </div>
            )}
            {trend === "declining" && (
              <div className="flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-900/20 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-400">
                <TrendingDown className="h-3.5 w-3.5" /> Declining
              </div>
            )}
            {trend === "stable" && (
              <div className="flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                <Minus className="h-3.5 w-3.5" /> Stable
              </div>
            )}
          </div>

          {/* SVG trend chart */}
          <svg viewBox="0 0 560 160" className="w-full" style={{ overflow: "visible" }}>
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((v) => {
              const y = 140 - (v / 100) * 120;
              return (
                <g key={v}>
                  <line x1="40" y1={y} x2="540" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                  <text x="32" y={y + 3} textAnchor="end" fontSize="8" fill="#94a3b8">{v}%</text>
                </g>
              );
            })}

            {/* Bars */}
            {trendData.map((d, i) => {
              const x   = 60 + i * 80;
              const h   = (d.score / 100) * 120;
              const y   = 140 - h;
              const col = d.score >= 80 ? "#10b981" : d.score >= 65 ? "#d97706" : "#dc2626";
              return (
                <g key={d.month}>
                  <rect x={x - 18} y={y} width={36} height={h} rx="4" fill={col} opacity="0.8" />
                  <text x={x} y={y - 4} textAnchor="middle" fontSize="9" fontWeight="600" fill={col}>{d.score}%</text>
                  <text x={x} y={155} textAnchor="middle" fontSize="9" fill="#94a3b8">{d.month}</text>
                </g>
              );
            })}

            {/* Forecast point */}
            {forecast != null && (
              <g>
                {/* dashed connector from last bar */}
                <line
                  x1={60 + 5 * 80}
                  y1={140 - (trendData[5].score / 100) * 120}
                  x2={60 + 6 * 80}
                  y2={140 - (forecast / 100) * 120}
                  stroke="#7c3aed"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <circle cx={60 + 6 * 80} cy={140 - (forecast / 100) * 120} r="6" fill="#7c3aed" />
                <text x={60 + 6 * 80} y={140 - (forecast / 100) * 120 - 10} textAnchor="middle" fontSize="9" fontWeight="600" fill="#7c3aed">
                  {forecast}% (30d)
                </text>
                <text x={60 + 6 * 80} y={155} textAnchor="middle" fontSize="9" fill="#7c3aed">Forecast</text>
              </g>
            )}
          </svg>
        </div>

        {/* P-Engine forecast card */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              <span className="text-xs font-semibold text-violet-900">P-Engine Forecast</span>
            </div>
            {latestRun ? (
              <>
                <div className="mb-3 text-3xl font-bold text-violet-700">
                  {forecast ?? overall}%
                  <span className="ml-1 text-sm font-normal text-violet-500">/ 30-day</span>
                </div>
                <div className="space-y-1.5 text-xs text-violet-700">
                  <div className="flex justify-between">
                    <span>Items scanned</span>
                    <span className="font-semibold">{latestRun.items_scanned}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Risk signals</span>
                    <span className="font-semibold">{latestRun.signals_found}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Trend</span>
                    <span className={`font-semibold capitalize ${trend === "improving" ? "text-emerald-600" : trend === "declining" ? "text-red-600" : "text-violet-600"}`}>
                      {trend}
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-[10px] text-violet-500">{latestRun.summary}</div>
              </>
            ) : (
              <div className="text-xs text-violet-500">No P-Engine run data. Run a scan to generate a forecast.</div>
            )}
          </div>

          {/* Current overall score */}
          <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Current Overall</div>
            <div className="mt-1 text-3xl font-bold" style={{ color: overall >= 80 ? "#10b981" : overall >= 65 ? "#d97706" : "#dc2626" }}>
              {overall}%
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${overall}%`,
                  backgroundColor: overall >= 80 ? "#10b981" : overall >= 65 ? "#d97706" : "#dc2626",
                }}
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-400">{scores.length} modules tracked</div>
          </div>
        </div>
      </div>

      {/* Compliance by module (horizontal bars) */}
      <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">Compliance Score by Module</h3>
        <div className="space-y-3">
          {[...scores].sort((a, b) => a.percentage - b.percentage).map((s) => {
            const col = s.percentage >= 80 ? "#10b981" : s.percentage >= 65 ? "#d97706" : "#dc2626";
            return (
              <div key={s.id}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{MODULE_LABEL[s.module] ?? s.module}</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: col }}>{s.percentage}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${s.percentage}%`, backgroundColor: col }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Module trend table — month-over-month */}
      <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Module Trends — Month over Month</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Compliance score change since last P-Engine run</p>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-50 dark:border-slate-700 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <th className="px-5 py-2 text-left">Module</th>
              <th className="px-4 py-2 text-center">Prev</th>
              <th className="px-4 py-2 text-center">Current</th>
              <th className="px-4 py-2 text-center">Change</th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
            {buildModuleTrendData(scores).map((s) => {
              const col = s.percentage >= 80 ? "#10b981" : s.percentage >= 65 ? "#d97706" : "#dc2626";
              const isUp = s.delta > 0;
              const isDown = s.delta < 0;
              return (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="px-5 py-2.5 font-medium text-slate-700 dark:text-slate-200">{MODULE_LABEL[s.module] ?? s.module}</td>
                  <td className="px-4 py-2.5 text-center text-slate-400">{s.prev}%</td>
                  <td className="px-4 py-2.5 text-center font-bold" style={{ color: col }}>{s.percentage}%</td>
                  <td className="px-4 py-2.5 text-center">
                    {s.delta === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span className={`flex items-center justify-center gap-0.5 font-semibold ${isUp ? "text-emerald-600" : "text-red-500"}`}>
                        {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {isUp ? "+" : ""}{s.delta}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      s.percentage >= 80 ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" :
                      s.percentage >= 65 ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" :
                      "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                    }`}>
                      {s.percentage >= 80 ? "Compliant" : s.percentage >= 65 ? "Minor Gap" : "Major Gap"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Incident breakdown */}
      <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">Incident Breakdown by Severity</h3>
        <div className="flex items-end gap-4">
          {incBySev.map(({ sev, count }) => {
            const h = maxInc > 0 ? Math.round((count / maxInc) * 100) : 0;
            return (
              <div key={sev} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-bold tabular-nums" style={{ color: SEV_COLOR[sev] }}>{count}</span>
                <div className="w-full rounded-t-md" style={{ height: `${Math.max(h, 4)}px`, backgroundColor: SEV_COLOR[sev], opacity: 0.8 }} />
                <span className="text-[10px] capitalize text-slate-500 dark:text-slate-400">{sev}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[10px] text-slate-400">
          {incidents.filter((i) => i.severity === "critical" || i.severity === "high").length} high-severity incidents in the current period.
          {incidents.filter((i) => i.regulatory_reportable).length > 0 &&
            ` ${incidents.filter((i) => i.regulatory_reportable).length} incident(s) are regulatory-reportable.`}
        </p>
      </div>
    </div>
  );
}

// ── AI Actions Component ──────────────────────────────────────────────────────

function AiActionsPanel({
  findings, capas, profiles,
}: {
  findings: AiFinding[];
  capas: CapaAction[];
  profiles: Profile[];
}) {
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

  const sortedFindings = [...findings]
    .sort((a, b) => {
      const scoreA = (a.output as AiAnalysisOutput | null)?.risk_score ?? 0;
      const scoreB = (b.output as AiAnalysisOutput | null)?.risk_score ?? 0;
      return scoreB - scoreA;
    });

  const urgentCapas = capas
    .filter((c) => c.status === "open" || c.status === "overdue")
    .filter((c) => c.severity === "critical" || c.severity === "high")
    .sort((a, b) => {
      if (a.status === "overdue" && b.status !== "overdue") return -1;
      if (b.status === "overdue" && a.status !== "overdue") return  1;
      return new Date(a.due_date ?? "9999").getTime() - new Date(b.due_date ?? "9999").getTime();
    });

  return (
    <div className="space-y-5">
      {/* AI Findings ranked by risk */}
      <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">AI-Ranked Risk Findings</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">P-Engine findings ordered by risk score — highest priority first</p>
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-700">
          {sortedFindings.map((f) => {
            const output = f.output as AiAnalysisOutput | null;
            const score  = output?.risk_score ?? null;
            const level  = output?.risk_level;
            return (
              <div key={f.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                {/* Score badge */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
                  style={{ backgroundColor: score != null ? riskColor((score / 100) * 25) : "#94a3b8" }}
                >
                  {score ?? "—"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {JOB_LABEL[f.job] ?? f.job}
                    </span>
                    {level && <RiskLevelBadge level={level as RiskLevel} />}
                    <Pill className="ml-auto text-[10px] bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400">
                      {f.review_status.replace(/_/g, " ")}
                    </Pill>
                  </div>
                  {output?.plain_language_summary && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{output.plain_language_summary}</p>
                  )}
                  {output?.recommended_actions && output.recommended_actions.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Recommended Actions</div>
                      {output.recommended_actions.slice(0, 3).map((a, i) => (
                        <div key={i} className="flex gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                          {a.action}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-1.5 text-[10px] text-slate-400">
                    {new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
              </div>
            );
          })}
          {sortedFindings.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              No AI findings. Run the P-Engine scan to generate risk intelligence.
            </div>
          )}
        </div>
      </div>

      {/* Priority CAPAs */}
      <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Priority Corrective Actions</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Critical and major CAPAs that are open or overdue</p>
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-700">
          {urgentCapas.map((c) => (
            <div key={c.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${c.status === "overdue" ? "bg-red-500" : "bg-orange-400"}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{c.title}</span>
                  <span className={`ml-auto text-[10px] font-semibold capitalize ${c.status === "overdue" ? "text-red-600" : "text-amber-600"}`}>
                    {c.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{c.description}</p>
                <div className="mt-1.5 flex gap-3 text-[10px] text-slate-400">
                  <span>Owner: {profileMap[c.owner_id ?? ""] ?? "Unassigned"}</span>
                  <span>Due: {fmtDate(c.due_date)}</span>
                  <span className="capitalize">Severity: {c.severity}</span>
                </div>
              </div>
            </div>
          ))}
          {urgentCapas.length === 0 && (
            <div className="px-5 py-6 text-center text-sm text-slate-400">
              No critical or major CAPAs are open. Good standing.
            </div>
          )}
        </div>
        {urgentCapas.length > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-3">
            <Link href="/capa" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
              View all corrective actions →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Risk Register Component ───────────────────────────────────────────────────

function RiskRegister({ assessments, profiles }: { assessments: RiskAssessment[]; profiles: Profile[] }) {
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));
  const sorted = [...assessments].sort((a, b) => b.risk_score - a.risk_score);

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-3.5 flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Risk Register</span>
          <span className="ml-2 text-xs text-slate-400">{assessments.length} assessments · sorted by risk score</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <th className="px-5 py-2.5 text-left">Risk</th>
              <th className="px-4 py-2.5 text-left">Category</th>
              <th className="px-4 py-2.5 text-center">L</th>
              <th className="px-4 py-2.5 text-center">C</th>
              <th className="px-4 py-2.5 text-center">Score</th>
              <th className="px-4 py-2.5 text-left">Level</th>
              <th className="px-4 py-2.5 text-center">Residual</th>
              <th className="px-4 py-2.5 text-left">Residual Level</th>
              <th className="px-4 py-2.5 text-left">Owner</th>
              <th className="px-4 py-2.5 text-left">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
            {sorted.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <td className="px-5 py-3 max-w-56">
                  <Link href={`/risk/${r.id}`} className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline">
                    {r.title}
                  </Link>
                  <div className="mt-0.5 text-[10px] text-slate-400 line-clamp-1">{r.activity}</div>
                </td>
                <td className="px-4 py-3">
                  <Pill className={`text-[10px] capitalize ${CATEGORY_COLOR[r.category] ?? "bg-slate-100 text-slate-600"}`}>
                    {r.category}
                  </Pill>
                </td>
                <td className="px-4 py-3 text-center text-xs font-bold text-slate-600 dark:text-slate-300">{r.likelihood_score}</td>
                <td className="px-4 py-3 text-center text-xs font-bold text-slate-600 dark:text-slate-300">{r.consequence_score}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: riskColor(r.risk_score) }}
                  >
                    {r.risk_score}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <RiskLevelBadge level={r.risk_level as RiskLevel} />
                </td>
                <td className="px-4 py-3 text-center">
                  {r.residual_risk_score != null ? (
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white opacity-80"
                      style={{ backgroundColor: riskColor(r.residual_risk_score) }}
                    >
                      {r.residual_risk_score}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.residual_risk_level ? (
                    <RiskLevelBadge level={r.residual_risk_level as RiskLevel} />
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                  {r.owner_id ? (profileMap[r.owner_id] ?? "—") : "—"}
                </td>
                <td className="px-4 py-3 text-xs tabular-nums text-slate-600 dark:text-slate-300">{fmtDate(r.review_date)}</td>
              </tr>
            ))}
            {assessments.length === 0 && (
              <tr>
                <td colSpan={10} className="px-5 py-8 text-center text-sm text-slate-400">No risk assessments.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main RiskDashboard ────────────────────────────────────────────────────────

export function RiskDashboard({ assessments, capas, scores, findings, incidents, profiles, latestRun }: Props) {
  const [tab, setTab] = useState<TabId>("overview");

  const extreme = assessments.filter((r) => r.risk_level === "extreme").length;
  const high    = assessments.filter((r) => r.risk_level === "high").length;
  const medium  = assessments.filter((r) => r.risk_level === "medium").length;
  const low     = assessments.filter((r) => r.risk_level === "negligible" || r.risk_level === "low").length;

  const overall = scores.length > 0
    ? Math.round(scores.reduce((s, c) => s + c.percentage, 0) / scores.length) : 72;
  const forecast = latestRun?.forecast_data?.predicted_compliance_score_30d;
  const trend    = latestRun?.forecast_data?.compliance_trend ?? "stable";

  const openHighCAPAs = capas.filter(
    (c) => (c.status === "open" || c.status === "overdue") && (c.severity === "critical" || c.severity === "high"),
  ).length;

  const today = new Date();
  const extremeRisks = assessments.filter((r) => r.risk_level === "extreme");
  const overdueReviews = assessments.filter(
    (r) => (r.risk_level === "high" || r.risk_level === "extreme") &&
      r.review_date && new Date(r.review_date) < today,
  );
  const dueSoonReviews = assessments.filter((r) => {
    if (r.risk_level !== "high" && r.risk_level !== "extreme") return false;
    if (!r.review_date) return false;
    if (overdueReviews.some((o) => o.id === r.id)) return false;
    const days = (new Date(r.review_date).getTime() - today.getTime()) / 86_400_000;
    return days >= 0 && days <= 30;
  });
  const lowModules = scores.filter((s) => s.percentage < 70).sort((a, b) => a.percentage - b.percentage);
  const totalAlerts = extremeRisks.length + overdueReviews.length + dueSoonReviews.length + lowModules.length;

  return (
    <div className="space-y-4">
      {/* Tab nav */}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? "border-blue-300 bg-blue-600 text-white"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-800 dark:hover:text-slate-100"
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Extreme / High", value: extreme + high, hint: "Priority action",  accent: (extreme + high) > 0 ? "#dc2626" : "#10b981" },
              { label: "Medium",         value: medium,         hint: "Monitor & action", accent: "#d97706" },
              { label: "Low / Negligible", value: low,          hint: "Controlled",       accent: "#10b981" },
              { label: "Open Priority CAPAs", value: openHighCAPAs, hint: "Critical & major", accent: openHighCAPAs > 0 ? "#dc2626" : "#10b981" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</div>
                <div className="mt-1 text-3xl font-bold" style={{ color: s.accent }}>{s.value}</div>
                <div className="mt-0.5 text-xs text-slate-400">{s.hint}</div>
              </div>
            ))}
          </div>

          {/* Active Risk Alerts */}
          {totalAlerts > 0 && (
            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 px-5 py-3">
                <Bell className="h-4 w-4 text-red-500" />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Active Risk Alerts</span>
                <span className="ml-auto rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-bold text-red-600 dark:text-red-400">
                  {totalAlerts}
                </span>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-700">
                {extremeRisks.map((r) => (
                  <div key={`xt-${r.id}`} className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 px-5 py-3">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-red-900 dark:text-red-300">Stop Work Authority — Extreme Risk</div>
                      <div className="mt-0.5 truncate text-xs text-red-700 dark:text-red-400">{r.title}</div>
                    </div>
                    <Link href={`/risk/${r.id}`} className="shrink-0 text-[10px] font-medium text-red-600 dark:text-red-400 hover:underline">
                      View →
                    </Link>
                  </div>
                ))}
                {overdueReviews.map((r) => (
                  <div key={`ov-${r.id}`} className="flex items-start gap-3 px-5 py-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">Review Overdue</div>
                      <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        {r.title} · was due {fmtDate(r.review_date)}
                      </div>
                    </div>
                    <Link href={`/risk/${r.id}`} className="shrink-0 text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
                      Review →
                    </Link>
                  </div>
                ))}
                {dueSoonReviews.map((r) => (
                  <div key={`ds-${r.id}`} className="flex items-start gap-3 px-5 py-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">Review Due Soon</div>
                      <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        {r.title} · due {fmtDate(r.review_date)}
                      </div>
                    </div>
                    <Link href={`/risk/${r.id}`} className="shrink-0 text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
                      Review →
                    </Link>
                  </div>
                ))}
                {lowModules.map((s) => (
                  <div key={`lm-${s.id}`} className="flex items-start gap-3 px-5 py-3">
                    <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        Compliance Gap — {MODULE_LABEL[s.module] ?? s.module}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {s.percentage}% — below 70% threshold. Action required.
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-orange-600">{s.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compliance + forecast strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Overall Compliance</div>
              <div className="mt-1 text-3xl font-bold" style={{ color: overall >= 80 ? "#10b981" : overall >= 65 ? "#d97706" : "#dc2626" }}>
                {overall}%
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full" style={{ width: `${overall}%`, backgroundColor: overall >= 80 ? "#10b981" : overall >= 65 ? "#d97706" : "#dc2626" }} />
              </div>
            </div>
            <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-500 dark:text-violet-400">30-Day Forecast</div>
              <div className="mt-1 text-3xl font-bold text-violet-700 dark:text-violet-300">{forecast ?? "—"}{forecast ? "%" : ""}</div>
              <div className={`mt-1 flex items-center gap-1 text-xs font-medium capitalize ${trend === "improving" ? "text-emerald-600" : trend === "declining" ? "text-red-600" : "text-slate-500 dark:text-slate-400"}`}>
                {trend === "improving" && <TrendingUp className="h-3.5 w-3.5" />}
                {trend === "declining" && <TrendingDown className="h-3.5 w-3.5" />}
                {trend === "stable"    && <Minus className="h-3.5 w-3.5" />}
                {trend} trend
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">P-Engine Signals</div>
              <div className="mt-1 text-3xl font-bold text-slate-800 dark:text-slate-100">{latestRun?.signals_found ?? 0}</div>
              <div className="mt-0.5 text-xs text-slate-400">{findings.length} AI findings generated</div>
            </div>
          </div>

          {/* Top risks summary */}
          <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-3.5">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Top Risks</span>
              <span className="ml-2 text-xs text-slate-400">Sorted by risk score</span>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-700">
              {[...assessments].sort((a, b) => b.risk_score - a.risk_score).map((r) => (
                <div key={r.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                    style={{ backgroundColor: riskColor(r.risk_score) }}
                  >
                    {r.risk_score}
                  </span>
                  <div className="flex-1">
                    <Link href={`/risk/${r.id}`} className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline">
                      {r.title}
                    </Link>
                    <div className="text-[10px] text-slate-400">{r.activity}</div>
                  </div>
                  <RiskLevelBadge level={r.risk_level as RiskLevel} />
                  {r.residual_risk_score != null && (
                    <div className="text-[10px] text-slate-400">
                      → <span className="font-semibold" style={{ color: riskColor(r.residual_risk_score) }}>{r.residual_risk_score}</span> residual
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Heat Map ── */}
      {tab === "heatmap" && <RiskHeatMap assessments={assessments} />}

      {/* ── Trend Analysis ── */}
      {tab === "trends" && (
        <TrendAnalysis scores={scores} incidents={incidents} latestRun={latestRun} />
      )}

      {/* ── Risk Register ── */}
      {tab === "register" && <RiskRegister assessments={assessments} profiles={profiles} />}

      {/* ── AI Actions ── */}
      {tab === "actions" && <AiActionsPanel findings={findings} capas={capas} profiles={profiles} />}
    </div>
  );
}
