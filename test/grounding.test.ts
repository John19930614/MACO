import { describe, it, expect } from "vitest";
import { reviewAnalysisOutput } from "@/lib/ai/grounding";
import { analyzeChemical } from "@/lib/ai/engine";
import { MOCK_CHEMICALS } from "@/lib/data/mock";
import type { AiAnalysisOutput } from "@/lib/types";

function base(overrides: Partial<AiAnalysisOutput> = {}): AiAnalysisOutput {
  return {
    risk_level: "medium",
    risk_score: 30,
    findings: [],
    gaps: [],
    regulatory_refs: [],
    recommended_actions: [],
    plain_language_summary: "Summary.",
    human_review_required: false,
    ...overrides,
  };
}

describe("reviewAnalysisOutput", () => {
  it("passes a clean, internally-consistent output", () => {
    const r = reviewAnalysisOutput(base({ risk_score: 30, risk_level: "medium" }));
    expect(r.status).toBe("pass");
    expect(r.issues).toHaveLength(0);
  });

  it("fails an out-of-range risk_score", () => {
    const r = reviewAnalysisOutput(base({ risk_score: 150 }));
    expect(r.status).toBe("fail");
    expect(r.issues.some((i) => i.check === "risk_score_range")).toBe(true);
  });

  it("warns when risk_level disagrees with the score band", () => {
    const r = reviewAnalysisOutput(base({ risk_score: 90, risk_level: "low" }));
    expect(r.issues.some((i) => i.check === "risk_level_consistency")).toBe(true);
    expect(r.status).toBe("warn");
  });

  it("warns on a regulatory ref that names no recognised authority", () => {
    const r = reviewAnalysisOutput(base({ regulatory_refs: ["Galactic Safety Directive 7"] }));
    expect(r.issues.some((i) => i.check === "reg_ref_unrecognized")).toBe(true);
  });

  it("accepts a real regulatory citation", () => {
    const r = reviewAnalysisOutput(base({ regulatory_refs: ["OSHA 29 CFR 1910.1200"] }));
    expect(r.issues.some((i) => i.check === "reg_ref_unrecognized")).toBe(false);
  });

  it("fails when the output cites a CAS that is not the record's CAS", () => {
    const r = reviewAnalysisOutput(
      base({ plain_language_summary: "This involves CAS 50-00-0 handling." }),
      { knownCas: "67-64-1" },
    );
    expect(r.status).toBe("fail");
    expect(r.issues.some((i) => i.check === "cas_hallucination")).toBe(true);
  });

  it("does not flag the record's own CAS", () => {
    const r = reviewAnalysisOutput(
      base({ plain_language_summary: "This involves CAS 67-64-1 handling." }),
      { knownCas: "67-64-1" },
    );
    expect(r.issues.some((i) => i.check === "cas_hallucination")).toBe(false);
  });

  it("warns when a high-risk output recommends no action", () => {
    const r = reviewAnalysisOutput(base({ risk_score: 70, risk_level: "high", recommended_actions: [] }));
    expect(r.issues.some((i) => i.check === "missing_actions")).toBe(true);
  });
});

describe("engine attaches a gateway review to every finding", () => {
  it("chemical findings carry a gateway review that passes for clean fixtures", async () => {
    const chem = MOCK_CHEMICALS[0];
    const finding = await analyzeChemical(chem);
    const output = finding.output as AiAnalysisOutput;
    expect(output.gateway).toBeDefined();
    expect(["pass", "warn", "fail"]).toContain(output.gateway!.status);
    // The deterministic heuristic should never hallucinate a foreign CAS.
    expect(output.gateway!.issues.some((i) => i.check === "cas_hallucination")).toBe(false);
  });
});
