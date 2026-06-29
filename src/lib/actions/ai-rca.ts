"use server";

import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/data/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerTenantId, getServerProfileId } from "@/lib/auth/session";
import { MOCK_MODE } from "@/lib/env";

async function getCtx() {
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const tenantId = await getServerTenantId();
  if (!tenantId) return null;
  const profileId = await getServerProfileId();
  return { client, tenantId, profileId };
}

/** Save an AI-generated root cause statement directly to the incident record. */
export async function saveIncidentRootCause(
  incidentId: string,
  rootCause: string,
): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    const { error } = await ctx.client
      .from("incidents")
      .update({ root_cause: rootCause, updated_at: now })
      .eq("id", incidentId)
      .eq("tenant_id", ctx.tenantId);
    if (error) return { ok: false, error: error.message };
  } else {
    const store = getStore();
    const idx = store.incidents.findIndex((i) => i.id === incidentId);
    if (idx !== -1) {
      store.incidents[idx] = { ...store.incidents[idx], root_cause: rootCause, updated_at: now };
    }
  }

  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/incidents");
  return { ok: true };
}
