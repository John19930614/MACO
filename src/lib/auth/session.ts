import "server-only";
import { MOCK_MODE } from "@/lib/env";
import { MOCK_TENANT_ID, MOCK_PROFILES_ALL } from "@/lib/data/mock";
import { getAuthUser, getAuthProfile, DEMO_SARAH_ID, createServiceRoleClient } from "@/lib/supabase/server";
import type { ServerUser } from "./types";

// Cookie holding the tenant a Reliance superadmin is previewing (read-only).
export const PREVIEW_TENANT_COOKIE = "safetyiq-preview-tenant";

// The nil UUID. In live mode, any query filtered by this tenant_id/profile_id
// returns zero rows — a safe "no data" result that never matches a real or demo
// tenant. Used as the live-mode fallback so an unresolved identity can never
// surface another tenant's (or the BioStar demo) data.
export const NIL_UUID = "00000000-0000-0000-0000-000000000000";

// Returns the authenticated user's tenant_id.
// MOCK_MODE → reads maco-mock-tenant cookie (set at login); falls back to MOCK_TENANT_ID.
// Live → reads Supabase session cookie → profiles.tenant_id.
// Returns null if unauthenticated (middleware should have redirected before this runs).
export async function getServerTenantId(): Promise<string | null> {
  if (MOCK_MODE) {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const tenantFromCookie = cookieStore.get("maco-mock-tenant")?.value;
    return tenantFromCookie || MOCK_TENANT_ID;
  }
  const profile = await getAuthProfile();
  // Superadmin previewing a tenant (read-only) → surface that tenant for reads.
  if (profile && profile.tenant_id === null) {
    const preview = await getPreviewTenantId();
    if (preview) return preview;
  }
  return profile?.tenant_id ?? null;
}

// Read-only "preview as tenant" for Reliance superadmins. Returns the tenant_id
// the superadmin is currently previewing (from an httpOnly cookie), or null.
// GATED ON SUPERADMIN: a non-superadmin who somehow holds the cookie still gets
// null here, so real tenant users' isolation is never affected by this feature.
export async function getPreviewTenantId(): Promise<string | null> {
  if (MOCK_MODE) return null;
  const profile = await getAuthProfile();
  if (!profile || profile.tenant_id !== null) return null; // superadmins only
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return cookieStore.get(PREVIEW_TENANT_COOKIE)?.value || null;
}

// Resolves a tenant_id that is ALWAYS safe to pass to a data query.
// MOCK_MODE → cookie tenant or BioStar demo tenant.
// Live → the real tenant_id, or NIL_UUID when it can't be resolved (so pages
// render empty states instead of falling back to the demo tenant). Pages MUST
// use this rather than `(await getServerTenantId()) ?? MOCK_TENANT_ID`.
export async function getEffectiveTenantId(): Promise<string> {
  const id = await getServerTenantId();
  if (id) return id;
  return MOCK_MODE ? MOCK_TENANT_ID : NIL_UUID;
}

// Returns the authenticated user's profile ID.
// MOCK_MODE → reads maco-mock-profile cookie; falls back to DEMO_SARAH_ID.
// Live → reads Supabase auth user id.
export async function getServerProfileId(): Promise<string> {
  if (MOCK_MODE) {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const profileFromCookie = cookieStore.get("maco-mock-profile")?.value;
    return profileFromCookie || DEMO_SARAH_ID;
  }
  // Live: never fall back to the demo profile (DEMO_SARAH_ID is a real UUID that
  // could match seeded demo rows). Use the nil UUID so queries return nothing.
  const profile = await getAuthProfile();
  return profile?.id ?? NIL_UUID;
}

// True when the caller is a Reliance platform superadmin (profile.tenant_id IS
// NULL). Superadmins manage the platform (the /sa console) and never belong to a
// client tenant, so they bypass tenant onboarding and the tenant dashboard.
export async function isSuperadmin(): Promise<boolean> {
  if (MOCK_MODE) {
    const pid = await getServerProfileId();
    return MOCK_PROFILES_ALL.find((p) => p.id === pid)?.tenant_id === null;
  }
  const profile = await getAuthProfile();
  return !!profile && profile.tenant_id === null;
}

// Returns a lightweight user object for TopBar display.
// MOCK_MODE → null (TopBar falls back to DemoUserProvider).
// Live → resolves auth session + profile + tenant name.
export async function getServerUser(): Promise<ServerUser | null> {
  if (MOCK_MODE) return null;
  const profile = await getAuthProfile();
  if (!profile) return null;

  // Superadmin previewing a tenant: present AS that tenant so the tenant nav and
  // modules render. The persistent preview banner makes this state unmistakable,
  // and all writes are blocked (read-only).
  if (profile.tenant_id === null) {
    const preview = await getPreviewTenantId();
    if (preview) {
      const svc = createServiceRoleClient();
      let company: string | null = null;
      if (svc) {
        const { data } = await svc.from("tenants").select("name").eq("id", preview).single();
        company = (data?.name as string) ?? null;
      }
      return {
        id: profile.id,
        display_name: profile.display_name,
        role: profile.role,
        tenant_id: preview,
        job_title: profile.job_title ?? null,
        company,
      };
    }
  }

  const t = profile.tenants as { name: string } | { name: string }[] | null;
  const company = Array.isArray(t) ? (t[0]?.name ?? null) : (t?.name ?? null);
  return {
    id: profile.id,
    display_name: profile.display_name,
    role: profile.role,
    tenant_id: profile.tenant_id,
    job_title: profile.job_title ?? null,
    company,
  };
}
