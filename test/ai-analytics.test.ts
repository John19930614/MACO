import { describe, it, expect } from "vitest";
import { summarizeFindings, estimateCost, summarizeTelemetry, MODEL_PRICES, type AiCall } from "@/lib/analytics/ai";
import * as fx from "@/lib/data/mock";

describe("summarizeFindings", () => {
  const s = summarizeFindings(fx.FINDINGS);

  it("counts findings and bounds every rate to 0..1", () => {
    expect(s.total).toBe(fx.FINDINGS.length);
    for (const r of [s.fallbackRate, s.humanReviewRate, s.avgConfidence]) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  it("reports the model mix and flags heuristic output as fallback", () => {
    const mixTotal = Object.values(s.byModel).reduce((a, b) => a + b, 0);
    expect(mixTotal).toBe(s.total);
    const withFallback = summarizeFindings([
      ...fx.FINDINGS,
      { ...fx.FINDINGS[0], id: "f_fb", model: "amaya-heuristic-fallback" },
    ]);
    expect(withFallback.fallbackRate).toBeGreaterThan(0);
  });
});

describe("estimateCost", () => {
  it("prices a call from the model table", () => {
    const c = estimateCost("claude-haiku-4-5", 1_000_000, 1_000_000);
    expect(c).toBeCloseTo(MODEL_PRICES["claude-haiku-4-5"].in + MODEL_PRICES["claude-haiku-4-5"].out, 6);
  });
  it("treats an unknown model as free rather than throwing", () => {
    expect(estimateCost("mystery-model", 1000, 1000)).toBe(0);
  });
});

describe("summarizeTelemetry", () => {
  const calls: AiCall[] = [
    { at: 1, provider: "openai", model: "gpt-4o-mini", ms: 800, inputTokens: 1000, outputTokens: 300, ok: true },
    { at: 2, provider: "anthropic", model: "claude-haiku-4-5", ms: 1200, inputTokens: 2000, outputTokens: 400, ok: true },
    { at: 3, provider: "openai", model: "amaya-heuristic-fallback", ms: 0, inputTokens: 0, outputTokens: 0, ok: false },
  ];
  const t = summarizeTelemetry(calls);

  it("rolls up calls, fallback rate, latency, tokens, and cost", () => {
    expect(t.calls).toBe(3);
    expect(t.fallbacks).toBe(1);
    expect(t.fallbackRate).toBeCloseTo(1 / 3, 5);
    expect(t.avgMs).toBeCloseTo((800 + 1200 + 0) / 3, 5);
    expect(t.totalInputTokens).toBe(3000);
    expect(t.totalOutputTokens).toBe(700);
    expect(t.estCostUsd).toBeGreaterThan(0);
  });

  it("handles an empty buffer", () => {
    expect(summarizeTelemetry([])).toMatchObject({ calls: 0, fallbackRate: 0, avgMs: 0, estCostUsd: 0 });
  });
});
