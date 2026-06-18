/**
 * Unified cell linkage (pure, deterministic, testable). Treats the entire
 * population of Safety Cells as ONE mass and links every pair that relates —
 * by explicit causal edges and by shared attributes (location, control gap,
 * exposure, energy, task). A deterministic force layout then positions them so
 * tightly-related cells pull together into organic clusters. No site/location
 * grouping is imposed; structure emerges from the data itself.
 */
import type { SafetyCell, CausalEdge } from "@/lib/types";

export interface CellLink {
  source: string;
  target: string;
  weight: number;
  kinds: string[];
  causalType?: string;
  pending: boolean; // true when the only causal evidence is an unreviewed AI edge
}

const WEIGHTS = {
  causal: 4,
  same_location: 3,
  same_control_gap: 2,
  same_exposure: 2,
  same_energy: 1,
  same_task: 1,
};

/** Build weighted links between all cell pairs; keep those at/above threshold. */
export function buildCellLinks(cells: SafetyCell[], edges: CausalEdge[], threshold = 2): CellLink[] {
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const map = new Map<string, CellLink>();

  const ensure = (a: string, b: string): CellLink => {
    const k = key(a, b);
    let l = map.get(k);
    if (!l) {
      const [source, target] = a < b ? [a, b] : [b, a];
      l = { source, target, weight: 0, kinds: [], pending: false };
      map.set(k, l);
    }
    return l;
  };

  // Explicit causal edges.
  for (const e of edges) {
    if (e.review_status === "rejected") continue;
    if (e.source_cell_id === e.target_cell_id) continue;
    const l = ensure(e.source_cell_id, e.target_cell_id);
    if (!l.kinds.includes("causal")) {
      l.kinds.push("causal");
      l.weight += WEIGHTS.causal;
      l.causalType = e.type;
      l.pending = e.ai_generated && e.review_status === "pending";
    } else if (!(e.ai_generated && e.review_status === "pending")) {
      l.pending = false; // a confirmed edge overrides the pending flag
    }
  }

  // Shared-attribute links.
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i];
      const b = cells[j];
      const add = (kind: keyof typeof WEIGHTS, ok: boolean) => {
        if (!ok) return;
        const l = ensure(a.id, b.id);
        if (!l.kinds.includes(kind)) {
          l.kinds.push(kind);
          l.weight += WEIGHTS[kind];
        }
      };
      add("same_location", a.location_id === b.location_id);
      add("same_control_gap", a.hazard_genome.controlGap === b.hazard_genome.controlGap);
      add("same_exposure", a.hazard_genome.exposureType === b.hazard_genome.exposureType);
      add("same_energy", a.hazard_genome.energySource === b.hazard_genome.energySource);
      add("same_task", Boolean(a.task) && a.task === b.task);
    }
  }

  return [...map.values()].filter((l) => l.weight >= threshold);
}

/** Connected components over the (thresholded) link graph — the emergent
 * clusters in the mass. Pure union-find; returns one array of ids per cluster. */
export function connectedComponents(ids: string[], links: { source: string; target: string }[]): string[][] {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.get(c) !== r) {
      const n = parent.get(c)!;
      parent.set(c, r);
      c = n;
    }
    return r;
  };
  for (const l of links) {
    if (!parent.has(l.source) || !parent.has(l.target)) continue;
    const ra = find(l.source);
    const rb = find(l.target);
    if (ra !== rb) parent.set(ra, rb);
  }
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const r = find(id);
    const arr = groups.get(r);
    if (arr) arr.push(id);
    else groups.set(r, [id]);
  }
  return [...groups.values()].sort((a, b) => b.length - a.length);
}

/**
 * Articulation points (cut vertices) of the link graph — the "linchpin" cells.
 * Removing one fragments its cluster, so these connect otherwise-separate groups
 * of risk and are the highest-leverage targets for prevention. Tarjan's DFS,
 * pure and deterministic.
 */
export function articulationPoints(ids: string[], links: { source: string; target: string }[]): string[] {
  const adj = new Map<string, string[]>();
  ids.forEach((id) => adj.set(id, []));
  for (const l of links) {
    if (adj.has(l.source) && adj.has(l.target)) {
      adj.get(l.source)!.push(l.target);
      adj.get(l.target)!.push(l.source);
    }
  }
  const disc = new Map<string, number>();
  const low = new Map<string, number>();
  const visited = new Set<string>();
  const ap = new Set<string>();
  let timer = 0;

  const dfs = (u: string, parent: string | null) => {
    visited.add(u);
    disc.set(u, timer);
    low.set(u, timer);
    timer++;
    let children = 0;
    for (const v of adj.get(u)!) {
      if (v === parent) continue;
      if (!visited.has(v)) {
        children++;
        dfs(v, u);
        low.set(u, Math.min(low.get(u)!, low.get(v)!));
        if (parent !== null && low.get(v)! >= disc.get(u)!) ap.add(u);
      } else {
        low.set(u, Math.min(low.get(u)!, disc.get(v)!));
      }
    }
    if (parent === null && children > 1) ap.add(u);
  };

  for (const id of ids) if (!visited.has(id)) dfs(id, null);
  return [...ap];
}

