// ============================================================
// Predictive Risk Engine — Phase 5 statistical validation core.
//
// Pure, dependency-free math so it runs in the node/vitest environment (no
// Supabase, no "server-only"). Given a historical dataset of predicted risk
// bands paired with whether an incident actually occurred in the follow-up
// window, this measures:
//   • how well the predicted band tracks real incidents (point-biserial
//     correlation of band-rank vs a 0/1 incident flag + a two-sided p-value), and
//   • the false-positive rate among the high-risk bands (orange/red periods that
//     were NOT followed by an incident).
//
// The bands here are the REAL four-band model used across the platform
// (green/amber/orange/red — see risk_score_bands / scoring.ts), NOT a five-band
// low/moderate/elevated/high/critical scheme.
// ============================================================

import type { HistoricalValidationDataset } from "./validation-data";

// Ordinal rank of each band, low → high. Point-biserial correlation treats this
// as the continuous variable against the 0/1 "incident happened" flag.
export const BAND_RANK = { green: 0, amber: 1, orange: 2, red: 3 } as const;

// "High-risk" for false-positive purposes = the bands an EHS lead would treat as
// actionable. A high-risk period with no subsequent incident is a false alarm.
export const HIGH_RISK_BANDS: ReadonlyArray<keyof typeof BAND_RANK> = ["orange", "red"];

export interface CorrelationResult {
  correlationCoefficient: number;
  pValue: number;
  sampleSize: number;
}

export interface FalsePositiveResult {
  falsePositiveRate: number;
  tolerance: number;
  highRiskPeriods: number;
  falsePositives: number;
}

// Point-biserial correlation between predicted band rank and actual incident
// occurrence, with a two-sided significance test. Returns a neutral, non-
// significant result for empty or degenerate (zero-variance) inputs rather than
// throwing, so callers can gate on sampleSize/pValue.
export function computeBandIncidentCorrelation(
  dataset: HistoricalValidationDataset,
): CorrelationResult {
  const rows = dataset.rows;
  const n = rows.length;
  if (n < 2) return { correlationCoefficient: 0, pValue: 1, sampleSize: n };

  const x = rows.map((r) => BAND_RANK[r.predictedBand] ?? 0);
  const y = rows.map((r) => (r.hadIncidentInWindow ? 1 : 0));

  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const mx = mean(x);
  const my = mean(y);

  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  // No variance in band or in outcome → correlation is undefined; report 0/ns.
  const r = dx2 === 0 || dy2 === 0 ? 0 : num / Math.sqrt(dx2 * dy2);

  // Significance of a correlation coefficient via the Student-t transform.
  const df = n - 2;
  const denom = 1 - r * r;
  const t = r * Math.sqrt(df / (denom <= 0 ? 1e-9 : denom));
  const pValue = studentTTwoSidedPValue(t, df);

  return { correlationCoefficient: r, pValue, sampleSize: n };
}

// False-positive rate among high-risk (orange/red) periods: the fraction of
// those periods that were NOT followed by an incident within the window. The
// tolerance is the EHS-approved ceiling carried on the dataset (default 0.15).
export function computeFalsePositiveRate(
  dataset: HistoricalValidationDataset,
): FalsePositiveResult {
  const highRiskRows = dataset.rows.filter((r) =>
    HIGH_RISK_BANDS.includes(r.predictedBand),
  );
  const falsePositives = highRiskRows.filter((r) => !r.hadIncidentInWindow);
  const falsePositiveRate =
    highRiskRows.length === 0 ? 0 : falsePositives.length / highRiskRows.length;
  return {
    falsePositiveRate,
    tolerance: dataset.fpTolerance ?? 0.15,
    highRiskPeriods: highRiskRows.length,
    falsePositives: falsePositives.length,
  };
}

// ── Statistics helpers ──────────────────────────────────────────────────────
// Two-sided p-value from Student's t distribution, via the regularized
// incomplete beta function. Accurate enough for significance gating (p < 0.05).

function studentTTwoSidedPValue(t: number, df: number): number {
  if (df <= 0) return 1;
  const x = df / (df + t * t);
  const p = regularizedIncompleteBeta(df / 2, 0.5, x);
  return Math.min(1, Math.max(0, p));
}

// Regularized incomplete beta I_x(a, b) via the Lentz continued-fraction
// expansion. Uses the standard reflection I_x(a,b) = 1 - I_{1-x}(b,a) for fast
// convergence when x is above the a/(a+b) pivot.
function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front =
    Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta) / a;

  if (x < (a + 1) / (a + b + 2)) {
    return front * betaContinuedFraction(a, b, x);
  }
  // Reflect for better convergence in the upper tail.
  const lbetaR = lgamma(b) + lgamma(a) - lgamma(a + b);
  const frontR =
    Math.exp(b * Math.log(1 - x) + a * Math.log(x) - lbetaR) / b;
  return 1 - frontR * betaContinuedFraction(b, a, 1 - x);
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const TINY = 1e-30;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let f = d;

  for (let i = 1; i <= 200; i++) {
    const m = i;
    // even step
    let numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + numerator * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + numerator / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    f *= d * c;
    // odd step
    numerator = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + numerator * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + numerator / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-12) break;
  }
  return f;
}

// Lanczos approximation of ln Γ(x).
function lgamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  }
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
