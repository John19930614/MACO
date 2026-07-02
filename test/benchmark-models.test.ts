import { describe, it, expect } from "vitest";
import {
  EHS_BENCH_PROMPTS,
  CANDIDATE_MODELS,
  UPGRADE_CANDIDATES,
  BASELINE_MODEL,
  ACCURACY_THRESHOLD,
  COST_MULTIPLIER_LIMIT,
  scoreCompleteness,
  normaliseScore,
  aggregateRows,
  recommend,
  type BenchmarkRowResult,
  type ModelAggregate,
} from "@/lib/ai/benchmarkModels";
import { MODEL_PRICES, estimateCost } from "@/lib/analytics/ai";

function row(model: string, score: number | null, cost = 0.01, latency: number | null = 2000): BenchmarkRowResult {
  return {
    model,
    prompt_key: "k",
    prompt_label: "l",
    latency_ms: score === null ? null : latency,
    input_tokens: 100,
    output_tokens: 500,
    score,
    cost_est_usd: score === null ? 0 : cost,
    ...(score === null ? { error: "boom" } : {}),
  };
}

function agg(model: string, meanScore: number, meanCostUsd: number, failures = 0, calls = 8): ModelAggregate {
  return { model, meanScore, meanCostUsd, meanLatencyMs: 2000, failures, calls };
}

describe("normaliseScore", () => {
  it("returns 100 for perfect completeness and a long response", () => {
    expect(normaliseScore({ completenessRatio: 1, responseLength: 500 })).toBe(100);
  });

  it("applies a 10-point penalty for very short responses", () => {
    expect(normaliseScore({ completenessRatio: 1, responseLength: 50 })).toBe(90);
  });

  it("returns 0 for zero completeness", () => {
    expect(normaliseScore({ completenessRatio: 0, responseLength: 500 })).toBe(0);
  });

  it("clamps at 0 — never negative", () => {
    expect(normaliseScore({ completenessRatio: 0, responseLength: 10 })).toBe(0);
  });
});

describe("scoreCompleteness", () => {
  it("returns 1.0 when all expected fields are present and non-empty", () => {
    const parsed = { un_number: "UN1790", hazard_class: "8", packing_group: "II", regulatory_notes: "Corrosive" };
    expect(scoreCompleteness(parsed, ["un_number", "hazard_class", "packing_group", "regulatory_notes"])).toBe(1);
  });

  it("returns 0.5 when half the fields are missing", () => {
    const parsed = { un_number: "UN1790", hazard_class: "8" };
    expect(scoreCompleteness(parsed, ["un_number", "hazard_class", "packing_group", "regulatory_notes"])).toBe(0.5);
  });

  it("counts empty arrays and blank strings as missing", () => {
    const parsed = { root_causes: [], immediate_cause: "Wet floor", note: "   " };
    expect(scoreCompleteness(parsed, ["immediate_cause", "root_causes"])).toBe(0.5);
    expect(scoreCompleteness(parsed, ["note"])).toBe(0);
  });

  it("returns 0 for an empty expected-fields list", () => {
    expect(scoreCompleteness({ a: "b" }, [])).toBe(0);
  });

  it("returns 0 for null / non-object / array responses", () => {
    expect(scoreCompleteness(null, ["field"])).toBe(0);
    expect(scoreCompleteness("text", ["field"])).toBe(0);
    expect(scoreCompleteness([1, 2], ["field"])).toBe(0);
  });
});

describe("EHS_BENCH_PROMPTS", () => {
  it("has exactly 8 prompts with unique keys", () => {
    expect(EHS_BENCH_PROMPTS).toHaveLength(8);
    const keys = EHS_BENCH_PROMPTS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every prompt defines at least one expected field", () => {
    for (const prompt of EHS_BENCH_PROMPTS) {
      expect(prompt.expectedFields.length).toBeGreaterThan(0);
    }
  });
});

