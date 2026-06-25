import { describe, it, expect } from "vitest";
import { requiresHumanReview, LOW_CONFIDENCE_REVIEW, HIGH_RISK_REVIEW, MODERATE_RISK } from "@/lib/ai/review-policy";

const sig = (o: Partial<Parameters<typeof requiresHumanReview>[0]> = {}) => ({
  baseRequired: false,
  gatewayStatus: "pass" as const,
  confidence: 0.8,
  riskScore: 10,
  ...o,
});

describe("requiresHumanReview", () => {
  it("respects an explicit base requirement", () => {
    expect(requiresHumanReview(sig({ baseRequired: true }))).toBe(true);
  });

  it("always escalates a grounding-gateway failure", () => {
    expect(requiresHumanReview(sig({ gatewayStatus: "fail", confidence: 0.95, riskScore: 5 }))).toBe(true);
  });

  it("does NOT escalate a confident, low-risk, clean finding", () => {
    expect(requiresHumanReview(sig({ confidence: 0.9, riskScore: 10, gatewayStatus: "pass" }))).toBe(false);
  });

  it("escalates any high-risk finding regardless of confidence", () => {
    expect(requiresHumanReview(sig({ riskScore: HIGH_RISK_REVIEW, confidence: 0.95 }))).toBe(true);
  });

  it("escalates low confidence ONLY when the finding is at least moderately consequential", () => {
    // low confidence + trivial risk → left alone (would only add noise)
    expect(requiresHumanReview(sig({ confidence: LOW_CONFIDENCE_REVIEW - 0.1, riskScore: MODERATE_RISK - 1 }))).toBe(false);
    // low confidence + moderate risk → escalate
    expect(requiresHumanReview(sig({ confidence: LOW_CONFIDENCE_REVIEW - 0.1, riskScore: MODERATE_RISK }))).toBe(true);
  });

  it("does not escalate a confident finding at moderate risk", () => {
    expect(requiresHumanReview(sig({ confidence: 0.8, riskScore: MODERATE_RISK }))).toBe(false);
  });
});
