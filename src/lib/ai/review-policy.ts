/**
 * Human-review calibration policy (pure, deterministic).
 *
 * The engine no longer trusts the model's own "human_review_required" flag
 * alone. This policy escalates a finding to human review when it is high-stakes
 * or when low model confidence coincides with a consequential risk — and never
 * auto-clears a finding the grounding gateway failed. Confidence and severity
 * interact: a low-confidence, low-risk finding is left alone (it would only add
 * noise), but low confidence on a medium-or-worse finding gets a human.
 */
import type { AiGatewayReview } from "@/lib/types";

/** Below this model confidence (0–1), a consequential finding is escalated. */
export const LOW_CONFIDENCE_REVIEW = 0.55;
/** At/above this 0–100 risk score, a finding is always reviewed regardless of confidence. */
export const HIGH_RISK_REVIEW = 70;
/** Risk at/above which low confidence starts to matter (low↔medium band boundary). */
export const MODERATE_RISK = 25;

export interface ReviewSignals {
  /** Model/heuristic asked for review, or a hard domain rule forced it. */
  baseRequired: boolean;
  gatewayStatus: AiGatewayReview["status"];
  confidence: number; // 0–1
  riskScore: number;  // 0–100
}

export function requiresHumanReview(s: ReviewSignals): boolean {
  if (s.baseRequired) return true;
  if (s.gatewayStatus === "fail") return true;
  if (s.riskScore >= HIGH_RISK_REVIEW) return true;
  if (s.confidence < LOW_CONFIDENCE_REVIEW && s.riskScore >= MODERATE_RISK) return true;
  return false;
}
