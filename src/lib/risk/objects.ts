/**
 * Reliance Risk Intelligence Framework — unified risk graph (pure, testable).
 *
 * The build manual (§6) describes Reliance as a living system of six connected
 * risk objects. This module projects the platform's data into one typed node
 * list + link list so the map, the 3D web, and analytics can all reason about
 * the same six-object model:
 *
 *   Precursor ← every Safety Cell (the early-warning hub)
 *   Control   ← a ControlProof whose safeguard is defined/active
 *   Failure   ← a ControlProof whose safeguard is missing/expired/bypassed/unverified
 *   Behavior  ← a BehaviorCell (a repeated human/organizational pattern)
 *   Event     ← an EventCell (an outcome: incident, claim, audit finding, …)
 *   Learning  ← an AiFinding (per-cell learning) or a VelaInsight (cross-vertical)
 *
 * Links anchor each object back to the precursor Safety Cell(s) it relates to,
 * so the graph reads as "signal → control/failure → behavior → event → learning".
 */
import type { SafetyCell, ControlProof, EventCell, BehaviorCell, AiFinding, VelaInsight } from "@/lib/types";
import { type RiskObjectType, type ProofStatus, type Severity, RISK_OBJECT_META } from "@/lib/constants";

export interface RiskObject {
  id: string; // unique across types, prefixed by type
  type: RiskObjectType;
  refId: string; // id of the source row (cell, proof, event, …)
  title: string;
  subtitle: string; // short descriptor (status / kind / pattern)
  severity?: Severity; // when the source carries one (precursor, event)
  cellId: string | null; // anchor precursor, for layout + linking
}

export interface RiskObjectLink {
  source: string; // RiskObject.id
  target: string; // RiskObject.id (a precursor)
  kind: "control_of" | "failure_of" | "behavior_of" | "event_of" | "learning_of";
}

export interface RiskGraph {
  objects: RiskObject[];
  links: RiskObjectLink[];
  counts: Record<RiskObjectType, number>;
}

export interface RiskGraphInput {
  cells: SafetyCell[];
  proofs: ControlProof[];
  events: EventCell[];
  behaviors: BehaviorCell[];
  findings: AiFinding[];
  vela: VelaInsight[];
}

/**
 * A ControlProof is a Control Cell when its safeguard is at least defined, and a
 * Failure Cell when it is absent or defeated. `not_checked` maps to Failure
 * because the manual lists "unverified controls" as a failure. Centralized so
 * the classification is easy to tune.
 */
export function proofToRiskType(status: ProofStatus): "control" | "failure" {
  switch (status) {
    case "proven":
    case "weak_proof":
    case "not_applicable":
      return "control";
    case "missing":
    case "expired":
    case "conflicting":
    case "not_checked":
      return "failure";
    default:
      return "failure";
  }
}

const precursorId = (cellId: string) => `ro_precursor_${cellId}`;

/** Project the data set into the six-object risk graph. Pure + deterministic. */
export function buildRiskGraph(input: RiskGraphInput): RiskGraph {
  const objects: RiskObject[] = [];
  const links: RiskObjectLink[] = [];
  const cellIds = new Set(input.cells.map((c) => c.id));

  // Precursor — the hub.
  for (const c of input.cells) {
    objects.push({
      id: precursorId(c.id),
      type: "precursor",
      refId: c.id,
      title: c.title,
      subtitle: `${c.severity} · ${c.status.replace(/_/g, " ")}`,
      severity: c.severity,
      cellId: c.id,
    });
  }

  // Control / Failure — each proof projects to exactly one, anchored to its cell.
  for (const p of input.proofs) {
    const type = proofToRiskType(p.status);
    const id = `ro_${type}_${p.id}`;
    objects.push({
      id,
      type,
      refId: p.id,
      title: p.control,
      subtitle: p.status.replace(/_/g, " "),
      cellId: p.cell_id,
    });
    if (cellIds.has(p.cell_id)) {
      links.push({ source: id, target: precursorId(p.cell_id), kind: type === "control" ? "control_of" : "failure_of" });
    }
  }

  // Behavior — a recurring pattern across one or more precursors.
  for (const b of input.behaviors) {
    const id = `ro_behavior_${b.id}`;
    objects.push({
      id,
      type: "behavior",
      refId: b.id,
      title: b.title,
      subtitle: `${b.pattern.replace(/_/g, " ")} · ×${b.occurrences}`,
      cellId: b.cell_ids[0] ?? null,
    });
    for (const cid of b.cell_ids) {
      if (cellIds.has(cid)) links.push({ source: id, target: precursorId(cid), kind: "behavior_of" });
    }
  }

  // Event — an outcome, traced back to its precursor where known.
  for (const e of input.events) {
    const id = `ro_event_${e.id}`;
    objects.push({
      id,
      type: "event",
      refId: e.id,
      title: e.title,
      subtitle: `${e.kind.replace(/_/g, " ")} · ${e.severity}`,
      severity: e.severity,
      cellId: e.cell_id,
    });
    if (e.cell_id && cellIds.has(e.cell_id)) {
      links.push({ source: id, target: precursorId(e.cell_id), kind: "event_of" });
    }
  }

  // Learning — per-cell AI findings + cross-vertical VELA insights.
  for (const f of input.findings) {
    const id = `ro_learning_${f.id}`;
    objects.push({
      id,
      type: "learning",
      refId: f.id,
      title: f.input_summary || `AI analysis (${f.model})`,
      subtitle: `${f.job.replace(/_/g, " ")} · ${f.review_status}`,
      cellId: f.cell_id,
    });
    if (f.cell_id !== null && cellIds.has(f.cell_id)) links.push({ source: id, target: precursorId(f.cell_id), kind: "learning_of" });
  }
  for (const v of input.vela) {
    objects.push({
      id: `ro_learning_${v.id}`,
      type: "learning",
      refId: v.id,
      title: v.pattern,
      subtitle: `cross-vertical · ${Math.round(v.confidence * 100)}%`,
      cellId: null, // VELA is cross-tenant — no single precursor anchor
    });
  }

  const counts = Object.fromEntries(
    (Object.keys(RISK_OBJECT_META) as RiskObjectType[]).map((t) => [t, objects.filter((o) => o.type === t).length]),
  ) as Record<RiskObjectType, number>;

  return { objects, links, counts };
}
