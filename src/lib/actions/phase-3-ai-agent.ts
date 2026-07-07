"use server";

// ============================================================
// Phase 3 — AI Agent Logic for the Predictive Risk Engine.
//
// Three observational/read-only capabilities on top of Phase 1's
// site_risk_scores (see 20260707050000_phase3_ai_agent.sql):
//
//   1. evaluateGatewayTrigger(siteId)
//        Compares a site's two most recent risk scores and, IF the risk band
//        crossed to a worse band OR 2+ leading indicators worsened at once,
//        logs a structured row to ai_gateway_trigger_log describing what the
//        gateway WOULD alert on. It sends NOTHING — no email, webhook, page, or
//        escalation. Actually sending alerts is Phase 4. This boundary is
//        asserted by the test suite.
//
//   2. generateSitePreventionRecommendation(siteRiskScoreId)
//        Calls the existing AI Gateway (generateStructuredJson — no new AI
//        plumbing) to write specific, actionable prevention guidance into
//        site_risk_scores.ai_recommendation_text, augmenting the templated
//        explanation_text an EHS manager already sees.
//
//   3. recordRecommendationReview(input)
//        Persists a named EHS lead's accuracy sign-off (accurate / needs_edit /
//        inaccurate + notes) to ai_recommendation_reviews so the human-review
//        gate is auditable, not a checkbox.
//
// Role mapping to this codebase's real roles (there is no "superadmin" or
// "ehs_lead" role string here):
//   • "superadmin"  → isSuperadmin() (Reliance user, tenant_id IS NULL)
//   • "ehs_lead"    → canManage() (safety_manager | ehs_manager | admin) — the
//                     same tier the Phase 1 go-live "EHS lead" step uses.
//
// Every DB path uses the service-role client and enforces tenant ownership in
// this layer (assertTenantOwnership), because service-role bypasses RLS. Under
// MOCK_MODE there is no Supabase, so the DB-backed actions return a friendly
// "runs on a connected environment" result — mirroring approveGoLiveStep.
// ============================================================

import { z } from "zod";
import {
  getServerUser,
  getServerProfileId,
  isSuperadmin,
  assertTenantOwnership,
  TenantMismatchError,
} from "@/lib/auth/session";
import { canManage, type Role } from "@/lib/constants";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { generateStructuredJson } from "@/lib/ai/provider";
import { MOCK_MODE } from "@/lib/env";
import { MOCK_PROFILES_ALL } from "@/lib/data/mock";

// Worse-is-higher band order (matches risk_score_bands: green < amber < orange < red).
const BAND_ORDER = ["green", "amber", "orange", "red"] as const;

// Human labels for indicator keys, so the AI prompt reads naturally and the
// degraded-indicator list is legible in the trigger log.
const INDICATOR_LABELS: Record<string, string> = {
  overdue_inspection: "Overdue inspections",
  expired_sds: "Expired SDS",
  missing_training: "Missing/overdue training",
  open_incident: "Recent open incidents",
  open_near_miss: "Recent open near-misses",
};

// Mock-aware role resolver — mirrors resolveCallerRole in predictive-risk-engine.ts.
// getServerUser() returns null under MOCK_MODE, so gating on it alone would
// reject every demo caller.
async function resolveCallerRole(): Promise<Role | null> {
  if (MOCK_MODE) {
    const profileId = await getServerProfileId();
    return (MOCK_PROFILES_ALL.find((p) => p.id === profileId)?.role as Role) ?? null;
  }
  const user = await getServerUser();
  return (user?.role as Role) ?? null;
}

// "EHS manager or superadmin" per the ticket → canManage() OR isSuperadmin().
async function isManagerOrSuperadmin(): Promise<boolean> {
  if (await isSuperadmin()) return true;
  const role = await resolveCallerRole();
  return !!role && canManage(role);
}

type IndicatorContribution = { count: number; weight: number; contribution: number };
type IndicatorBreakdown = Record<string, IndicatorContribution>;

interface RiskScoreRow {
  id: string;
  tenant_id: string;
  site_id: string;
  band_key: string;
  raw_score: number;
  explanation_text: string;
  indicator_breakdown: IndicatorBreakdown | null;
  score_date: string;
}

// ── 1. Gateway trigger evaluation (observation-only) ────────────────────────

const triggerInputSchema = z.object({ siteId: z.string().uuid() });
export type EvaluateGatewayTriggerInput = z.infer<typeof triggerInputSchema>;

