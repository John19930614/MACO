"use server";

// ============================================================
// DRAFT — NOT WIRED, NOT DEPLOYED. Predictive Risk Engine (Phase 1).
//
// Reads existing EHS data (audits, chemical_inventory SDS dates, training
// records, incidents) and computes a per-site composite risk score. Requires
// the DRAFT_predictive_risk_engine.sql migration to be reviewed, approved,
// and applied before this can run against a real leading_indicators /
// risk_score_bands / site_risk_scores schema.
//
// Explicitly out of scope for this phase (do not add here without a separate
// sign-off): AI Gateway calls, auto-escalation/paging, retraining loops. This
// module is invoked ONLY by an approved nightly scheduler or an admin/EHS
// manager clicking "Recalculate now" — never on page load, never as a side
// effect of another action.
// ============================================================

import { z } from "zod";
import { getEffectiveTenantId, getServerUser, getServerProfileId } from "@/lib/auth/session";
import { canManage, type Role } from "@/lib/constants";
import { MOCK_MODE } from "@/lib/env";
import { MOCK_PROFILES_ALL } from "@/lib/data/mock";
import { getSites } from "@/lib/data/repo";
import { getAudits, getChemicals, getTrainingRecords, getIncidents } from "@/lib/data/ehsRepo";
import { computeSiteRiskScore } from "@/lib/predictive-risk-engine/scoring";
// import { createSupabaseServerClient } from "@/lib/supabase/server"; // needed once site_risk_scores exists

const RecalculateInputSchema = z.object({
  siteId: z.string().uuid().optional(), // omit to recalculate every site for the caller's tenant
  scoreDate: z.string().date().optional(), // defaults to today; used for backfill/testing
});

export type RecalculateInput = z.infer<typeof RecalculateInputSchema>;

// computeSiteRiskScore is pure (no Supabase/auth) and lives in
// @/lib/predictive-risk-engine/scoring — NOT in this file. Every export from
// a "use server" file must be an async function (Next.js Server Actions
// constraint), and that function is synchronous, so it's imported here rather
// than defined inline. See that module for the weights/bands and
// predictive-risk-engine.test.ts for its unit tests.

// getServerUser() unconditionally returns null under MOCK_MODE (it's built for
// a real Supabase session) — so gating on it alone would reject every caller
// in the mock/demo environment. Mirrors the MOCK_MODE branch getCtx() uses
// (src/lib/actions/ehs-shared.ts) to resolve identity from mock data instead.
// NOTE: this resolves the mock EHS-data identity (MOCK_PROFILES_ALL, the same
// source getCtx()/ehsRepo use), which is a separate id namespace from the
// LeftNav's cosmetic demo-persona switcher (DEMO_USERS in
// @/lib/context/demo-user) — they happen to share ids for the seeded "Sarah
// Chen" persona, but aren't guaranteed to for every demo profile.
async function resolveCallerRole(): Promise<Role | null> {
  if (MOCK_MODE) {
    const profileId = await getServerProfileId();
    return (MOCK_PROFILES_ALL.find((p) => p.id === profileId)?.role as Role) ?? null;
  }
  const user = await getServerUser();
  return (user?.role as Role) ?? null;
}

export async function recalculateSiteRiskScores(input: RecalculateInput) {
  const parsed = RecalculateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Please check the highlighted fields." };
  }

  const role = await resolveCallerRole();
  if (!role || !canManage(role)) {
    return { ok: false as const, error: "Only an EHS manager or admin can recalculate risk scores." };
  }

  const tenantId = await getEffectiveTenantId();
  const [allSites, audits, chemicals, trainingRecords, incidents] = await Promise.all([
    getSites(),
    getAudits(tenantId),
    getChemicals(tenantId),
    getTrainingRecords(tenantId),
    getIncidents(tenantId),
  ]);

  const targetSites = parsed.data.siteId
    ? allSites.filter((s) => s.id === parsed.data.siteId && s.tenant_id === tenantId)
    : allSites.filter((s) => s.tenant_id === tenantId);

  const results = targetSites.map((site) =>
    computeSiteRiskScore(site.id, site.name, { audits, chemicals, trainingRecords, incidents }),
  );

  // NOT executed until DRAFT_predictive_risk_engine.sql is approved and applied:
  //
  // const client = await createSupabaseServerClient();
  // for (const r of results) {
  //   await client.from("site_risk_scores").upsert({
  //     tenant_id: tenantId,
  //     site_id: r.siteId,
  //     score_date: parsed.data.scoreDate ?? new Date().toISOString().slice(0, 10),
  //     raw_score: r.rawScore,
  //     band_key: r.band,
  //     explanation_text: r.explanationText,
  //     indicator_breakdown: r.indicatorBreakdown,
  //   }, { onConflict: "site_id,score_date" });
  // }
  //
  // No downstream alert, escalation, or AI Gateway call fires from this
  // function in Phase 1 — it only computes and (once approved) persists scores.

  return { ok: true as const, updated: results.length, results };
}

export async function getSiteRiskScores(_siteId?: string) {
  // DRAFT — read-only fetch for the dashboard. Returns [] until
  // site_risk_scores exists; once the migration is applied, scope by
  // in_tenant(tenant_id) RLS (see DRAFT_predictive_risk_engine.sql) and
  // optionally filter by site_id, ordered by score_date desc.
  //
  // const client = await createSupabaseServerClient();
  // let query = client.from("site_risk_scores").select("*").order("score_date", { ascending: false });
  // if (siteId) query = query.eq("site_id", siteId);
  // const { data } = await query;
  // return data ?? [];
  return [];
}
