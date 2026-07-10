import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

// ── Live-mode mocks for the server-action tests ─────────────────────────────
// Force live mode (so role resolution goes through getServerUser, not mock
// profiles) and stub session + the service-role Supabase client. The pure
// computeSiteRiskScore tests below don't touch any of this.
vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  MOCK_MODE: false,
}));

const session = vi.hoisted(() => ({
  getServerUser: vi.fn(),
  getServerProfileId: vi.fn(async () => "approver-1"),
  getEffectiveTenantId: vi.fn(async () => "tenant-A"),
  isSuperadmin: vi.fn(async () => false),
}));
vi.mock("@/lib/auth/session", () => session);

// In-memory stand-in for public.predictive_risk_go_live, keyed by tenant_id.
// Mirrors upsert(onConflict) merge + partial update semantics.
const db = vi.hoisted(() => ({ rows: new Map<string, Record<string, unknown>>() }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    from() {
      return {
        upsert(payload: Record<string, unknown>) {
          const key = payload.tenant_id as string;
          db.rows.set(key, { status: "preview", ...(db.rows.get(key) ?? {}), ...payload });
          return Promise.resolve({ error: null });
        },
        select() {
          return {
            eq(_col: string, val: string) {
              return { maybeSingle: () => Promise.resolve({ data: db.rows.get(val) ?? null, error: null }) };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          return {
            eq(_col: string, val: string) {
              const existing = db.rows.get(val);
              if (existing) db.rows.set(val, { ...existing, ...patch });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  }),
}));

import { computeSiteRiskScore } from "@/lib/predictive-risk-engine/scoring";
import { recalculateSiteRiskScores, approveGoLiveStep } from "@/lib/actions/predictive-risk-engine";
import { computeBandIncidentCorrelation, computeFalsePositiveRate } from "@/lib/risk-engine/validation";
import {
  loadHistoricalValidationDataset,
  type HistoricalValidationDataset,
  type ValidationRow,
  type PredictedBand,
} from "@/lib/risk-engine/validation-data";
import type { Audit, Chemical, TrainingRecord, Incident } from "@/lib/types";

// computeSiteRiskScore is pure (no Supabase/auth), so it's exercised directly
// with fixtures below. The vitest config only picks up test/**/*.test.ts — a
// file under src/lib/**/__tests__ would silently never run, so this lives here.

const SITE = "site-1";
const OTHER_SITE = "site-2";
const TENANT = "tenant-1";
const TODAY = new Date();
const YESTERDAY = new Date(TODAY.getTime() - 24 * 60 * 60 * 1000).toISOString();
const TOMORROW = new Date(TODAY.getTime() + 24 * 60 * 60 * 1000).toISOString();
const RECENT = new Date(TODAY.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
const STALE = new Date(TODAY.getTime() - 200 * 24 * 60 * 60 * 1000).toISOString();

function audit(o: Partial<Audit> = {}): Audit {
  return {
    id: "a1", tenant_id: TENANT, site_id: SITE, title: "Audit",
    type: "internal", scheduled_date: YESTERDAY, completed_date: null,
    status: "scheduled", lead_auditor_id: null, scope: null, notes: null,
    created_at: YESTERDAY, updated_at: YESTERDAY, ...o,
  };
}

function chemical(o: Partial<Chemical> = {}): Chemical {
  return {
    id: "c1", tenant_id: TENANT, site_id: SITE, name: "Acetone",
    cas_number: null, un_number: null, chemical_formula: null, ghs_classes: [],
    quantity: 1, unit: "L", storage_location: "Cabinet A", sds_url: "https://example.com/sds.pdf",
    sds_expiry: YESTERDAY, hazard_statements: [], precautionary_statements: [],
    is_scheduled: false, schedule_ref: null, supplier: null, date_received: null,
    status: "active", owner_id: null, created_by: "u1", created_at: YESTERDAY,
    updated_at: YESTERDAY, ...o,
  };
}

function trainingRecord(o: Partial<TrainingRecord> = {}): TrainingRecord {
  return {
    id: "t1", tenant_id: TENANT, site_id: SITE, profile_id: "p1", course_id: "course1",
    completed_date: STALE, expiry_date: YESTERDAY, score: null, passed: true,
    delivery_method: "classroom", instructor_id: null, notes: null,
    created_at: STALE, ...o,
  };
}

function incident(o: Partial<Incident> = {}): Incident {
  return {
    id: "i1", tenant_id: TENANT, site_id: SITE, title: "Incident", description: "",
    incident_type: "first_aid", severity: "low", occurred_at: RECENT, location: "Floor 1",
    injured_party: null, injuries_description: null, immediate_actions: null, root_cause: null,
    reported_by: "u1", owner_id: null, status: "reported", lost_time_days: null,
    medical_treatment_required: false, regulatory_reportable: false, regulatory_report_date: null,
    created_at: RECENT, updated_at: RECENT, ...o,
  };
}

describe("computeSiteRiskScore", () => {
  it("scores a clean site as green with a low-risk explanation", () => {
    const result = computeSiteRiskScore(SITE, "Main Plant", {
      audits: [audit({ status: "completed", scheduled_date: STALE })],
      chemicals: [chemical({ sds_expiry: TOMORROW })],
      trainingRecords: [trainingRecord({ expiry_date: TOMORROW })],
      incidents: [],
    });
    expect(result.band).toBe("green");
    expect(result.rawScore).toBe(0);
    expect(result.explanationText).toMatch(/low/i);
  });

  it("computes weighted raw_score from indicator counts", () => {
    // 2 overdue inspections (weight 2.0) + 1 expired SDS (weight 1.5) = 5.5
    const result = computeSiteRiskScore(SITE, "Main Plant", {
      audits: [
        audit({ id: "a1", status: "scheduled", scheduled_date: YESTERDAY }),
        audit({ id: "a2", status: "in_progress", scheduled_date: YESTERDAY }),
      ],
      chemicals: [chemical({ sds_expiry: YESTERDAY })],
      trainingRecords: [],
      incidents: [],
    });
    expect(result.rawScore).toBe(5.5);
  });

  it("only counts indicators for the requested site", () => {
    const result = computeSiteRiskScore(SITE, "Main Plant", {
      audits: [audit({ site_id: OTHER_SITE })],
      chemicals: [chemical({ site_id: OTHER_SITE })],
      trainingRecords: [],
      incidents: [],
    });
    expect(result.rawScore).toBe(0);
  });

  it("treats near-misses and open incidents as distinct indicators", () => {
    const result = computeSiteRiskScore(SITE, "Main Plant", {
      audits: [],
      chemicals: [],
      trainingRecords: [],
      incidents: [
        incident({ id: "i1", incident_type: "near_miss", status: "reported", occurred_at: RECENT }),
        incident({ id: "i2", incident_type: "lost_time_injury", status: "under_investigation", occurred_at: RECENT }),
      ],
    });
    // 1 open_near_miss (1.0) + 1 open_incident (2.5) = 3.5
    expect(result.rawScore).toBe(3.5);
    expect(result.indicatorBreakdown.open_near_miss.count).toBe(1);
    expect(result.indicatorBreakdown.open_incident.count).toBe(1);
  });

  it("excludes closed incidents and incidents outside the 90-day window", () => {
    const result = computeSiteRiskScore(SITE, "Main Plant", {
      audits: [],
      chemicals: [],
      trainingRecords: [],
      incidents: [
        incident({ id: "i1", status: "closed", occurred_at: RECENT }),
        incident({ id: "i2", status: "reported", occurred_at: STALE }),
      ],
    });
    expect(result.rawScore).toBe(0);
  });

  it("assigns amber at the 3.0 lower boundary (2 expired SDS = 2 * 1.5 = 3.0 exactly)", () => {
    const atBoundary = computeSiteRiskScore(SITE, "S", {
      audits: [], chemicals: [chemical(), chemical({ id: "c2" })],
      trainingRecords: [], incidents: [],
    });
    expect(atBoundary.rawScore).toBe(3.0);
    expect(atBoundary.band).toBe("amber"); // confirms the band range is inclusive of its min
  });

  it("assigns red once score crosses the 8.5 boundary", () => {
    const red = computeSiteRiskScore(SITE, "S", {
      audits: [
        audit({ id: "a1" }), audit({ id: "a2" }), audit({ id: "a3" }), audit({ id: "a4" }),
      ], // 4 * 2.0 = 8.0
      chemicals: [chemical()], // + 1.5 = 9.5
      trainingRecords: [], incidents: [],
    });
    expect(red.rawScore).toBe(9.5);
    expect(red.band).toBe("red");
  });

  it("names the top contributing indicators in explanation_text", () => {
    const result = computeSiteRiskScore(SITE, "Main Plant", {
      audits: [audit(), audit({ id: "a2" }), audit({ id: "a3" })], // overdue_inspection: 6.0
      chemicals: [chemical()], // expired_sds: 1.5
      trainingRecords: [],
      incidents: [],
    });
    const text = result.explanationText;
    expect(text).toContain("3 inspections are overdue");
    expect(text).toContain("1 SDS has expired");
  });
});

describe("recalculateSiteRiskScores (role gating + input validation)", () => {
  beforeEach(() => {
    session.getServerUser.mockResolvedValue({ role: "ehs_manager" });
    session.isSuperadmin.mockResolvedValue(false);
  });

  it("rejects recalculation request with an invalid siteId", async () => {
    // Input validation runs before role/data resolution, so this is caught
    // regardless of who's calling.
    const res = await recalculateSiteRiskScores({ siteId: "not-a-uuid" } as never);
    expect(res.ok).toBe(false);
  });

  it("blocks non-manager roles from triggering recalculation (returns { ok: false }, no throw)", async () => {
    session.getServerUser.mockResolvedValue({ role: "field_officer" });
    const res = await recalculateSiteRiskScores({});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/EHS manager or admin/i);
  });
});

describe("approveGoLiveStep (two-person sign-off gate)", () => {
  beforeEach(() => {
    db.rows.clear();
    session.getServerUser.mockResolvedValue({ role: "ehs_manager" });
    session.getEffectiveTenantId.mockResolvedValue("tenant-A");
    session.getServerProfileId.mockResolvedValue("approver-1");
    session.isSuperadmin.mockResolvedValue(false);
  });

  it("flips status to 'live' only once BOTH ehs_lead and superadmin approvals are recorded", async () => {
    // Step 1: EHS lead (tenant manager) approves — still Preview.
    const r1 = await approveGoLiveStep("ehs_lead");
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.status).toBe("preview");

    // Step 2: superadmin approves the same tenant — now Live.
    session.isSuperadmin.mockResolvedValue(true);
    const r2 = await approveGoLiveStep("superadmin", "tenant-A");
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.status).toBe("live");
    expect(db.rows.get("tenant-A")?.status).toBe("live");
  });

  it("does not flip to 'live' on the EHS lead approval alone", async () => {
    const r1 = await approveGoLiveStep("ehs_lead");
    expect(r1.ok).toBe(true);
    expect(db.rows.get("tenant-A")?.status).toBe("preview");
  });

  it("rejects a non-manager attempting the EHS lead step", async () => {
    session.getServerUser.mockResolvedValue({ role: "viewer" });
    const res = await approveGoLiveStep("ehs_lead");
    expect(res.ok).toBe(false);
  });

  it("rejects a non-superadmin attempting the superadmin step (and vice versa)", async () => {
    // A tenant manager who is not a superadmin cannot complete Step 2.
    session.isSuperadmin.mockResolvedValue(false);
    expect((await approveGoLiveStep("superadmin", "tenant-A")).ok).toBe(false);

    // A superadmin must still name the tenant they're approving.
    session.isSuperadmin.mockResolvedValue(true);
    expect((await approveGoLiveStep("superadmin")).ok).toBe(false);
  });
});

// ── Phase 5: statistical validation math ────────────────────────────────────
// The correlation + false-positive helpers are pure, so they're exercised here
// with synthetic fixtures (deterministic, offline). The against-REAL-data
// assertions live in the gated integration block below — they only run when a
// staging DB with 2+ years of history is wired up via SAFETYIQ_VALIDATION_DB,
// because the standard test run is offline/mock and has no such data.

function mkRow(band: PredictedBand, hadIncident: boolean, i = 0): ValidationRow {
  return {
    siteId: `site-${band}-${i}`,
    predictedBand: band,
    hadIncidentInWindow: hadIncident,
    windowStart: "2026-01-01T00:00:00.000Z",
    windowEnd: "2026-01-31T00:00:00.000Z",
  };
}

// A dataset where higher predicted bands really do precede more incidents.
function strongSignalDataset(perBand = 10, fpTolerance = 0.15): HistoricalValidationDataset {
  const rows: ValidationRow[] = [];
  for (let i = 0; i < perBand; i++) {
    rows.push(mkRow("green", false, i));
    rows.push(mkRow("amber", false, i));
    rows.push(mkRow("orange", true, i));
    rows.push(mkRow("red", true, i));
  }
  return { rows, fpTolerance };
}

describe("computeBandIncidentCorrelation", () => {
  it("finds a significant positive correlation when higher bands precede incidents", () => {
    const dataset = strongSignalDataset(10);
    const { correlationCoefficient, pValue, sampleSize } = computeBandIncidentCorrelation(dataset);
    expect(sampleSize).toBe(40);
    expect(correlationCoefficient, `coef=${correlationCoefficient} should be positive`).toBeGreaterThan(0);
    expect(
      pValue,
      `p=${pValue} coef=${correlationCoefficient} n=${sampleSize} — expected statistically significant`,
    ).toBeLessThan(0.05);
  });

  it("returns a neutral, non-significant result for an empty dataset", () => {
    const res = computeBandIncidentCorrelation({ rows: [], fpTolerance: 0.15 });
    expect(res).toEqual({ correlationCoefficient: 0, pValue: 1, sampleSize: 0 });
  });

  it("does not claim significance when there is no variance in the band", () => {
    const rows = Array.from({ length: 40 }, (_, i) => mkRow("red", i % 2 === 0, i));
    const { correlationCoefficient, pValue } = computeBandIncidentCorrelation({ rows, fpTolerance: 0.15 });
    expect(correlationCoefficient).toBe(0);
    expect(pValue).toBe(1);
  });
});

describe("computeFalsePositiveRate", () => {
  it("reports 0% when every high-risk period is followed by an incident", () => {
    const { falsePositiveRate, tolerance, highRiskPeriods } = computeFalsePositiveRate(strongSignalDataset(10));
    expect(highRiskPeriods).toBe(20); // orange + red
    expect(falsePositiveRate).toBe(0);
    expect(falsePositiveRate).toBeLessThanOrEqual(tolerance);
  });

  it("flags a high false-positive rate when high-risk periods have no incident", () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, i) => mkRow("red", false, i)), // 10 false alarms
      ...Array.from({ length: 10 }, (_, i) => mkRow("red", true, i + 100)),
    ];
    const { falsePositiveRate, tolerance } = computeFalsePositiveRate({ rows, fpTolerance: 0.15 });
    expect(falsePositiveRate).toBeCloseTo(0.5, 5);
    expect(falsePositiveRate).toBeGreaterThan(tolerance);
  });

  it("carries the tolerance from the dataset and treats no-high-risk as 0%", () => {
    const rows = [mkRow("green", false), mkRow("amber", false)];
    const res = computeFalsePositiveRate({ rows, fpTolerance: 0.2 });
    expect(res.tolerance).toBe(0.2);
    expect(res.highRiskPeriods).toBe(0);
    expect(res.falsePositiveRate).toBe(0);
  });
});

