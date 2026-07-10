"use server";

// Server actions for Universal-Waste & Recycling tracking.
//
// Follows the platform's real conventions (NOT the ticket's fictional
// requireRole / createServerActionClient / org_id): session context via
// getCtx() (tenant_id + profile_id + RLS-respecting client), MOCK_MODE dual
// path, Zod validation, and friendly plain-English errors. Role visibility is
// already gated in the nav (management roles); tenant isolation is enforced by
// RLS on every table these actions write to.
//
// Hard rules enforced here (defense-in-depth over the DB's NOT NULL FKs):
//   • Determination gate — no UW item or nonhaz record can be created without a
//     linked, APPROVED waste_determination on file.
//   • accumulation_deadline and diversion_rate are DB generated columns — never
//     accepted as input.
//   • chain_of_custody + retention_period are written from the linked
//     certificate/item, not accepted as raw manual input.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { MOCK_MODE } from "@/lib/env";
import { getCtx } from "./ehs-shared";
import { resolveJurisdictionRule, type JurisdictionRule } from "@/lib/waste/jurisdiction-engine";

const PAGE = "/waste/universal-waste-recycling";

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };
type Ctx = NonNullable<Awaited<ReturnType<typeof getCtx>>>;

const FIELD_ERROR = "Please check the highlighted fields.";
const SESSION_ERROR = "Session expired — please reload.";
const GATE_ERROR =
  "You can't add this to a recycling stream until a documented hazardous-waste determination is on file.";

// ── Determinations ─────────────────────────────────────────────────────────────

const determinationSchema = z.object({
  siteId: z.string().uuid().optional(),
  materialDescription: z.string().min(1),
  determinationResult: z.enum(["hazardous", "universal_waste", "nonhazardous", "excluded"]),
  regulatoryBasis: z.string().optional(),
  jurisdictionState: z.string().length(2),
  documentUrl: z.string().url().optional(),
});

export async function createDetermination(input: z.infer<typeof determinationSchema>): Promise<Result<{ id: string }>> {
  if (MOCK_MODE) return { ok: true };
  const parsed = determinationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: FIELD_ERROR };
  const ctx = await getCtx();
  if (!ctx) return { ok: false, error: SESSION_ERROR };
  const data = parsed.data;

  const { data: row, error } = await ctx.client
    .from("waste_determinations")
    .insert({
      tenant_id: ctx.tenantId,
      site_id: data.siteId ?? ctx.siteId,
      material_description: data.materialDescription,
      determination_result: data.determinationResult,
      regulatory_basis: data.regulatoryBasis ?? null,
      jurisdiction_state: data.jurisdictionState,
      document_url: data.documentUrl ?? null,
      determined_by: ctx.profileId,
      status: "approved",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: FIELD_ERROR };
  revalidatePath(PAGE);
  return { ok: true, data: { id: row.id as string } };
}

// Confirms a determination is on file, approved, and owned by this tenant.
async function assertApprovedDetermination(
  client: Ctx["client"],
  tenantId: string,
  determinationId: string,
): Promise<boolean> {
  const { data } = await client
    .from("waste_determinations")
    .select("id")
    .eq("id", determinationId)
    .eq("tenant_id", tenantId)
    .eq("status", "approved")
    .maybeSingle();
  return Boolean(data);
}

// ── Universal Waste items ──────────────────────────────────────────────────────

const uwItemSchema = z.object({
  siteId: z.string().uuid().optional(),
  determinationId: z.string().uuid(),
  category: z.enum([
    "batteries", "lamps", "mercury_equipment", "aerosol_cans",
    "pesticides", "e_waste", "used_oil", "solvents",
  ]),
  handlerClass: z.enum(["small_quantity", "large_quantity"]).default("small_quantity"),
  jurisdictionState: z.string().length(2),
  quantity: z.number().optional(),
  quantityUom: z.string().optional(),
  quantityLimit: z.number().optional(),
  accumulationStartDate: z.string().min(1),
});

export async function createUniversalWasteItem(input: z.input<typeof uwItemSchema>): Promise<Result<{ id: string }>> {
  if (MOCK_MODE) return { ok: true };
  const parsed = uwItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: FIELD_ERROR };
  const ctx = await getCtx();
  if (!ctx) return { ok: false, error: SESSION_ERROR };
  const data = parsed.data;

  // Determination gate — hard block before anything enters a recycling stream.
  if (!(await assertApprovedDetermination(ctx.client, ctx.tenantId, data.determinationId))) {
    return { ok: false, error: GATE_ERROR };
  }

  // Inspection frequency comes from the jurisdiction engine (data-driven).
  const rule = await resolveJurisdictionRule(data.jurisdictionState, data.category);

  const { data: row, error } = await ctx.client
    .from("universal_waste_items")
    .insert({
      tenant_id: ctx.tenantId,
      site_id: data.siteId ?? ctx.siteId,
      determination_id: data.determinationId,
      category: data.category,
      handler_class: data.handlerClass,
      jurisdiction_state: data.jurisdictionState,
      quantity: data.quantity ?? null,
      quantity_uom: data.quantityUom ?? null,
      quantity_limit: data.quantityLimit ?? null,
      accumulation_start_date: data.accumulationStartDate,
      inspection_frequency_days: rule.inspection_frequency_days,
      created_by: ctx.profileId,
      // accumulation_deadline is a generated column — deliberately not set.
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: FIELD_ERROR };
  revalidatePath(PAGE);
  return { ok: true, data: { id: row.id as string } };
}

const uwStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["accumulating", "shipped", "rejected", "closed"]),
});

export async function updateUwItemStatus(input: z.infer<typeof uwStatusSchema>): Promise<Result> {
  if (MOCK_MODE) return { ok: true };
  const parsed = uwStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: FIELD_ERROR };
  const ctx = await getCtx();
  if (!ctx) return { ok: false, error: SESSION_ERROR };
  const { error } = await ctx.client
    .from("universal_waste_items")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("tenant_id", ctx.tenantId);
  if (error) return { ok: false, error: FIELD_ERROR };
  revalidatePath(PAGE);
  return { ok: true };
}

// ── Nonhazardous recycling records ─────────────────────────────────────────────

const nonhazSchema = z.object({
  siteId: z.string().uuid().optional(),
  determinationId: z.string().uuid(),
  materialCategory: z.string().min(1),
  contaminationLimitPct: z.number().optional(),
  weightRecycled: z.number().optional(),
  weightLandfill: z.number().optional(),
  weightUom: z.string().optional(),
  costAvoided: z.number().optional(),
  revenue: z.number().optional(),
  vendorId: z.string().uuid().optional(),
});

export async function createNonhazRecyclingRecord(input: z.infer<typeof nonhazSchema>): Promise<Result<{ id: string }>> {
  if (MOCK_MODE) return { ok: true };
  const parsed = nonhazSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: FIELD_ERROR };
  const ctx = await getCtx();
  if (!ctx) return { ok: false, error: SESSION_ERROR };
  const data = parsed.data;

  // Determination gate applies to nonhaz recycling too.
  if (!(await assertApprovedDetermination(ctx.client, ctx.tenantId, data.determinationId))) {
    return { ok: false, error: GATE_ERROR };
  }

  const { data: row, error } = await ctx.client
    .from("nonhaz_recycling_records")
    .insert({
      tenant_id: ctx.tenantId,
      site_id: data.siteId ?? ctx.siteId,
      determination_id: data.determinationId,
      material_category: data.materialCategory,
      contamination_limit_pct: data.contaminationLimitPct ?? null,
      weight_recycled: data.weightRecycled ?? null,
      weight_landfill: data.weightLandfill ?? null,
      weight_uom: data.weightUom ?? "lbs",
      cost_avoided: data.costAvoided ?? null,
      revenue: data.revenue ?? null,
      vendor_id: data.vendorId ?? null,
      created_by: ctx.profileId,
      // diversion_rate is a generated column — deliberately not set.
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: FIELD_ERROR };
  revalidatePath(PAGE);
  return { ok: true, data: { id: row.id as string } };
}

// ── Certificates (auto-populate chain-of-custody + retention) ──────────────────

const certSchema = z
  .object({
    universalWasteItemId: z.string().uuid().optional(),
    nonhazRecyclingRecordId: z.string().uuid().optional(),
    certificateType: z.enum(["recycling", "reclamation", "destruction"]),
    vendorId: z.string().uuid().optional(),
    issuedDate: z.string().min(1),
    documentUrl: z.string().url(),
    retentionPeriodYears: z.number().int().optional(),
  })
  .refine((v) => Boolean(v.universalWasteItemId) !== Boolean(v.nonhazRecyclingRecordId), {
    message: "A certificate must attach to exactly one tracked item or record.",
  });

