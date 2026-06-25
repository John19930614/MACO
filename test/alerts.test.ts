import { describe, it, expect } from "vitest";
import { detectAiAnomalies, DEFAULT_AI_THRESHOLDS } from "@/lib/analytics/alerts";
import type { TelemetrySummary } from "@/lib/analytics/ai";

const summary = (o: Partial<TelemetrySummary> = {}): TelemetrySummary => ({
  calls: 100, fallbacks: 0, fallbackRate: 0, avgMs: 1000,
  totalInputTokens: 0, totalOutputTokens: 0, estCostUsd: 0, ...o,
});

describe("detectAiAnomalies", () => {
  it("returns nothing for a healthy window", () => {
    expect(detectAiAnomalies(summary())).toHaveLength(0);
  });

  it("returns nothing when there are no calls", () => {
    expect(detectAiAnomalies(summary({ calls: 0, fallbackRate: 1, avgMs: 99999, estCostUsd: 999 }))).toHaveLength(0);
  });

  it("warns on an elevated fallback rate", () => {
    const a = detectAiAnomalies(summary({ fallbacks: 30, fallbackRate: 0.3 }));
    expect(a.some((x) => x.key === "fallback_rate" && x.severity === "warn")).toBe(true);
  });

  it("escalates to critical at 2x the threshold", () => {
    const a = detectAiAnomalies(summary({ fallbacks: 60, fallbackRate: 0.6 }));
    expect(a.find((x) => x.key === "fallback_rate")?.severity).toBe("critical");
  });

  it("flags latency and cost over budget", () => {
    const a = detectAiAnomalies(summary({ avgMs: 9000, estCostUsd: 6 }));
    expect(a.map((x) => x.key).sort()).toEqual(["avg_latency", "cost"]);
  });

  it("honours custom thresholds", () => {
    expect(detectAiAnomalies(summary({ estCostUsd: 3 }), { maxCostUsd: 2 }).some((x) => x.key === "cost")).toBe(true);
    expect(detectAiAnomalies(summary({ estCostUsd: 3 }), { maxCostUsd: 10 })).toHaveLength(0);
  });

  it("uses sane defaults", () => {
    expect(DEFAULT_AI_THRESHOLDS.maxFallbackRate).toBeGreaterThan(0);
    expect(DEFAULT_AI_THRESHOLDS.maxCostUsd).toBeGreaterThan(0);
  });
});
