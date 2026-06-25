import { getProfiles, getSites } from "@/lib/data/repo";
import { getEstablishment, getTenantSettings, type EstablishmentInfo } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { MOCK_MODE, hasLiveAi, aiProvider, serverSecrets } from "@/lib/env";
import { SettingsClient, type AiInfo, type IntegrationStatus } from "./SettingsClient";
import type { Profile, Site } from "@/lib/types";

export default async function SettingsPage() {
  let profiles: Profile[] = [];
  let sites: Site[] = [];

  try {
    [profiles, sites] = await Promise.all([getProfiles(), getSites()]);
  } catch {
    // Falls back to mock data in SettingsClient
  }

  // Canonical company identity + saved settings (live mode only).
  let savedSettings: Record<string, unknown> | null = null;
  let establishment: EstablishmentInfo | null = null;
  if (!MOCK_MODE) {
    try {
      const tenantId = await getEffectiveTenantId();
      const [settings, est] = await Promise.all([getTenantSettings(tenantId), getEstablishment(tenantId)]);
      if (settings && Object.keys(settings).length) savedSettings = settings;
      establishment = est;
    } catch {
      // Falls back to defaults / localStorage in SettingsClient
    }
  }

  // Real, env-derived platform + integration status (no hardcoded claims).
  const { anthropicModel, aiModel } = serverSecrets();
  const provider = aiProvider();
  const aiInfo: AiInfo = {
    on: hasLiveAi(),
    provider: provider === "anthropic" ? "Anthropic Claude" : "OpenAI",
    model: provider === "anthropic" ? anthropicModel : aiModel,
  };
  const integrationStatus: IntegrationStatus = {
    supabase: !MOCK_MODE,
    ai: hasLiveAi(),
    aiProvider: provider === "anthropic" ? "Anthropic Claude API" : "OpenAI API",
    email: !!process.env.RESEND_API_KEY,
  };

  return (
    <SettingsClient
      serverProfiles={profiles}
      serverSites={sites}
      savedSettings={savedSettings}
      establishment={establishment}
      aiInfo={aiInfo}
      integrationStatus={integrationStatus}
    />
  );
}
