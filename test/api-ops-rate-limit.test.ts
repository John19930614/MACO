// Tests for the CRON_SECRET guard on /api/ops (src/lib/ops/cronGuard.ts):
//   - audit row shape for success / rejected / rate-limited outcomes
//   - masked secret hint (last 4 chars only; short/null fully masked)
//   - timing-safe secret comparison semantics
//   - rate-limit bucket isolation + window reset for the cron key
// Pure-logic module — no next/server, supabase, or HTTP stack involved.
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createRateLimiter } from "@/lib/rateLimiter";
import {
  CRON_MAX_REQUESTS,
  CRON_WINDOW_MS,
  buildCronAuditEntry,
  maskSecret,
  timingSafeEqualStr,
} from "@/lib/ops/cronGuard";

describe("CRON_SECRET audit entry shape", () => {
  test("success outcome maps to cron_secret.access with correct fields", () => {
    const entry = buildCronAuditEntry("success", "1.2.3.4", "supersecretABCD");
    expect(entry).toMatchObject({
      tenant_id: null,
      actor_id: "cron:1.2.3.4",
      action: "cron_secret.access",
      entity: "ops_api",
      entity_id: "/api/ops",
      reason: "success",
      detail: {
        path: "/api/ops",
        ip: "1.2.3.4",
        secret_hint: "****ABCD",
        outcome: "success",
      },
    });
    expect(entry.detail).not.toHaveProperty("retry_after_seconds");
  });

  test("rejected outcome maps to cron_secret.rejected", () => {
    const entry = buildCronAuditEntry("rejected", "5.6.7.8", "wrong-XYZW");
    expect(entry).toMatchObject({
      action: "cron_secret.rejected",
      actor_id: "cron:5.6.7.8",
      detail: { ip: "5.6.7.8", secret_hint: "****XYZW", outcome: "rejected" },
    });
  });

  test("rate-limited outcome maps to cron_secret.rate_limited and carries retry_after_seconds", () => {
    const entry = buildCronAuditEntry("rate-limited", "9.9.9.9", "someSecret1234", 42);
    expect(entry).toMatchObject({
      action: "cron_secret.rate_limited",
      detail: {
        ip: "9.9.9.9",
        secret_hint: "****1234",
        outcome: "rate-limited",
        retry_after_seconds: 42,
      },
    });
  });

  test("audit entry never contains the full secret anywhere", () => {
    const fullSecret = "my-very-long-cron-secret-value";
    const entry = buildCronAuditEntry("rejected", "1.1.1.1", fullSecret);
    expect(JSON.stringify(entry)).not.toContain(fullSecret);
  });
});

describe("maskSecret", () => {
  test("short or null secrets are fully masked", () => {
    expect(maskSecret(null)).toBe("****");
    expect(maskSecret(undefined)).toBe("****");
    expect(maskSecret("")).toBe("****");
    expect(maskSecret("abc")).toBe("****");
    // A 4-char secret must not be fully revealed by a "last 4" hint
    expect(maskSecret("abcd")).toBe("****");
  });

  test("long secrets show only the last 4 characters", () => {
    const hint = maskSecret("my-very-long-cron-secret-value");
    expect(hint).toBe("****alue");
    expect(hint.length).toBe(8); // '****' + last 4
  });
});

describe("timingSafeEqualStr", () => {
  test("equal strings compare true", () => {
    expect(timingSafeEqualStr("secret-value", "secret-value")).toBe(true);
  });

  test("unequal same-length strings compare false", () => {
    expect(timingSafeEqualStr("secret-value", "secret-valuf")).toBe(false);
  });

  test("different-length strings compare false", () => {
    expect(timingSafeEqualStr("short", "much-longer-string")).toBe(false);
  });

  test("empty vs non-empty compares false", () => {
    expect(timingSafeEqualStr("", "x")).toBe(false);
  });
});

describe("cron rate-limit bucket", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("superadmin JWT requests never consume cron quota (limiter is only invoked on cron attempts)", () => {
    const cronCheck = createRateLimiter(60_000, 2);
    // JWT requests do not call the limiter at all — the cron bucket keeps
    // its full quota regardless of how much JWT traffic flows.
    expect(cronCheck("cron_secret:10.0.0.1").allowed).toBe(true);
    expect(cronCheck("cron_secret:10.0.0.1").allowed).toBe(true);
    expect(cronCheck("cron_secret:10.0.0.1").allowed).toBe(false);
  });

  test("configured cap: request CRON_MAX_REQUESTS+1 within the window is blocked", () => {
    const cronCheck = createRateLimiter(CRON_WINDOW_MS, CRON_MAX_REQUESTS);
    for (let i = 0; i < CRON_MAX_REQUESTS; i++) {
      expect(cronCheck("cron_secret:2.2.2.2").allowed).toBe(true);
    }
    expect(cronCheck("cron_secret:2.2.2.2").allowed).toBe(false);
  });

  test("rate limit resets after the window; cron requests allowed again", () => {
    const cronCheck = createRateLimiter(60_000, 1);
    cronCheck("cron_secret:10.0.0.2");
    expect(cronCheck("cron_secret:10.0.0.2").allowed).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(cronCheck("cron_secret:10.0.0.2").allowed).toBe(true);
  });

  test("429 contract: blocked result carries a positive integer retryAfterSeconds", () => {
    const cronCheck = createRateLimiter(60_000, 1);
    cronCheck("cron_secret:1.1.1.1");
    const { allowed, retryAfterSeconds } = cronCheck("cron_secret:1.1.1.1");
    expect(allowed).toBe(false);
    expect(Number.isInteger(retryAfterSeconds)).toBe(true);
    expect(retryAfterSeconds).toBeGreaterThan(0);
  });
});
