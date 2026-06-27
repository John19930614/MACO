import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY, serverSecrets } from "@/lib/env";

/**
 * Authentication for the internal /api/ops endpoint (Ops Console live signals).
 *
 * Two accepted callers, both superadmin-gated:
 *   1. CRON_SECRET  — for a CLI / uptime probe (Authorization: Bearer <secret>
 *      or ?secret=<secret>). NEVER used by the browser console (a server secret
 *      must not live in client code — SOP-12).
 *   2. Supabase JWT — the signed-in operator's own access token
 *      (Authorization: Bearer <jwt>). Verified server-side; the profile must be
 *      a Reliance superadmin (tenant_id IS NULL).
 */
export type OpsAuth =
  | { ok: true; userId: string | null; via: "secret" | "jwt" }
  | { ok: false; status: number; reason: string };

/** Service-role client — bypasses RLS; used only for read queries in /api/ops. */
export function opsServiceClient(): SupabaseClient | null {
  const key = serverSecrets().serviceRoleKey;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

function bearerOf(req: NextRequest): string {
  const h = req.headers.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

export async function requireSuperadmin(req: NextRequest): Promise<OpsAuth> {
  const bearer = bearerOf(req);

  // 1. CRON_SECRET (CLI / probe) — exact match only.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const qs = req.nextUrl.searchParams.get("secret");
    if (bearer === secret || qs === secret) return { ok: true, userId: null, via: "secret" };
  }

  // 2. Supabase JWT (the console's signed-in operator).
  if (!bearer) return { ok: false, status: 401, reason: "missing bearer token" };
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { ok: false, status: 503, reason: "supabase not configured" };

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.getUser(bearer);
  if (error || !data?.user) return { ok: false, status: 401, reason: "invalid token" };

  const svc = opsServiceClient();
  if (!svc) return { ok: false, status: 503, reason: "service role not configured" };
  const { data: prof } = await svc.from("profiles").select("tenant_id").eq("id", data.user.id).single();
  if (!prof || prof.tenant_id !== null) return { ok: false, status: 403, reason: "not a superadmin" };

  return { ok: true, userId: data.user.id, via: "jwt" };
}
