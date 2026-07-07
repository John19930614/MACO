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
import {
  getEffectiveTenantId,
  getServerUser,
  getServerProfileId,
  isSuperadmin,
  assertTenantOwnership,
  NIL_UUID,
} from "@/lib/auth/session";
import { canManage, type Role } from "@/lib/constants";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { MOCK_MODE } from "@/lib/env";
import { MOCK_PROFILES_ALL } from "@/lib/data/mock";
import { getSites } from "@/lib/data/repo";
import { getAudits, getChemicals, getTrainingRecords, getIncidents } from "@/lib/data/ehsRepo";
import { computeSiteRiskScore } from "@/lib/predictive-risk-engine/scoring";
import { evaluateGatewayTrigger } from "./phase-3-ai-agent";

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

  // Persist scores. The service-role client bypasses RLS (site_risk_scores has
  // no client insert policy by design), so tenant ownership is enforced HERE.
  // Under MOCK_MODE createServiceRoleClient() returns null → we skip persistence
  // and return the freshly computed results (shown on the dashboard but not
  // durable across a reload), preserving the demo experience. Superadmins have
  // no tenant of their own, so there's nothing for them to persist here.
  const client = createServiceRoleClient();
  if (client && tenantId !== NIL_UUID) {
    await assertTenantOwnership(tenantId);
    const scoreDate = parsed.data.scoreDate ?? new Date().toISOString().slice(0, 10);
    const { error: upsertError } = await client.from("site_risk_scores").upsert(
      results.map((r) => ({
        tenant_id: tenantId,
        site_id: r.siteId,
        score_date: scoreDate,
        raw_score: r.rawScore,
        band_key: r.band,
        explanation_text: r.explanationText,
        indicator_breakdown: r.indicatorBreakdown,
      })),
      { onConflict: "site_id,score_date" },
    );
    if (upsertError) {
      return { ok: false as const, error: "Scores were calculated but couldn't be saved. Please try again." };
    }

    // Phase 3 (observation-only): after persisting, check each site for a
    // gateway trigger condition (band crossing / 2+ indicators degrading) and
    // log it to ai_gateway_trigger_log. This NEVER sends an alert or escalation
    // — that's Phase 4. Best-effort and non-fatal: a logging hiccup must not
    // fail a recalculation.
    try {
      await Promise.all(results.map((r) => evaluateGatewayTrigger({ siteId: r.siteId })));
    } catch {
      // swallow — trigger logging is observational and must not break recalc
    }
  }

  return { ok: true as const, updated: results.length, results };
}

// ── Go-live gate (Preview mode vs Live) ─────────────────────────────────────
// Backs the Preview/Live badge, the one-time trust banner, and the two-person
// sign-off panel. State lives in public.predictive_risk_go_live (one row per
// tenant, see 20260707040000_predictive_risk_go_live_signoff.sql). Reads/writes
// go through the service-role client and enforce role/tenant in this layer —
// mirroring how site_risk_scores writes work — because a Reliance superadmin
// (tenant_id IS NULL) can't satisfy the table's in_tenant() RLS policy.

export type GoLiveStatus = {
  status: "preview" | "live";
  ehs_lead_approved_at: string | null;
  superadmin_approved_at: string | null;
};

const DEFAULT_GO_LIVE: GoLiveStatus = {
  status: "preview",
  ehs_lead_approved_at: null,
  superadmin_approved_at: null,
};

export async function getGoLiveStatus() {
  // MOCK_MODE has no Supabase — the dashboard renders in Preview and the
  // sign-off panel is informational only (approveGoLiveStep is a no-op there).
  if (MOCK_MODE) {
    return { ok: true as const, data: DEFAULT_GO_LIVE };
  }

  const tenantId = await getEffectiveTenantId();
  const client = createServiceRoleClient();
  if (!client) return { ok: false as const, error: "Couldn't load go-live status. Please try again." };
  const { data, error } = await client
    .from("predictive_risk_go_live")
    .select("status, ehs_lead_approved_at, superadmin_approved_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: "Couldn't load go-live status. Please try again." };
  }
  return { ok: true as const, data: (data as GoLiveStatus | null) ?? DEFAULT_GO_LIVE };
}

