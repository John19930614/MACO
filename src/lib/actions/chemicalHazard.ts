"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerTenantId, getServerProfileId } from "@/lib/auth/session";
import { MOCK_MODE } from "@/lib/env";
import { analyzeConcentrationHazard } from "@/lib/chemicals/hazardEngine";
import type { HazardAnalysisResult, PhysicalState } from "@/lib/chemicals/hazardEngine";
import { revalidatePath } from "next/cache";

export interface HazardAnalysisInput {
  chemicalId: string;
  chemicalName: string;
  casNumber: string | null;
  hStatements: string[];
  concentrationPct: number;
  physicalState: PhysicalState;
  quantityKg: number | null;
  storageLocation: string;
  sdsExpiry: string | null;
  flashPointC?: number | null;
  expirationDate?: string | null;
  dilutionNotes?: string;
}

export interface SaveHazardReviewInput extends HazardAnalysisInput {
  result: HazardAnalysisResult;
  reviewDecision: "accepted" | "overridden";
  reviewReason: string;    // required when overriding OR when result.requiresReview
}

/** Run the hazard engine and return the result (does NOT save to DB). */
export async function runHazardAnalysis(
  input: HazardAnalysisInput,
): Promise<{ ok: boolean; result?: HazardAnalysisResult; error?: string }> {
  try {
    const result = analyzeConcentrationHazard({
      casNumber: input.casNumber,
      chemicalName: input.chemicalName,
      hStatements: input.hStatements,
      concentrationPct: input.concentrationPct,
      physicalState: input.physicalState,
      quantityKg: input.quantityKg,
      storageLocation: input.storageLocation,
      sdsExpiry: input.sdsExpiry,
      flashPointC: input.flashPointC,
      expirationDate: input.expirationDate,
      dilutionNotes: input.dilutionNotes,
    });
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Analysis failed." };
  }
}

/** Save a reviewed hazard classification to the audit log. */
export async function saveHazardReview(
  input: SaveHazardReviewInput,
): Promise<{ ok: boolean; error?: string }> {
  const {
    chemicalId, chemicalName, casNumber, concentrationPct, physicalState,
    flashPointC, expirationDate, dilutionNotes, result, reviewDecision, reviewReason,
  } = input;

  if (!reviewReason.trim()) {
    return { ok: false, error: "A reason is required to save this classification." };
  }

  // A reviewer accepting or overriding the classification finalizes it; the
  // record is no longer "pending uncertain review".
  const reviewStatus = reviewDecision === "overridden" ? "overridden" : "approved";

  const payload = {
    chemical_id: chemicalId,
    chemical_name: chemicalName,
    cas_number: casNumber,
    concentration_pct: concentrationPct,
    physical_state: physicalState,
    flash_point_c: flashPointC ?? null,
    expiration_date: expirationDate ?? null,
    dilution_notes: dilutionNotes ?? null,
    hazard_band: result.band,
    confidence: result.confidence,
    hazard_types: result.hazardTypes,
    factors: result.factors,
    plain_english_summary: result.plainEnglishSummary,
    sds_expired: result.sdsExpired,
    requires_review: result.requiresReview,
    review_decision: reviewDecision,
    review_reason: reviewReason,
  };

  if (!MOCK_MODE) {
    const client = await createSupabaseServerClient();
    if (!client) return { ok: false, error: "Session expired — please reload." };
    const tenantId = await getServerTenantId();
    if (!tenantId) return { ok: false, error: "Session expired — please reload." };
    const profileId = await getServerProfileId();

    // Write to audit log
    const { error } = await client.from("audit_log").insert({
      tenant_id: tenantId,
      actor_id: profileId ?? null,
      action: "chemical_hazard_classification",
      entity_type: "chemical",
      entity_id: chemicalId,
      details: payload,
    });
    if (error) return { ok: false, error: error.message };

    // Persist the hazard band back onto the chemical record so it shows in the list
    await client
      .from("chemical_inventory")
      .update({
        hazard_band: result.band,
        hazard_band_confidence: result.confidence,
        hazard_band_reviewed_at: new Date().toISOString(),
        hazard_band_reason: reviewReason,
        hazard_review_status: reviewStatus,
        concentration_pct: concentrationPct,
        physical_state: physicalState,
        flash_point_c: flashPointC ?? null,
        expiration_date: expirationDate ?? null,
      })
      .eq("id", chemicalId)
      .eq("tenant_id", tenantId);
  } else {
    // Mock mode — log to console only
    console.info("[MOCK] saveHazardReview:", payload);
  }

  revalidatePath("/chemicals");
  revalidatePath(`/chemicals/${chemicalId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Fetch past hazard classification records for a chemical from the audit log. */
export async function getHazardHistory(chemicalId: string): Promise<{
  ok: boolean;
  records?: Array<{
    id: string;
    createdAt: string;
    hazardBand: string;
    confidence: number;
    concentrationPct: number;
    reviewDecision: string;
    reviewReason: string;
    hazardTypes: string[];
  }>;
  error?: string;
}> {
  if (MOCK_MODE) return { ok: true, records: [] };

  const client = await createSupabaseServerClient();
  if (!client) return { ok: false, error: "Session expired." };
  const tenantId = await getServerTenantId();
  if (!tenantId) return { ok: false, error: "Session expired." };

  const { data, error } = await client
    .from("audit_log")
    .select("id, created_at, details")
    .eq("tenant_id", tenantId)
    .eq("action", "chemical_hazard_classification")
    .eq("entity_id", chemicalId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return { ok: false, error: error.message };

  const records = (data ?? []).map((row) => {
    const d = (row.details ?? {}) as Record<string, unknown>;
    return {
      id: row.id as string,
      createdAt: row.created_at as string,
      hazardBand: (d.hazard_band as string) ?? "unknown",
      confidence: (d.confidence as number) ?? 0,
      concentrationPct: (d.concentration_pct as number) ?? 0,
      reviewDecision: (d.review_decision as string) ?? "accepted",
      reviewReason: (d.review_reason as string) ?? "",
      hazardTypes: (d.hazard_types as string[]) ?? [],
    };
  });

  return { ok: true, records };
}
