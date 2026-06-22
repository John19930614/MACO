"use client";

import { useState } from "react";
import { GUS_VERTICALS } from "@/lib/arc/arc";
import {
  ARC_SITES, CELLS, PROOFS, ACTIONS, HSL_READINGS, VELA_INSIGHTS,
} from "@/lib/data/mock";
import { PageHeader } from "@/components/ui/primitives";
import type { Site, SafetyCell, HslReading, VelaInsight } from "@/lib/types";
import type { Vertical } from "@/lib/arc/arc";

// ── Types ──────────────────────────────────────────────────────────────────────

interface VerticalStats {
  vertical: Vertical;
  site: Site;
  totalCells: number;
  openCells: number;
  criticalCount: number;
  highCount: number;
  avgRisk: number;
  openActions: number;
  proofGapCount: number;
  proofTotal: number;
  topCells: SafetyCell[];
  hslReadings: HslReading[];
  velaPatterns: VelaInsight[];
  topGaps: { gap: string; count: number }[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, string> = {
  HardHat: "🪖", Flame: "🔥", Pickaxe: "⛏️", Factory: "🏭", Package: "📦",
  Zap: "⚡", Truck: "🚛", Anchor: "⚓", Plane: "✈️", TrainFront: "🚆",
  Wheat: "🌾", Beef: "🥩", FlaskConical: "🧪", Pill: "💊", HeartPulse: "🫀",
  RadioTower: "📡", Recycle: "♻️", Building2: "🏢", Wind: "🌬️",
};

const VERTICAL_FOCUS: Record<string, { focus: string; regs: string[] }> = {
  maritime:      { focus: "Crane ops, deck safety, confined space, marine pollution",      regs: ["MLC 2006", "SOLAS", "AMSA"] },
  construction:  { focus: "Working at height, mobile plant, silica dust, electrical",      regs: ["WHS Regulations", "AS 2550"] },
  manufacturing: { focus: "Machine guarding, pressure vessels, chemical handling",         regs: ["AS 1210", "ISO 13849", "WHS Act"] },
  "oil-gas":     { focus: "Process safety, permit-to-work, gas detection, LOPA",          regs: ["NOPSEMA", "API RP 14C", "PSSR 2000"] },
  mining:        { focus: "Ground control, blast safety, ventilation, plant interaction",  regs: ["Mines Safety Act", "AS 4024"] },
  chemical:      { focus: "HAZOP, SIS, chemical release, process containment",            regs: ["CIMAH", "Seveso III", "AS ISO 31000"] },
};

const SEV_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-amber-100 text-amber-700",
  low:      "bg-slate-100 text-slate-500",
};

const SEV_DOT: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#94a3b8",
};

const HSL_LABELS: Record<string, string> = {
  psych_safety_gap:       "Psych safety gap",
  cultural_drift_index:   "Cultural drift",
  cognitive_load_monitor: "Cognitive load",
  invisible_workforce:    "Invisible workforce",
  knowledge_ghost:        "Knowledge ghost",
  crew_trauma_score:      "Crew trauma",
};

const HSL_WORSE_WHEN_HIGH = new Set([
  "psych_safety_gap", "cultural_drift_index", "cognitive_load_monitor",
  "invisible_workforce", "crew_trauma_score",
]);

