import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY, serverSecrets } from "@/lib/env";
import { createRateLimiter } from "@/lib/rateLimiter";
import {
  CRON_MAX_REQUESTS,
  CRON_WINDOW_MS,
  buildCronAuditEntry,
  timingSafeEqualStr,
  type CronOutcome,
} from "@/lib/ops/cronGuard";

/**
 * Authentication for the internal /api/ops endpoint (Ops Console live signals).
 *
 * Two accepted callers, both superadmin-gated:
 *   1. CRON_SECRET  — for a CLI / uptime probe (Authorization: Bearer <secret>
 *      or ?secret=<secret>). NEVER used by the browser console (a server secret
 *      must not live in client code — SOP-12). Rate-limited per source IP,
 *      compared timing-safe, and every attempt is audited to audit_log
 *      (see cronGuard.ts).
 *   2. Supabase JWT — the signed-in operator's own access token
 *      (Authorization: Bearer <jwt>). Verified server-side; the profile must be
 *      a Reliance superadmin (tenant_id IS NULL).
 */
export type OpsAuth =
  | { ok: true; userId: string | null; via: "secret" | "jwt" }
  | { ok: false; status: number; reason: string; retryAfterSeconds?: number };

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

// Fixed-window limiter for CRON_SECRET attempts, keyed by source IP. Module-
// level so the bucket persists across requests within the same instance
// (per-instance on Vercel — a brute-force brake, not a precise global quota).
const cronLimiter = createRateLimiter(CRON_WINDOW_MS, CRON_MAX_REQUESTS);

/** Best available client IP behind Vercel's proxy headers. */
function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Exactly one audit_log row per CRON_SECRET attempt (success, rejected, or
 * rate-limited). Written via the service-role client because the probe has no
 * Supabase session — repo.addAudit() resolves the acting user and would throw.
 * Best-effort: a failed audit write must never break auth itself. In mock/CI
 * mode there is no service client, so this is a no-op.
 */
async function auditCronAttempt(
  outcome: CronOutcome,
  ip: string,
  submittedSecret: string | null,
  retryAfterSeconds?: number
): Promise<void> {
  try {
    const svc = opsServiceClient();
    if (!svc) return;
    const { error } = await svc
      .from("audit_log")
      .insert(buildCronAuditEntry(outcome, ip, submittedSecret, retryAfterSeconds));
    if (error) console.error("cron audit write failed (non-fatal):", error.message);
  } catch (e) {
    console.error("cron audit write failed (non-fatal):", e);
  }
}

export async function requireSuperadmin(req: NextRequest): Promise<OpsAuth> {
  const bearer = bearerOf(req);

  // 1. CRON_SECRET (CLI / probe) — rate-limited, timing-safe, audited.
  //
  // A request counts as a cron attempt when it carries ?secret=, a bearer that
  // is not JWT-shaped (Supabase JWTs always contain dots), or a bearer that
  // timing-safe-matches the secret (covers a dotted secret without breaking
  // JWT traffic). Real JWTs never enter this branch, so the superadmin path
  // below is untouched by rate-limiting and auditing.
  const secret = process.env.CRON_SECRET || "";
  const qsSecret = req.nextUrl.searchParams.get("secret");
  const isCronAttempt =
    qsSecret !== null ||
    (bearer !== "" &&
      (!bearer.includes(".") || (secret !== "" && timingSafeEqualStr(bearer, secret))));

  if (isCronAttempt) {
    const ip = clientIp(req);
    const candidate = qsSecret ?? bearer;

    // Rate-limit before validating, so the limiter also throttles guessing.
    const rl = cronLimiter(`cron_secret:${ip}`);
    if (!rl.allowed) {
      await auditCronAttempt("rate-limited", ip, candidate, rl.retryAfterSeconds);
      return {
        ok: false,
        status: 429,
        reason: `rate limit reached — retry after ${rl.retryAfterSeconds}s`,
        retryAfterSeconds: rl.retryAfterSeconds,
      };
    }

    if (secret !== "" && timingSafeEqualStr(candidate, secret)) {
      await auditCronAttempt("success", ip, candidate);
      return { ok: true, userId: null, via: "secret" };
    }

    await auditCronAttempt("rejected", ip, candidate);
    return { ok: false, status: 401, reason: "invalid automation secret" };
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
