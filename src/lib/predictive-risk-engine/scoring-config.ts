// ============================================================
// Predictive Risk Engine — load the live scoring configuration.
//
// scoring.ts is pure and defaults to hardcoded weights/bands. This module reads
// the EHS-tunable overrides from the database (leading_indicators.weight and
// risk_score_bands min/max) so an approved Phase 5 reweighting takes effect on
// the next recalculation without a code deploy.
//
// Returns null in MOCK_MODE, when there is no service-role client, or on any
// query error — callers pass the result straight to computeSiteRiskScore, which
// falls back to the reviewed defaults when config is undefined.
// ============================================================

import { createServiceRoleClient } from "@/lib/supabase/server";
import type {
  ScoringConfig,
  IndicatorKey,
  BandKey,
} from "@/lib/predictive-risk-engine/scoring";

export async function loadScoringConfig(): Promise<ScoringConfig | null> {
  const client = createServiceRoleClient();
  if (!client) return null;

  const [{ data: indicators, error: indErr }, { data: bands, error: bandErr }] =
    await Promise.all([
      client.from("leading_indicators").select("key, weight, active"),
      client.from("risk_score_bands").select("band_key, min_score, max_score"),
    ]);

  if (indErr || bandErr || !indicators || !bands) return null;

  const weights: Partial<Record<IndicatorKey, number>> = {};
  for (const row of indicators as {
    key: string;
    weight: number | string;
    active: boolean | null;
  }[]) {
    // An explicitly deactivated indicator contributes nothing.
    weights[row.key as IndicatorKey] =
      row.active === false ? 0 : Number(row.weight);
  }

  const parsedBands = (bands as {
    band_key: string;
    min_score: number | string;
    max_score: number | string;
  }[])
    .map((b) => ({
      key: b.band_key as BandKey,
      min: Number(b.min_score),
      max: Number(b.max_score),
    }))
    .sort((a, b) => a.min - b.min);

  if (parsedBands.length === 0) return null;

  return { weights, bands: parsedBands };
}
