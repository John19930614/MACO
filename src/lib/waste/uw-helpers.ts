// Pure, dependency-free helpers for Universal-Waste & Recycling tracking.
//
// These live OUTSIDE the "use server" actions file (which may only export async
// server actions) and outside the jurisdiction engine (which imports the
// Supabase server client). Keeping them here means the UI can import them in a
// client component and the vitest suite can import them in a plain Node env with
// no server-only / next-headers baggage.

export type VendorBadge = "valid" | "expiring" | "expired";
export type Stoplight = "green" | "yellow" | "red";

const DAY_MS = 24 * 60 * 60 * 1000;

// Vendor permit/insurance/authorization badge. Expired if ANY provided date is
// in the past; expiring if ANY is within `withinDays` (default 30); otherwise
// valid. Null dates are ignored (a vendor with no dates on file is "valid").
export function getVendorStatusBadge(
  permitExpiry: string | null,
  insuranceExpiry: string | null,
  recyclerAuthorizationExpiry: string | null = null,
  now: Date = new Date(),
  withinDays = 30,
): VendorBadge {
  const soon = new Date(now.getTime() + withinDays * DAY_MS);
  const dates = [permitExpiry, insuranceExpiry, recyclerAuthorizationExpiry]
    .filter((d): d is string => Boolean(d))
    .map((d) => new Date(d));
  if (dates.some((d) => d < now)) return "expired";
  if (dates.some((d) => d <= soon)) return "expiring";
  return "valid";
}

// Diversion rate from weight-ticket data: recycled / (recycled + landfill) * 100,
// rounded to 0.1%. Returns null when no weight has been recorded yet.
export function computeDiversionRate(
  weightRecycled: number | null | undefined,
  weightLandfill: number | null | undefined,
): number | null {
  const recycled = weightRecycled ?? 0;
  const landfill = weightLandfill ?? 0;
  const total = recycled + landfill;
  if (total <= 0) return null;
  return Math.round((1000 * recycled) / total) / 10;
}

// Plain-language subtitle for the diversion-rate card.
export function diversionSubtitle(rate: number | null): string {
  if (rate == null) return "Log a weight ticket to start tracking diversion.";
  return `${rate}% of waste diverted from landfill.`;
}

// The 1-year "must ship out by" deadline: accumulation start + 365 days.
// Accepts and returns an ISO date string (YYYY-MM-DD).
export function accumulationDeadline(startDate: string): string {
  const start = new Date(`${startDate}T00:00:00Z`);
  const deadline = new Date(start.getTime() + 365 * DAY_MS);
  return deadline.toISOString().slice(0, 10);
}

// Whole days from `now` until the given date (negative once past).
export function daysUntil(dateStr: string, now: Date = new Date()): number {
  const target = new Date(`${dateStr}T00:00:00Z`).getTime();
  const today = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  return Math.round((target - today) / DAY_MS);
}

// Stoplight status for a UW accumulation deadline:
//   green  → more than 60 days left
//   yellow → 60 days or fewer left (but not overdue)
//   red    → past the deadline
export function stoplightForDeadline(deadlineStr: string, now: Date = new Date()): Stoplight {
  const days = daysUntil(deadlineStr, now);
  if (days < 0) return "red";
  if (days <= 60) return "yellow";
  return "green";
}

// Human countdown label for a UW item.
export function countdownLabel(deadlineStr: string, now: Date = new Date()): string {
  const days = daysUntil(deadlineStr, now);
  if (days < 0) return `${Math.abs(days)} days overdue — remove this waste now`;
  if (days === 0) return "Due today — remove this waste";
  return `${days} days left to remove this waste`;
}

// Whether a category is eligible to be tracked as Universal Waste in a given
// state as of a date. Day-one only encodes the WI aerosol-cans effective date
// (7/1/2025); every other state/category is eligible. Full 50-state variance is
// a fast-follow, handled by the DB-backed resolveJurisdictionRule.
export function isUniversalWasteEligible(
  state: string,
  category: string,
  asOf: Date = new Date(),
): boolean {
  if (state === "WI" && category === "aerosol_cans") {
    return asOf >= new Date("2025-07-01T00:00:00Z");
  }
  return true;
}

// Whether a UW item's recorded quantity exceeds its configured limit (if any).
export function exceedsQuantityLimit(
  quantity: number | null | undefined,
  quantityLimit: number | null | undefined,
): boolean {
  if (quantity == null || quantityLimit == null) return false;
  return quantity > quantityLimit;
}
