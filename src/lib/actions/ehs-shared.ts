// Shared session-context helper for the split EHS server-action modules
// (ehs-records / ehs-compliance / ehs-waste / ehs-ai). Plain server module —
// intentionally NOT a "use server" file, since it exports a helper rather than
// a server action.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerTenantId, getServerProfileId } from "@/lib/auth/session";

// ── Session context helper ─────────────────────────────────────────────────────
// Returns the session-aware Supabase client, the user's real tenant_id, site_id,
// and profile_id. All live-mode actions use this so RLS is always respected.

export async function getCtx() {
  const client = await createSupabaseServerClient();
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
