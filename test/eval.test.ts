import { describe, it, expect } from "vitest";
import { extractCellDraft } from "@/lib/ai/extract";
import { analyzeCell, analyzeChemical, analyzeComplianceGap } from "@/lib/ai/engine";
import { PROMPT_VERSION } from "@/lib/env";
import { riskLevelFromScore100 } from "@/lib/constants";
import { MOCK_CHEMICALS, MOCK_LEGAL_REQUIREMENTS } from "@/lib/data/mock";
import type { SafetyCell, AiAnalysisOutput } from "@/lib/types";

/**
 * Regression eval for the DETERMINISTIC engine — the heuristic that backs both
 * mock mode and the live-LLM fallback. It can run in CI without an API key, so
 * it guards the floor of quality every analysis degrades to. The golden set is
 * pinned to PROMPT_VERSION: when the prompt/taxonomy changes, bump EXPECTED_*
 * deliberately and re-score rather than letting drift pass silently.
 */
const EXPECTED_PROMPT_VERSION = "safetyiq-causality-2026-06-25";

interface Golden {
  text: string;
  energy?: string;
  exposure?: string;
  gap?: string;
  severity?: string;
}

const EXTRACTOR_GOLDEN: Golden[] = [
  { text: "A forklift was unloading near the blind corner with no spotter and pedestrians cutting through.", energy: "motion", exposure: "struck_by", gap: "missing" },
  { text: "Worker on the roof edge with the guardrail removed; a fall here would be fatal.", energy: "gravity", exposure: "fall", gap: "missing", severity: "critical" },
  { text: "The panel was live and the lockout had been bypassed with tape.", energy: "electrical", exposure: "contact", gap: "bypassed" },
  { text: "Toxic vapor venting from the line; the gas monitor calibration is overdue.", energy: "chemical", exposure: "inhalation", gap: "expired" },
  { text: "A conveyor nip point caught a worker's glove; the guard had been removed.", energy: "mechanical", exposure: "caught_in", gap: "missing" },
  { text: "Bare hot steam line with no barrier present; a worker could be burned.", energy: "thermal", exposure: "contact", gap: "missing" },
];

describe("AI regression eval (deterministic engine + extractor)", () => {
  it("pins the golden set to the current PROMPT_VERSION", () => {
    expect(PROMPT_VERSION).toBe(EXPECTED_PROMPT_VERSION);
  });

  it("extractor classifies the hazard genome at >= 85% field accuracy", () => {
    let hits = 0;
    let total = 0;
    const misses: string[] = [];
    for (const g of EXTRACTOR_GOLDEN) {
      const { draft } = extractCellDraft(g.text);
      const checks: [string, string | undefined, string][] = [
        ["energy", g.energy, draft.hazard_genome.energySource],
        ["exposure", g.exposure, draft.hazard_genome.exposureType],
        ["gap", g.gap, draft.hazard_genome.controlGap],
        ["severity", g.severity, draft.severity],
      ];
      for (const [field, expected, actual] of checks) {
        if (expected === undefined) continue;
        total++;
        if (expected === actual) hits++;
        else misses.push(`"${g.text.slice(0, 32)}…" ${field}: expected ${expected}, got ${actual}`);
      }
    }
    const accuracy = hits / total;
    expect(accuracy, `misses:\n${misses.join("\n")}`).toBeGreaterThanOrEqual(0.85);
  });

  it("every heuristic analysis meets the output-quality floor", async () => {
    const base: SafetyCell = {
      id: "eval_cell",
      tenant_id: "tenant_pacific",
      site_id: "site_harbor",
      location_id: "loc_dock_a",
      title: "Eval cell",
      description: "d",
      task: "Container unloading",
      crew: null,
      company: null,
      permit_ref: null,
      hazard_genome: { energySource: "motion", exposureType: "struck_by", trigger: "congestion", controlGap: "missing" },
      severity: "high",
      likelihood: 4,
      risk_score: 78,
      status: "open",
      owner_id: null,
      created_by: "u_field",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const candidate: SafetyCell = { ...base, id: "eval_other", title: "Other at same dock" };

    const f = await analyzeCell(base, [candidate]);
    const out = f.output as {
      risk_score: number;
      prevention: unknown[];
      plain_language_summary: string;
      suggested_edges: { target_cell_id: string; type: string }[];
    };
    expect(out.risk_score).toBeGreaterThanOrEqual(0);
    expect(out.risk_score).toBeLessThanOrEqual(100);
    expect(out.prevention.length).toBeGreaterThan(0); // always offers a counterfactual control
    expect(out.plain_language_summary.length).toBeGreaterThan(20);
    // a same-location candidate must surface as a same_location edge
    expect(out.suggested_edges.some((e) => e.target_cell_id === "eval_other" && e.type === "same_location")).toBe(true);
    // governance: a high-severity cell is always flagged for human review
    expect(f.human_review_required).toBe(true);
  });

  it("every chemical & compliance analysis meets the engine output-quality floor", async () => {
    const findings = await Promise.all([
      ...MOCK_CHEMICALS.map((c) => analyzeChemical(c)),
      ...MOCK_LEGAL_REQUIREMENTS.map((r) => analyzeComplianceGap(r)),
    ]);
    for (const f of findings) {
      const out = f.output as AiAnalysisOutput;
      // score in range, level consistent with the score band (no self-contradiction)
      expect(out.risk_score).toBeGreaterThanOrEqual(0);
      expect(out.risk_score).toBeLessThanOrEqual(100);
      expect(out.risk_level).toBe(riskLevelFromScore100(out.risk_score));
      // the deterministic engine grounds in the record — it must never self-fail the gateway
      expect(out.gateway?.status).not.toBe("fail");
      // every analysis is cache-stamped for reuse
      expect(out.input_hash).toMatch(/^[0-9a-f]{16}$/);
    }
  });
});
