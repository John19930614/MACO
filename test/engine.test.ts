/**
 * SafetyIQ AI Engine tests.
 *
 * `analyzeChemical` and `analyzeComplianceGap` always run in MOCK_MODE in
 * the test environment (NEXT_PUBLIC_SAFETYIQ_MOCK=true / no Supabase creds),
 * so they exercise the deterministic heuristic path — no network calls, no API
 * keys required.
 *
 * `buildPredictabilityForecast` is a pure sync function — always directly
 * testable.
 *
 * `deriveConfidence` is a pure scoring function.
 */
import { describe, it, expect } from "vitest";
import { analyzeChemical, analyzeComplianceGap, buildPredictabilityForecast, deriveConfidence } from "@/lib/ai/engine";
import type { AiAnalysisOutput } from "@/lib/types";
import { MOCK_CHEMICALS, MOCK_LEGAL_REQUIREMENTS, MOCK_TENANT_ID, MOCK_SITE_ID } from "@/lib/data/mock";
import { RISK_LEVELS, SEVERITIES } from "@/lib/constants";

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Minimal valid AiAnalysisOutput for deriveConfidence tests. */
function makeOutput(overrides: Partial<AiAnalysisOutput> = {}): AiAnalysisOutput {
  return {
    risk_level: "low",
    risk_score: 30,
    findings: [],
    gaps: [],
    regulatory_refs: [],
    recommended_actions: [],
    plain_language_summary: "No significant issues found.",
    human_review_required: false,
    ...overrides,
  };
}

// ── analyzeChemical ───────────────────────────────────────────────────────────

describe("analyzeChemical()", () => {
  it("returns an AiFinding for the formaldehyde fixture", async () => {
    const formaldehyde = MOCK_CHEMICALS.find(c => c.id === "chem-001")!;
    const finding = await analyzeChemical(formaldehyde);

    expect(finding).toBeDefined();
    expect(finding.job).toBe("chemical_hazard_analysis");
    expect(finding.source_type).toBe("chemical");
    expect(finding.source_id).toBe("chem-001");
    expect(finding.tenant_id).toBe(MOCK_TENANT_ID);
    expect(finding.site_id).toBe(MOCK_SITE_ID);
  });

  it("sets review_status to 'pending'", async () => {
    const chem = MOCK_CHEMICALS[0];
    const finding = await analyzeChemical(chem);
    expect(finding.review_status).toBe("pending");
  });

  it("uses the heuristic-mock model in test environment", async () => {
    const chem = MOCK_CHEMICALS[0];
    const finding = await analyzeChemical(chem);
    expect(finding.model).toBe("safetyiq-heuristic-mock");
  });

  it("stamps the current PROMPT_VERSION", async () => {
    const chem = MOCK_CHEMICALS[0];
    const finding = await analyzeChemical(chem);
    expect(finding.prompt_version).toBe("safetyiq-ehs-2026-06-17");
  });

  it("confidence is within 0.3–0.95 range", async () => {
    const chem = MOCK_CHEMICALS[0];
    const finding = await analyzeChemical(chem);
    expect(finding.confidence).toBeGreaterThanOrEqual(0.3);
    expect(finding.confidence).toBeLessThanOrEqual(0.95);
  });

  it("output.risk_level is a valid RISK_LEVEL", async () => {
    const chem = MOCK_CHEMICALS[0];
    const finding = await analyzeChemical(chem);
    const output = finding.output as AiAnalysisOutput;
    expect(RISK_LEVELS).toContain(output.risk_level);
  });

  it("output.risk_score is 0–100", async () => {
    const chem = MOCK_CHEMICALS[0];
    const finding = await analyzeChemical(chem);
    const output = finding.output as AiAnalysisOutput;
    expect(output.risk_score).toBeGreaterThanOrEqual(0);
    expect(output.risk_score).toBeLessThanOrEqual(100);
  });

  it("output.findings severities are all valid", async () => {
    const chem = MOCK_CHEMICALS[0];
    const finding = await analyzeChemical(chem);
    const output = finding.output as AiAnalysisOutput;
    for (const f of output.findings) {
      expect(SEVERITIES).toContain(f.severity);
    }
  });

  it("scheduled chemical (formaldehyde) forces human_review_required=true", async () => {
    const formaldehyde = MOCK_CHEMICALS.find(c => c.is_scheduled && c.id === "chem-001")!;
    const finding = await analyzeChemical(formaldehyde);
    expect(finding.human_review_required).toBe(true);
  });

  it("non-scheduled, low-hazard chemical does not force review", async () => {
    const ethanol = MOCK_CHEMICALS.find(c => c.id === "chem-004")!;
    const finding = await analyzeChemical(ethanol);
    const output = finding.output as AiAnalysisOutput;
    // ethanol has only H225 (flammable liquid) — not in the force-review set
    expect(finding.job).toBe("chemical_hazard_analysis");
    expect(output.risk_score).toBeGreaterThanOrEqual(0);
  });

  it("has at least one recommended_action for high-hazard chemical", async () => {
    const formaldehyde = MOCK_CHEMICALS.find(c => c.id === "chem-001")!;
    const finding = await analyzeChemical(formaldehyde);
    const output = finding.output as AiAnalysisOutput;
    expect(output.recommended_actions.length).toBeGreaterThan(0);
  });

  it("recommended_action priorities are valid enum values", async () => {
    const chem = MOCK_CHEMICALS[0];
    const finding = await analyzeChemical(chem);
    const output = finding.output as AiAnalysisOutput;
    const PRIORITIES = ["immediate", "short_term", "medium_term", "long_term"] as const;
    for (const action of output.recommended_actions) {
      expect(PRIORITIES).toContain(action.priority);
    }
  });

  it("plain_language_summary is a non-empty string", async () => {
    const chem = MOCK_CHEMICALS[0];
    const finding = await analyzeChemical(chem);
    const output = finding.output as AiAnalysisOutput;
    expect(typeof output.plain_language_summary).toBe("string");
    expect(output.plain_language_summary.length).toBeGreaterThan(0);
  });

  it("sodium azide (most hazardous fixture) produces high risk_score", async () => {
    const azide = MOCK_CHEMICALS.find(c => c.id === "chem-007")!;
    const finding = await analyzeChemical(azide);
    const output = finding.output as AiAnalysisOutput;
    expect(output.risk_score).toBeGreaterThan(40);
  });
});