const BAD_PROOF = new Set(["missing", "expired", "conflicting", "not_checked"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function hslRiskLevel(dim: string, value: number): "high" | "moderate" | "low" {
  const isRisk = HSL_WORSE_WHEN_HIGH.has(dim);
  const level  = isRisk ? value : 100 - value;
  if (level >= 65) return "high";
  if (level >= 45) return "moderate";
  return "low";
}

const HSL_BAR_COLOR = { high: "bg-red-400", moderate: "bg-amber-400", low: "bg-emerald-400" };
const HSL_TEXT_COLOR = { high: "text-red-600", moderate: "text-amber-600", low: "text-emerald-600" };

// ── Data computation (runs once at module load) ────────────────────────────────

function buildStats(): { liveStats: VerticalStats[]; availableVerticals: Vertical[] } {
  const liveSlugs = new Set(ARC_SITES.map((s) => s.vertical));

  const liveStats: VerticalStats[] = ARC_SITES.map((site) => {
    const vertical = GUS_VERTICALS.find((v) => v.slug === site.vertical)!;
    const siteCells = CELLS.filter((c) => c.site_id === site.id);
    const cellIds   = new Set(siteCells.map((c) => c.id));

    const openCells     = siteCells.filter((c) => c.status !== "closed").length;
    const criticalCount = siteCells.filter((c) => c.severity === "critical").length;
    const highCount     = siteCells.filter((c) => c.severity === "high").length;
    const avgRisk       = siteCells.length
      ? Math.round(siteCells.reduce((s, c) => s + c.risk_score, 0) / siteCells.length)
      : 0;

    const siteProofs    = PROOFS.filter((p) => cellIds.has(p.cell_id));
    const proofGapCount = siteProofs.filter((p) => BAD_PROOF.has(p.status)).length;

    const openActions = ACTIONS.filter(
      (a) => cellIds.has(a.cell_id) && (a.status === "open" || a.status === "in_progress")
    ).length;

    const topCells = [...siteCells].sort((a, b) => b.risk_score - a.risk_score).slice(0, 6);

    const gapCounts: Record<string, number> = {};
    for (const c of siteCells) {
      const g = c.hazard_genome?.controlGap ?? "unknown";
      gapCounts[g] = (gapCounts[g] ?? 0) + 1;
    }
    const topGaps = Object.entries(gapCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([gap, count]) => ({ gap, count }));

    return {
      vertical,
      site,
      totalCells: siteCells.length,
      openCells,
      criticalCount,
      highCount,
      avgRisk,
      openActions,
      proofGapCount,
      proofTotal: siteProofs.length,
      topCells,
      hslReadings: HSL_READINGS.filter((r) => r.site_id === site.id),
      velaPatterns: VELA_INSIGHTS.filter((v) =>
        (v.applies_to as string[]).includes(site.vertical as string)
      ),
      topGaps,
    };
  });

  const availableVerticals = GUS_VERTICALS.filter((v) => !liveSlugs.has(v.slug));
  return { liveStats, availableVerticals };
}

const { liveStats, availableVerticals } = buildStats();
const totalCells    = liveStats.reduce((s, v) => s + v.totalCells, 0);
const totalCritical = liveStats.reduce((s, v) => s + v.criticalCount, 0);

// ── Component ─────────────────────────────────────────────────────────────────

export function VerticalsPage() {
  const [selectedSlug, setSelectedSlug] = useState<string>(liveStats[0]?.vertical.slug ?? "");
  const selected = liveStats.find((s) => s.vertical.slug === selectedSlug);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="GUS Verticals"
        subtitle={`${GUS_VERTICALS.length} per-vertical AI engines, each tuned to its industry's hazards, tasks, and regulations.`}
        actions={
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
            {liveStats.length} live · {availableVerticals.length} available
          </span>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* Summary stats strip */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Active verticals",    value: liveStats.length,          color: "#3b82f6" },
            { label: "Total cells",         value: totalCells,                 color: "#6366f1" },
            { label: "Critical open",       value: totalCritical,              color: "#ef4444" },
            { label: "Verticals available", value: availableVerticals.length,  color: "#94a3b8" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-400">{s.label}</div>
              <div className="mt-1 text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Live engine selector cards */}
        <section className="mb-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Live GUS engines · {liveStats.length} active
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {liveStats.map((s) => {
              const isSelected  = s.vertical.slug === selectedSlug;
              const icon        = ICON_MAP[s.vertical.icon] ?? "🏭";
              const proofGapPct = s.proofTotal > 0
                ? Math.round((s.proofGapCount / s.proofTotal) * 100)
                : 0;

              return (
                <button
                  key={s.vertical.slug}
                  onClick={() => setSelectedSlug(isSelected ? "" : s.vertical.slug)}
                  className={`rounded-xl border-2 p-4 text-left transition-all shadow-sm ${
                    isSelected
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-2xl">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold leading-tight text-slate-900">{s.vertical.name}</div>
                      <div className="truncate text-xs text-slate-500">{s.site.name}</div>
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                      Live
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
                      <div className="text-xs font-bold text-slate-800">{s.totalCells}</div>
                      <div className="text-[10px] text-slate-400">cells</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
                      <div
                        className="text-xs font-bold"
                        style={{ color: s.criticalCount > 0 ? "#ef4444" : s.highCount > 0 ? "#f97316" : "#22c55e" }}
                      >
                        {s.criticalCount > 0 ? `${s.criticalCount} crit` : s.highCount > 0 ? `${s.highCount} high` : "clear"}
                      </div>
                      <div className="text-[10px] text-slate-400">severity</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
                      <div className="text-xs font-bold text-slate-800">{s.avgRisk}</div>
                      <div className="text-[10px] text-slate-400">avg risk</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
                      <div className="text-xs font-bold" style={{ color: proofGapPct > 30 ? "#ef4444" : "#22c55e" }}>
                        {proofGapPct}%
                      </div>
                      <div className="text-[10px] text-slate-400">proof gap</div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-2 text-center text-[11px] font-medium text-blue-600">▲ details below</div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Expanded detail panel */}
        {selected && (
          <div className="mb-6 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">
            {/* Detail header */}
            <div className="border-b border-slate-100 bg-blue-50 px-5 py-4">
              <div className="flex flex-wrap items-start gap-3">
                <span className="text-3xl">{ICON_MAP[selected.vertical.icon] ?? "🏭"}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold text-slate-900">
                    {selected.vertical.name} GUS Engine
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {selected.site.name} · {selected.site.state}, {selected.site.country} · {selected.site.headcount} headcount
                  </div>
                  {VERTICAL_FOCUS[selected.vertical.slug] && (
                    <div className="mt-1 text-xs text-slate-600">
                      <span className="font-medium">Engine focus:</span>{" "}
                      {VERTICAL_FOCUS[selected.vertical.slug].focus}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(VERTICAL_FOCUS[selected.vertical.slug]?.regs ?? []).map((r) => (
                    <span key={r} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 divide-y divide-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              {/* Left: Cells + control gaps */}
              <div className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">Safety Cells</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                    {selected.totalCells} total
                  </span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-600">
                    {selected.openCells} open
                  </span>
                </div>

                <div className="space-y-1.5">
                  {selected.topCells.map((c) => (
                    <div key={c.id} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: SEV_DOT[c.severity] }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-slate-800">{c.title}</div>
                        <div className="text-[11px] text-slate-400">
                          {c.hazard_genome.energySource} · {c.hazard_genome.controlGap} gap
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${SEV_COLORS[c.severity]}`}>
                          {c.severity}
                        </span>
                        <div className="mt-0.5 text-[11px] font-bold text-slate-500">{c.risk_score}</div>
                      </div>
                    </div>
                  ))}
                  {selected.topCells.length === 0 && (
                    <p className="text-xs text-slate-400">No cells recorded.</p>
                  )}
                </div>

                {selected.topGaps.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 text-xs font-semibold text-slate-500">Control gap distribution</div>
                    <div className="space-y-1">
                      {selected.topGaps.map(({ gap, count }) => {
                        const max = selected.topGaps[0]?.count ?? 1;
                        return (
                          <div key={gap} className="flex items-center gap-2">
                            <span className="w-20 truncate text-[11px] capitalize text-slate-500">{gap}</span>
                            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-orange-400"
                                style={{ width: `${(count / max) * 100}%` }}
                              />
                            </div>
                            <span className="w-4 text-right text-[11px] font-semibold text-slate-600">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: HSL + proof + VELA */}
              <div className="space-y-5 p-5">
                {/* HSL readings */}
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-800">Human Signal Layer</div>
                  <div className="space-y-1.5">
                    {selected.hslReadings.map((r) => {
                      const level = hslRiskLevel(r.dimension, r.value);
                      return (
                        <div key={r.id} className="flex items-center gap-2">
                          <span className="w-32 truncate text-[11px] text-slate-500">
                            {HSL_LABELS[r.dimension] ?? r.dimension}
                          </span>
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${HSL_BAR_COLOR[level]}`}
                              style={{ width: `${r.value}%` }}
                            />
                          </div>
                          <span className="w-6 text-right text-[11px] font-semibold text-slate-600">{r.value}</span>
                          <span className={`w-16 text-[10px] font-medium ${HSL_TEXT_COLOR[level]}`}>
                            {level === "high" ? "High risk" : level === "moderate" ? "Moderate" : "Low risk"}
                          </span>
                        </div>
                      );
                    })}
                    {selected.hslReadings.length === 0 && (
                      <p className="text-[11px] text-slate-400">No HSL readings recorded.</p>
                    )}
                  </div>
                </div>

                {/* Proof coverage */}
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-800">Control proof coverage</div>
                  {selected.proofTotal > 0 ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-emerald-400"
                            style={{
                              width: `${((selected.proofTotal - selected.proofGapCount) / selected.proofTotal) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-700">
                          {selected.proofTotal - selected.proofGapCount}/{selected.proofTotal} proven
                        </span>
                      </div>
                      {selected.proofGapCount > 0 && (
                        <p className="text-[11px] text-red-600">
                          {selected.proofGapCount} control{selected.proofGapCount > 1 ? "s" : ""} missing or expired
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">No control proofs recorded.</p>
                  )}
                </div>

                {/* VELA patterns */}
                {selected.velaPatterns.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800">VELA cross-vertical patterns</span>
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-bold text-violet-700">
                        VELA
                      </span>
                    </div>
                    <div className="space-y-2">
                      {selected.velaPatterns.map((p) => (
                        <div key={p.id} className="rounded-lg border border-violet-100 bg-violet-50 p-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-violet-800">
                              {p.pattern.replace(/-/g, " ")}
                            </span>
                            <span className="ml-auto text-[11px] font-medium text-violet-600">
                              {Math.round(p.confidence * 100)}% confidence
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-violet-700">{p.summary}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {p.regulatory_refs.map((r) => (
                              <span
                                key={r}
                                className="rounded border border-violet-200 bg-white px-1.5 py-0.5 text-[10px] text-violet-500"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Engine status */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold text-slate-700">GUS engine active</span>
                    <span className="ml-auto text-slate-400">P-CLSS last run: 6h ago</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Tuned to {selected.vertical.name.toLowerCase()} hazard taxonomy · {selected.openActions} open action{selected.openActions !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Available verticals */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Available verticals — {availableVerticals.length} ready to activate
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {availableVerticals.map((v) => (
              <div
                key={v.slug}
                className="rounded-xl border border-slate-200 bg-white p-3 text-center transition hover:bg-slate-50"
              >
                <div className="mb-1 text-xl">{ICON_MAP[v.icon] ?? "🏭"}</div>
                <div className="text-xs font-medium leading-tight text-slate-500">{v.name}</div>
                <div className="mt-1.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400">
                  Available
                </div>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-400">
          GUS engines activate when a site is onboarded to that vertical. VELA observes all live engines and surfaces cross-vertical patterns automatically.
        </p>
      </div>
    </div>
  );
}