describe("model catalog & pricing", () => {
  it("baseline is first in the candidate list", () => {
    expect(CANDIDATE_MODELS[0]).toBe(BASELINE_MODEL);
  });

  it("upgrade candidates are a subset of the run catalog and exclude the reference models", () => {
    for (const m of UPGRADE_CANDIDATES) {
      expect(CANDIDATE_MODELS).toContain(m);
    }
    expect(UPGRADE_CANDIDATES).not.toContain(BASELINE_MODEL);
    expect(UPGRADE_CANDIDATES).not.toContain("claude-haiku-4-5");
    expect(UPGRADE_CANDIDATES).not.toContain("claude-sonnet-4-6");
  });

  it("every candidate model has a price entry — cost gates never divide by a silent 0", () => {
    for (const m of CANDIDATE_MODELS) {
      expect(MODEL_PRICES[m], `missing MODEL_PRICES entry for ${m}`).toBeDefined();
      expect(estimateCost(m, 1_000_000, 1_000_000)).toBeGreaterThan(0);
    }
  });

  it("prices claude-sonnet-5 at the $3/$15 sticker", () => {
    expect(estimateCost("claude-sonnet-5", 1_000_000, 1_000_000)).toBeCloseTo(18, 6);
  });
});

describe("aggregateRows", () => {
  it("means over successful calls only and counts failures", () => {
    const rows = [row("m", 90), row("m", 100), row("m", null)];
    const [a] = aggregateRows(rows);
    expect(a.meanScore).toBe(95);
    expect(a.failures).toBe(1);
    expect(a.calls).toBe(3);
  });

  it("preserves first-seen model order", () => {
    const rows = [row("b", 90), row("a", 90), row("b", 80)];
    expect(aggregateRows(rows).map((a) => a.model)).toEqual(["b", "a"]);
  });
});

describe("recommend", () => {
  it("recommends an upgrade when a candidate clears both gates", () => {
    const r = recommend([
      agg(BASELINE_MODEL, 85, 0.01),
      agg("claude-opus-4-8", 85 + ACCURACY_THRESHOLD, 0.017),
    ]);
    expect(r.recommendation).toBe("upgrade");
    expect(r.winner).toBe("claude-opus-4-8");
  });

  it("keeps the baseline when no candidate beats it by the threshold", () => {
    const r = recommend([
      agg(BASELINE_MODEL, 90, 0.01),
      agg("claude-opus-4-8", 93, 0.017),
    ]);
    expect(r.recommendation).toBe("keep");
    expect(r.winner).toBe(BASELINE_MODEL);
  });

  it("rejects a candidate that exceeds the cost multiplier", () => {
    const r = recommend([
      agg(BASELINE_MODEL, 80, 0.01),
      agg("claude-opus-4-8", 95, 0.01 * (COST_MULTIPLIER_LIMIT + 0.5)),
    ]);
    expect(r.recommendation).toBe("keep");
  });

  it("rejects a candidate with any failed calls", () => {
    const r = recommend([
      agg(BASELINE_MODEL, 80, 0.01),
      agg("claude-opus-4-8", 95, 0.017, 1),
    ]);
    expect(r.recommendation).toBe("keep");
  });

  it("never crowns the reference models (haiku triage, previous default)", () => {
    const r = recommend([
      agg(BASELINE_MODEL, 80, 0.01),
      agg("claude-haiku-4-5", 99, 0.003),
      agg("claude-sonnet-4-6", 99, 0.01),
    ]);
    expect(r.recommendation).toBe("keep");
    expect(r.winner).toBe(BASELINE_MODEL);
  });

  it("is inconclusive when the baseline produced no successful calls", () => {
    const r = recommend([
      agg(BASELINE_MODEL, 0, 0, 8, 8),
      agg("claude-opus-4-8", 95, 0.017),
    ]);
    expect(r.recommendation).toBe("inconclusive");
    expect(r.winner).toBeNull();
  });
});
