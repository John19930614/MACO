"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { serverSecrets, MOCK_MODE } from "@/lib/env";
import { getServerTenantId, getServerProfileId } from "@/lib/auth/session";
import { resolveCallerRole } from "@/lib/auth/resolve-role";
import { COORDINATOR_ROLES } from "@/lib/constants";
import { computeGeneratorCategory } from "@/lib/waste/generator-category";

// Service-role client for tenant-checked writes (mirrors wasteFlags.ts). RLS is
// still enforced for reads via the session client elsewhere; every write here is
// guarded by an explicit tenant match on the target site.
function svc() {
  const { serviceRoleKey } = serverSecrets();
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const inputSchema = z.object({
  siteId: z.string().uuid(),
  periodYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12),
  hazardousWasteKg: z.number().min(0),
  acuteHazardousWasteKg: z.number().min(0),
});

export type UpsertTallyInput = z.infer<typeof inputSchema>;

/**
 * Upsert a site's monthly hazardous-waste tally, recompute the EPA generator
 * category, and — only when the category actually changes — denormalize it onto
 * the site row and open a generator_category_change compliance action.
 *
 * Coordinator+ roles only. Tenant-scoped: the site must belong to the caller's
 * tenant or the write is refused.
 */
export async function upsertMonthlyWasteTally(
  input: UpsertTallyInput,
): Promise<
  | { ok: true; generatorCategory: "VSQG" | "SQG" | "LQG"; changed: boolean }
  | { ok: false; error: string }
> {
  if (MOCK_MODE) {
    return { ok: false, error: "Recording waste tallies requires a live database (not available in demo mode)." };
  }

  const role = await resolveCallerRole();
  if (!role || !COORDINATOR_ROLES.includes(role)) {
    return { ok: false, error: "You don't have permission to record waste tallies." };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the highlighted fields." };
  }
  const data = parsed.data;

  const tenantId = await getServerTenantId();
  if (!tenantId) return { ok: false, error: "Not authenticated" };
  const profileId = await getServerProfileId();

  const db = svc();

  // Confirm the site belongs to this tenant before touching anything.
  const { data: site, error: siteError } = await db
    .from("sites")
    .select("id, current_generator_category")
    .eq("id", data.siteId)
    .eq("tenant_id", tenantId)
    .single();
  if (siteError || !site) return { ok: false, error: "Site not found for this tenant" };

  const newCategory = computeGeneratorCategory(data.hazardousWasteKg, data.acuteHazardousWasteKg);
  const nowIso = new Date().toISOString();

  const { error: upsertError } = await db
    .from("waste_monthly_tally")
    .upsert(
      {
        tenant_id: tenantId,
        site_id: data.siteId,
        period_year: data.periodYear,
        period_month: data.periodMonth,
        hazardous_waste_kg: data.hazardousWasteKg,
        acute_hazardous_waste_kg: data.acuteHazardousWasteKg,
        generator_category: newCategory,
        prior_generator_category: site.current_generator_category ?? null,
        computed_at: nowIso,
        created_by: profileId,
        updated_at: nowIso,
      },
      { onConflict: "site_id,period_year,period_month" },
    );
  if (upsertError) return { ok: false, error: upsertError.message };

  const changed = site.current_generator_category !== newCategory;
  if (changed) {
    const { error: siteUpdateError } = await db
      .from("sites")
      .update({ current_generator_category: newCategory, generator_category_updated_at: nowIso })
      .eq("id", data.siteId)
      .eq("tenant_id", tenantId);
    if (siteUpdateError) return { ok: false, error: siteUpdateError.message };

    // LQG is the most heavily regulated status → flag it as high severity.
    await db.from("waste_compliance_action").insert({
      tenant_id: tenantId,
      site_id: data.siteId,
      action_type: "generator_category_change",
      severity: newCategory === "LQG" ? "high" : "medium",
      details: {
        from: site.current_generator_category,
        to: newCategory,
        periodYear: data.periodYear,
        periodMonth: data.periodMonth,
      },
    });
  }

  revalidatePath("/waste/compliance");
  return { ok: true, generatorCategory: newCategory, changed };
}
