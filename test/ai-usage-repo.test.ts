import { describe, it, expect } from "vitest";
import { summarizePeriod, getAiUsageSummary, type AiUsageRow } from "@/lib/data/aiUsageRepo";
import { recordAiCall } from "@/lib/ai/telemetry";

describe("summarizePeriod", () => {
  it("returns hasData=false and a null (not zero) cost when there are no rows", () => {
    expect(summarizePeriod([])).toEqual({ runCount: 0, estimatedCostUsd: null, hasData: false });
  });

  it("sums per-row estimated cost across known models", () => {
    const rows: AiUsageRow[] = [
      { model: "claude-haiku-4-5", inputTokens: 1_000_000, outputTokens: 0 }, // $1.00
      { model: "claude-sonnet-5", inputTokens: 0, outputTokens: 1_000_000 }, // $15.00
    ];
    const result = summarizePeriod(rows);
    expect(result.runCount).toBe(2);
    expect(result.hasData).toBe(true);
    expect(result.estimatedCostUsd).toBeCloseTo(16, 5);
  });

  it("treats an unrecognized model as $0 rather than throwing", () => {
    const result = summarizePeriod([{ model: "some-future-model", inputTokens: 500, outputTokens: 500 }]);
    expect(result.runCount).toBe(1);
    expect(result.estimatedCostUsd).toBe(0);
  });
});

describe("getAiUsageSummary (mock mode)", () => {
  it("reflects a freshly recorded call in both the today and month rollups", async () => {
    recordAiCall({
      provider: "test-prov",
      model: "ai-usage-repo-test-model",
      ms: 5,
      inputTokens: 1000,
      outputTokens: 1000,
      ok: true,
    });

    const summary = await getAiUsageSummary();

    expect(summary.today.hasData).toBe(true);
    expect(summary.today.runCount).toBeGreaterThanOrEqual(1);
    expect(summary.today.estimatedCostUsd).not.toBeNull();

    // The month-to-date rollup must include everything the today rollup does.
    expect(summary.month.runCount).toBeGreaterThanOrEqual(summary.today.runCount);
    expect(summary.month.hasData).toBe(true);
  });
});

// NOTE: this panel is intentionally platform-wide (not scoped by tenant) —
// ai_telemetry logs the platform's own AI Gateway calls, many of which have no
// tenant_id at all (e.g. platform review scans), so a tenant filter would
// undercount real usage. See the doc comment on getAiUsageSummary.
