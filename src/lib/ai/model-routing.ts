/**
 * Model tiering (pure). The engine routes each analysis to a model tier by its
 * stakes: routine work goes to a cheaper "triage" model, high-stakes work
 * (scheduled/CMR chemicals, material compliance gaps, high/critical cells) is
 * escalated to the stronger "deep" model. Concrete models are resolved at the
 * provider boundary and recorded per call, so the cost split is visible in
 * telemetry. Both tiers are env-overridable so routing is tunable without a
 * redeploy.
 *
 * Benchmark note (2026-07-02, /sa/gateway → AI Model Benchmark):
 *   Models compared: claude-sonnet-4-6 (then-default), claude-haiku-4-5
 *                    (triage), claude-sonnet-5, claude-opus-4-8.
 *   Result: UPGRADE — claude-sonnet-5 scored 100/100 completeness, 0 failures,
 *   $0.0151/call vs claude-sonnet-4-6's 75/100 (2 timeouts + 1 non-answer) at
 *   the same $3/$15 sticker. Opus 4.8 scored 87.5 at 34% higher cost.
 *   Approved by: John Haldemann, 2026-07-02. Default changed in src/lib/env.ts.
 *   Triage tier unchanged (claude-haiku-4-5).
 */
export type ModelTier = "triage" | "deep";

/** Cheaper default for routine analyses. */
export const DEFAULT_TRIAGE_MODEL = "claude-haiku-4-5";

/**
 * Resolve a tier to a concrete Anthropic model. "deep" falls back to the
 * platform's configured model; "triage" to a cheaper model. Overridable via
 * SAFETYIQ_AI_MODEL_DEEP / SAFETYIQ_AI_MODEL_TRIAGE.
 */
export function anthropicModelForTier(tier: ModelTier, configuredModel: string): string {
  if (tier === "deep") return process.env.SAFETYIQ_AI_MODEL_DEEP || configuredModel;
  return process.env.SAFETYIQ_AI_MODEL_TRIAGE || DEFAULT_TRIAGE_MODEL;
}

/** Map a binary stakes signal to a tier. */
export function tierForStakes(highStakes: boolean): ModelTier {
  return highStakes ? "deep" : "triage";
}
