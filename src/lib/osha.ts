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
export const OSHA_HOURS_WORKED = OSHA_FTE * 2080; // 87,360 — fallback when a tenant hasn't entered its real hours
export const OSHA_DART_BENCHMARK = 1.8; // NAICS 5417 — R&D biotech industry average

/**
 * OSHA rate per 100 FTE for a given case count, as a fixed-2 string.
 * `hoursWorked` defaults to the platform fallback; pass the tenant's real
 * annual hours (from Company Settings) so rates reflect the actual establishment.
 */
export function oshaRate(caseCount: number, hoursWorked: number = OSHA_HOURS_WORKED): string {
  const hrs = hoursWorked > 0 ? hoursWorked : OSHA_HOURS_WORKED;
  if (caseCount <= 0) return "0.00";
  return ((caseCount / hrs) * 200000).toFixed(2);
}

/**
 * Resolve a tenant's annual hours-worked basis from its saved settings.
 * Prefers an explicit `oshaAnnualHours`; else derives from `oshaAvgEmployees`
 * × 2,080; else falls back to the platform default. Always returns > 0.
 */
export function resolveOshaHours(settings?: Record<string, unknown> | null): number {
  if (settings) {
    const hours = Number(settings.oshaAnnualHours);
    if (Number.isFinite(hours) && hours > 0) return hours;
    const emp = Number(settings.oshaAvgEmployees);
    if (Number.isFinite(emp) && emp > 0) return Math.round(emp * 2080);
  }
  return OSHA_HOURS_WORKED;
}
