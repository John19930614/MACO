import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY, MOCK_MODE } from "@/lib/env";

// ── Legacy anon client (no cookie session — used by ehsRepo data functions) ───
export function createServerSupabase() {
  if (MOCK_MODE || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

// ── SSR cookie client (session-aware — used by session.ts and middleware) ─────
export async function createSupabaseServerClient() {
  if (MOCK_MODE || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cookieStore.set(name, value, options as any),
          );
        } catch {
          // Called from a Server Component — cookie writes are ignored there;
          // the middleware handles session refresh.
        }
      },
    },
  });
}

// ── Cached auth user — deduplicates getUser() across all server components
// within a single request (layout + page both call session helpers, which
// each previously made an independent round-trip to Supabase).
export const getAuthUser = cache(async () => {
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  return user;
});

// ── Cached profile — deduplicates the profiles table lookup that getServerTenantId
// and getServerUser both need on every request.
export const getAuthProfile = cache(async () => {
  const user = await getAuthUser();
  if (!user) return null;
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const { data } = await client
    .from("profiles")
    .select("id, display_name, role, tenant_id, job_title, tenants(name)")
    .eq("id", user.id)
    .single();
  return data ?? null;
});

export const DEMO_TENANT_ID =
  process.env.NEXT_PUBLIC_DEMO_TENANT_ID ?? "aaaaaaaa-0000-4000-a000-000000000001";

// Fixed UUIDs seeded in the SafetyIQ demo project
export const DEMO_SITE_ID  = "bbbbbbbb-0000-4000-b000-000000000001";
export const DEMO_SARAH_ID = "cccccccc-0001-4000-c000-000000000001";
