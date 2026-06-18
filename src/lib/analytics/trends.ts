/**
 * Trends analytics (pure, deterministic, testable). Aggregates across ALL
 * Safety Cells to surface patterns over time and across the hazard taxonomy,
 * plus cross-platform (cross-vertical) comparison — the system-wide view.
 */
import type { SafetyCell, ControlProof, SafetyAction, Site } from "@/lib/types";
import { SEVERITIES, type Severity } from "@/lib/constants";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const GAP = new Set(["missing", "weak_proof", "expired", "conflicting"]);

export interface WeekBucket {
  weekStart: string;
  label: string;
  counts: Record<Severity, number>;
  total: number;
}

/** Weekly buckets from the earliest to the latest cell, stacked by severity. */
export function timelineByWeek(cells: SafetyCell[]): WeekBucket[] {
  if (cells.length === 0) return [];
  const times = cells.map((c) => new Date(c.created_at).getTime());
  const min = Math.min(...times);
  const max = Math.max(...times);
  const buckets: WeekBucket[] = [];
  for (let t = min; t <= max + WEEK; t += WEEK) {
    buckets.push({
      weekStart: new Date(t).toISOString(),
      label: new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      counts: { low: 0, medium: 0, high: 0, critical: 0 },
      total: 0,
    });
  }
  for (const c of cells) {
    const idx = Math.floor((new Date(c.created_at).getTime() - min) / WEEK);
    const b = buckets[idx];
    if (b) {
      b.counts[c.severity] += 1;
      b.total += 1;
    }
  }
  return buckets;
}

export interface Slice {
  label: string;
  count: number;
}

/** Generic distribution by a string key, sorted descending. */
export function distribution(cells: SafetyCell[], keyFn: (c: SafetyCell) => string): Slice[] {
  const m = new Map<string, number>();
  for (const c of cells) {
    const k = keyFn(c) || "unknown";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export function severityMix(cells: SafetyCell[]): Record<Severity, number> {
  const out: Record<Severity, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const c of cells) out[c.severity] += 1;
  return out;
}

export interface VerticalRow {
  vertical: string;
  count: number;
  avgRisk: number;
  pctHigh: number;
  pctOpen: number;
}

/** Cross-platform comparison — one row per vertical. */
export function byVertical(cells: SafetyCell[], sites: Site[]): VerticalRow[] {
  const vBySite = new Map(sites.map((s) => [s.id, s.vertical]));
  const groups = new Map<string, SafetyCell[]>();
  for (const c of cells) {
    const v = vBySite.get(c.site_id) ?? "unknown";
    const arr = groups.get(v);
    if (arr) arr.push(c);
    else groups.set(v, [c]);
  }
  return [...groups.entries()]
    .map(([vertical, cs]) => ({
      vertical,
      count: cs.length,
      avgRisk: Math.round(cs.reduce((n, c) => n + c.risk_score, 0) / cs.length),
      pctHigh: Math.round((cs.filter((c) => c.severity === "high" || c.severity === "critical").length / cs.length) * 100),
      pctOpen: Math.round((cs.filter((c) => c.status !== "closed").length / cs.length) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

export interface Kpis {
  total: number;
  open: number;
  highOpen: number;
  gapRate: number;
  actionClosure: number;
  closedWithProof: number;
}

export function kpis(cells: SafetyCell[], actions: SafetyAction[], proofs: ControlProof[]): Kpis {
  const open = cells.filter((c) => c.status !== "closed").length;
  const highOpen = cells.filter((c) => c.status !== "closed" && (c.severity === "high" || c.severity === "critical")).length;
  const gap = proofs.filter((p) => GAP.has(p.status)).length;
  const closedActions = actions.filter((a) => a.status === "closed").length;
  return {
    total: cells.length,
    open,
    highOpen,
    gapRate: proofs.length ? Math.round((gap / proofs.length) * 100) : 0,
    actionClosure: actions.length ? Math.round((closedActions / actions.length) * 100) : 0,
    closedWithProof: actions.filter((a) => a.closed_with_proof).length,
  };
}

export const SEVERITY_ORDER = SEVERITIES;
