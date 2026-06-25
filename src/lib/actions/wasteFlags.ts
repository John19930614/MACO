"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { serverSecrets, MOCK_MODE } from "@/lib/env";
import { getServerTenantId, getServerProfileId } from "@/lib/auth/session";
import type { WasteFlagStatus } from "@/lib/types";

function svc() {
  const { serviceRoleKey } = serverSecrets();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const VALID_STATUSES = new Set<WasteFlagStatus>([
  "open", "under_review", "not_applicable", "confirmed", "closed",
]);

/**
 * Raise a waste-review flag for a chemical. These are review PROMPTS only —
 * they never assign a legal waste code. Service-role write, tenant-scoped with
 * an ownership check so a chemical from another tenant can't be flagged.
 */
export async function flagChemicalForWasteReview(input: {
  chemicalId: string;
  triggerSource: string;
  triggerValue: string;
  potentialWasteConcern: string;
  suggestedReviewArea?: string;
}): Promise<{ ok: true; flagId: string } | { ok: false; error: string }> {
  if (MOCK_MODE) return { ok: false, error: "Waste flags require a live database (not available in demo mode)." };

  const tenantId = await getServerTenantId();
  if (!tenantId) return { ok: false, error: "Not authenticated" };

  const db = svc();

  const { data: chem, error: chemErr } = await db
    .from("chemical_inventory")
    .select("id, tenant_id, site_id")
    .eq("id", input.chemicalId)
    .eq("tenant_id", tenantId)
    .single();

  if (chemErr || !chem) return { ok: false, error: "Chemical not found for this tenant" };

  const { data: inserted, error: insertErr } = await db
    .from("chemical_waste_review_flags")
    .insert({
      tenant_id:               tenantId,
      site_id:                 chem.site_id ?? null,
      chemical_id:             input.chemicalId,
      trigger_source:          input.triggerSource,
      trigger_value:           input.triggerValue,
      potential_waste_concern: input.potentialWasteConcern,
      suggested_review_area:   input.suggestedReviewArea ?? null,
      status:                  "open",
    })
    .select("id")
    .single();

  if (insertErr || !inserted) return { ok: false, error: insertErr?.message ?? "Failed to create flag" };
  revalidatePath("/chemicals");
  return { ok: true, flagId: inserted.id };
}

/**
 * Advance a waste-review flag through its review lifecycle. Records the
 * reviewer, notes, and (on resolution) the final determination.
 */
export async function updateWasteFlagStatus(input: {
  flagId: string;
  status: WasteFlagStatus;
  reviewerNotes?: string;
  finalDetermination?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (MOCK_MODE) return { ok: false, error: "Waste flags require a live database (not available in demo mode)." };
  if (!VALID_STATUSES.has(input.status)) return { ok: false, error: "Invalid status" };

  const tenantId = await getServerTenantId();
  const profileId = await getServerProfileId();
  if (!tenantId) return { ok: false, error: "Not authenticated" };

  const resolved = input.status === "confirmed" || input.status === "closed" || input.status === "not_applicable";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {
    status:         input.status,
    reviewer_notes: input.reviewerNotes ?? null,
    reviewed_by:    resolved ? profileId : null,
    reviewed_at:    resolved ? new Date().toISOString() : null,
  };
  if (input.finalDetermination !== undefined) patch.final_determination = input.finalDetermination;

  const { error } = await svc()
    .from("chemical_waste_review_flags")
    .update(patch)
    .eq("id", input.flagId)
    .eq("tenant_id", tenantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/chemicals");
  return { ok: true };
}