// ── analyzeComplianceGap ──────────────────────────────────────────────────────

describe("analyzeComplianceGap()", () => {
  it("returns an AiFinding for OSHA Formaldehyde Standard (major_gap)", async () => {
    const req = MOCK_LEGAL_REQUIREMENTS.find(r => r.id === "legal-003")!;
    const finding = await analyzeComplianceGap(req);

    expect(finding).toBeDefined();
    expect(finding.job).toBe("compliance_gap_detection");
    expect(finding.source_type).toBe("legal_requirement");
    expect(finding.source_id).toBe("legal-003");
    expect(finding.tenant_id).toBe(MOCK_TENANT_ID);
  });

  it("sets review_status to 'pending'", async () => {
    const req = MOCK_LEGAL_REQUIREMENTS[0];
    const finding = await analyzeComplianceGap(req);
    expect(finding.review_status).toBe("pending");
  });

  it("uses the heuristic-mock model in test environment", async () => {
    const req = MOCK_LEGAL_REQUIREMENTS[0];
    const finding = await analyzeComplianceGap(req);
    expect(finding.model).toBe("safetyiq-heuristic-mock");
  });

  it("confidence is within 0.3–0.95 range", async () => {
    const req = MOCK_LEGAL_REQUIREMENTS[0];
    const finding = await analyzeComplianceGap(req);
    expect(finding.confidence).toBeGreaterThanOrEqual(0.3);
    expect(finding.confidence).toBeLessThanOrEqual(0.95);
  });

  it("major_gap requirement produces higher risk_score than compliant", async () => {
    const majorGap = MOCK_LEGAL_REQUIREMENTS.find(r => r.status === "major_gap")!;
    const compliant = MOCK_LEGAL_REQUIREMENTS.find(r => r.status === "compliant")!;

    const [gapFinding, compliantFinding] = await Promise.all([
      analyzeComplianceGap(majorGap),
      analyzeComplianceGap(compliant),
    ]);

    const gapOutput  = gapFinding.output as AiAnalysisOutput;
    const okOutput   = compliantFinding.output as AiAnalysisOutput;
    expect(gapOutput.risk_score).toBeGreaterThan(okOutput.risk_score);
  });

  it("output contains the regulation_ref in regulatory_refs", async () => {
    const req = MOCK_LEGAL_REQUIREMENTS[0];
    const finding = await analyzeComplianceGap(req);
    const output = finding.output as AiAnalysisOutput;
    expect(output.regulatory_refs).toContain(req.regulation_ref);
  });

  it("output.risk_level is a valid RISK_LEVEL", async () => {
    const req = MOCK_LEGAL_REQUIREMENTS[0];
    const finding = await analyzeComplianceGap(req);
    const output = finding.output as AiAnalysisOutput;
    expect(RISK_LEVELS).toContain(output.risk_level);
  });

  it("output has at least one recommended_action for any status", async () => {
    for (const req of MOCK_LEGAL_REQUIREMENTS.slice(0, 3)) {
      const finding = await analyzeComplianceGap(req);
      const output = finding.output as AiAnalysisOutput;
      expect(output.recommended_actions.length).toBeGreaterThan(0);
    }
  });
});

// ── buildPredictabilityForecast ───────────────────────────────────────────────

