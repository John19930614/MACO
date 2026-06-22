/**
 * Referential & tenant integrity check over a dataset. Pure and deterministic
 * so it can run server-side for the Data Space page AND in tests. This is the
 * "is the database correct?" check: orphaned children, dangling references, and
 * cross-tenant leakage are all surfaced as human-readable issues.
 */
import type {
  Tenant, Site, SafetyLocation, SafetyCell, ControlProof, EvidenceFile, CausalEdge, AiFinding, SafetyAction, EventCell, BehaviorCell,
} from "@/lib/types";

export interface IntegrityInput {
  tenants: Tenant[];
  sites: Site[];
  locations: SafetyLocation[];
  cells: SafetyCell[];
  proofs: ControlProof[];
  evidence: EvidenceFile[];
  edges: CausalEdge[];
  findings: AiFinding[];
  actions: SafetyAction[];
  events?: EventCell[];
  behaviors?: BehaviorCell[];
}

export interface IntegrityReport {
  counts: Record<string, number>;
  issues: string[];
  ok: boolean;
  checked: number;
}

export function checkReferentialIntegrity(d: IntegrityInput): IntegrityReport {
  const issues: string[] = [];
  const tenantIds = new Set(d.tenants.map((t) => t.id));
  const siteIds = new Set(d.sites.map((s) => s.id));
  const locIds = new Set(d.locations.map((l) => l.id));
  const cellById = new Map(d.cells.map((c) => [c.id, c]));

  for (const s of d.sites) if (!tenantIds.has(s.tenant_id)) issues.push(`site ${s.id} → unknown tenant ${s.tenant_id}`);
  for (const l of d.locations) if (!siteIds.has(l.site_id)) issues.push(`location ${l.id} → unknown site ${l.site_id}`);

  for (const c of d.cells) {
    if (!siteIds.has(c.site_id)) issues.push(`cell ${c.id} → unknown site ${c.site_id}`);
    if (!locIds.has(c.location_id)) issues.push(`cell ${c.id} → unknown location ${c.location_id}`);
    if (!tenantIds.has(c.tenant_id)) issues.push(`cell ${c.id} → unknown tenant ${c.tenant_id}`);
    const loc = d.locations.find((l) => l.id === c.location_id);
    if (loc && loc.site_id !== c.site_id) issues.push(`cell ${c.id} location is in a different site`);
  }

  // child → parent cell existence + tenant match
  const childChecks: [string, { cell_id: string | null; tenant_id: string; id: string }[]][] = [
    ["control_proofs", d.proofs],
    ["evidence_files", d.evidence],
    ["ai_findings", d.findings],
    ["actions", d.actions],
  ];
  for (const [table, rows] of childChecks) {
    for (const r of rows) {
      if (r.cell_id === null) continue; // module-level findings have no cell anchor
      const parent = cellById.get(r.cell_id);
      if (!parent) issues.push(`${table} ${r.id} → orphaned (no cell ${r.cell_id})`);
      else if (r.tenant_id !== parent.tenant_id) issues.push(`${table} ${r.id} → tenant mismatch with its cell`);
    }
  }

  for (const e of d.edges) {
    if (!cellById.has(e.source_cell_id)) issues.push(`causal_edge ${e.id} → unknown source ${e.source_cell_id}`);
    if (!cellById.has(e.target_cell_id)) issues.push(`causal_edge ${e.id} → unknown target ${e.target_cell_id}`);
    const src = cellById.get(e.source_cell_id);
    if (src && e.tenant_id !== src.tenant_id) issues.push(`causal_edge ${e.id} → tenant mismatch with its source cell`);
  }

  // Risk Intelligence Framework objects (manual §6) — checked when present.
  const events = d.events ?? [];
  const behaviors = d.behaviors ?? [];
  for (const e of events) {
    if (!siteIds.has(e.site_id)) issues.push(`event_cell ${e.id} → unknown site ${e.site_id}`);
    if (!tenantIds.has(e.tenant_id)) issues.push(`event_cell ${e.id} → unknown tenant ${e.tenant_id}`);
    if (e.cell_id) {
      const parent = cellById.get(e.cell_id);
      if (!parent) issues.push(`event_cell ${e.id} → unknown precursor cell ${e.cell_id}`);
      else if (e.tenant_id !== parent.tenant_id) issues.push(`event_cell ${e.id} → tenant mismatch with its precursor cell`);
    }
  }
  for (const b of behaviors) {
    if (!siteIds.has(b.site_id)) issues.push(`behavior_cell ${b.id} → unknown site ${b.site_id}`);
    if (!tenantIds.has(b.tenant_id)) issues.push(`behavior_cell ${b.id} → unknown tenant ${b.tenant_id}`);
    for (const cid of b.cell_ids) {
      const parent = cellById.get(cid);
      if (!parent) issues.push(`behavior_cell ${b.id} → unknown precursor cell ${cid}`);
      else if (b.tenant_id !== parent.tenant_id) issues.push(`behavior_cell ${b.id} → tenant mismatch with precursor cell ${cid}`);
    }
  }

  const counts: Record<string, number> = {
    tenants: d.tenants.length,
    sites: d.sites.length,
    locations: d.locations.length,
    safety_cells: d.cells.length,
    control_proofs: d.proofs.length,
    evidence_files: d.evidence.length,
    causal_edges: d.edges.length,
    ai_findings: d.findings.length,
    actions: d.actions.length,
    event_cells: events.length,
    behavior_cells: behaviors.length,
  };
  const checked = d.sites.length + d.locations.length + d.cells.length + d.proofs.length + d.evidence.length + d.edges.length + d.findings.length + d.actions.length + events.length + behaviors.length;

  return { counts, issues, ok: issues.length === 0, checked };
}
