"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { serverSecrets, MOCK_MODE } from "@/lib/env";
import { getServerTenantId, getServerProfileId } from "@/lib/auth/session";
import { resolveCallerRole } from "@/lib/auth/resolve-role";
import { COORDINATOR_ROLES, MANAGER_ROLES } from "@/lib/constants";
import { computeReductionTargetQty, computeRoiPct } from "@/lib/waste/minimization";

function svc() {
  const { serviceRoleKey } = serverSecrets();
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const programSchema = z.object({
  siteId: z.string().uuid().optional(),
  name: z.string().min(1),
  wasteStream: z.string().optional(),
  baselineYear: z.number().int().min(1990).max(2100),
  baselineQuantityKg: z.number().min(0),
  reductionTargetPct: z.number().min(0).max(100),
  ownerId: z.string().uuid().optional(),
  dueDate: z.string().min(1),
  estimatedCost: z.number().min(0).optional(),
  estimatedSavings: z.number().min(0).optional(),
});

export type MinimizationProgramInput = z.infer<typeof programSchema>;

/**
 * Create or update a waste-minimization program. Coordinator+ roles. New
 * programs always start in 'draft' — approval is a separate manager-gated step.
 */
export async function upsertMinimizationProgram(
  input: MinimizationProgramInput,
  programId?: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (MOCK_MODE) {
    return { ok: false, error: "Minimization programs require a live database (not available in demo mode)." };
  }

  const role = await resolveCallerRole();
  if (!role || !COORDINATOR_ROLES.includes(role)) {
    return { ok: false, error: "You don't have permission to manage minimization programs." };
  }

  const parsed = programSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the highlighted fields." };
  }
  const data = parsed.data;

  const tenantId = await getServerTenantId();
  if (!tenantId) return { ok: false, error: "Not authenticated" };
  const profileId = await getServerProfileId();

  const targetQty = computeReductionTargetQty(data.baselineQuantityKg, data.reductionTargetPct);
  const roi = computeRoiPct(data.estimatedCost, data.estimatedSavings);

  const payload = {
    tenant_id: tenantId,
    site_id: data.siteId ?? null,
    name: data.name,
    waste_stream: data.wasteStream ?? null,
    baseline_year: data.baselineYear,
    baseline_quantity_kg: data.baselineQuantityKg,
    reduction_target_pct: data.reductionTargetPct,
    reduction_target_quantity_kg: targetQty,
    owner_id: data.ownerId ?? null,
    due_date: data.dueDate,
    estimated_cost: data.estimatedCost ?? null,
    estimated_savings: data.estimatedSavings ?? null,
    estimated_roi_pct: roi,
    updated_at: new Date().toISOString(),
  };

  const db = svc();

  if (programId) {
    // Scope the update to the caller's tenant so cross-tenant edits are refused.
    const { data: updated, error } = await db
      .from("waste_minimization_program")
      .update(payload)
      .eq("id", programId)
      .eq("tenant_id", tenantId)
      .select("id")
      .single();
    if (error || !updated) return { ok: false, error: error?.message ?? "Program not found for this tenant" };
    revalidatePath("/waste/compliance");
    return { ok: true, id: updated.id };
  }

  const { data: inserted, error } = await db
    .from("waste_minimization_program")
    .insert({ ...payload, created_by: profileId })
    .select("id")
    .single();
  if (error || !inserted) return { ok: false, error: error?.message ?? "Failed to create program" };
  revalidatePath("/waste/compliance");
  return { ok: true, id: inserted.id };
}

/**
 * Approve a minimization program. Manager roles only (safety_manager /
 * ehs_manager / admin) — coordinators can create/edit but not approve.
 */
export async function approveMinimizationProgram(
  programId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (MOCK_MODE) {
    return { ok: false, error: "Approvals require a live database (not available in demo mode)." };
  }

  const role = await resolveCallerRole();
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { ok: false, error: "Only an EHS/safety manager or admin can approve a program." };
  }

  const tenantId = await getServerTenantId();
  if (!tenantId) return { ok: false, error: "Not authenticated" };
  const profileId = await getServerProfileId();

  const { data: updated, error } = await svc()
    .from("waste_minimization_program")
    .update({
      approval_status: "approved",
      approved_by: profileId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", programId)
    .eq("tenant_id", tenantId)
    .select("id")
    .single();
  if (error || !updated) return { ok: false, error: error?.message ?? "Program not found for this tenant" };
  revalidatePath("/waste/compliance");
  return { ok: true };
}

/**
 * Fire overdue_minimization_target actions for programs past their due date that
 * have not been reviewed or completed. Idempotent: skips programs that already
 * have an open action of the same type, so re-running never duplicates.
 */
export async function checkOverdueMinimizationTargets(
  tenantId: string,
): Promise<{ ok: true; opened: number } | { ok: false; error: string }> {
  if (MOCK_MODE) return { ok: false, error: "Requires a live database." };

  const sessionTenant = await getServerTenantId();
  if (!sessionTenant || sessionTenant !== tenantId) {
    return { ok: false, error: "Tenant mismatch" };
  }

  const db = svc();
  const today = new Date().toISOString().slice(0, 10);

  const { data: overdue, error } = await db
    .from("waste_minimization_program")
    .select("id, site_id, due_date")
    .eq("tenant_id", tenantId)
    .lt("due_date", today)
    .is("effectiveness_review_date", null)
    .neq("status", "completed");
  if (error) return { ok: false, error: error.message };

  let opened = 0;
  for (const program of overdue ?? []) {
    const { data: existing } = await db
      .from("waste_compliance_action")
      .select("id")
      .eq("reference_id", program.id)
      .eq("action_type", "overdue_minimization_target")
      .eq("status", "open")
      .maybeSingle();
    if (existing) continue;

    await db.from("waste_compliance_action").insert({
      tenant_id: tenantId,
      site_id: program.site_id ?? null,
      action_type: "overdue_minimization_target",
      reference_id: program.id,
      severity: "high",
      details: { dueDate: program.due_date },
    });
    opened += 1;
  }
  return { ok: true, opened };
}
