/**
 * Prevention Web builder (pure, deterministic, testable). Synthesizes the
 * system-level prevention picture:
 *
 *   control-gap cluster (shared cause)  →  Safety Cells (affecting each other
 *   via causal edges)  →  prevention (corrective/preventive actions + AI
 *   counterfactual recommendations) that closes the gap.
 *
 * This is the connective tissue the ARC method calls counterfactual prevention:
 * group risk by the control failure mode, see how cells reinforce each other,
 * and trace each to the action that would have changed the outcome.
 */
import type { SafetyCell, SafetyAction, AiFinding, CausalityOutput } from "@/lib/types";

export interface GapCluster {
  gap: string;
  cell_ids: string[];
}

export interface PreventionItem {
  id: string;
  cell_id: string;
  kind: "action" | "recommendation";
  label: string;
  status: string;
  counterfactual?: string;
}

export interface PreventionWebModel {
  clusters: GapCluster[];
  preventions: PreventionItem[];
}

export function buildPreventionWeb(cells: SafetyCell[], actions: SafetyAction[], findings: AiFinding[]): PreventionWebModel {
  // Cluster cells by their control-failure mode — the lever for prevention.
  const byGap = new Map<string, string[]>();
  for (const c of cells) {
    const gap = c.hazard_genome.controlGap || "unknown";
    const arr = byGap.get(gap);
    if (arr) arr.push(c.id);
    else byGap.set(gap, [c.id]);
  }
  const clusters: GapCluster[] = [...byGap.entries()]
    .map(([gap, cell_ids]) => ({ gap, cell_ids }))
    .sort((a, b) => b.cell_ids.length - a.cell_ids.length);

  const cellIds = new Set(cells.map((c) => c.id));
  const preventions: PreventionItem[] = [];

  // Explicit corrective/preventive actions.
  for (const a of actions) {
    if (!cellIds.has(a.cell_id)) continue;
    preventions.push({ id: `a_${a.id}`, cell_id: a.cell_id, kind: "action", label: a.title, status: a.status });
  }

  // AI counterfactual recommendations from findings.
  for (const f of findings) {
    if (f.cell_id === null || !cellIds.has(f.cell_id)) continue;
    const cellId = f.cell_id;
    const out = f.output as Partial<CausalityOutput>;
    (out.prevention ?? []).forEach((p, i) =>
      preventions.push({ id: `r_${f.id}_${i}`, cell_id: cellId, kind: "recommendation", label: p.action, status: f.review_status, counterfactual: p.counterfactual }),
    );
  }

  return { clusters, preventions };
}
