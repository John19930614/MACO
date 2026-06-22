import "server-only";
import { MOCK_MODE } from "@/lib/env";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import { createSupabaseServerClient, DEMO_SARAH_ID } from "@/lib/supabase/server";
import type { ServerUser } from "./types";

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
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const { data: { user }, error: authErr } = await client.auth.getUser();
  if (authErr || !user) return null;
  const { data: profile } = await client
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  return profile?.tenant_id ?? null;
}

// Returns the authenticated user's profile ID.
// MOCK_MODE → reads maco-mock-profile cookie; falls back to DEMO_SARAH_ID.
// Live → reads Supabase auth user id.
export async function getServerProfileId(): Promise<string> {
  if (MOCK_MODE) {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const profileFromCookie = cookieStore.get("maco-mock-profile")?.value;
    if (profileFromCookie) return profileFromCookie;
  } else {
    const client = await createSupabaseServerClient();
    if (client) {
      const { data: { user } } = await client.auth.getUser();
      if (user?.id) return user.id;
    }
  }
  return DEMO_SARAH_ID;
}

// Returns a lightweight user object for TopBar display.
// MOCK_MODE → null (TopBar falls back to DemoUserProvider).
// Live → resolves auth session + profile + tenant name.
export async function getServerUser(): Promise<ServerUser | null> {
  if (MOCK_MODE) return null;
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const { data: { user }, error: authErr } = await client.auth.getUser();
  if (authErr || !user) return null;
  const { data: profile } = await client
    .from("profiles")
    .select("id, display_name, role, tenant_id, job_title, tenants(name)")
    .eq("id", user.id)
    .single();
  if (!profile) return null;
  const tenantArr = profile.tenants as { name: string }[] | null;
  const company = Array.isArray(tenantArr) ? (tenantArr[0]?.name ?? null) : null;
  return {
    id: profile.id,
    display_name: profile.display_name,
    role: profile.role,
    tenant_id: profile.tenant_id,
    job_title: profile.job_title ?? null,
    company,
  };
}
