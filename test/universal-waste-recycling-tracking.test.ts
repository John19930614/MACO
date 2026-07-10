import { test, expect } from "vitest";
import {
  getVendorStatusBadge,
  computeDiversionRate,
  diversionSubtitle,
  accumulationDeadline,
  stoplightForDeadline,
  countdownLabel,
  exceedsQuantityLimit,
  isUniversalWasteEligible,
} from "@/lib/waste/uw-helpers";
// Re-export surface: the jurisdiction engine exposes isUniversalWasteEligible too.
import { isUniversalWasteEligible as isEligibleViaEngine } from "@/lib/waste/jurisdiction-engine";

// Fixed "now" so date-based assertions are deterministic.
const NOW = new Date("2026-07-10T00:00:00Z");
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// ── Vendor status badge (valid / expiring / expired) ────────────────────────────

test("vendor badge is expired when permit date is in the past", () => {
  expect(getVendorStatusBadge("2020-01-01", null, null, NOW)).toBe("expired");
});

test("vendor badge is expiring within 30 days", () => {
  expect(getVendorStatusBadge(daysFromNow(10), null, null, NOW)).toBe("expiring");
});

test("vendor badge is valid when far in the future", () => {
  expect(getVendorStatusBadge("2099-01-01", "2099-01-01", "2099-01-01", NOW)).toBe("valid");
});

test("vendor badge: any expired date wins over a valid one", () => {
  expect(getVendorStatusBadge("2099-01-01", "2000-01-01", null, NOW)).toBe("expired");
});

test("vendor badge is valid when no dates are on file", () => {
  expect(getVendorStatusBadge(null, null, null, NOW)).toBe("valid");
});

// ── Accumulation deadline (365 days) + stoplight thresholds ─────────────────────

test("accumulation deadline is exactly 365 days after the start date", () => {
  expect(accumulationDeadline("2025-07-01")).toBe("2026-07-01");
});

test("stoplight is green when more than 60 days remain", () => {
  expect(stoplightForDeadline(daysFromNow(120), NOW)).toBe("green");
});

test("stoplight is yellow at 60 days or fewer", () => {
  expect(stoplightForDeadline(daysFromNow(60), NOW)).toBe("yellow");
  expect(stoplightForDeadline(daysFromNow(1), NOW)).toBe("yellow");
});

test("stoplight is red once past the deadline", () => {
  expect(stoplightForDeadline(daysFromNow(-1), NOW)).toBe("red");
});

test("countdown label reads in plain language", () => {
  expect(countdownLabel(daysFromNow(45), NOW)).toBe("45 days left to remove this waste");
  expect(countdownLabel(daysFromNow(-3), NOW)).toBe("3 days overdue — remove this waste now");
});

// ── Quantity limit ──────────────────────────────────────────────────────────────

test("quantity-limit warning triggers only when exceeded", () => {
  expect(exceedsQuantityLimit(120, 100)).toBe(true);
  expect(exceedsQuantityLimit(80, 100)).toBe(false);
  expect(exceedsQuantityLimit(50, null)).toBe(false);
});

// ── Diversion rate ──────────────────────────────────────────────────────────────

test("diversion rate = recycled / (recycled + landfill) * 100", () => {
  expect(computeDiversionRate(72, 28)).toBe(72);
});

test("diversion rate is null before any weight is recorded", () => {
  expect(computeDiversionRate(0, 0)).toBeNull();
  expect(computeDiversionRate(null, null)).toBeNull();
});

test("diversion subtitle is plain language", () => {
  expect(diversionSubtitle(72)).toBe("72% of waste diverted from landfill.");
  expect(diversionSubtitle(null)).toMatch(/weight ticket/i);
});

// ── WI aerosol effective-date logic ─────────────────────────────────────────────

test("WI aerosol cans are NOT universal waste before 7/1/2025", () => {
  expect(isUniversalWasteEligible("WI", "aerosol_cans", new Date("2025-06-30"))).toBe(false);
});

test("WI aerosol cans ARE universal waste on/after 7/1/2025", () => {
  expect(isUniversalWasteEligible("WI", "aerosol_cans", new Date("2025-07-01"))).toBe(true);
});

test("other categories/states are eligible regardless of date", () => {
  expect(isUniversalWasteEligible("CA", "batteries", new Date("2000-01-01"))).toBe(true);
  expect(isUniversalWasteEligible("WI", "batteries", new Date("2000-01-01"))).toBe(true);
});

test("jurisdiction engine re-exports the same eligibility helper", () => {
  expect(isEligibleViaEngine("WI", "aerosol_cans", new Date("2025-07-01"))).toBe(true);
});
