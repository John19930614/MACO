import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Live-mode mocks for the Phase 3 server-action tests ─────────────────────
// Force live mode so role resolution goes through getServerUser (not mock
// profiles), and stub session + the service-role Supabase client + the AI
// provider. The vitest config only picks up test/**/*.test.ts — a file under
// src/lib/**/__tests__ (as the ticket suggested) would silently never run, so
// this lives here.
vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  MOCK_MODE: false,
}));

const session = vi.hoisted(() => ({
  getServerUser: vi.fn(async () => ({ role: "ehs_manager" }) as { role: string }),
  getServerProfileId: vi.fn(async () => "profile-1"),
  getEffectiveTenantId: vi.fn(async () => "tenant-A"),
  isSuperadmin: vi.fn(async () => false),
  assertTenantOwnership: vi.fn(async (t: string) => t),
}));
vi.mock("@/lib/auth/session", () => {
  class TenantMismatchError extends Error {}
  return {
    ...session,
    NIL_UUID: "00000000-0000-0000-0000-000000000000",
    TenantMismatchError,
  };
});

// In-memory stand-in for the Supabase service-role client. `writes` records
// every table written to — the Phase 4 boundary test asserts the ONLY thing a
// trigger writes is the log table (never an alerts/notifications table).
const store = vi.hoisted(() => ({
  scores: [] as Record<string, unknown>[],
  triggerInserts: [] as Record<string, unknown>[],
  reviewInserts: [] as Record<string, unknown>[],
  scoreUpdates: [] as { patch: Record<string, unknown>; col: string; val: unknown }[],
  writes: [] as string[],
}));

function scoreQuery() {
  let rows = [...store.scores];
  const api = {
    eq(col: string, val: unknown) {
      rows = rows.filter((r) => r[col] === val);
      return api;
    },
    order(col: string, opts: { ascending: boolean }) {
      rows = rows.sort((a, b) => {
        const av = a[col] as string;
        const bv = b[col] as string;
        if (av === bv) return 0;
        return opts.ascending ? (av > bv ? 1 : -1) : av < bv ? 1 : -1;
      });
      return api;
    },
    limit(n: number) {
      return Promise.resolve({ data: rows.slice(0, n), error: null });
    },
    maybeSingle() {
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    },
    then(resolve: (v: { data: unknown[]; error: null }) => unknown) {
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    },
  };
  return api;
}

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    from(table: string) {
      return {
        select() {
          return scoreQuery();
        },
        insert(payload: Record<string, unknown>) {
          store.writes.push(table);
          if (table === "ai_gateway_trigger_log") store.triggerInserts.push(payload);
          if (table === "ai_recommendation_reviews") store.reviewInserts.push(payload);
          return Promise.resolve({ error: null });
        },
        update(patch: Record<string, unknown>) {
          return {
            eq(col: string, val: unknown) {
              store.writes.push(table);
              store.scoreUpdates.push({ patch, col, val });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  }),
}));

vi.mock("@/lib/ai/provider", () => ({
  generateStructuredJson: vi.fn(async () => ({
    data: {
      recommendation:
        "Re-inspect the 2 overdue areas in Bay 2 this week and replace the expired SDS for the flagged solvents.",
    },
    model: "claude-sonnet-5",
    usage: { inputTokens: 10, outputTokens: 20 },
  })),
}));

import * as phase3 from "@/lib/actions/phase-3-ai-agent";
const { evaluateGatewayTrigger, generateSitePreventionRecommendation, recordRecommendationReview } = phase3;

const SITE_ID = "11111111-1111-4111-8111-111111111111";
const SCORE_ID = "22222222-2222-4222-8222-222222222222";

function scoreRow(o: Record<string, unknown> = {}) {
  return {
    id: "s1",
    tenant_id: "tenant-A",
    site_id: SITE_ID,
    band_key: "amber",
    raw_score: 5,
    explanation_text: "Risk rose because 1 inspection is overdue.",
    indicator_breakdown: { overdue_inspection: { count: 1, weight: 2, contribution: 2 } },
    score_date: "2026-07-02",
    ai_recommendation_text: null,
    ...o,
  };
}

