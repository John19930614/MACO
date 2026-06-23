/**
 * Shared OSHA incident-rate basis.
 *
 * TRIR and DART must be computed identically everywhere (dashboard, OSHA module,
 * and every export) or the same establishment shows different rates on different
 * screens. All call sites import from here instead of hard-coding hours.
 *
 * OSHA rate = (case count × 200,000) ÷ hours worked, where 200,000 = 100 FTE
 * working 2,000 hours/year. Hours worked = FTE × 2,080 (40 h × 52 w).
 */
export const OSHA_FTE = 42;
export const OSHA_HOURS_WORKED = OSHA_FTE * 2080; // 87,360
export const OSHA_DART_BENCHMARK = 1.8; // NAICS 5417 — R&D biotech industry average

/** OSHA rate per 100 FTE for a given case count, as a fixed-2 string. */
export function oshaRate(caseCount: number): string {
  if (caseCount <= 0) return "0.00";
  return ((caseCount / OSHA_HOURS_WORKED) * 200000).toFixed(2);
}
