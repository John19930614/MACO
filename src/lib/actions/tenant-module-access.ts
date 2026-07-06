"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerProfileId } from "@/lib/auth/session";
import { ALL_MODULE_KEYS, type ModuleKey } from "@/lib/modules/moduleAccess";

// Toggling module access for a company is a Reliance-superadmin action (same
// tier as the platform-wide Module Control Panel and every other sa.ts action)
// — see src/lib/actions/sa.ts getSaCtx() for the identical pattern. The table
// is additionally protected by RLS = is_reliance_admin() for write.

const NOT_AUTHORIZED = { ok: false as const, error: "You don't have permission to change module access." };

async function getSaCtx(): Promise<{
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
  actorLabel: string;
} | null> {
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const profileId = await getServerProfileId();
  const { data: profile, error } = await client
    .from("profiles")
    .select("tenant_id, display_name")
    .eq("id", profileId)
    .single();
  if (error || !profile) return null;
  if (profile.tenant_id !== null) return null;
  return { client, actorLabel: profile.display_name ?? profileId };
}

export interface SetTenantModuleAccessResult {
  ok: boolean;
  error?: string;
  moduleKey?: ModuleKey;
  isEnabled?: boolean;
}

export async function setTenantModuleAccess(input: {
  tenantId: string;
  moduleKey: ModuleKey;
  isEnabled: boolean;
}): Promise<SetTenantModuleAccessResult> {
  if (!ALL_MODULE_KEYS.includes(input.moduleKey)) {
    return { ok: false, error: "Unknown module." };
  }

  const ctx = await getSaCtx();
  if (!ctx) return NOT_AUTHORIZED;

  const { tenantId, moduleKey, isEnabled } = input;

  const { data: existing } = await ctx.client
    .from("tenant_module_access")
    .select("is_enabled")
    .eq("tenant_id", tenantId)
    .eq("module_key", moduleKey)
    .maybeSingle();

  const previousValue = existing?.is_enabled ?? true;

  const { error: upsertError } = await ctx.client
    .from("tenant_module_access")
    .upsert(
      {
        tenant_id: tenantId,
        module_key: moduleKey,
        is_enabled: isEnabled,
        updated_by: ctx.actorLabel,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,module_key" },
    );

  if (upsertError) {
    return { ok: false, error: "Something went wrong saving this change. Please try again." };
  }

  // Non-fatal: a failed audit insert never blocks the toggle itself, but is
  // reported so it doesn't fail silently.
  const { error: auditError } = await ctx.client.from("tenant_module_access_audit").insert({
    tenant_id: tenantId,
    module_key: moduleKey,
    previous_value: previousValue,
    new_value: isEnabled,
    changed_by: ctx.actorLabel,
  });
  if (auditError) {
    console.error("tenant_module_access_audit insert failed:", auditError.message);
  }

  revalidatePath(`/sa/companies/${tenantId}`);

  return { ok: true, moduleKey, isEnabled };
}