beforeEach(() => {
  store.scores = [];
  store.triggerInserts = [];
  store.reviewInserts = [];
  store.scoreUpdates = [];
  store.writes = [];
  session.getServerUser.mockResolvedValue({ role: "ehs_manager" });
  session.isSuperadmin.mockResolvedValue(false);
  session.getEffectiveTenantId.mockResolvedValue("tenant-A");
  session.assertTenantOwnership.mockImplementation(async (t: string) => t);
});

describe("evaluateGatewayTrigger (observation-only)", () => {
  it("does not trigger (or log) when the band is unchanged and fewer than 2 indicators degrade", async () => {
    store.scores = [
      scoreRow({ id: "s2", band_key: "amber", score_date: "2026-07-02", indicator_breakdown: { overdue_inspection: { count: 1, weight: 2, contribution: 2 } } }),
      scoreRow({ id: "s1", band_key: "amber", score_date: "2026-07-01", indicator_breakdown: { overdue_inspection: { count: 1, weight: 2, contribution: 2 } } }),
    ];
    const res = await evaluateGatewayTrigger({ siteId: SITE_ID });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.triggered).toBe(false);
    expect(store.triggerInserts).toHaveLength(0);
    expect(store.writes).toHaveLength(0);
  });

  it("triggers and logs one row on a worsening band crossing (amber → orange)", async () => {
    store.scores = [
      scoreRow({ id: "s2", band_key: "orange", score_date: "2026-07-02" }),
      scoreRow({ id: "s1", band_key: "amber", score_date: "2026-07-01" }),
    ];
    const res = await evaluateGatewayTrigger({ siteId: SITE_ID });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.triggered && res.reason).toBe("band_crossing");
    expect(store.triggerInserts).toHaveLength(1);
    expect(store.triggerInserts[0]).toMatchObject({
      trigger_reason: "band_crossing",
      from_band: "amber",
      to_band: "orange",
      site_id: SITE_ID,
      tenant_id: "tenant-A",
    });
  });

  it("triggers and logs on 2+ simultaneous indicator degradation (same band)", async () => {
    store.scores = [
      scoreRow({
        id: "s2",
        band_key: "amber",
        score_date: "2026-07-02",
        indicator_breakdown: {
          overdue_inspection: { count: 1, weight: 2, contribution: 2 },
          expired_sds: { count: 1, weight: 1.5, contribution: 1.5 },
        },
      }),
      scoreRow({
        id: "s1",
        band_key: "amber",
        score_date: "2026-07-01",
        indicator_breakdown: {
          overdue_inspection: { count: 0, weight: 2, contribution: 0 },
          expired_sds: { count: 0, weight: 1.5, contribution: 0 },
        },
      }),
    ];
    const res = await evaluateGatewayTrigger({ siteId: SITE_ID });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.triggered && res.reason).toBe("multi_indicator_degrade");
    expect(store.triggerInserts).toHaveLength(1);
    expect((store.triggerInserts[0].indicators_degraded as string[]).sort()).toEqual(["expired_sds", "overdue_inspection"]);
  });

  it("returns triggered:false when there is only one score to compare", async () => {
    store.scores = [scoreRow({ id: "s1", score_date: "2026-07-02" })];
    const res = await evaluateGatewayTrigger({ siteId: SITE_ID });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.triggered).toBe(false);
    expect(store.writes).toHaveLength(0);
  });

  it("keeps the Phase 4 boundary: a trigger writes ONLY the log table, and the module exposes no alert/escalation function", async () => {
    store.scores = [
      scoreRow({ id: "s2", band_key: "red", score_date: "2026-07-02" }),
      scoreRow({ id: "s1", band_key: "amber", score_date: "2026-07-01" }),
    ];
    await evaluateGatewayTrigger({ siteId: SITE_ID });
    // The only side effect is the log insert — no notifications/alerts/escalations table touched.
    expect(store.writes).toEqual(["ai_gateway_trigger_log"]);
    // Structural guarantee: nothing in this module is an alert/escalation sender.
    const exportNames = Object.keys(phase3).join(" ").toLowerCase();
    expect(exportNames).not.toMatch(/alert|escalat|notify|paging|\bpage\b|email|webhook|sms/);
  });
});