// Records one of the two required approvals, then flips status to 'live' only
// once BOTH are present. `tenantId` is honored ONLY for the superadmin step
// (a superadmin has no tenant of their own); the ehs_lead step always derives
// the tenant from the caller's session and never trusts a client-supplied id.
export async function approveGoLiveStep(
  step: "ehs_lead" | "superadmin",
  tenantId?: string,
) {
  if (MOCK_MODE) {
    return {
      ok: false as const,
      error: "Sign-off runs on a connected staging/live environment, not in demo mode.",
    };
  }

  const approverId = await getServerProfileId();

  let targetTenantId: string;
  if (step === "superadmin") {
    if (!(await isSuperadmin())) {
      return { ok: false as const, error: "Only a Reliance superadmin can complete this step." };
    }
    if (!tenantId) {
      return { ok: false as const, error: "Select which tenant to approve before signing off." };
    }
    targetTenantId = tenantId; // honored because isSuperadmin() passed above
  } else {
    const user = await getServerUser();
    const role = (user?.role as Role) ?? null;
    if (!role || !canManage(role)) {
      return { ok: false as const, error: "Only an EHS lead (manager) can complete this step." };
    }
    targetTenantId = await getEffectiveTenantId();
  }

  const client = createServiceRoleClient();
  if (!client) return { ok: false as const, error: "Couldn't save approval. Please try again." };
  const nowIso = new Date().toISOString();
  const approvalCols =
    step === "ehs_lead"
      ? { ehs_lead_approved_at: nowIso, ehs_lead_approved_by: approverId }
      : { superadmin_approved_at: nowIso, superadmin_approved_by: approverId };

  const { error: upsertError } = await client
    .from("predictive_risk_go_live")
    .upsert({ tenant_id: targetTenantId, updated_at: nowIso, ...approvalCols }, { onConflict: "tenant_id" });

  if (upsertError) {
    return { ok: false as const, error: "Couldn't save approval. Please try again." };
  }

  const { data: row } = await client
    .from("predictive_risk_go_live")
    .select("ehs_lead_approved_at, superadmin_approved_at, status")
    .eq("tenant_id", targetTenantId)
    .maybeSingle();

  let status: "preview" | "live" = (row?.status as "preview" | "live") ?? "preview";
  if (row?.ehs_lead_approved_at && row?.superadmin_approved_at && status !== "live") {
    await client
      .from("predictive_risk_go_live")
      .update({ status: "live", updated_at: new Date().toISOString() })
      .eq("tenant_id", targetTenantId);
    status = "live";
  }

  return { ok: true as const, status };
}

export interface SiteRiskScoreRow {
  id: string; // site_risk_scores.id — needed to attach an AI recommendation/review
  siteId: string;
  siteName: string;
  score: number;
  band: string;
  explanation: string;
  aiRecommendation: string | null;
  updatedAt: string | null;
}

// Read-only fetch for the dashboard: the LATEST persisted score per site,
// scoped to the caller's tenant. Returns [] under MOCK_MODE (no Supabase) — the
// page then shows freshly computed results from "Refresh risk scores" instead.
export async function getSiteRiskScores(siteId?: string): Promise<SiteRiskScoreRow[]> {
  const client = createServiceRoleClient();
  if (!client) return [];

  const tenantId = await getEffectiveTenantId();
  if (tenantId === NIL_UUID) return [];

  let query = client
    .from("site_risk_scores")
    .select("id, site_id, band_key, raw_score, explanation_text, ai_recommendation_text, score_date, created_at, sites(name)")
    .eq("tenant_id", tenantId)
    .order("score_date", { ascending: false })
    .limit(500);
  if (siteId) query = query.eq("site_id", siteId);

  const { data, error } = await query;
  if (error || !data) return [];

  // Keep only the most recent score per site (rows are already score_date desc).
  const seen = new Set<string>();
  const rows: SiteRiskScoreRow[] = [];
  for (const r of data) {
    const sid = r.site_id as string;
    if (seen.has(sid)) continue;
    seen.add(sid);
    const rel = (r as { sites?: { name?: string } | { name?: string }[] | null }).sites;
    const name = Array.isArray(rel) ? rel[0]?.name : rel?.name;
    rows.push({
      id: r.id as string,
      siteId: sid,
      siteName: name ?? "Unknown site",
      score: Number(r.raw_score),
      band: r.band_key as string,
      explanation: r.explanation_text as string,
      aiRecommendation: (r.ai_recommendation_text as string | null) ?? null,
      updatedAt: (r.created_at as string | null) ?? null,
    });
  }
  return rows;
}
