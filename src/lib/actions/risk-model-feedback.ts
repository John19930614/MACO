"use server";

// ============================================================
// Phase 5 — feedback capture. Records whether a leading-indicator
// recommendation was followed and whether risk actually decreased afterward, for
// use as reweighting input. Manager/admin (or Reliance superadmin) gated,
// validated with zod. Returns { ok } results — never throws to the caller —
// matching the rest of the predictive-risk action layer.
// ============================================================

import { z } from "zod";
import { canManage } from "@/lib/constants";
import { resolveCallerRole } from "@/lib/auth/resolve-role";
import { isSuperadmin } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/server";

const feedbackSchema = z.object({
  recommendationId: z.string().uuid(),
  siteId: z.string().uuid(),
  wasFollowed: z.boolean(),
  riskScoreBefore: z.number().min(0).max(100),
  riskScoreAfter: z.number().min(0).max(100).nullable(),
  observedAt: z.string().datetime(),
  notes: z.string().max(2000).optional(),
});

export type RiskModelFeedbackInput = z.infer<typeof feedbackSchema>;

export async function submitRiskModelFeedback(input: RiskModelFeedbackInput) {
  // Role gate first — a manager, admin, or Reliance superadmin only.
  const role = await resolveCallerRole();
  const allowed = (role && canManage(role)) || (await isSuperadmin());
  if (!allowed) {
    return {
      ok: false as const,
      error: "Only an EHS manager or admin can submit risk-model feedback.",
    };
  }

  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Please check the highlighted fields.",
      issues: parsed.error.flatten(),
    };
  }

  const client = createServiceRoleClient();
  if (!client) {
    return {
      ok: false as const,
      error: "Feedback is saved on a connected staging/live environment, not in demo mode.",
    };
  }

  const { error } = await client.from("risk_model_feedback").insert({
    recommendation_id: parsed.data.recommendationId,
    site_id: parsed.data.siteId,
    was_followed: parsed.data.wasFollowed,
    risk_score_before: parsed.data.riskScoreBefore,
    risk_score_after: parsed.data.riskScoreAfter,
    observed_at: parsed.data.observedAt,
    notes: parsed.data.notes ?? null,
  });

  if (error) {
    return { ok: false as const, error: "Could not save feedback. Please try again." };
  }

  return { ok: true as const };
}
