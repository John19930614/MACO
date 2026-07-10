"use server";

// ============================================================
// Phase 5 — automated reweighting/retuning proposal + human approval.
//
// generateReweightProposal() computes a PROPOSED adjustment to
//   • leading_indicators.weight   (based on accumulated outcome feedback), and
//   • risk_score_bands min_score/max_score cutoffs (based on the false-positive
//     rate vs the EHS-approved tolerance),
// then writes it as a `pending_approval` row. It NEVER applies anything.
//
// approveReweightProposal() is the ONLY path that mutates the live model, and it
// updates ONLY those two reference tables. It is gated on an EHS lead
// (manager/admin/superadmin) AND on the run being statistically valid
// (p < 0.05) with an acceptable false-positive rate (<= tolerance).
//
// SAFETY INVARIANT (see docs/phase-5-learning-loop.md, verified by test item 3):
// neither function reads or writes ANY trigger / escalation / paging /
// notification table. Approval changes scoring INPUTS only — it does not enable
// alerts. Phase 4 auto-escalation stays untrusted until separate sign-off.
// ============================================================

import { z } from "zod";
import { canManage } from "@/lib/constants";
import { resolveCallerRole } from "@/lib/auth/resolve-role";
import { isSuperadmin } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { loadHistoricalValidationDataset } from "@/lib/risk-engine/validation-data";
import {
  computeBandIncidentCorrelation,
  computeFalsePositiveRate,
} from "@/lib/risk-engine/validation";

// A run below this correlation significance is never applied.
const SIGNIFICANCE_ALPHA = 0.05;
// Max fractional change to any single weight/cutoff per run — keeps the model
// evolving in small, reviewable steps rather than lurching.
const MAX_STEP_FRACTION = 0.1;
const VALIDATION_LOOKBACK_DAYS = 730;

async function requireEhsLead() {
  const role = await resolveCallerRole();
  const allowed = (role && canManage(role)) || (await isSuperadmin());
  return allowed
    ? null
    : { ok: false as const, error: "Only an EHS manager or admin can do this." };
}

interface ProposedIndicator {
  id: string;
  key: string;
  oldWeight: number;
  newWeight: number;
}
interface ProposedBand {
  id: string;
  band_key: string;
  oldMin: number;
  newMin: number;
  oldMax: number;
  newMax: number;
}

interface FeedbackRow {
  was_followed: boolean;
  risk_score_before: number | null;
  risk_score_after: number | null;
}

// ── Proposal generation (runs on a schedule, or on demand). Does NOT apply. ──
export async function generateReweightProposal() {
  const denied = await requireEhsLead();
  if (denied) return denied;

  const client = createServiceRoleClient();
  if (!client) {
    return {
      ok: false as const,
      error: "Reweighting runs on a connected staging/live environment, not in demo mode.",
    };
  }

  const dataset = await loadHistoricalValidationDataset({
    lookbackDays: VALIDATION_LOOKBACK_DAYS,
  });
  const correlation = computeBandIncidentCorrelation(dataset);
  const fp = computeFalsePositiveRate(dataset);

  const [{ data: indicators }, { data: bands }, { data: feedback }] =
    await Promise.all([
      client.from("leading_indicators").select("id, key, weight"),
      client.from("risk_score_bands").select("id, band_key, min_score, max_score"),
      client
        .from("risk_model_feedback")
        .select("was_followed, risk_score_before, risk_score_after"),
    ]);

  const feedbackRows = (feedback ?? []) as FeedbackRow[];

  const proposedIndicators: ProposedIndicator[] = (
    (indicators ?? []) as { id: string; key: string; weight: number | string }[]
  ).map((ind) => {
    const oldWeight = Number(ind.weight);
    return {
      id: ind.id,
      key: ind.key,
      oldWeight,
      newWeight: clampStep(oldWeight, indicatorAdjustment(feedbackRows)),
    };
  });

  const proposedBands = proposeBandCutoffs(
    ((bands ?? []) as {
      id: string;
      band_key: string;
      min_score: number | string;
      max_score: number | string;
    }[]).map((b) => ({
      id: b.id,
      band_key: b.band_key,
      min_score: Number(b.min_score),
      max_score: Number(b.max_score),
    })),
    fp.falsePositiveRate,
    fp.tolerance,
  );

  const { data: proposal, error } = await client
    .from("risk_model_validation_runs")
    .insert({
      status: "pending_approval",
      correlation_coefficient: correlation.correlationCoefficient,
      p_value: correlation.pValue,
      sample_size: correlation.sampleSize,
      false_positive_rate: fp.falsePositiveRate,
      fp_tolerance: fp.tolerance,
      proposed_indicators: proposedIndicators,
      proposed_bands: proposedBands,
    })
    .select()
    .single();

  if (error) {
    return { ok: false as const, error: "Could not save the reweighting proposal. Please try again." };
  }
  return { ok: true as const, proposal };
}

const proposalIdSchema = z.object({ proposalId: z.string().uuid() });

