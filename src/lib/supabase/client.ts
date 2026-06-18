"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY, MOCK_MODE } from "@/lib/env";

/**
 * Browser Supabase client. Returns null in mock mode so UI code can fall back
 * to the fixture-backed API routes without crashing.
 */
export function createClient() {
  if (MOCK_MODE) return null;
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
