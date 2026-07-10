import "server-only";
import { MOCK_MODE } from "@/lib/env";
import { MOCK_PROFILES_ALL } from "@/lib/data/mock";
import { getAuthProfile } from "@/lib/supabase/server";
import { getServerProfileId, getServerTenantId } from "@/lib/auth/session";
import { MANAGER_ROLES, type Role } from "@/lib/constants";

// Who may start/stop/edit reporting clocks, enter confirmation numbers, or
// override the closure gate: tenant Safety/EHS managers and admins, plus platform
// superadmins (profiles.tenant_id IS NULL). Mirrors the RLS policy in
// 20260710050000_regulatory_reporting_clocks.sql. The ticket's investigator/legal/
// hr roles do not exist in this platform (profiles.role ∈ constants.ROLES); every
// other role is read-only on the Reporting Status panel.

export type ReportingAccess = {
  authorized: boolean;
  isSuperadmin: boolean;
  tenantId: string | null;
  profileId: string;
  role: Role | null;
};

export async function getIncidentReportingAccess(): Promise<ReportingAccess> {
  const profileId = await getServerProfileId();

  if (MOCK_MODE) {
    const p = MOCK_PROFILES_ALL.find((mp) => mp.id === profileId);
    const isSuper = p?.tenant_id === null;
    const role = (p?.role as Role | undefined) ?? null;
    const authorized = !!p && (isSuper || (!!role && MANAGER_ROLES.includes(role)));
    return {
      authorized,
      isSuperadmin: isSuper,
      tenantId: p?.tenant_id ?? (await getServerTenantId()),
      profileId,
      role,
    };
  }

  const profile = await getAuthProfile();
  const isSuper = !!profile && profile.tenant_id === null;
  const role = (profile?.role as Role | undefined) ?? null;
  const authorized = !!profile && (isSuper || (!!role && MANAGER_ROLES.includes(role)));
  return {
    authorized,
    isSuperadmin: isSuper,
    tenantId: profile?.tenant_id ?? null,
    profileId,
    role,
  };
}
