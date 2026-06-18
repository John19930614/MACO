/**
 * ARC intelligence — pure, deterministic scoring used by the live ARC engine.
 * Kept side-effect-free so it is trivially unit-testable; the async repo layer
 * wraps these with data access (src/lib/data/repo.ts).
 *
 *   • scoreSimilarCells — the EXP "knowledge ghost": find prior cells whose
 *     hazard genome / location resemble a target (genome-based stand-in for the
 *     pgvector similarity in manual Phase 2).
 *   • computeHsl        — derive the six Human Signal Layer dimensions from live
 *     cell / proof / action data instead of static readings.
 *   • findSignals       — the P-CLSS hunt: which open cells are weak signals.
 */
import type { SafetyCell, ControlProof, SafetyAction, ExpCapture, Profile, Site, AiFinding, CausalEdge, VelaInsight } from "@/lib/types";
import { HSL_DIMENSIONS } from "./arc";
import { clamp } from "@/lib/utils";

// ── EXP: find similar cells ──────────────────────────────────────────────────
export interface SimilarHit {
  cell: SafetyCell;
  score: number; // 0-1
  reasons: string[];
}

export function scoreSimilarCells(target: SafetyCell, others: SafetyCell[], limit = 5): SimilarHit[] {
  const g = target.hazard_genome;
  const hits: SimilarHit[] = [];
  for (const c of others) {
    if (c.id === target.id) continue;
    const cg = c.hazard_genome;
    let score = 0;
    const reasons: string[] = [];
    if (c.location_id === target.location_id) { score += 0.4; reasons.push("same location"); }
    if (cg.exposureType === g.exposureType) { score += 0.2; reasons.push(`same exposure (${g.exposureType.replace(/_/g, " ")})`); }
    if (cg.energySource === g.energySource) { score += 0.15; reasons.push(`same energy (${g.energySource})`); }
    if (cg.controlGap === g.controlGap) { score += 0.15; reasons.push(`same control gap (${g.controlGap})`); }
    if (cg.trigger === g.trigger) { score += 0.1; reasons.push("same trigger"); }
    if (c.task && c.task === target.task) { score += 0.1; reasons.push("same task"); }
    if (score > 0) hits.push({ cell: c, score: Math.min(1, score), reasons });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ── P-CLSS: hunt for weak signals ────────────────────────────────────────────
export interface Signal {
  cell: SafetyCell;
  weight: number;
  reasons: string[];
}

const GAP_PROOF = new Set(["missing", "weak_proof", "expired", "conflicting"]);

export function findSignals(cells: SafetyCell[], proofsByCell: Map<string, ControlProof[]>): Signal[] {
  const signals: Signal[] = [];
  for (const cell of cells) {
    if (cell.status === "closed") continue;
    let weight = 0;
    const reasons: string[] = [];
    if (cell.severity === "critical") { weight += 4; reasons.push("critical severity"); }
    else if (cell.severity === "high") { weight += 2; reasons.push("high severity"); }
    const proofs = proofsByCell.get(cell.id) ?? [];
    const gaps = proofs.filter((p) => GAP_PROOF.has(p.status));
    if (gaps.length) { weight += gaps.length * 2; reasons.push(`${gaps.length} control(s) without solid proof`); }
    if (["bypassed", "unverified", "missing"].includes(cell.hazard_genome.controlGap)) {
      weight += 1;
      reasons.push(`control ${cell.hazard_genome.controlGap}`);
    }
    if (weight > 0) signals.push({ cell, weight, reasons });
  }
  return signals.sort((a, b) => b.weight - a.weight);
}

// ── Map heat: composite current-risk weight ──────────────────────────────────
/**
 * Heat weight (0-1) for the map heatmap. Richer than raw risk_score: it blends
 * severity, likelihood, recency decay, open/closed status, and unresolved
 * control-proof gaps so the heat reflects *current actionable risk*, not a
 * static number. Closed cells fade; recent gappy critical cells burn hottest.
 */
export function heatWeight(
  cell: Pick<SafetyCell, "severity" | "likelihood" | "risk_score" | "status" | "created_at">,
  gapCount: number,
  now: number,
  eventCount = 0,
): number {
  const sev: Record<string, number> = { low: 0.4, medium: 0.6, high: 0.85, critical: 1 };
  const base = sev[cell.severity] ?? 0.5;
  const likelihood = 0.6 + 0.08 * (cell.likelihood - 1); // 0.6 .. 0.92
  const ageDays = Math.max(0, (now - new Date(cell.created_at).getTime()) / DAY);
  const recency = clamp(1 - ageDays / 120, 0.2, 1); // decays over ~4 months, floor 0.2
  const open = cell.status === "closed" ? 0.12 : 1;
  const gaps = 1 + Math.min(gapCount, 4) * 0.12; // each unresolved proof adds heat, capped
  // A precursor that already produced an outcome (Event Cell) burns hotter — the
  // warning sign was real. Capped so it amplifies rather than saturates.
  const events = 1 + Math.min(eventCount, 3) * 0.2;
  const riskBlend = 0.5 + 0.5 * clamp(cell.risk_score / 100, 0, 1);
  return clamp(base * likelihood * recency * open * gaps * events * riskBlend, 0, 1);
}

// ── HSL: compute the six dimensions from live data ───────────────────────────
export interface ComputedHsl {
  dimension: string;
  value: number; // 0-100
  trend: "up" | "down" | "flat";
}

interface HslInputs {
  cells: SafetyCell[];
  proofs: ControlProof[];
  actions: SafetyAction[];
  exp: ExpCapture[];
  profiles: Profile[];
}

const DAY = 24 * 60 * 60 * 1000;

export function computeHsl(input: HslInputs, now: number): ComputedHsl[] {
  const { cells, proofs, actions, exp, profiles } = input;
  const total = Math.max(1, cells.length);
  const roleById = new Map(profiles.map((p) => [p.id, p.role]));

  // knowledge_ghost (worse when LOW): share of captured expertise embedded.
  const knowledgeGhost = exp.length ? (exp.filter((e) => e.embedded).length / exp.length) * 100 : 50;

  // crew_trauma_score: recent serious events within 30 days.
  const recentSerious = cells.filter(
    (c) => (c.severity === "critical" || c.severity === "high") && now - new Date(c.created_at).getTime() < 30 * DAY,
  ).length;
  const crewTrauma = clamp(recentSerious * 22, 0, 100);

  // cognitive_load_monitor: open high-severity cells + overdue actions.
  const openHigh = cells.filter((c) => c.status !== "closed" && (c.severity === "high" || c.severity === "critical")).length;
  const overdue = actions.filter((a) => a.status !== "closed" && a.due_date && new Date(a.due_date).getTime() < now).length;
  const cognitiveLoad = clamp(openHigh * 14 + overdue * 12, 0, 100);

  // cultural_drift_index: proof-gap ratio.
  const totalProofs = Math.max(1, proofs.length);
  const gapProofs = proofs.filter((p) => GAP_PROOF.has(p.status)).length;
  const culturalDrift = Math.round((gapProofs / totalProofs) * 100);

  // invisible_workforce: share of cells from non-primary (contractor) companies.
  const byCompany = new Map<string, number>();
  for (const c of cells) byCompany.set(c.company ?? "—", (byCompany.get(c.company ?? "—") ?? 0) + 1);
  const primary = [...byCompany.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const contractorCells = cells.filter((c) => (c.company ?? "—") !== primary).length;
  const invisibleWorkforce = Math.round((contractorCells / total) * 100);

  // psych_safety_gap (silence): low share of field-contributor reports => high gap.
  const contributorReports = cells.filter((c) => roleById.get(c.created_by) === "contributor").length;
  const psychSafetyGap = clamp(100 - Math.round((contributorReports / total) * 100), 0, 100);

  const values: Record<string, number> = {
    psych_safety_gap: psychSafetyGap,
    cultural_drift_index: culturalDrift,
    cognitive_load_monitor: cognitiveLoad,
    invisible_workforce: invisibleWorkforce,
    knowledge_ghost: Math.round(knowledgeGhost),
    crew_trauma_score: crewTrauma,
  };

  return HSL_DIMENSIONS.map((d) => {
    const value = clamp(values[d.key] ?? 0, 0, 100);
    const risk = d.worseWhen === "high" ? value : 100 - value;
    const trend: ComputedHsl["trend"] = risk > 60 ? "up" : risk < 35 ? "down" : "flat";
    return { dimension: d.key, value, trend };
  });
}

// ── VELA: cross-tenant master intelligence ───────────────────────────────────
/**
 * Derive cross-vertical insights from ALL tenants' data (VELA is intentionally
 * cross-tenant). A control-failure mode that recurs across two or more verticals
 * becomes a pre-emptive pattern; human-confirmed reviews boost its confidence.
 * Pure + deterministic (timestamp passed in) so it is unit-testable.
 */
export function deriveVelaInsights(
  cells: SafetyCell[],
  sites: Site[],
  findings: AiFinding[],
  edges: CausalEdge[],
  now: string,
): VelaInsight[] {
  const vertBySite = new Map(sites.map((s) => [s.id, s.vertical]));
  const confirmedCells = new Set<string>();
  for (const f of findings) if (f.review_status === "accepted") confirmedCells.add(f.cell_id);
  for (const e of edges) if (e.review_status === "accepted") { confirmedCells.add(e.source_cell_id); confirmedCells.add(e.target_cell_id); }

  const byGap = new Map<string, { verticals: Set<string>; count: number; confirmed: boolean }>();
  for (const c of cells) {
    const gap = c.hazard_genome.controlGap;
    if (!gap) continue;
    const vert = vertBySite.get(c.site_id) ?? "unknown";
    const g = byGap.get(gap) ?? { verticals: new Set<string>(), count: 0, confirmed: false };
    g.verticals.add(vert);
    g.count += 1;
    if (confirmedCells.has(c.id)) g.confirmed = true;
    byGap.set(gap, g);
  }

  const out: VelaInsight[] = [];
  for (const [gap, g] of byGap) {
    if (g.verticals.size < 2) continue; // cross-vertical only — that's the point of VELA
    const verticals = [...g.verticals];
    const origin = verticals[0];
    const confidence = Math.round(clamp(0.5 + 0.08 * g.count + (g.confirmed ? 0.2 : 0), 0, 0.95) * 100) / 100;
    out.push({
      id: `vela_live_${gap}`,
      pattern: `'${gap}' control failures recur across verticals`,
      origin_vertical: origin,
      applies_to: verticals.filter((v) => v !== origin),
      confidence,
      summary: `Observed ${g.count} times across ${g.verticals.size} verticals (${verticals.join(", ")}). ${g.confirmed ? "Human-confirmed in review — promoted to a cross-vertical pre-emption." : "Emerging signal — not yet confirmed by review."}`,
      created_at: now,
    });
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}
