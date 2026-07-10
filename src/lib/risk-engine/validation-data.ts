// ============================================================
// Predictive Risk Engine — Phase 5 historical validation dataset loader.
//
// Builds the dataset consumed by validation.ts (and the reweighting proposal
// generator) from data that ALREADY exists in the platform:
//   • predicted bands over time  → public.site_risk_scores (score_date, band_key)
//   • actual incidents           → the incidents the engine already scores on
//
// There is intentionally NO separate risk_score_snapshots table — each persisted
// site_risk_scores row already IS a point-in-time prediction. For each such row
// we open a follow-up window [score_date, score_date + windowDays] and record
// whether an incident occurred at that site inside it.
//
// Runs only where a service-role client is available (a connected staging/live
// environment). Under MOCK_MODE — including the vitest run — createServiceRole-
// Client() returns null and this returns an EMPTY dataset. The unit tests
// exercise the math in validation.ts with synthetic fixtures instead; the
// against-real-data assertions live in a separately gated integration test.
//
// Every query is best-effort: a missing table or a query error degrades to an
// empty result (with a `warning`) rather than throwing, so the live validation
// test fails loudly as "insufficient data (n <= 30)" instead of crashing.
// ============================================================

import { createServiceRoleClient } from "@/lib/supabase/server";
import type { BandKey } from "@/lib/predictive-risk-engine/scoring";

export type PredictedBand = BandKey; // "green" | "amber" | "orange" | "red"

export interface ValidationRow {
  siteId: string;
  predictedBand: PredictedBand;
  hadIncidentInWindow: boolean;
  windowStart: string;
  windowEnd: string;
}

export interface HistoricalValidationDataset {
  rows: ValidationRow[];
  fpTolerance: number;
  /** Set when the dataset could not be fully loaded (missing table, query error,
   *  or mock mode). Surfaced so callers can explain an empty/insufficient set. */
  warning?: string;
}

// Days after a prediction within which a subsequent incident counts as the
// prediction "coming true". Deliberately conservative — an orange/red band that
// isn't followed by an incident inside this window is treated as a false alarm.
export const DEFAULT_INCIDENT_WINDOW_DAYS = 30;
export const DEFAULT_FP_TOLERANCE = 0.15;

interface LoadOpts {
  lookbackDays: number;
  windowDays?: number;
}

export async function loadHistoricalValidationDataset(
  opts: LoadOpts,
): Promise<HistoricalValidationDataset> {
  const windowDays = opts.windowDays ?? DEFAULT_INCIDENT_WINDOW_DAYS;
  const client = createServiceRoleClient();

  // Mock mode / no service-role key: no real history to validate against.
  if (!client) {
    return {
      rows: [],
      fpTolerance: DEFAULT_FP_TOLERANCE,
      warning:
        "No connected database — validation runs only against a staging/live environment with real history.",
    };
  }

  const since = new Date(
    Date.now() - opts.lookbackDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const sinceDate = since.slice(0, 10);

  const fpTolerance = await loadFpTolerance(client);

  // Predicted bands over time.
  const { data: scores, error: scoreErr } = await client
    .from("site_risk_scores")
    .select("site_id, band_key, score_date")
    .gte("score_date", sinceDate);

  if (scoreErr) {
    return {
      rows: [],
      fpTolerance,
      warning: `Could not read site_risk_scores: ${scoreErr.message}`,
    };
  }

  // Actual incidents. Best-effort: if the incidents table isn't reachable we
  // still return the (all-false) rows so the test reports insufficient signal.
  let incidents: { site_id: string; occurred_at: string }[] = [];
  const { data: incData, error: incErr } = await client
    .from("incidents")
    .select("site_id, occurred_at")
    .gte("occurred_at", since);
  if (!incErr && incData) {
    incidents = incData as { site_id: string; occurred_at: string }[];
  }

  // Index incidents by site for an O(scores × siteIncidents) window check.
  const incidentsBySite = new Map<string, number[]>();
  for (const i of incidents) {
    if (!i.site_id || !i.occurred_at) continue;
    const t = new Date(i.occurred_at).getTime();
    if (Number.isNaN(t)) continue;
    const arr = incidentsBySite.get(i.site_id);
    if (arr) arr.push(t);
    else incidentsBySite.set(i.site_id, [t]);
  }

  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const rows: ValidationRow[] = (scores ?? []).map((s) => {
    const start = new Date(`${s.score_date}T00:00:00.000Z`).getTime();
    const end = start + windowMs;
    const siteIncidents = incidentsBySite.get(s.site_id) ?? [];
    const hadIncidentInWindow = siteIncidents.some((t) => t >= start && t <= end);
    return {
      siteId: s.site_id as string,
      predictedBand: s.band_key as PredictedBand,
      hadIncidentInWindow,
      windowStart: new Date(start).toISOString(),
      windowEnd: new Date(end).toISOString(),
    };
  });

  return {
    rows,
    fpTolerance,
    warning: incErr
      ? `Incidents unavailable (${incErr.message}) — treated every period as no-incident.`
      : undefined,
  };
}

async function loadFpTolerance(
  client: NonNullable<ReturnType<typeof createServiceRoleClient>>,
): Promise<number> {
  const { data, error } = await client
    .from("risk_model_validation_runs")
    .select("fp_tolerance")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data || data.fp_tolerance == null) return DEFAULT_FP_TOLERANCE;
  return Number(data.fp_tolerance);
}
