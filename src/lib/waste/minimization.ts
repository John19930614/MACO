// Pure helpers for waste-minimization programs. Kept out of the "use server"
// action module because Server Action files may only export async functions —
// these synchronous helpers live here so both the action and the tests can
// import them.

/**
 * Target remaining quantity after applying the reduction target to a baseline.
 * e.g. baseline 1000 kg with a 30% target → 700 kg.
 */
export function computeReductionTargetQty(baselineQuantityKg: number, reductionTargetPct: number): number {
  return baselineQuantityKg * (1 - reductionTargetPct / 100);
}

/**
 * Simple ROI% from estimated cost + savings. Returns null unless there is a
 * positive cost to divide by (avoids divide-by-zero / meaningless ROI).
 */
export function computeRoiPct(cost?: number | null, savings?: number | null): number | null {
  if (typeof cost !== "number" || cost <= 0 || typeof savings !== "number") return null;
  return ((savings - cost) / cost) * 100;
}
