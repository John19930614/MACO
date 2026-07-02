/**
 * In-process fixed-window rate limiter.
 * Safe for a single serverless instance; note that Vercel may spin multiple
 * instances, so the bucket is per-instance. Acceptable for the low-traffic
 * /api/ops cron endpoint this guards — the cap is a brute-force brake, not a
 * precise global quota.
 */

interface Bucket {
  count: number;
  windowStart: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the current window resets. Only meaningful when allowed === false. */
  retryAfterSeconds: number;
}

// Sweep expired buckets once the map grows past this, so an attacker rotating
// spoofed X-Forwarded-For values cannot grow memory without bound.
const SWEEP_THRESHOLD = 1000;

export function createRateLimiter(
  windowMs: number,
  maxRequests: number
): (key: string) => RateLimitResult {
  const buckets = new Map<string, Bucket>();

  return function check(key: string): RateLimitResult {
    const now = Date.now();

    if (buckets.size > SWEEP_THRESHOLD) {
      for (const [k, b] of buckets) {
        if (now - b.windowStart >= windowMs) buckets.delete(k);
      }
    }

    const bucket = buckets.get(key);

    if (!bucket || now - bucket.windowStart >= windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (bucket.count < maxRequests) {
      bucket.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const retryAfterSeconds = Math.ceil(
      (windowMs - (now - bucket.windowStart)) / 1000
    );
    return { allowed: false, retryAfterSeconds };
  };
}