// ── Approval — the ONLY mutation of the live model. EHS-lead + validity gated. ─
export async function approveReweightProposal(input: z.infer<typeof proposalIdSchema>) {
  const denied = await requireEhsLead();
  if (denied) return denied;

  const parsed = proposalIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Please check the highlighted fields." };

  const client = createServiceRoleClient();
  if (!client) {
    return {
      ok: false as const,
      error: "Approval runs on a connected staging/live environment, not in demo mode.",
    };
  }

  const { data: proposal, error: fetchErr } = await client
    .from("risk_model_validation_runs")
    .select("*")
    .eq("id", parsed.data.proposalId)
    .single();
  if (fetchErr || !proposal) return { ok: false as const, error: "Proposal not found." };

  if (proposal.status !== "pending_approval") {
    return { ok: false as const, error: "This proposal has already been resolved." };
  }
  if (proposal.p_value == null || Number(proposal.p_value) >= SIGNIFICANCE_ALPHA) {
    return {
      ok: false as const,
      error: "This model hasn't reached statistical significance and can't be approved.",
    };
  }
  if (
    proposal.false_positive_rate != null &&
    Number(proposal.false_positive_rate) > Number(proposal.fp_tolerance)
  ) {
    return {
      ok: false as const,
      error: "The false-alarm rate is above the approved tolerance, so this can't be approved yet.",
    };
  }

  // Apply — ONLY leading_indicators.weight and risk_score_bands min/max. No
  // trigger/escalation/notification table is referenced anywhere here.
  for (const ind of (proposal.proposed_indicators ?? []) as ProposedIndicator[]) {
    const { error } = await client
      .from("leading_indicators")
      .update({ weight: ind.newWeight })
      .eq("id", ind.id);
    if (error) {
      return { ok: false as const, error: "Couldn't apply the new weights. No changes were saved." };
    }
  }
  for (const band of (proposal.proposed_bands ?? []) as ProposedBand[]) {
    const { error } = await client
      .from("risk_score_bands")
      .update({ min_score: band.newMin, max_score: band.newMax })
      .eq("id", band.id);
    if (error) {
      return { ok: false as const, error: "Couldn't apply the new cutoffs. Some weights may have changed." };
    }
  }

  await client
    .from("risk_model_validation_runs")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", parsed.data.proposalId);

  return { ok: true as const };
}

// ── Rejection — records the decision, applies nothing. ──────────────────────
export async function rejectReweightProposal(input: z.infer<typeof proposalIdSchema>) {
  const denied = await requireEhsLead();
  if (denied) return denied;

  const parsed = proposalIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Please check the highlighted fields." };

  const client = createServiceRoleClient();
  if (!client) {
    return { ok: false as const, error: "Approval runs on a connected staging/live environment, not in demo mode." };
  }

  const { error } = await client
    .from("risk_model_validation_runs")
    .update({ status: "rejected" })
    .eq("id", parsed.data.proposalId)
    .eq("status", "pending_approval");
  if (error) return { ok: false as const, error: "Could not record the rejection. Please try again." };
  return { ok: true as const };
}

// ── Adjustment math ─────────────────────────────────────────────────────────

// Bound a change to ±MAX_STEP_FRACTION of the current value (min 0.01 absolute),
// and round to 4 dp for stable, human-readable diffs.
function clampStep(current: number, delta: number): number {
  const maxStep = Math.abs(current) * MAX_STEP_FRACTION || 0.01;
  const bounded = Math.max(-maxStep, Math.min(maxStep, delta));
  return Number((current + bounded).toFixed(4));
}

// Effectiveness signal: of the recommendations that were followed and have an
// after-score, how many actually reduced risk? A ratio above 0.5 nudges weights
// up (the indicators are predictive and acting on them helps); below 0.5 nudges
// down. Neutral (0) when there isn't enough feedback yet.
function indicatorAdjustment(feedback: FeedbackRow[]): number {
  const acted = feedback.filter(
    (f) => f.was_followed && f.risk_score_after != null && f.risk_score_before != null,
  );
  if (acted.length === 0) return 0;
  const improved = acted.filter(
    (f) => Number(f.risk_score_after) < Number(f.risk_score_before),
  );
  const ratio = improved.length / acted.length;
  return (ratio - 0.5) * 0.02; // small, then bounded by clampStep
}

// Retune band cutoffs to control false positives while keeping the four bands
// contiguous. When the FP rate is over tolerance we raise the lower edges of the
// higher bands (harder to be flagged high-risk); otherwise we tighten slightly.
// green.min is pinned to 0; each band's max is set just under the next band's
// new min so [min,max] ranges never overlap or gap.
function proposeBandCutoffs(
  bands: { id: string; band_key: string; min_score: number; max_score: number }[],
  fpRate: number,
  tolerance: number,
): ProposedBand[] {
  const sorted = [...bands].sort((a, b) => a.min_score - b.min_score);
  const overTolerance = fpRate > tolerance;
  // Raise thresholds when crying wolf too often; gently lower otherwise.
  const bandDelta = overTolerance ? 0.5 : -0.2;

  const newMins = sorted.map((b, i) =>
    i === 0 ? 0 : clampStep(b.min_score, bandDelta),
  );

  return sorted.map((b, i) => {
    const isLast = i === sorted.length - 1;
    const newMax = isLast ? b.max_score : Number((newMins[i + 1] - 0.01).toFixed(4));
    return {
      id: b.id,
      band_key: b.band_key,
      oldMin: b.min_score,
      newMin: newMins[i],
      oldMax: b.max_score,
      newMax,
    };
  });
}
