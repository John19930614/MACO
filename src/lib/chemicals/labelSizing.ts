// EU CLP (Regulation 1272/2008, Annex I §1.2.1) label-size tiers.
//
// The minimum dimensions of a hazard label — and of each GHS pictogram on it —
// are set by the CAPACITY of the container being labelled. These are legal
// MINIMUMS; printing larger is always compliant, printing smaller is not.
//
//   Container capacity      Min label (w × h)     Pictogram rule
//   ≤ 3 litres              52 × 74 mm            each ≥ 1/15 of label area,
//   > 3 – 50 litres         74 × 105 mm           and never smaller than
//   > 50 – 500 litres       105 × 148 mm          1 cm² (10 × 10 mm)
//   > 500 litres            148 × 210 mm
//
// US OSHA HazCom (29 CFR 1910.1200) mandates no specific size, so sizing to the
// CLP minimums also satisfies OSHA.

export type ClpTier = "≤3 L" | "3–50 L" | "50–500 L" | ">500 L";

export interface LabelSize {
  tier: ClpTier;
  /** Container capacity in litres, or null when it hasn't been recorded. */
  containerLitres: number | null;
  labelWmm: number;
  labelHmm: number;
  /** Minimum side length of each square GHS pictogram, in mm. */
  pictogramMm: number;
  /** True when capacity is unknown and the smallest tier was used as a fallback. */
  isFallback: boolean;
}

const TIERS: { maxL: number; tier: ClpTier; w: number; h: number }[] = [
  { maxL: 3,        tier: "≤3 L",     w: 52,  h: 74  },
  { maxL: 50,       tier: "3–50 L",   w: 74,  h: 105 },
  { maxL: 500,      tier: "50–500 L", w: 105, h: 148 },
  { maxL: Infinity, tier: ">500 L",   w: 148, h: 210 },
];

const GALLON_TO_L = 3.785411784;

/**
 * Convert a container capacity to litres. Volume units convert exactly; mass
 * units (g/kg) are approximated at density ≈ 1 (documented limitation — set a
 * volume unit for solids where the true packed volume differs). Returns null for
 * missing/invalid input so callers can show a "set container size" hint.
 */
export function litresFromCapacity(
  capacity: number | null | undefined,
  unit: string | null | undefined,
): number | null {
  if (capacity == null || !Number.isFinite(capacity) || capacity <= 0) return null;
  switch ((unit ?? "L").trim().toLowerCase()) {
    case "ml":      return capacity / 1000;
    case "l":       return capacity;
    case "gal":
    case "gallon":
    case "gallons": return capacity * GALLON_TO_L;
    case "g":       return capacity / 1000; // mass→volume approximation (ρ≈1)
    case "kg":      return capacity;        // mass→volume approximation (ρ≈1)
    default:        return capacity;        // unknown unit → assume litres
  }
}

/** CLP pictogram minimum: ≥ 1/15 of label area, and never below 1 cm² (10 mm). */
function pictogramMinMm(w: number, h: number): number {
  return Math.max(10, Math.round(Math.sqrt((w * h) / 15)));
}

/** Resolve the CLP label size for a container capacity. Unknown → smallest tier (flagged). */
export function labelSizeForContainer(
  capacity: number | null | undefined,
  unit: string | null | undefined,
): LabelSize {
  const litres = litresFromCapacity(capacity, unit);
  const effective = litres ?? 0; // unknown → smallest tier
  const t = TIERS.find((x) => effective <= x.maxL) ?? TIERS[TIERS.length - 1];
  return {
    tier: t.tier,
    containerLitres: litres,
    labelWmm: t.w,
    labelHmm: t.h,
    pictogramMm: pictogramMinMm(t.w, t.h),
    isFallback: litres == null,
  };
}

/** The two smallest tiers can't legibly fit the full multi-section layout. */
export function isCompactTier(size: LabelSize): boolean {
  return size.labelWmm < 100;
}
