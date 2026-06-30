"use server";

import { revalidatePath } from "next/cache";
import { getStore, nextId } from "@/lib/data/store";
import { MOCK_TENANT_ID, MOCK_SITE_ID } from "@/lib/data/mock";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getServerTenantId, getServerProfileId } from "@/lib/auth/session";
import { MOCK_MODE } from "@/lib/env";
import type { CapaSourceType } from "@/lib/types";

interface RemediationAction {
  action: string;
  priority: string;
  rationale: string;
  capa_kind: "corrective" | "preventive";
}

async function getCtx() {
  const client = createServiceRoleClient();
  if (!client) return null;
  const tenantId = await getServerTenantId();
  if (!tenantId) return null;
  const profileId = await getServerProfileId();
  const { data: profile } = await client
    .from("profiles")
    .select("default_site_id")
    .eq("id", profileId)
    .single();
  return { client, tenantId, siteId: profile?.default_site_id ?? null, profileId };
}

/**
 * Create CAPAs from selected AI-recommended actions and accept the finding.
 * Safe — only creates records, never deletes or modifies existing data.
 */
export async function remediateFinding(
  findingId: string,
  selectedActions: RemediationAction[],
): Promise<{ ok: boolean; capasCreated: number; error?: string }> {
  const now = new Date().toISOString();

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, capasCreated: 0, error: "Session expired — please reload." };

    // Create one CAPA per selected action
    for (const a of selectedActions) {
      const { error } = await ctx.client.from("capa_records").insert({
        tenant_id:   ctx.tenantId,
        site_id:     ctx.siteId,
        title:       a.action.slice(0, 200),
        description: a.rationale,
        kind:        a.capa_kind,
        source_type: "ai_finding" as CapaSourceType,
        source_id:   findingId,
        severity:    a.priority === "immediate" ? "critical" : a.priority === "short_term" ? "high" : "medium",
        status:      "open",
        due_date:    null,
        owner_id:    null,
        root_cause:  null,
        verification_method: null,
      });
      if (error) return { ok: false, capasCreated: 0, error: error.message };
    }

    // Mark the finding as accepted
    const { error: reviewError } = await ctx.client
      .from("ai_findings")
      .update({ review_status: "accepted" })
      .eq("id", findingId)
      .eq("tenant_id", ctx.tenantId);
    if (reviewError) return { ok: false, capasCreated: 0, error: reviewError.message };
  } else {
    const store = getStore();
    for (const a of selectedActions) {
      store.capaActions.push({
        id:          nextId("capa"),
        tenant_id:   MOCK_TENANT_ID,
        site_id:     MOCK_SITE_ID,
        title:       a.action.slice(0, 200),
        description: a.rationale,
        kind:        a.capa_kind,
        source_type: "ai_finding" as CapaSourceType,
        source_id:   findingId,
        root_cause:  null,
        severity:    a.priority === "immediate" ? "critical" : a.priority === "short_term" ? "high" : "medium",
        owner_id:    null,
        due_date:    null,
        status:      "open",
        verification_method: null,
        closed_at:   null,
        closure_note: null,
        closed_with_evidence: false,
        created_at:  now,
        updated_at:  now,
      });
    }
    const idx = store.findings.findIndex((f) => f.id === findingId);
    if (idx !== -1) store.findings[idx] = { ...store.findings[idx], review_status: "accepted" };
  }

  revalidatePath("/ai");
  revalidatePath("/capa");
  revalidatePath("/dashboard");
  return { ok: true, capasCreated: selectedActions.length };
}

/** Mark a finding as rejected (dismissed) without creating any CAPAs. */
export async function dismissFinding(
  findingId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    const { error } = await ctx.client
      .from("ai_findings")
      .update({ review_status: "rejected", rejection_reason: reason })
      .eq("id", findingId)
      .eq("tenant_id", ctx.tenantId);
    if (error) return { ok: false, error: error.message };
    // Best-effort audit log entry
    try {
      await ctx.client.from("audit_log").insert({
        tenant_id: ctx.tenantId,
        actor_id: ctx.profileId,
        action: "ai_finding_dismissed",
        entity_type: "ai_finding",
        entity_id: findingId,
        details: { reason },
      });
    } catch (e) {
      console.error("audit write failed (non-fatal):", e);
    }
  } else {
    const store = getStore();
    const idx = store.findings.findIndex((f) => f.id === findingId);
    if (idx !== -1) store.findings[idx] = { ...store.findings[idx], review_status: "rejected", rejection_reason: reason };
  }

  revalidatePath("/ai");
  return { ok: true };
}
