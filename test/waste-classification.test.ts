/**
 * Waste Classification job tests (analyzeWaste).
 *
 * Like the other engine analyses, analyzeWaste always runs in MOCK_MODE in the
 * test environment (NEXT_PUBLIC_SAFETYIQ_MOCK=true / no Supabase creds), so it
 * exercises the deterministic heuristic path — no network calls, no API keys.
 * The live path shares runAnalysis() with analyzeChemical/analyzeComplianceGap,
 * whose fallback behaviour is covered in engine.test.ts.
 */
import { describe, it, expect } from "vitest";
import { analyzeWaste } from "@/lib/ai/engine";
import type { AiAnalysisOutput, WasteStream } from "@/lib/types";
import { MOCK_WASTE_STREAMS, MOCK_TENANT_ID, MOCK_SITE_ID } from "@/lib/data/mock";
import { RISK_LEVELS, SEVERITIES, riskLevelFromScore100 } from "@/lib/constants";

// ── Shared helpers ────────────────────────────────────────────────────────────

/** A fully consistent hazardous stream; override fields to inject defects. */
function makeStream(overrides: Partial<WasteStream> = {}): WasteStream {
  return {
    id: "waste-test-001",
    tenant_id: MOCK_TENANT_ID,
    site_id: MOCK_SITE_ID,
    waste_name: "Spent Halogenated Solvents",
    waste_code: "F001",
    classification: "hazardous",
    quantity: 40,
    unit: "L",
    disposal_method: "incineration",
    disposal_contractor: "Clean Harbors Environmental Services",
    manifest_number: "TX-2026-06-0101",
    disposal_date: "2026-06-20",
    regulatory_limit: 220,
    regulatory_unit: "L/month",
    status: "disposed",
    created_by: "profile-test",
    created_at: "2026-06-01T08:00:00Z",
    ...overrides,
  };
}

// ── analyzeWaste ──────────────────────────────────────────────────────────────

describe("analyzeWaste()", () => {
  it("returns an AiFinding for the halogenated-solvents fixture", async () => {
    const solvents = MOCK_WASTE_STREAMS.find((w) => w.id === "waste-001")!;
    const finding = await analyzeWaste(solvents);

    expect(finding).toBeDefined();
    expect(finding.job).toBe("waste_classification");
    expect(finding.source_type).toBe("waste_stream");
    expect(finding.source_id).toBe("waste-001");
    expect(finding.tenant_id).toBe(MOCK_TENANT_ID);
    expect(finding.site_id).toBe(MOCK_SITE_ID);
  });

  it("sets review_status to 'pending' and uses the heuristic-mock model in tests", async () => {
    const finding = await analyzeWaste(makeStream());
    expect(finding.review_status).toBe("pending");
    expect(finding.model).toBe("safetyiq-heuristic-mock");
  });

  it("confidence is within 0.3–0.95 range", async () => {
    const finding = await analyzeWaste(makeStream());
    expect(finding.confidence).toBeGreaterThanOrEqual(0.3);
    expect(finding.confidence).toBeLessThanOrEqual(0.95);
  });

  it("output.risk_level is a valid RISK_LEVEL and tracks risk_score banding", async () => {
    for (const ws of [makeStream(), makeStream({ waste_code: "D001", classification: "general" })]) {
      const output = (await analyzeWaste(ws)).output as AiAnalysisOutput;
      expect(RISK_LEVELS).toContain(output.risk_level);
      expect(output.risk_level).toBe(riskLevelFromScore100(output.risk_score));
      expect(output.risk_score).toBeGreaterThanOrEqual(0);
      expect(output.risk_score).toBeLessThanOrEqual(100);
    }
  });

  it("output.findings severities are all valid", async () => {
    const output = (await analyzeWaste(makeStream({ waste_code: "D001", classification: "general", manifest_number: null }))).output as AiAnalysisOutput;
    for (const f of output.findings) expect(SEVERITIES).toContain(f.severity);
  });

  it("EPA code on a non-hazardous classification flags a critical mismatch and forces review", async () => {
    // D001 (ignitable) recorded as "general" waste — the core defect this job exists to catch.
    const finding = await analyzeWaste(makeStream({ waste_code: "D001", classification: "general" }));
    const output = finding.output as AiAnalysisOutput;

    expect(finding.human_review_required).toBe(true);
    expect(output.findings.some((f) => f.category === "classification" && f.severity === "critical")).toBe(true);
    expect(output.recommended_actions.some((a) => a.priority === "immediate" && a.capa_kind === "corrective")).toBe(true);
  });

  it("quantity over the regulatory limit flags a regulatory finding and forces review", async () => {
    const finding = await analyzeWaste(makeStream({ quantity: 300, regulatory_limit: 220 }));
    const output = finding.output as AiAnalysisOutput;

    expect(finding.human_review_required).toBe(true);
    expect(output.findings.some((f) => f.category === "regulatory")).toBe(true);
  });

  it("shipped hazardous stream without a manifest number flags a tracking finding", async () => {
    const output = (await analyzeWaste(makeStream({ status: "manifested", manifest_number: null }))).output as AiAnalysisOutput;
    expect(output.findings.some((f) => f.category === "tracking")).toBe(true);
    expect(output.gaps.some((g) => /manifest/i.test(g))).toBe(true);
  });

  it("hazardous stream without a waste code flags incomplete characterization", async () => {
    const output = (await analyzeWaste(makeStream({ waste_code: null }))).output as AiAnalysisOutput;
    expect(output.findings.some((f) => f.category === "characterization")).toBe(true);
  });

  it("a fully consistent stream produces no findings and only a preventive action", async () => {
    const output = (await analyzeWaste(makeStream())).output as AiAnalysisOutput;
    expect(output.findings).toHaveLength(0);
    expect(output.gaps).toHaveLength(0);
    expect(output.recommended_actions).toHaveLength(1);
    expect(output.recommended_actions[0].capa_kind).toBe("preventive");
  });

  it("mismatched stream scores higher risk than a consistent one", async () => {
    const [bad, ok] = await Promise.all([
      analyzeWaste(makeStream({ waste_code: "D001", classification: "general", quantity: 300 })),
      analyzeWaste(makeStream()),
    ]);
    expect((bad.output as AiAnalysisOutput).risk_score).toBeGreaterThan((ok.output as AiAnalysisOutput).risk_score);
  });

  it("hazardous streams cite RCRA generator standards in regulatory_refs", async () => {
    const output = (await analyzeWaste(makeStream())).output as AiAnalysisOutput;
    expect(output.regulatory_refs.some((r) => r.includes("40 CFR 262"))).toBe(true);
  });

  it("plain_language_summary is a non-empty string", async () => {
    const output = (await analyzeWaste(makeStream())).output as AiAnalysisOutput;
    expect(typeof output.plain_language_summary).toBe("string");
    expect(output.plain_language_summary.length).toBeGreaterThan(0);
  });
});
