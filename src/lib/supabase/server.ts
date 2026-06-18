import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, MOCK_MODE } from "@/lib/env";

export function createServerSupabase() {
  if (MOCK_MODE || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

export const DEMO_TENANT_ID =
  process.env.NEXT_PUBLIC_DEMO_TENANT_ID ?? "aaaaaaaa-0000-4000-a000-000000000001";

// Fixed UUIDs seeded in the SafetyIQ demo project (bjgqjpekhicqlunxbobo)
export const DEMO_SITE_ID    = "bbbbbbbb-0000-4000-b000-000000000001";
export const DEMO_SARAH_ID   = "cccccccc-0001-4000-c000-000000000001"; // Sarah Chen — default reporter