/**
 * Bridges (cut edges) of the link graph. Removing a bridge splits a cluster in
 * two — the single connection holding two groups of risk together. Tarjan's
 * bridge-finding DFS; returns normalized [a,b] pairs (a < b). Pure.
 */
export function bridges(ids: string[], links: { source: string; target: string }[]): [string, string][] {
  const adj = new Map<string, { to: string; eid: number }[]>();
  ids.forEach((id) => adj.set(id, []));
  links.forEach((l, i) => {
    if (adj.has(l.source) && adj.has(l.target)) {
      adj.get(l.source)!.push({ to: l.target, eid: i });
      adj.get(l.target)!.push({ to: l.source, eid: i });
    }
  });
  const disc = new Map<string, number>();
  const low = new Map<string, number>();
  const visited = new Set<string>();
  const out: [string, string][] = [];
  let timer = 0;

  const dfs = (u: string, parentEid: number) => {
    visited.add(u);
    disc.set(u, timer);
    low.set(u, timer);
    timer++;
    for (const { to: v, eid } of adj.get(u)!) {
      if (eid === parentEid) continue;
      if (!visited.has(v)) {
        dfs(v, eid);
        low.set(u, Math.min(low.get(u)!, low.get(v)!));
        if (low.get(v)! > disc.get(u)!) out.push(u < v ? [u, v] : [v, u]);
      } else {
        low.set(u, Math.min(low.get(u)!, disc.get(v)!));
      }
    }
  };

  for (const id of ids) if (!visited.has(id)) dfs(id, -1);
  return out;
}

export interface XY {
  x: number;
  y: number;
}

/**
 * Deterministic force-directed layout (Fruchterman–Reingold style). No RNG:
 * nodes start on a circle by index so the result is stable across runs.
 */
export function layoutForce(ids: string[], links: { source: string; target: string; weight: number }[], iterations = 300): Record<string, XY> {
  const N = ids.length;
  const pos: Record<string, XY> = {};
  if (N === 0) return pos;
  const R0 = 80 + N * 14;
  ids.forEach((id, i) => {
    const a = (i / N) * 2 * Math.PI;
    pos[id] = { x: Math.cos(a) * R0, y: Math.sin(a) * R0 };
  });
  if (N === 1) return { [ids[0]]: { x: 0, y: 0 } };

  const k = 90; // ideal edge length
  const idIndex = new Set(ids);
  const safeLinks = links.filter((l) => idIndex.has(l.source) && idIndex.has(l.target));

  for (let iter = 0; iter < iterations; iter++) {
    const temp = (1 - iter / iterations) * (k * 1.5);
    const disp: Record<string, XY> = {};
    for (const id of ids) disp[id] = { x: 0, y: 0 };

    // Repulsion between all pairs.
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const u = pos[ids[i]];
        const v = pos[ids[j]];
        let dx = u.x - v.x;
        let dy = u.y - v.y;
        let d = Math.hypot(dx, dy);
        if (d < 0.01) { dx = (i - j) * 0.1 + 0.1; dy = 0.1; d = Math.hypot(dx, dy); }
        const rep = (k * k) / d;
        const ux = (dx / d) * rep;
        const uy = (dy / d) * rep;
        disp[ids[i]].x += ux; disp[ids[i]].y += uy;
        disp[ids[j]].x -= ux; disp[ids[j]].y -= uy;
      }
    }
    // Attraction along links (stronger with weight).
    for (const l of safeLinks) {
      const u = pos[l.source];
      const v = pos[l.target];
      const dx = u.x - v.x;
      const dy = u.y - v.y;
      const d = Math.max(0.01, Math.hypot(dx, dy));
      const att = ((d * d) / k) * (0.5 + l.weight * 0.12);
      const ux = (dx / d) * att;
      const uy = (dy / d) * att;
      disp[l.source].x -= ux; disp[l.source].y -= uy;
      disp[l.target].x += ux; disp[l.target].y += uy;
    }
    // Integrate, cap by temperature, plus gentle centering.
    for (const id of ids) {
      const dd = disp[id];
      const len = Math.max(0.01, Math.hypot(dd.x, dd.y));
      const move = Math.min(len, temp);
      pos[id].x += (dd.x / len) * move - pos[id].x * 0.01;
      pos[id].y += (dd.y / len) * move - pos[id].y * 0.01;
    }
  }
  return pos;
}
