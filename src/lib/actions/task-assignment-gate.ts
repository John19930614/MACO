"use server";

import { MOCK_MODE } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerTenantId, getServerProfileId } from "@/lib/auth/session";
import {
  decideGate,
  type GateDecision,
  type GateProfile,
  type HazardousTaskRule,
} from "@/lib/young-worker/gate-logic";

// Core hard-gate. Adapted to this platform: keyed by profile_id + tenant_id
// (no `workers`/`organizations`/`task_assignments` tables). It is a standalone
// evaluator + logger — a future task-assignment or equipment-checkout flow calls
// evaluateTaskAssignmentGate() and, for the hard stop, enforceEquipmentCheckoutGate().

export type { GateDecision };

export type TaskGateInput = {
  profileId: string;
  taskCode: string;
  equipmentCode?: string;
  scheduledAt: string; // ISO datetime of assignment start
  supervisionDocumented?: boolean;
};

const ALLOW: GateDecision = { decision: "allowed", reasons: [], ruleIdsMatched: [] };

export async function evaluateTaskAssignmentGate(
  input: TaskGateInput,
): Promise<GateDecision> {
  // Mock/demo mode has no young_workers data — treat as an adult (no gate).
  if (MOCK_MODE) return ALLOW;

  const supabase = await createSupabaseServerClient();
  const tenantId = await getServerTenantId();
  if (!supabase || !tenantId) {
    // Fail SAFE: if we cannot verify age/permit status, block rather than allow.
    return {
      decision: "blocked",
      reasons: [
        "Unable to verify the worker's age and permit status. Assignment blocked until resolved.",
      ],
      ruleIdsMatched: [],
    };
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("young_workers")
    .select("*")
    .eq("profile_id", input.profileId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (profileError) {
    return {
      decision: "blocked",
      reasons: [
        "Unable to verify the worker's age and permit status. Assignment blocked until resolved.",
      ],
      ruleIdsMatched: [],
    };
  }

  // Not a registered young worker → adult flow, no gate applies.
  if (!profileRow) return ALLOW;

  const profile = profileRow as GateProfile & {
    id: string;
    work_permit_expiry_date: string | null;
  };

  const { data: ruleRows } = await supabase
    .from("hazardous_task_rules")
    .select("*")
    .in("jurisdiction", ["FEDERAL", profile.work_state])
    .eq("task_code", input.taskCode);

  const rules = (ruleRows ?? []) as HazardousTaskRule[];

  const result = decideGate(profile, rules, {
    taskCode: input.taskCode,
    equipmentCode: input.equipmentCode,
    scheduledAt: input.scheduledAt,
    supervisionDocumented: input.supervisionDocumented,
  });

  const evaluatedBy = await getServerProfileId();

  await supabase.from("task_assignment_gate_log").insert({
    tenant_id: tenantId,
    profile_id: input.profileId,
    task_code: input.taskCode,
    equipment_code: input.equipmentCode ?? null,
    decision: result.decision,
    reasons: result.reasons,
    rule_ids_matched: result.ruleIdsMatched,
    evaluated_by: evaluatedBy,
  });

  // Permit-expiry alerting (dedup: don't re-raise an already-open alert).
  if (profile.work_permit_expiry_date) {
    const daysToExpiry = Math.floor(
      (new Date(profile.work_permit_expiry_date).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24),
    );
    if (daysToExpiry <= 14) {
      const alertType = daysToExpiry < 0 ? "permit_expired" : "permit_expiring";
      const { data: existing } = await supabase
        .from("young_worker_alerts")
        .select("id")
        .eq("young_worker_id", profile.id)
        .eq("alert_type", alertType)
        .eq("status", "open")
        .maybeSingle();
      if (!existing) {
        await supabase.from("young_worker_alerts").insert({
          tenant_id: tenantId,
          young_worker_id: profile.id,
          alert_type: alertType,
          details: { daysToExpiry, taskCode: input.taskCode },
        });
      }
    }
  }

  return result;
}

/**
 * Hard stop for equipment check-out / point-of-use. Throws when the gate blocks,
 * so the calling flow cannot proceed with a prohibited assignment.
 */
export async function enforceEquipmentCheckoutGate(
  input: TaskGateInput,
): Promise<GateDecision> {
  const result = await evaluateTaskAssignmentGate(input);
  if (result.decision === "blocked") {
    throw new Error(
      result.reasons.join(" ") || "This assignment is not permitted for this worker.",
    );
  }
  return result;
}