export async function evaluateGatewayTrigger(input: EvaluateGatewayTriggerInput) {
  const parsed = triggerInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Please provide a valid site." };

  if (!(await isManagerOrSuperadmin())) {
    return { ok: false as const, error: "Only an EHS manager, admin, or Reliance superadmin can run this check." };
  }

  const client = createServiceRoleClient();
  // MOCK_MODE / no Supabase → no score history to compare, so nothing fires.
  if (!client) return { ok: true as const, triggered: false as const, reason: null };

  const { data, error } = await client
    .from("site_risk_scores")
    .select("id, tenant_id, site_id, band_key, raw_score, explanation_text, indicator_breakdown, score_date")
    .eq("site_id", parsed.data.siteId)
    .order("score_date", { ascending: false })
    .limit(2);

  if (error) return { ok: false as const, error: "Couldn't load risk scores. Please try again." };
  const scores = (data ?? []) as RiskScoreRow[];
  if (scores.length < 2) return { ok: true as const, triggered: false as const, reason: null };

  const [latest, previous] = scores;

  // A tenant manager may only evaluate their own tenant's site. A superadmin
  // (no tenant) is allowed cross-tenant. The site_id is trusted only after this.
  if (!(await isSuperadmin())) {
    try {
      await assertTenantOwnership(latest.tenant_id);
    } catch (e) {
      if (e instanceof TenantMismatchError) {
        return { ok: false as const, error: "You can only evaluate sites in your own account." };
      }
      throw e;
    }
  }

  // (a) Band crossed to a worse band?
  const crossedBand =
    BAND_ORDER.indexOf(latest.band_key as (typeof BAND_ORDER)[number]) >
    BAND_ORDER.indexOf(previous.band_key as (typeof BAND_ORDER)[number]);

  // (b) Two or more indicators degraded (contribution rose) at once?
  const latestBreakdown = latest.indicator_breakdown ?? {};
  const previousBreakdown = previous.indicator_breakdown ?? {};
  const degraded = Object.keys(latestBreakdown).filter((k) => {
    const now = latestBreakdown[k]?.contribution ?? 0;
    const before = previousBreakdown[k]?.contribution ?? 0;
    return now > before;
  });
  const multiIndicatorDegrade = degraded.length >= 2;

  if (!crossedBand && !multiIndicatorDegrade) {
    return { ok: true as const, triggered: false as const, reason: null };
  }

  const reason: "band_crossing" | "multi_indicator_degrade" = crossedBand
    ? "band_crossing"
    : "multi_indicator_degrade";

  // Log ONLY. No alert/notification/escalation call happens here — that is the
  // Phase 4 boundary the test suite guards.
  const { error: insertError } = await client.from("ai_gateway_trigger_log").insert({
    tenant_id: latest.tenant_id,
    site_id: latest.site_id,
    trigger_reason: reason,
    from_band: previous.band_key,
    to_band: latest.band_key,
    indicators_degraded: degraded,
  });
  if (insertError) return { ok: false as const, error: "Couldn't record the trigger. Please try again." };

  return { ok: true as const, triggered: true as const, reason, degraded };
}

// ── 2. AI-generated prevention recommendation ───────────────────────────────

const recommendationInputSchema = z.object({ siteRiskScoreId: z.string().uuid() });
export type GenerateRecommendationInput = z.infer<typeof recommendationInputSchema>;

const RECOMMENDATION_SCHEMA = {
  name: "prevention_recommendation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      recommendation: {
        type: "string",
        description:
          "2-4 sentences of specific, actionable prevention guidance for the site's EHS manager, grounded in the indicators driving the score. Name the concrete step(s) to take (e.g. 'Re-inspect the 3 overdue areas in Bay 2 this week'), not generic advice. Do NOT instruct anyone to page/escalate/alert — that is out of scope for this phase.",
      },
    },
    required: ["recommendation"],
  },
} as const;

const recommendationResultSchema = z.object({ recommendation: z.string().min(1) });