describe("generateSitePreventionRecommendation (role-gated AI write)", () => {
  it("writes ai_recommendation_text for a manager and returns it", async () => {
    store.scores = [scoreRow({ id: SCORE_ID })];
    const res = await generateSitePreventionRecommendation({ siteRiskScoreId: SCORE_ID });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.aiRecommendationText.length).toBeGreaterThan(0);
    expect(store.scoreUpdates).toHaveLength(1);
    expect(store.scoreUpdates[0].col).toBe("id");
    expect(store.scoreUpdates[0].val).toBe(SCORE_ID);
    expect(store.scoreUpdates[0].patch).toHaveProperty("ai_recommendation_text");
  });

  it("rejects non-manager / non-superadmin roles and writes nothing", async () => {
    session.getServerUser.mockResolvedValue({ role: "field_officer" });
    store.scores = [scoreRow({ id: SCORE_ID })];
    const res = await generateSitePreventionRecommendation({ siteRiskScoreId: SCORE_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/EHS manager/i);
    expect(store.scoreUpdates).toHaveLength(0);
  });

  it("produced recommendation stays within scope (no paging/escalation language) — fixture accuracy proxy", async () => {
    // The real acceptance gate is the human EHS-lead review documented in
    // docs/phase-3-ai-agent.md; this asserts the generated text contract:
    // non-empty and free of Phase-4 escalation instructions.
    store.scores = [scoreRow({ id: SCORE_ID })];
    const res = await generateSitePreventionRecommendation({ siteRiskScoreId: SCORE_ID });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.aiRecommendationText).not.toMatch(/\b(page|escalate|alert)\b/i);
      expect(res.aiRecommendationText).toMatch(/inspect|replace|review|check|verify|week/i);
    }
  });
});

describe("recordRecommendationReview (EHS-lead sign-off)", () => {
  it("persists the verdict, named reviewer, and tenant for a manager", async () => {
    store.scores = [scoreRow({ id: SCORE_ID, tenant_id: "tenant-A" })];
    const res = await recordRecommendationReview({
      siteRiskScoreId: SCORE_ID,
      recommendationText: "Re-inspect Bay 2.",
      reviewedBy: "Sarah Chen",
      verdict: "accurate",
      notes: "Matches the overdue inspections on site.",
    });
    expect(res.ok).toBe(true);
    expect(store.reviewInserts).toHaveLength(1);
    expect(store.reviewInserts[0]).toMatchObject({
      site_risk_score_id: SCORE_ID,
      reviewed_by: "Sarah Chen",
      verdict: "accurate",
      tenant_id: "tenant-A",
    });
  });

  it("rejects non ehs_lead/superadmin roles and persists nothing", async () => {
    session.getServerUser.mockResolvedValue({ role: "viewer" });
    store.scores = [scoreRow({ id: SCORE_ID })];
    const res = await recordRecommendationReview({
      siteRiskScoreId: SCORE_ID,
      recommendationText: "x",
      reviewedBy: "Tom Reed",
      verdict: "accurate",
    });
    expect(res.ok).toBe(false);
    expect(store.reviewInserts).toHaveLength(0);
  });

  it("rejects an invalid verdict via zod before any write", async () => {
    store.scores = [scoreRow({ id: SCORE_ID })];
    const res = await recordRecommendationReview({
      siteRiskScoreId: SCORE_ID,
      recommendationText: "x",
      reviewedBy: "Sarah Chen",
      verdict: "totally_fine" as never,
    });
    expect(res.ok).toBe(false);
    expect(store.reviewInserts).toHaveLength(0);
  });
});
