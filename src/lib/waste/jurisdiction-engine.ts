// Jurisdiction engine for Universal Waste.
//
// Resolves the applicable UW category / inspection-frequency rule for a given
// state + category + as-of date from the `uw_jurisdiction_rules` reference table
// (WI aerosol cans eff 7/1/2025, CA state-specific categories seeded in
// migration 20260710010000). Isolated so the future 50-state expansion is a
// data-only change — no code edits required.

import { createSupabaseServerClient } from "@/lib/supabase/server";

export { isUniversalWasteEligible } from "./uw-helpers";

export interface JurisdictionRule {
  inspection_frequency_days: number;
  effective_date?: string;
  notes: string;
}

const DEFAULT_RULE: JurisdictionRule = {
  inspection_frequency_days: 7,
  notes: "Default frequency — no state-specific rule found.",
};

// Reads the most recent rule effective on/before `asOf` for the given state and
// category. Degrades to a safe default (weekly inspection) when no row matches
// or the client is unavailable, so callers never crash on a missing rule.
export async function resolveJurisdictionRule(
  state: string,
  category: string,
  asOf: Date = new Date(),
): Promise<JurisdictionRule> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return DEFAULT_RULE;
  const { data, error } = await supabase
    .from("uw_jurisdiction_rules")
    .select("inspection_frequency_days, effective_date, notes")
    .eq("jurisdiction_state", state)
    .eq("category", category)
    .lte("effective_date", asOf.toISOString().slice(0, 10))
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return DEFAULT_RULE;
  return {
    inspection_frequency_days: data.inspection_frequency_days ?? 7,
    effective_date: data.effective_date ?? undefined,
    notes: data.notes ?? DEFAULT_RULE.notes,
  };
}