// Gated integration test — runs ONLY against a real staging DB (2+ yrs history).
// Skipped in normal CI/mock runs so an offline suite never fails on missing data.
describe.skipIf(!process.env.SAFETYIQ_VALIDATION_DB)(
  "Predictive Risk Engine — statistical validation (real data)",
  () => {
    let dataset: HistoricalValidationDataset;

    beforeAll(async () => {
      dataset = await loadHistoricalValidationDataset({ lookbackDays: 730 });
    });

    it("correlates predicted risk band with actual historical incident occurrence (significant)", () => {
      const { correlationCoefficient, pValue, sampleSize } = computeBandIncidentCorrelation(dataset);
      expect(
        sampleSize,
        `n=${sampleSize} — insufficient history (need > 30 predicted periods). ${dataset.warning ?? ""}`,
      ).toBeGreaterThan(30);
      expect(
        pValue,
        `p=${pValue} coef=${correlationCoefficient} n=${sampleSize} — not statistically significant`,
      ).toBeLessThan(0.05);
    });

    it("has a false-positive rate within the EHS-approved tolerance", () => {
      const { falsePositiveRate, tolerance, highRiskPeriods, falsePositives } =
        computeFalsePositiveRate(dataset);
      expect(
        falsePositiveRate,
        `FP rate ${falsePositiveRate} (${falsePositives}/${highRiskPeriods}) exceeds tolerance ${tolerance}`,
      ).toBeLessThanOrEqual(tolerance);
    });
  },
);

describe("RLS tenant isolation (verified manually against staging — not a unit test)", () => {
  it.skip("denies a user in tenant A reading tenant B's site_risk_scores", () => {
    // Postgres RLS (in_tenant()) can only be exercised against a live database
    // with two seeded tenants and real auth JWTs — it can't be asserted in this
    // node/mock unit context. This is checklist item 5 in
    // docs/predictive-risk-engine.md and is verified manually on the staging
    // branch (dashboard + a raw Supabase client call from each tenant).
    expect(true).toBe(true);
  });
});
