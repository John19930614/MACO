import { getProfiles, getSites } from "@/lib/data/repo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MOCK_MODE } from "@/lib/env";
import { SettingsClient } from "./SettingsClient";
import type { Profile, Site } from "@/lib/types";

export default async function SettingsPage() {
  let profiles: Profile[] = [];
  let sites: Site[] = [];

  try {
    [profiles, sites] = await Promise.all([getProfiles(), getSites()]);
  } catch {
    // Falls back to mock data in SettingsClient
  }

  // Load persisted settings from the tenant's onboarding_data (live mode only),
  // mirroring how dashboard/page.tsx reads tenant.onboarding_data.
  let savedSettings: Record<string, unknown> | null = null;
  if (!MOCK_MODE) {
    try {
      const supabase = await createSupabaseServerClient();
      if (supabase) {
        const tenantId = await getEffectiveTenantId();
        const { data: tenant } = await supabase
          .from("tenants")
          .select("onboarding_data")
          .eq("id", tenantId)
          .single();
        const onboarding = (tenant?.onboarding_data as Record<string, unknown>) ?? {};
        const settings = onboarding.settings as Record<string, unknown> | undefined;
        if (settings && typeof settings === "object") savedSettings = settings;
      }
    } catch {
      // Falls back to defaults / localStorage in SettingsClient
    }
  }

  return (
    <SettingsClient
      serverProfiles={profiles}
      serverSites={sites}
      savedSettings={savedSettings}
    />
  );
}
