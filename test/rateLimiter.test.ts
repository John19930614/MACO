import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createRateLimiter } from "@/lib/rateLimiter";

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("allows requests up to the max within the window", () => {
    const check = createRateLimiter(60_000, 10);
    for (let i = 0; i < 10; i++) {
      expect(check("ip-a").allowed).toBe(true);
    }
  });

  test("blocks the request that exceeds the cap", () => {
    const check = createRateLimiter(60_000, 10);
    for (let i = 0; i < 10; i++) check("ip-a");
    const result = check("ip-a");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  test("retryAfterSeconds is positive and ≤ windowMs/1000 when blocked", () => {
    const check = createRateLimiter(60_000, 3);
    for (let i = 0; i < 3; i++) check("ip-b");
    const { retryAfterSeconds } = check("ip-b");
    expect(retryAfterSeconds).toBeGreaterThan(0);
    expect(retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  test("different keys have independent buckets", () => {
    const check = createRateLimiter(60_000, 2);
    check("ip-a");
    check("ip-a");
    // ip-a is now at cap; ip-b should still be allowed
    expect(check("ip-a").allowed).toBe(false);
    expect(check("ip-b").allowed).toBe(true);
  });

  test("bucket resets after the window expires", () => {
    const check = createRateLimiter(60_000, 2);
    check("ip-c");
    check("ip-c");
    expect(check("ip-c").allowed).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(check("ip-c").allowed).toBe(true);
  });

  test("returns retryAfterSeconds 0 for allowed requests", () => {
    const check = createRateLimiter(60_000, 5);
    const result = check("ip-d");
    expect(result.allowed).toBe(true);
    expect(result.retryAfterSeconds).toBe(0);
  });

  test("partial window elapse does not reset the bucket", () => {
    const check = createRateLimiter(60_000, 1);
    check("ip-e");
    vi.advanceTimersByTime(30_000);
    const result = check("ip-e");
    expect(result.allowed).toBe(false);
    // Half the window remains
    expect(result.retryAfterSeconds).toBe(30);
  });
});