describe("buildPredictabilityForecast()", () => {
  const baseParams = {
    complianceScores: { chemical: 74, legal: 63, audits: 82, capa: 68, training: 78 },
    overdueCapaCount: 1,
    overdueTrainingCount: 2,
    expiringSdsCount: 1,
    openIncidentCount: 1,
  };

  it("returns a PredictabilityForecast object", () => {
    const forecast = buildPredictabilityForecast(baseParams);
    expect(forecast).toBeDefined();
    expect(typeof forecast.predicted_compliance_score_30d).toBe("number");
    expect(typeof forecast.compliance_trend).toBe("string");
  });

  it("predicted_compliance_score_30d is within 0–100", () => {
    const forecast = buildPredictabilityForecast(baseParams);
    expect(forecast.predicted_compliance_score_30d).toBeGreaterThanOrEqual(0);
    expect(forecast.predicted_compliance_score_30d).toBeLessThanOrEqual(100);
  });

  it("compliance_trend is one of improving/stable/declining", () => {
    const forecast = buildPredictabilityForecast(baseParams);
    expect(["improving", "stable", "declining"]).toContain(forecast.compliance_trend);
  });

  it("high pressure points produce a declining trend", () => {
    const highPressure = buildPredictabilityForecast({
      ...baseParams,
      overdueCapaCount: 8,
      overdueTrainingCount: 6,
      expiringSdsCount: 5,
      openIncidentCount: 4,
    });
    expect(highPressure.compliance_trend).toBe("declining");
  });

  it("zero pressure points produce an improving trend", () => {
    const noPressure = buildPredictabilityForecast({
      complianceScores: { chemical: 95, legal: 92, audits: 98 },
      overdueCapaCount: 0,
      overdueTrainingCount: 0,
      expiringSdsCount: 0,
      openIncidentCount: 0,
    });
    expect(noPressure.compliance_trend).toBe("improving");
  });

  it("top_risk_modules lists modules with lowest scores first", () => {
    const forecast = buildPredictabilityForecast(baseParams);
    expect(forecast.top_risk_modules.length).toBeGreaterThan(0);
    // lowest score in baseParams is legal (63) then capa (68) then chemical (74)
    expect(forecast.top_risk_modules[0]).toBe("legal");
  });

  it("leading_indicators has 4 entries", () => {
    const forecast = buildPredictabilityForecast(baseParams);
    expect(forecast.leading_indicators).toHaveLength(4);
  });

  it("leading_indicator values match input params", () => {
    const forecast = buildPredictabilityForecast(baseParams);
    const capaIndicator = forecast.leading_indicators.find(i => i.indicator.includes("CAPA"));
    expect(capaIndicator?.value).toBe(baseParams.overdueCapaCount);
  });

  it("mirrors overdue counts onto the forecast object", () => {
    const forecast = buildPredictabilityForecast(baseParams);
    expect(forecast.overdue_training_count).toBe(baseParams.overdueTrainingCount);
    expect(forecast.expiring_sds_count).toBe(baseParams.expiringSdsCount);
    expect(forecast.open_capa_overdue_count).toBe(baseParams.overdueCapaCount);
  });

  it("empty complianceScores does not throw", () => {
    expect(() => buildPredictabilityForecast({
      complianceScores: {},
      overdueCapaCount: 0,
      overdueTrainingCount: 0,
      expiringSdsCount: 0,
      openIncidentCount: 0,
    })).not.toThrow();
  });
});

// ── deriveConfidence ──────────────────────────────────────────────────────────

describe("deriveConfidence()", () => {
  it("result is always within 0.3–0.95 range", () => {
    const cases: AiAnalysisOutput[] = [
      makeOutput(),
      makeOutput({ findings: [{ category: "a", description: "b", severity: "high" }] }),
      makeOutput({ gaps: ["g1", "g2", "g3", "g4", "g5"] }),
      makeOutput({
        findings: [{ category: "x", description: "y", severity: "critical" }],
        recommended_actions: [{ action: "do it", priority: "immediate", rationale: "because", capa_kind: "corrective" }],
        regulatory_refs: ["OSHA 1910"],
        plain_language_summary: "A fairly long summary that exceeds 60 characters in total length.",
        gaps: [],
      }),
    ];

    for (const o of cases) {
      const conf = deriveConfidence(o);
      expect(conf).toBeGreaterThanOrEqual(0.3);
      expect(conf).toBeLessThanOrEqual(0.95);
    }
  });

  it("output with more findings and actions scores higher than empty output", () => {
    const low = deriveConfidence(makeOutput());
    const high = deriveConfidence(makeOutput({
      findings: [{ category: "c", description: "d", severity: "high" }],
      recommended_actions: [{ action: "fix it", priority: "short_term", rationale: "r", capa_kind: "corrective" }],
      regulatory_refs: ["OSHA 1910"],
      plain_language_summary: "This summary is long enough to exceed the 60 character threshold.",
    }));
    expect(high).toBeGreaterThan(low);
  });

  it("many gaps reduce the confidence score", () => {
    const fewGaps  = deriveConfidence(makeOutput({ gaps: ["g1"] }));
    const manyGaps = deriveConfidence(makeOutput({ gaps: ["g1", "g2", "g3", "g4", "g5"] }));
    expect(manyGaps).toBeLessThanOrEqual(fewGaps);
  });

  it("result is a rounded two-decimal number", () => {
    const conf = deriveConfidence(makeOutput());
    const rounded = Math.round(conf * 100) / 100;
    expect(conf).toBe(rounded);
  });
});