export async function generateSitePreventionRecommendation(input: GenerateRecommendationInput) {
  const parsed = recommendationInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Please provide a valid risk score." };

  if (!(await isManagerOrSuperadmin())) {
    return { ok: false as const, error: "Only an EHS manager, admin, or Reliance superadmin can generate recommendations." };
  }

  const client = createServiceRoleClient();
  if (!client) {
    return {
      ok: false as const,
      error: "Generating recommendations runs on a connected staging/live environment, not in demo mode.",
    };
  }

  const { data: score, error } = await client
    .from("site_risk_scores")
    .select("id, tenant_id, site_id, band_key, raw_score, explanation_text, indicator_breakdown, score_date")
    .eq("id", parsed.data.siteRiskScoreId)
    .maybeSingle();

  if (error || !score) return { ok: false as const, error: "That risk score could not be found." };
  const row = score as RiskScoreRow;

  if (!(await isSuperadmin())) {
    try {
      await assertTenantOwnership(row.tenant_id);
    } catch (e) {
      if (e instanceof TenantMismatchError) {
        return { ok: false as const, error: "You can only generate recommendations for sites in your own account." };
      }
      throw e;
    }
  }

  const breakdown = row.indicator_breakdown ?? {};
  const indicatorLines = Object.entries(breakdown)
    .filter(([, v]) => (v?.count ?? 0) > 0)
    .sort(([, a], [, b]) => (b?.contribution ?? 0) - (a?.contribution ?? 0))
    .map(([k, v]) => `- ${INDICATOR_LABELS[k] ?? k}: ${v.count} (weight ${v.weight}, contribution ${v.contribution})`)
    .join("\n");

  let aiText: string;
  try {
    const result = await generateStructuredJson({
      system:
        "You are an EHS (environment, health & safety) prevention advisor for an industrial site. " +
        "Given a site's current risk band and the leading indicators driving it, write concise, specific, " +
        "actionable prevention guidance the site's EHS manager can act on this week. Be concrete and reference " +
        "the actual indicators. Do not recommend paging, escalation, or alerting anyone — that is handled elsewhere.",
      user:
        `Current risk band: ${row.band_key} (raw score ${row.raw_score}).\n` +
        `Templated explanation currently shown: "${row.explanation_text}".\n` +
        `Leading indicators contributing to this score:\n${indicatorLines || "- (no active indicators)"}\n\n` +
        `Write the prevention recommendation.`,
      schema: RECOMMENDATION_SCHEMA,
      maxTokens: 500,
      tier: "deep",
    });
    aiText = recommendationResultSchema.parse(result.data).recommendation;
  } catch {
    return {
      ok: false as const,
      error: "Something went wrong generating a recommendation. Please try again in a moment.",
    };
  }

  const { error: updateError } = await client
    .from("site_risk_scores")
    .update({ ai_recommendation_text: aiText })
    .eq("id", row.id);
  if (updateError) return { ok: false as const, error: "The recommendation was generated but couldn't be saved. Please try again." };

  return { ok: true as const, aiRecommendationText: aiText };
}

// ── 3. Human review sign-off (auditable) ────────────────────────────────────

const reviewInputSchema = z.object({
  siteRiskScoreId: z.string().uuid(),
  recommendationText: z.string().min(1),
  reviewedBy: z.string().min(1),
  verdict: z.enum(["accurate", "inaccurate", "needs_edit"]),
  notes: z.string().max(2000).optional(),
});
export type RecordReviewInput = z.infer<typeof reviewInputSchema>;

export async function recordRecommendationReview(input: RecordReviewInput) {
  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Please check the review details and try again." };

  // "ehs_lead / superadmin" → canManage() OR isSuperadmin().
  if (!(await isManagerOrSuperadmin())) {
    return { ok: false as const, error: "Only an EHS lead (manager/admin) or Reliance superadmin can record a review." };
  }

  const client = createServiceRoleClient();
  if (!client) {
    return {
      ok: false as const,
      error: "Recording a review runs on a connected staging/live environment, not in demo mode.",
    };
  }

  // Resolve the review's tenant from the score it belongs to, and enforce
  // ownership for non-superadmin reviewers.
  const { data: score, error: scoreError } = await client
    .from("site_risk_scores")
    .select("id, tenant_id")
    .eq("id", parsed.data.siteRiskScoreId)
    .maybeSingle();
  if (scoreError || !score) return { ok: false as const, error: "That risk score could not be found." };
  const tenantId = (score as { tenant_id: string }).tenant_id;

  if (!(await isSuperadmin())) {
    try {
      await assertTenantOwnership(tenantId);
    } catch (e) {
      if (e instanceof TenantMismatchError) {
        return { ok: false as const, error: "You can only review recommendations for sites in your own account." };
      }
      throw e;
    }
  }

  const { error: insertError } = await client.from("ai_recommendation_reviews").insert({
    tenant_id: tenantId,
    site_risk_score_id: parsed.data.siteRiskScoreId,
    recommendation_text: parsed.data.recommendationText,
    reviewed_by: parsed.data.reviewedBy,
    verdict: parsed.data.verdict,
    notes: parsed.data.notes ?? null,
  });
  if (insertError) return { ok: false as const, error: "Couldn't record the review. Please try again." };

  return { ok: true as const };
}

// ── Reliability screen data (superadmin-only; cross-tenant via service-role) ──

