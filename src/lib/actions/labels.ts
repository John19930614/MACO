"use server";

import { createClient } from "@supabase/supabase-js";
import { serverSecrets, MOCK_MODE } from "@/lib/env";
import { getServerTenantId, getServerProfileId } from "@/lib/auth/session";

function svc() {
  const { serviceRoleKey } = serverSecrets();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// Snapshot of exactly what was on the label at print time — the compliance record.
export interface LabelSnapshot {
  product_name: string;
  cas_number: string | null;
  supplier: string | null;
  storage_location: string | null;
  signal_word: "Danger" | "Warning" | null;
  pictogram_codes: string[];
  hazard_statements: { code: string; text: string }[];
  precautionary_statements: { code: string; text: string }[];
  regulatory_basis: string;
}

const VALID_LABEL_TYPES = new Set([
  "primary_container", "secondary_container", "small_container",
  "waste_container", "workplace_hmis_nfpa", "dot_shipping_review",
]);

/**
 * Record a GHS label print into label_print_log (append-only audit trail).
 * Service-role write, manually tenant-scoped, with an ownership check so a
 * chemical_id from another tenant can never be logged.
 */
export async function logLabelPrint(input: {
  chemicalId: string;
  snapshot: LabelSnapshot;
  labelType?: string;
  quantity?: number;
  containerDescription?: string;
  locationDescription?: string;
  printReason?: string;
}): Promise<{ ok: true; logId: string } | { ok: false; error: string }> {
  // In mock/demo mode there is no live DB — printing still works, just unlogged.
  if (MOCK_MODE) return { ok: true, logId: "mock" };

  const tenantId = await getServerTenantId();
  const profileId = await getServerProfileId();
  if (!tenantId) return { ok: false, error: "Not authenticated" };

  const labelType = input.labelType && VALID_LABEL_TYPES.has(input.labelType)
    ? input.labelType
    : "secondary_container";

  const db = svc();

  // Ownership check: the chemical must belong to the caller's tenant.
  const { data: chem, error: chemErr } = await db
    .from("chemical_inventory")
    .select("id, tenant_id, site_id")
    .eq("id", input.chemicalId)
    .eq("tenant_id", tenantId)
    .single();

  if (chemErr || !chem) return { ok: false, error: "Chemical not found for this tenant" };

  const { data: inserted, error: insertErr } = await db
    .from("label_print_log")
    .insert({
      tenant_id:             tenantId,
      site_id:               chem.site_id ?? null,
      chemical_id:           input.chemicalId,
      label_type:            labelType,
      printed_by:            profileId,
      quantity:              Math.max(1, Math.floor(input.quantity ?? 1)),
      container_description: input.containerDescription ?? null,
      location_description:  input.locationDescription ?? null,
      print_reason:          input.printReason ?? null,
      label_snapshot_json:   input.snapshot,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) return { ok: false, error: insertErr?.message ?? "Failed to log print" };
  return { ok: true, logId: inserted.id };
}
