"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerProfileId } from "@/lib/auth/session";

// Platform-admin (Reliance superadmin) action layer for the SA console.
//
// A superadmin is a profile with tenant_id IS NULL. The normal getCtx() in
// ehs.ts returns null for them (it requires a tenantId), so these actions use
// their own context helper, getSaCtx(), which verifies superadmin status.
// The platform tables are additionally protected by RLS = is_reliance_admin().

const NOT_AUTHORIZED = { ok: false as const, error: "Not authorized." };

// Returns the session client + caller profileId only if the caller is a
// superadmin (profile.tenant_id IS NULL). Returns null otherwise / no session.
async function getSaCtx(): Promise<{ client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>; profileId: string } | null> {
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const profileId = await getServerProfileId();
  const { data: profile, error } = await client
    .from("profiles")
    .select("tenant_id")
    .eq("id", profileId)
    .single();
  if (error || !profile) return null;
  if (profile.tenant_id !== null) return null;
  return { client, profileId };
}

function str(formData: FormData, key: string): string {
  return (formData.get(key) as string) ?? "";
}
function strOrNull(formData: FormData, key: string): string | null {
  const v = (formData.get(key) as string) ?? "";
  return v.trim() ? v : null;
}

// ── Support Tickets ─────────────────────────────────────────────────────────────

export async function createSupportTicket(_prev: unknown, formData: FormData) {
  const ctx = await getSaCtx();
  if (!ctx) return NOT_AUTHORIZED;
  const { error } = await ctx.client.from("sa_support_tickets").insert({
    tenant_id: strOrNull(formData, "tenant_id"),
    subject: str(formData, "subject") || "Untitled Ticket",
    body: str(formData, "body"),
    status: str(formData, "status") || "open",
    priority: str(formData, "priority") || "medium",
    requester: strOrNull(formData, "requester"),
    assignee: strOrNull(formData, "assignee"),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sa/support");
  return { ok: true };
}

export async function updateSupportTicket(id: string, formData: FormData) {
  const ctx = await getSaCtx();
  if (!ctx) return NOT_AUTHORIZED;
  const { error } = await ctx.client.from("sa_support_tickets").update({
    subject: str(formData, "subject") || "Untitled Ticket",
    body: str(formData, "body"),
    status: str(formData, "status") || "open",
    priority: str(formData, "priority") || "medium",
    requester: strOrNull(formData, "requester"),
    assignee: strOrNull(formData, "assignee"),
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sa/support");
  return { ok: true };
}

// ── Guardrails ──────────────────────────────────────────────────────────────────

export async function upsertGuardrail(_prev: unknown, formData: FormData) {
  const ctx = await getSaCtx();
  if (!ctx) return NOT_AUTHORIZED;
  const thresholdRaw = str(formData, "threshold");
  const { error } = await ctx.client.from("sa_guardrails").upsert({
    key: str(formData, "key"),
    label: str(formData, "label"),
    enabled: str(formData, "enabled") === "true",
    threshold: thresholdRaw.trim() ? Number(thresholdRaw) : null,
    notes: strOrNull(formData, "notes"),
    updated_at: new Date().toISOString(),
  }, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sa/guardrails");
  return { ok: true };
}

// ── Global Legal Library ────────────────────────────────────────────────────────

export async function addGlobalLegal(_prev: unknown, formData: FormData) {
  const ctx = await getSaCtx();
  if (!ctx) return NOT_AUTHORIZED;
  const appliesTo = str(formData, "applies_to")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const { error } = await ctx.client.from("sa_global_legal").insert({
    regulation_ref: str(formData, "regulation_ref"),
    title: str(formData, "title") || "Untitled Regulation",
    jurisdiction: str(formData, "jurisdiction"),
    category: str(formData, "category") || "general",
    description: strOrNull(formData, "description"),
    applies_to: appliesTo,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sa/globallegal");
  return { ok: true };
}

export async function deleteGlobalLegal(id: string) {
  const ctx = await getSaCtx();
  if (!ctx) return NOT_AUTHORIZED;
  const { error } = await ctx.client.from("sa_global_legal").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sa/globallegal");
  return { ok: true };
}

// ── Import Jobs ─────────────────────────────────────────────────────────────────

export async function createImportJob(_prev: unknown, formData: FormData) {
  const ctx = await getSaCtx();
  if (!ctx) return NOT_AUTHORIZED;
  const rowCountRaw = str(formData, "row_count");
  const { error } = await ctx.client.from("sa_import_jobs").insert({
    tenant_id: strOrNull(formData, "tenant_id"),
    kind: str(formData, "kind") || "generic",
    filename: str(formData, "filename"),
    row_count: rowCountRaw.trim() ? parseInt(rowCountRaw, 10) || 0 : 0,
    status: str(formData, "status") || "pending",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sa/imports");
  return { ok: true };
}

// ── Subscriptions / Billing ─────────────────────────────────────────────────────

export async function upsertSubscription(_prev: unknown, formData: FormData) {
  const ctx = await getSaCtx();
  if (!ctx) return NOT_AUTHORIZED;
  const id = strOrNull(formData, "id");
  const mrrRaw = str(formData, "mrr");
  const seatsRaw = str(formData, "seats");
  const row = {
    tenant_id: strOrNull(formData, "tenant_id"),
    plan: str(formData, "plan") || "starter",
    status: str(formData, "status") || "active",
    mrr: mrrRaw.trim() ? Number(mrrRaw) || 0 : 0,
    seats: seatsRaw.trim() ? parseInt(seatsRaw, 10) || 0 : 0,
    renews_at: strOrNull(formData, "renews_at"),
    notes: strOrNull(formData, "notes"),
    updated_at: new Date().toISOString(),
  };
  const { error } = id
    ? await ctx.client.from("subscriptions").update(row).eq("id", id)
    : await ctx.client.from("subscriptions").insert(row);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sa/billing");
  return { ok: true };
}

// ── Implementation pipeline ─────────────────────────────────────────────────────

export async function updateTenantImplStage(tenantId: string, stage: string) {
  const ctx = await getSaCtx();
  if (!ctx) return NOT_AUTHORIZED;
  const { error } = await ctx.client.from("tenants").update({
    impl_status: stage,
  }).eq("id", tenantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sa/impl");
  revalidatePath("/sa/companies");
  return { ok: true };
}
