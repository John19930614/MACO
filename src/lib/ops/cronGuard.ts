/**
 * Pure helpers for the CRON_SECRET guard on /api/ops: timing-safe secret
 * comparison, secret masking for audit hints, and the audit_log row builder.
 *
 * Deliberately free of next/server, supabase, and "server-only" imports so the
 * whole module is unit-testable in plain node (test/api-ops-rate-limit.test.ts).
 * The wiring — IP extraction, rate-limit enforcement, DB write — lives in
 * src/lib/ops/auth.ts.
 */
import { timingSafeEqual as nodeTimingSafeEqual } from "crypto";

export type CronOutcome = "success" | "rejected" | "rate-limited";

// 10 requests per fixed 60-second window, per source IP.
export const CRON_WINDOW_MS = 60_000;
export const CRON_MAX_REQUESTS = 10;

/**
 * Timing-safe string comparison. Length mismatch still performs a comparison
 * of equal-length buffers so the early return does not leak length via timing.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      nodeTimingSafeEqual(bufA, bufA);
      return false;
    }
    return nodeTimingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Last 4 characters only, for audit hints. Secrets shorter than 8 chars are
 * fully masked — showing "the last 4" of a 4-char secret would reveal all of it.
 */
export function maskSecret(secret: string | null | undefined): string {
  if (!secret || secret.length < 8) return "****";
  return `****${secret.slice(-4)}`;
}

/** Row shape for a direct service-role insert into public.audit_log. */
export interface CronAuditEntry {
  tenant_id: null;
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string;
  reason: string;
  detail: Record<string, unknown>;
}

const ACTION_BY_OUTCOME: Record<CronOutcome, string> = {
  success: "cron_secret.access",
  rejected: "cron_secret.rejected",
  "rate-limited": "cron_secret.rate_limited",
};

/**
 * Exactly one audit row per CRON_SECRET attempt. tenant_id null = platform-level
 * (the audit_log RLS admits null rows for the Reliance superadmin, and the
 * service-role writer bypasses RLS anyway). Never includes the full secret —
 * only the masked hint.
 */
export function buildCronAuditEntry(
  outcome: CronOutcome,
  ip: string,
  submittedSecret: string | null,
  retryAfterSeconds?: number
): CronAuditEntry {
  return {
    tenant_id: null,
    actor_id: `cron:${ip}`,
    action: ACTION_BY_OUTCOME[outcome],
    entity: "ops_api",
    entity_id: "/api/ops",
    reason: outcome,
    detail: {
      path: "/api/ops",
      ip,
      secret_hint: maskSecret(submittedSecret),
      outcome,
      ...(retryAfterSeconds !== undefined ? { retry_after_seconds: retryAfterSeconds } : {}),
    },
  };
}
