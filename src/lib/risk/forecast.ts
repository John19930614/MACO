/**
 * ARC P-CLSS — Anticipate / Forecast (pure, deterministic, testable).
 *
 * Converts the platform's leading indicators into a forward-looking risk
 * forecast PER LOCATION: "what is likely to fail next, and why." It blends
 * open control failures, outcome (event) recurrence, emergent behavior
 * patterns, open high-severity cells, overdue actions, and the site's Human
 * Signal Layer into a 0–100 score with an explainable list of top drivers, the
 * predicted failure mode, and a pre-emptive recommendation. No model call — the
 * logic is auditable, which a safety forecast must be.
 */
import type { SafetyCell, ControlProof, EventCell, BehaviorCell, SafetyAction, HslReading, SafetyLocation, Site } from "@/lib/types";
import { proofToRiskType } from "./objects";

export type ForecastBand = "green" | "amber" | "orange" | "red";

export interface ForecastDriver {
  key: string;
  label: string;
  contribution: number; // 0–100 points this driver adds to the score
}

export interface LocationForecast {
  locationId: string;
  label: string;
  siteId: string;
  score: number; // 0–100
  band: ForecastBand;
  predictedExposure: string | null; // dominant exposure type at the location
  vertical: string; // GUS vertical whose weight profile shaped this score
  topCellId: string | null; // highest-risk open cell here — the pre-empt target
  cells: { id: string; title: string; severity: string }[]; // contributing cells, highest-risk first
  drivers: ForecastDriver[]; // highest contribution first
  recommendation: string;
}

export interface ForecastInput {
  locations: SafetyLocation[];
  cells: SafetyCell[];
  proofs: ControlProof[];
  events: EventCell[];
  behaviors: BehaviorCell[];
  actions: SafetyAction[];
  hsl: HslReading[];
  sites: Site[];
  now: number;
}

type WeightKey = "failures" | "events" | "behavior" | "openHigh" | "overdue" | "hsl";
type Weights = Record<WeightKey, number>;

// Default (cross-vertical) leading-indicator weights — max points each.
const DEFAULT_WEIGHTS: Weights = { failures: 28, events: 22, behavior: 16, openHigh: 14, overdue: 10, hsl: 10 };

// GUS per-vertical profiles. Each vertical emphasizes its priority hazards;
// weights are tuned to total 100. Unlisted verticals use DEFAULT_WEIGHTS.
const VERTICAL_WEIGHTS: Record<string, Weights> = {
  // Process-safety led: broken/unverified controls and outcomes dominate.
  "oil-gas": { failures: 34, events: 26, behavior: 14, openHigh: 12, overdue: 8, hsl: 6 },
  chemical: { failures: 34, events: 26, behavior: 14, openHigh: 12, overdue: 8, hsl: 6 },
  // Behaviour + human-factor led: removed-for-work protection, fatigue, drift.
  construction: { failures: 22, events: 16, behavior: 24, openHigh: 16, overdue: 8, hsl: 14 },
  // Vehicle/pedestrian led: open high-severity struck-by + behaviour.
  maritime: { failures: 24, events: 20, behavior: 20, openHigh: 18, overdue: 8, hsl: 10 },
};

const weightsFor = (vertical: string): Weights => VERTICAL_WEIGHTS[vertical] ?? DEFAULT_WEIGHTS;
const WEIGHT_KEYS: WeightKey[] = ["failures", "events", "behavior", "openHigh", "overdue", "hsl"];

const LABELS: Record<WeightKey, string> = {
  failures: "Open control failures",
  events: "Recent outcomes (events)",
  behavior: "Behavior pattern present",
  openHigh: "Open high-severity cells",
  overdue: "Overdue actions",
  hsl: "Human Signal Layer pressure",
};

export function bandFor(score: number): ForecastBand {
  if (score >= 76) return "red";
  if (score >= 56) return "orange";
  if (score >= 31) return "amber";
  return "green";
}

const recommendationFor = (topDriver: string | undefined, exposure: string | null): string => {
  const exp = exposure ? exposure.replace(/_/g, " ") : "the dominant hazard";
  switch (topDriver) {
    case "failures":
      return `Verify or repair the failing controls before the next shift — ${exp} exposure is currently unguarded here.`;
    case "events":
      return `Investigate the recurring outcome and harden the control; this location is repeating its ${exp} failure mode.`;
    case "behavior":
      return `Coach the crew on the recurring pattern and gate high-tempo windows before work resumes.`;
    case "openHigh":
      return `Close out the open high-severity cells here before they produce an outcome.`;
    case "overdue":
      return `Clear the overdue actions — prevention is lagging the risk at this location.`;
    case "hsl":
      return `Reduce cognitive load and re-engage the crew; the human signals here are trending toward failure.`;
    default:
      return `Monitor — no single dominant driver at this location.`;
  }
};

