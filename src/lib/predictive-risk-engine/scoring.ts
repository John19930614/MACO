// Pure scoring logic for the Predictive Risk Engine (Phase 1) — DRAFT, not
// wired into any deployed action yet. No "use server" here on purpose: every
// export from a "use server" file must be an async function (Next.js Server
// Actions constraint), and this is a synchronous, side-effect-free function —
// kept in its own module so it can be unit tested directly and imported by
// src/lib/actions/predictive-risk-engine.ts without violating that rule.

import type { Audit, Chemical, TrainingRecord, Incident } from "@/lib/types";

export const NEAR_MISS_TYPE = "near_miss";
export const RECENT_INCIDENT_WINDOW_DAYS = 90;

// Placeholder weights — MUST match (and be kept in sync with) the seeded rows
// in DRAFT_predictive_risk_engine.sql. Once the migration is applied, these
// should be read from leading_indicators instead of hardcoded.
export const INDICATOR_WEIGHTS = {
  overdue_inspection: 2.0,
  expired_sds: 1.5,
  missing_training: 1.5,
  open_incident: 2.5,
  open_near_miss: 1.0,
} as const;

export type IndicatorKey = keyof typeof INDICATOR_WEIGHTS;

const INDICATOR_LABELS: Record<IndicatorKey, { singular: string; plural: string }> = {
  overdue_inspection: { singular: "inspection is overdue", plural: "inspections are overdue" },
  expired_sds: { singular: "SDS has expired", plural: "SDS have expired" },
  missing_training: { singular: "employee has missing/overdue training", plural: "employees have missing/overdue training" },
  open_incident: { singular: "recent incident is still open", plural: "recent incidents are still open" },
  open_near_miss: { singular: "recent near-miss is still open", plural: "recent near-misses are still open" },
};

// Placeholder bands — MUST match risk_score_bands. Once applied, read from
// the DB so an EHS lead can retune cutoffs without a code deploy.
export const BANDS = [
  { key: "green", min: 0, max: 2.99 },
  { key: "amber", min: 3, max: 5.99 },
  { key: "orange", min: 6, max: 8.49 },
  { key: "red", min: 8.5, max: Infinity },
] as const;

export type BandKey = (typeof BANDS)[number]["key"];

export function bandForScore(score: number): BandKey {
  return BANDS.find((b) => score >= b.min && score <= b.max)?.key ?? "green";
}

export interface IndicatorContribution {
  count: number;
  weight: number;
  contribution: number;
}

export interface SiteRiskComputation {
  siteId: string;
  siteName: string;
  rawScore: number;
  band: BandKey;
  explanationText: string;
  indicatorBreakdown: Record<IndicatorKey, IndicatorContribution>;
}

export interface SiteRiskInputData {
  audits: Audit[];
  chemicals: Chemical[];
  trainingRecords: TrainingRecord[];
  incidents: Incident[];
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// Takes pre-fetched EHS records (already scoped to one tenant) and returns the
// computed score for ONE site. Side-effect-free — no Supabase, no auth.
export function computeSiteRiskScore(
  siteId: string,
  siteName: string,
  data: SiteRiskInputData,
): SiteRiskComputation {
  const today = new Date();
  const recentSince = daysAgo(RECENT_INCIDENT_WINDOW_DAYS);

  const overdueInspectionCount = data.audits.filter(
    (a) =>
      a.site_id === siteId &&
      (a.status === "scheduled" || a.status === "in_progress") &&
      new Date(a.scheduled_date) < today,
  ).length;

  const expiredSdsCount = data.chemicals.filter(
    (c) => c.site_id === siteId && !!c.sds_expiry && new Date(c.sds_expiry) < today,
  ).length;

  const missingTrainingCount = data.trainingRecords.filter(
    (r) => r.site_id === siteId && !!r.expiry_date && new Date(r.expiry_date) < today,
  ).length;

  const openIncidentCount = data.incidents.filter(
    (i) =>
      i.site_id === siteId &&
      i.incident_type !== NEAR_MISS_TYPE &&
      i.status !== "closed" &&
      new Date(i.occurred_at) >= recentSince,
  ).length;

  const openNearMissCount = data.incidents.filter(
    (i) =>
      i.site_id === siteId &&
      i.incident_type === NEAR_MISS_TYPE &&
      i.status !== "closed" &&
      new Date(i.occurred_at) >= recentSince,
  ).length;

  const counts: Record<IndicatorKey, number> = {
    overdue_inspection: overdueInspectionCount,
    expired_sds: expiredSdsCount,
    missing_training: missingTrainingCount,
    open_incident: openIncidentCount,
    open_near_miss: openNearMissCount,
  };

  const indicatorBreakdown = {} as Record<IndicatorKey, IndicatorContribution>;
  let rawScore = 0;
  for (const key of Object.keys(counts) as IndicatorKey[]) {
    const weight = INDICATOR_WEIGHTS[key];
    const contribution = counts[key] * weight;
    indicatorBreakdown[key] = { count: counts[key], weight, contribution };
    rawScore += contribution;
  }
  rawScore = Math.round(rawScore * 10) / 10;

  // Explanation names the top 2-3 contributing indicators with non-zero count.
  const topContributors = (Object.entries(indicatorBreakdown) as [IndicatorKey, IndicatorContribution][])
    .filter(([, v]) => v.count > 0)
    .sort(([, a], [, b]) => b.contribution - a.contribution)
    .slice(0, 3);

  const explanationText =
    topContributors.length === 0
      ? "Risk is low — no overdue inspections, expired SDS, missing training, or open incidents/near-misses at this site."
      : `Risk rose because ${topContributors
          .map(([key, v]) => `${v.count} ${v.count === 1 ? INDICATOR_LABELS[key].singular : INDICATOR_LABELS[key].plural}`)
          .join(" and ")}.`;

  return {
    siteId,
    siteName,
    rawScore,
    band: bandForScore(rawScore),
    explanationText,
    indicatorBreakdown,
  };
}
