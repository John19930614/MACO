/**
 * AI observability helpers (pure, testable). Two angles:
 *   • summarizeFindings — health of the AI engine from the stored findings
 *     (model mix, fallback rate, avg confidence, human-review rate). Works in
 *     mock and live, since findings exist in both.
 *   • estimateCost / summarizeTelemetry — token & latency rollups for the live
 *     per-call telemetry buffer (src/lib/ai/telemetry.ts).
 */
import type { AiFinding } from "@/lib/types";

export interface FindingsSummary {
  total: number;
  byModel: Record<string, number>;
  fallbackRate: number; // share produced by the heuristic (model + fallback)
  humanReviewRate: number;
  pending: number;
  avgConfidence: number;
}

export function summarizeFindings(findings: AiFinding[]): FindingsSummary {
  const total = findings.length;
  const byModel: Record<string, number> = {};
  let heuristic = 0;
  let humanReview = 0;
  let pending = 0;
  let confSum = 0;
  for (const f of findings) {
    byModel[f.model] = (byModel[f.model] ?? 0) + 1;
    if (f.model.startsWith("safetyiq-heuristic")) heuristic++;
    if (f.human_review_required) humanReview++;
    if (f.review_status === "pending") pending++;
    confSum += f.confidence;
  }
  return {
    total,
    byModel,
    fallbackRate: total ? heuristic / total : 0,
    humanReviewRate: total ? humanReview / total : 0,
    pending,
    avgConfidence: total ? confSum / total : 0,
  };
}

// USD per 1M tokens (input / output). Anthropic prices per the model catalog;
// gpt-4o-mini per OpenAI. Unknown models cost 0 so estimates never throw.
export const MODEL_PRICES: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-opus-4-8": { in: 5, out: 25 },
};

/** Estimated USD cost of a single call given its model + token usage. */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICES[model] ?? { in: 0, out: 0 };
  return (inputTokens / 1e6) * p.in + (outputTokens / 1e6) * p.out;
}

export interface AiCall {
  at: number; // epoch ms
  provider: string;
  model: string;
  ms: number;
  inputTokens: number;
  outputTokens: number;
  ok: boolean; // false = fell back to the heuristic
}

export interface TelemetrySummary {
  calls: number;
  fallbacks: number;
  fallbackRate: number;
  avgMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estCostUsd: number;
}

export function summarizeTelemetry(calls: AiCall[]): TelemetrySummary {
  const n = calls.length;
  const fallbacks = calls.filter((c) => !c.ok).length;
  const avgMs = n ? calls.reduce((s, c) => s + c.ms, 0) / n : 0;
  const totalInput = calls.reduce((s, c) => s + c.inputTokens, 0);
  const totalOutput = calls.reduce((s, c) => s + c.outputTokens, 0);
  const estCost = calls.reduce((s, c) => s + estimateCost(c.model, c.inputTokens, c.outputTokens), 0);
  return {
    calls: n,
    fallbacks,
    fallbackRate: n ? fallbacks / n : 0,
    avgMs,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    estCostUsd: estCost,
  };
}
