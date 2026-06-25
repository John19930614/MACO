import { describe, it, expect, afterEach } from "vitest";
import { anthropicModelForTier, tierForStakes, DEFAULT_TRIAGE_MODEL } from "@/lib/ai/model-routing";

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
});

describe("tierForStakes", () => {
  it("escalates high-stakes work to the deep tier", () => {
    expect(tierForStakes(true)).toBe("deep");
    expect(tierForStakes(false)).toBe("triage");
  });
});

describe("anthropicModelForTier", () => {
  it("routes triage to the cheaper default model", () => {
    delete process.env.SAFETYIQ_AI_MODEL_TRIAGE;
    expect(anthropicModelForTier("triage", "claude-sonnet-4-6")).toBe(DEFAULT_TRIAGE_MODEL);
  });

  it("routes deep to the configured model by default", () => {
    delete process.env.SAFETYIQ_AI_MODEL_DEEP;
    expect(anthropicModelForTier("deep", "claude-sonnet-4-6")).toBe("claude-sonnet-4-6");
  });

  it("honours env overrides for both tiers", () => {
    process.env.SAFETYIQ_AI_MODEL_TRIAGE = "claude-haiku-4-5";
    process.env.SAFETYIQ_AI_MODEL_DEEP = "claude-opus-4-8";
    expect(anthropicModelForTier("triage", "claude-sonnet-4-6")).toBe("claude-haiku-4-5");
    expect(anthropicModelForTier("deep", "claude-sonnet-4-6")).toBe("claude-opus-4-8");
  });
});