export interface ReliabilityRiskRow {
  id: string;
  siteName: string;
  bandKey: string;
  rawScore: number;
  scoreDate: string;
  hasRecommendation: boolean;
}
export interface ReliabilityTriggerRow {
  id: string;
  siteName: string;
  triggerReason: string;
  fromBand: string | null;
  toBand: string | null;
  indicatorsDegraded: string[];
  triggeredAt: string;
}
export interface ReliabilityIndicatorRow {
  key: string;
  label: string;
  weight: number;
  active: boolean;
  updatedAt: string;
}
export interface ReliabilityReviewSummary {
  total: number;
  accurate: number;
  needsEdit: number;
  inaccurate: number;
}
export interface RiskReliabilityData {
  mock: boolean;
  scores: ReliabilityRiskRow[];
  triggerLog: ReliabilityTriggerRow[];
  indicators: ReliabilityIndicatorRow[];
  reviewSummary: ReliabilityReviewSummary;
}

const EMPTY_RELIABILITY: RiskReliabilityData = {
  mock: true,
  scores: [],
  triggerLog: [],
  indicators: [],
  reviewSummary: { total: 0, accurate: 0, needsEdit: 0, inaccurate: 0 },
};

// Reads across tenants for the Reliance "Risk Score Reliability" screen. Gated
// to superadmin — a client tenant must never reach this. Uses the service-role
// client (a superadmin has no tenant, so in_tenant() RLS would return nothing).
export async function getRiskReliabilityData(): Promise<{ ok: true; data: RiskReliabilityData } | { ok: false; error: string }> {
  if (!(await isSuperadmin())) {
    return { ok: false as const, error: "This screen is available to Reliance superadmins only." };
  }

  const client = createServiceRoleClient();
  if (!client) return { ok: true as const, data: EMPTY_RELIABILITY };

  const [scoresRes, triggersRes, indicatorsRes, reviewsRes] = await Promise.all([
    client
      .from("site_risk_scores")
      .select("id, band_key, raw_score, score_date, ai_recommendation_text, sites(name)")
      .order("score_date", { ascending: false })
      .limit(200),
    client
      .from("ai_gateway_trigger_log")
      .select("id, trigger_reason, from_band, to_band, indicators_degraded, triggered_at, sites(name)")
      .order("triggered_at", { ascending: false })
      .limit(50),
    client.from("leading_indicators").select("key, label, weight, active, updated_at").order("key", { ascending: true }),
    client.from("ai_recommendation_reviews").select("verdict").limit(1000),
  ]);

  const siteName = (s: unknown): string => {
    const rel = (s as { sites?: { name?: string } | { name?: string }[] | null }).sites;
    if (Array.isArray(rel)) return rel[0]?.name ?? "—";
    return rel?.name ?? "—";
  };

  const scores: ReliabilityRiskRow[] = (scoresRes.data ?? []).map((r) => ({
    id: r.id as string,
    siteName: siteName(r),
    bandKey: r.band_key as string,
    rawScore: Number(r.raw_score),
    scoreDate: r.score_date as string,
    hasRecommendation: !!(r as { ai_recommendation_text?: string | null }).ai_recommendation_text,
  }));

  const triggerLog: ReliabilityTriggerRow[] = (triggersRes.data ?? []).map((r) => ({
    id: r.id as string,
    siteName: siteName(r),
    triggerReason: r.trigger_reason as string,
    fromBand: (r.from_band as string | null) ?? null,
    toBand: (r.to_band as string | null) ?? null,
    indicatorsDegraded: Array.isArray(r.indicators_degraded) ? (r.indicators_degraded as string[]) : [],
    triggeredAt: r.triggered_at as string,
  }));

  const indicators: ReliabilityIndicatorRow[] = (indicatorsRes.data ?? []).map((r) => ({
    key: r.key as string,
    label: r.label as string,
    weight: Number(r.weight),
    active: !!r.active,
    updatedAt: r.updated_at as string,
  }));

  const reviewSummary = (reviewsRes.data ?? []).reduce<ReliabilityReviewSummary>(
    (acc, r) => {
      acc.total += 1;
      if (r.verdict === "accurate") acc.accurate += 1;
      else if (r.verdict === "needs_edit") acc.needsEdit += 1;
      else if (r.verdict === "inaccurate") acc.inaccurate += 1;
      return acc;
    },
    { total: 0, accurate: 0, needsEdit: 0, inaccurate: 0 },
  );

  return { ok: true as const, data: { mock: false, scores, triggerLog, indicators, reviewSummary } };
}
