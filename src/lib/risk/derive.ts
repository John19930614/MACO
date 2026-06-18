/**
 * Risk Intelligence Framework — derivations that make the loop *live* (pure,
 * deterministic, testable).
 *
 *  • detectBehaviors  — Behavior Cells should EMERGE from repeated patterns,
 *    not be hand-authored. This surfaces them from the cell population.
 *  • proposeLearning  — closes the ARC loop: an Event Cell (outcome) yields a
 *    concrete Learning Cell proposal (tighten a control, re-weight scoring, or
 *    fold the outcome into the next prompt version).
 */
import type { SafetyCell, BehaviorCell, EventCell } from "@/lib/types";
import type { BehaviorPattern } from "@/lib/constants";
import { scoreSimilarCells } from "@/lib/arc/intelligence";

const PRESSURE = /pressure|schedule|tempo|deadline|behind/i;
const REMOVED = /removed for work|reinstat|not reinstated/i;

/** Surface Behavior Cells from recurring patterns in the cell population. */
export function detectBehaviors(cells: SafetyCell[]): BehaviorCell[] {
  const bySite = new Map<string, SafetyCell[]>();
  for (const c of cells) {
    const arr = bySite.get(c.site_id);
    if (arr) arr.push(c);
    else bySite.set(c.site_id, [c]);
  }

  const out: BehaviorCell[] = [];
  for (const [site, group] of bySite) {
    const tenant = group[0].tenant_id;
    const emit = (pattern: BehaviorPattern, title: string, description: string, members: SafetyCell[]) => {
      if (members.length < 2) return; // a pattern needs repetition
      const ids = members.map((c) => c.id).sort();
      const created = members.map((c) => c.created_at).sort().at(-1)!; // newest member, deterministic
      out.push({ id: `beh_auto_${site}_${pattern}`, tenant_id: tenant, site_id: site, pattern, title, description, cell_ids: ids, occurrences: ids.length, created_at: created });
    };

    emit("production_pressure", "Controls slip under schedule pressure", "Cells whose trigger points to tempo or schedule pressure.", group.filter((c) => PRESSURE.test(c.hazard_genome.trigger)));
    emit("weak_closeout", "Protection removed for work, not reinstated", "Cells where protection was taken down for a task and left off.", group.filter((c) => REMOVED.test(c.hazard_genome.trigger)));

    // recurring_issue: the single location with the most cells in the site.
    const byLoc = new Map<string, SafetyCell[]>();
    for (const c of group) {
      const arr = byLoc.get(c.location_id);
      if (arr) arr.push(c);
      else byLoc.set(c.location_id, [c]);
    }
    const top = [...byLoc.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];
    if (top) emit("recurring_issue", "Risk recurs at the same location", "Multiple cells concentrate at one location.", top[1]);
  }
  return out;
}

export interface LearningProposal {
  id: string;
  event_id: string;
  cell_id: string;
  kind: "control" | "scoring" | "prompt";
  title: string;
}

export interface SimilarOutcome {
  event: EventCell;
  similarity: number; // 0–1, how much the outcome's precursor resembles this cell
  reasons: string[];
  sourceCellId: string;
  sourceTitle: string;
}

/**
 * "What happened last time a situation looked like this." Ranks past Event
 * Cells by how much their precursor cell's hazard genome/location resembles the
 * given cell (reusing scoreSimilarCells — the EXP knowledge-ghost scorer).
 * Pure + deterministic. Live mode can swap in vector similarity over events.
 */
export function similarOutcomes(cell: SafetyCell, events: EventCell[], cells: SafetyCell[], limit = 5): SimilarOutcome[] {
  const sim = new Map(scoreSimilarCells(cell, cells, cells.length).map((h) => [h.cell.id, h]));
  const titleById = new Map(cells.map((c) => [c.id, c.title]));
  const out: SimilarOutcome[] = [];
  for (const e of events) {
    if (!e.cell_id || e.cell_id === cell.id) continue;
    const h = sim.get(e.cell_id);
    if (!h) continue;
    out.push({ event: e, similarity: h.score, reasons: h.reasons, sourceCellId: e.cell_id, sourceTitle: titleById.get(e.cell_id) ?? e.cell_id });
  }
  return out.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

const GAP_NEEDS_CONTROL = new Set(["missing", "expired", "unverified"]);

/**
 * Turn outcomes into learning. Each Event Cell with a known precursor yields one
 * proposal: harden the control if the gap was a missing/expired/unverified
 * safeguard, re-weight scoring for a serious outcome, else fold it into the next
 * prompt version. Pure + deterministic.
 */
export function proposeLearning(events: EventCell[], cells: SafetyCell[]): LearningProposal[] {
  const cellById = new Map(cells.map((c) => [c.id, c]));
  const out: LearningProposal[] = [];
  for (const e of events) {
    if (!e.cell_id) continue;
    const cell = cellById.get(e.cell_id);
    if (!cell) continue;
    const g = cell.hazard_genome;
    const exposure = g.exposureType.replace(/_/g, " ");
    const outcome = e.kind.replace(/_/g, " ");
    let kind: LearningProposal["kind"];
    let title: string;
    if (GAP_NEEDS_CONTROL.has(g.controlGap)) {
      kind = "control";
      title = `Make the ${exposure} control required and verified before work`;
    } else if (e.severity === "critical" || e.severity === "high") {
      kind = "scoring";
      title = `Raise risk weighting for ${g.energySource} · ${exposure} after this ${outcome}`;
    } else {
      kind = "prompt";
      title = `Fold this ${outcome} into the next analysis prompt version`;
    }
    out.push({ id: `learn_${e.id}`, event_id: e.id, cell_id: e.cell_id, kind, title });
  }
  return out;
}
