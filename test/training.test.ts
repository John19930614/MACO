import { describe, it, expect } from "vitest";
import { analyzeTraining } from "@/lib/ai/engine";
import { MOCK_TRAINING_COURSES, MOCK_TRAINING_RECORDS, MOCK_PROFILES_ALL, MOCK_TENANT_ID, MOCK_SITE_ID } from "@/lib/data/mock";
import type { TrainingCourse, TrainingRecord, Profile, AiAnalysisOutput } from "@/lib/types";

const NOW = Date.parse("2026-06-11T00:00:00Z");

const course = (o: Partial<TrainingCourse> = {}): TrainingCourse => ({
  id: "c1", tenant_id: "t1", title: "HazCom", description: "", course_type: "compliance",
  duration_minutes: 60, pass_score: 80, validity_period_days: 365,
  required_roles: ["field_officer"], regulatory_ref: "OSHA 1910.1200(h)", active: true,
  created_at: "2026-01-01T00:00:00Z", ...o,
});
const profile = (id: string, o: Partial<Profile> = {}): Profile => ({
  id, display_name: id, role: "field_officer", tenant_id: "t1", default_site_id: null, active: true, ...o,
});
const record = (o: Partial<TrainingRecord> = {}): TrainingRecord => ({
  id: "r", tenant_id: "t1", site_id: "s1", profile_id: "p1", course_id: "c1",
  completed_date: "2026-01-01", expiry_date: "2027-01-01", score: 90, passed: true,
  delivery_method: "classroom", instructor_id: null, notes: null, created_at: "2026-01-01T00:00:00Z", ...o,
});

describe("analyzeTraining (deterministic gap analysis)", () => {
  it("flags an uncovered required-role staff member and an expired cert", async () => {
    const finding = await analyzeTraining({
      tenant_id: "t1", site_id: "s1", now: NOW,
      courses: [course()],
      profiles: [profile("p1"), profile("p2")],
      records: [
        record({ id: "r1", profile_id: "p1", expiry_date: "2027-01-01" }), // p1 current
        record({ id: "r2", profile_id: "p2", expiry_date: "2025-01-01" }), // p2 lapsed → gap + expired
      ],
    });

    expect(finding.job).toBe("training_gap_analysis");
    expect(finding.source_type).toBe("training");
    const out = finding.output as AiAnalysisOutput;
    expect(out.risk_score).toBeGreaterThan(0);
    expect(out.findings.some((f) => f.description.includes("HazCom"))).toBe(true);
    expect(out.regulatory_refs).toContain("OSHA 1910.1200(h)");
    expect(out.gaps.length).toBeGreaterThan(0);
    // 50% coverage → review required; gateway attached and self-consistent.
    expect(finding.human_review_required).toBe(true);
    expect(out.gateway).toBeDefined();
    expect(out.gateway!.issues.some((i) => i.check === "reg_ref_unrecognized")).toBe(false);
  });

  it("reports no gaps when every required-role member is covered", async () => {
    const finding = await analyzeTraining({
      tenant_id: "t1", site_id: "s1", now: NOW,
      courses: [course()],
      profiles: [profile("p1")],
      records: [record({ id: "r1", profile_id: "p1", expiry_date: "2027-01-01" })],
    });
    const out = finding.output as AiAnalysisOutput;
    expect(out.risk_score).toBe(0);
    expect(out.findings).toHaveLength(0);
    expect(out.human_review_required).toBe(false);
  });

  it("handles a tenant with no role-based requirements without throwing", async () => {
    const finding = await analyzeTraining({
      tenant_id: "t1", site_id: "s1", now: NOW,
      courses: [course({ required_roles: [] })],
      profiles: [profile("p1")],
      records: [],
    });
    const out = finding.output as AiAnalysisOutput;
    expect(out.risk_score).toBe(0);
    expect(out.plain_language_summary).toMatch(/no role-based training requirements/i);
  });

  it("produces a valid finding over the real mock fixtures", async () => {
    const finding = await analyzeTraining({
      tenant_id: MOCK_TENANT_ID, site_id: MOCK_SITE_ID, now: NOW,
      courses: MOCK_TRAINING_COURSES,
      records: MOCK_TRAINING_RECORDS,
      profiles: MOCK_PROFILES_ALL,
    });
    const out = finding.output as AiAnalysisOutput;
    expect(out.risk_score).toBeGreaterThanOrEqual(0);
    expect(out.risk_score).toBeLessThanOrEqual(100);
    expect(finding.review_status).toBe("pending");
    expect(out.gateway).toBeDefined();
  });
});