export function buildForecast(input: ForecastInput): LocationForecast[] {
  const { locations, cells, proofs, events, behaviors, actions, hsl, sites, now } = input;

  const cellsByLoc = new Map<string, SafetyCell[]>();
  for (const c of cells) {
    const arr = cellsByLoc.get(c.location_id);
    if (arr) arr.push(c);
    else cellsByLoc.set(c.location_id, [c]);
  }
  const cellLoc = new Map(cells.map((c) => [c.id, c.location_id]));

  // failing proofs per location
  const failByLoc = new Map<string, number>();
  for (const p of proofs) {
    const loc = cellLoc.get(p.cell_id);
    if (loc && proofToRiskType(p.status) === "failure") failByLoc.set(loc, (failByLoc.get(loc) ?? 0) + 1);
  }
  // events per location (via precursor cell)
  const evByLoc = new Map<string, number>();
  for (const e of events) {
    const loc = e.cell_id ? cellLoc.get(e.cell_id) : undefined;
    if (loc) evByLoc.set(loc, (evByLoc.get(loc) ?? 0) + 1);
  }
  // behavior pattern hits per location (a behavior touches a location if any member cell is there)
  const behByLoc = new Map<string, number>();
  for (const b of behaviors) {
    const locs = new Set(b.cell_ids.map((id) => cellLoc.get(id)).filter(Boolean) as string[]);
    for (const loc of locs) behByLoc.set(loc, (behByLoc.get(loc) ?? 0) + 1);
  }
  // overdue open actions per location
  const overdueByLoc = new Map<string, number>();
  for (const a of actions) {
    if (a.status === "closed" || !a.due_date) continue;
    if (new Date(a.due_date).getTime() >= now) continue;
    const loc = cellLoc.get(a.cell_id);
    if (loc) overdueByLoc.set(loc, (overdueByLoc.get(loc) ?? 0) + 1);
  }
  // site-level HSL pressure (worse-when-high dimensions), normalized 0..1
  const hslBySite = new Map<string, number>();
  const hslAcc = new Map<string, { sum: number; n: number }>();
  const WORSE_HIGH = new Set(["psych_safety_gap", "cultural_drift_index", "cognitive_load_monitor", "crew_trauma_score"]);
  for (const r of hsl) {
    if (!WORSE_HIGH.has(r.dimension)) continue;
    const a = hslAcc.get(r.site_id) ?? { sum: 0, n: 0 };
    a.sum += r.value;
    a.n += 1;
    hslAcc.set(r.site_id, a);
  }
  for (const [site, a] of hslAcc) hslBySite.set(site, a.n ? a.sum / a.n / 100 : 0);

  const vertBySite = new Map(sites.map((s) => [s.id, s.vertical]));

  const out: LocationForecast[] = [];
  for (const [locId, locCells] of cellsByLoc) {
    const loc = locations.find((l) => l.id === locId);
    const siteId = locCells[0].site_id;
    const vertical = vertBySite.get(siteId) ?? "default";
    const weights = weightsFor(vertical);

    const openHigh = locCells.filter((c) => c.status !== "closed" && (c.severity === "high" || c.severity === "critical")).length;

    const signals: Record<WeightKey, number> = {
      failures: Math.min(1, (failByLoc.get(locId) ?? 0) / 3),
      events: Math.min(1, (evByLoc.get(locId) ?? 0) / 2),
      behavior: Math.min(1, (behByLoc.get(locId) ?? 0) / 2),
      openHigh: Math.min(1, openHigh / 2),
      overdue: Math.min(1, (overdueByLoc.get(locId) ?? 0) / 2),
      hsl: Math.min(1, hslBySite.get(siteId) ?? 0),
    };

    const drivers: ForecastDriver[] = WEIGHT_KEYS
      .map((k) => ({ key: k, label: LABELS[k], contribution: Math.round(signals[k] * weights[k]) }))
      .filter((d) => d.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution);

    const score = Math.min(100, drivers.reduce((s, d) => s + d.contribution, 0));

    // predicted failure mode: dominant exposure among open cells (fallback: all)
    const pool = locCells.filter((c) => c.status !== "closed");
    const exposureCounts = new Map<string, number>();
    for (const c of (pool.length ? pool : locCells)) {
      const e = c.hazard_genome.exposureType;
      exposureCounts.set(e, (exposureCounts.get(e) ?? 0) + 1);
    }
    const predictedExposure = [...exposureCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;

    // Pre-empt target: highest-risk open cell here (fallback: highest-risk any).
    const ranked = [...(pool.length ? pool : locCells)].sort((a, b) => b.risk_score - a.risk_score || a.id.localeCompare(b.id));
    const topCellId = ranked[0]?.id ?? null;

    out.push({
      locationId: locId,
      label: loc?.label ?? locId,
      siteId,
      score,
      band: bandFor(score),
      predictedExposure,
      vertical,
      topCellId,
      cells: ranked.slice(0, 5).map((c) => ({ id: c.id, title: c.title, severity: c.severity })),
      drivers,
      recommendation: recommendationFor(drivers[0]?.key, predictedExposure),
    });
  }

  // Highest forecast first; tie-break by id for determinism.
  return out.sort((a, b) => b.score - a.score || a.locationId.localeCompare(b.locationId));
}
