/**
 * Model tiering (pure). The engine routes each analysis to a model tier by its
 * stakes: routine work goes to a cheaper "triage" model, high-stakes work
 * (scheduled/CMR chemicals, material compliance gaps, high/critical cells) is
 * escalated to the stronger "deep" model. Concrete models are resolved at the
 * provider boundary and recorded per call, so the cost split is visible in
 * telemetry. Both tiers are env-overridable so routing is tunable without a
 * redeploy.
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