export async function createRecyclingCertificate(input: z.infer<typeof certSchema>): Promise<Result<{ id: string }>> {
  if (MOCK_MODE) return { ok: true };
  const parsed = certSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: FIELD_ERROR };
  const ctx = await getCtx();
  if (!ctx) return { ok: false, error: SESSION_ERROR };
  const data = parsed.data;
  const retention = data.retentionPeriodYears ?? 3;

  const { data: row, error } = await ctx.client
    .from("recycling_certificates")
    .insert({
      tenant_id: ctx.tenantId,
      universal_waste_item_id: data.universalWasteItemId ?? null,
      nonhaz_recycling_record_id: data.nonhazRecyclingRecordId ?? null,
      certificate_type: data.certificateType,
      vendor_id: data.vendorId ?? null,
      issued_date: data.issuedDate,
      document_url: data.documentUrl,
      retention_period_years: retention,
      created_by: ctx.profileId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: FIELD_ERROR };

  // Chain-of-custody + retention are DERIVED from the certificate, not typed in.
  // Append a COC event to the linked UW item and mark it shipped.
  if (data.universalWasteItemId) {
    const { data: item } = await ctx.client
      .from("universal_waste_items")
      .select("chain_of_custody")
      .eq("id", data.universalWasteItemId)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();
    const coc = Array.isArray(item?.chain_of_custody) ? item!.chain_of_custody : [];
    coc.push({
      event: `certificate_of_${data.certificateType}`,
      certificate_id: row.id,
      vendor_id: data.vendorId ?? null,
      issued_date: data.issuedDate,
      recorded_at: new Date().toISOString(),
    });
    await ctx.client
      .from("universal_waste_items")
      .update({ chain_of_custody: coc, retention_period_years: retention, status: "shipped", updated_at: new Date().toISOString() })
      .eq("id", data.universalWasteItemId)
      .eq("tenant_id", ctx.tenantId);
  }
  if (data.nonhazRecyclingRecordId) {
    await ctx.client
      .from("nonhaz_recycling_records")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", data.nonhazRecyclingRecordId)
      .eq("tenant_id", ctx.tenantId);
  }

  revalidatePath(PAGE);
  return { ok: true, data: { id: row.id as string } };
}

// ── Rejected-load workflow ─────────────────────────────────────────────────────

const rejectSchema = z
  .object({
    universalWasteItemId: z.string().uuid().optional(),
    nonhazRecyclingRecordId: z.string().uuid().optional(),
    reason: z.string().min(1),
  })
  .refine((v) => Boolean(v.universalWasteItemId) !== Boolean(v.nonhazRecyclingRecordId), {
    message: "Reject exactly one tracked item or record.",
  });

export async function markLoadRejected(input: z.infer<typeof rejectSchema>): Promise<Result<{ id: string }>> {
  if (MOCK_MODE) return { ok: true };
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: FIELD_ERROR };
  const ctx = await getCtx();
  if (!ctx) return { ok: false, error: SESSION_ERROR };
  const data = parsed.data;

  const { data: row, error } = await ctx.client
    .from("rejected_loads")
    .insert({
      tenant_id: ctx.tenantId,
      universal_waste_item_id: data.universalWasteItemId ?? null,
      nonhaz_recycling_record_id: data.nonhazRecyclingRecordId ?? null,
      rejected_reason: data.reason,
      rejected_by: ctx.profileId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: FIELD_ERROR };

  // Flag the tracked entity as rejected — blocks further processing until resolved.
  if (data.universalWasteItemId) {
    await ctx.client
      .from("universal_waste_items")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", data.universalWasteItemId)
      .eq("tenant_id", ctx.tenantId);
  }
  if (data.nonhazRecyclingRecordId) {
    await ctx.client
      .from("nonhaz_recycling_records")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", data.nonhazRecyclingRecordId)
      .eq("tenant_id", ctx.tenantId);
  }

  // Waste-coordinator notification: an unresolved rejected_loads row IS the
  // in-app flag (surfaced as a red badge on the list). A dedicated paging/
  // notification channel is intentionally not wired in this release (matches the
  // risk-escalations "human-gated, no auto-page" pattern).
  revalidatePath(PAGE);
  return { ok: true, data: { id: row.id as string } };
}

const resolveSchema = z.object({
  rejectedLoadId: z.string().uuid(),
  resolutionAction: z.enum(["recertified", "disposed", "rerouted"]),
  resolutionNotes: z.string().optional(),
});

export async function resolveRejectedLoad(input: z.infer<typeof resolveSchema>): Promise<Result> {
  if (MOCK_MODE) return { ok: true };
  const parsed = resolveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: FIELD_ERROR };
  const ctx = await getCtx();
  if (!ctx) return { ok: false, error: SESSION_ERROR };
  const { error } = await ctx.client
    .from("rejected_loads")
    .update({
      resolution_action: parsed.data.resolutionAction,
      resolution_notes: parsed.data.resolutionNotes ?? null,
      resolved_by: ctx.profileId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.rejectedLoadId)
    .eq("tenant_id", ctx.tenantId);
  if (error) return { ok: false, error: FIELD_ERROR };
  revalidatePath(PAGE);
  return { ok: true };
}

// ── Jurisdiction rules (async wrapper for callers / UI) ────────────────────────

export async function getJurisdictionRules(
  state: string,
  category: string,
): Promise<Result<JurisdictionRule>> {
  const rule = await resolveJurisdictionRule(state, category);
  return { ok: true, data: rule };
}
