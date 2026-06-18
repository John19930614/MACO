import { describe, it, expect } from "vitest";
import { checkReferentialIntegrity, type IntegrityInput } from "@/lib/data/integrity";
import * as fx from "@/lib/data/mock";

const dataset = (): IntegrityInput => ({
  tenants: fx.TENANTS,
  sites: fx.SITES,
  locations: fx.LOCATIONS,
  cells: fx.CELLS,
  proofs: fx.PROOFS,
  evidence: fx.EVIDENCE,
  edges: fx.EDGES,
  findings: fx.FINDINGS,
  actions: fx.ACTIONS,
  events: fx.EVENT_CELLS,
  behaviors: fx.BEHAVIOR_CELLS,
});

describe("checkReferentialIntegrity", () => {
  it("reports the fixture dataset as consistent", () => {
    const r = checkReferentialIntegrity(dataset());
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
    expect(r.counts.safety_cells).toBe(fx.CELLS.length);
    expect(r.checked).toBeGreaterThan(0);
  });

  it("flags an orphaned child record", () => {
    const d = dataset();
    d.proofs = [...d.proofs, { ...d.proofs[0], id: "pf_orphan", cell_id: "cell_missing" }];
    const r = checkReferentialIntegrity(d);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.includes("orphaned") && i.includes("pf_orphan"))).toBe(true);
  });

  it("flags a cross-tenant child (tenant mismatch with its cell)", () => {
    const d = dataset();
    const wrong = { ...d.proofs[0], id: "pf_wrong", tenant_id: "tenant_summit" }; // its cell is pacific
    d.proofs = [...d.proofs, wrong];
    const r = checkReferentialIntegrity(d);
    expect(r.issues.some((i) => i.includes("tenant mismatch") && i.includes("pf_wrong"))).toBe(true);
  });

  it("flags an edge pointing at a non-existent cell", () => {
    const d = dataset();
    d.edges = [...d.edges, { ...d.edges[0], id: "edge_bad", target_cell_id: "nope" }];
    const r = checkReferentialIntegrity(d);
    expect(r.issues.some((i) => i.includes("edge_bad") && i.includes("unknown target"))).toBe(true);
  });

  it("flags an event whose precursor cell does not exist", () => {
    const d = dataset();
    d.events = [...(d.events ?? []), { ...fx.EVENT_CELLS[0], id: "evt_bad", cell_id: "cell_missing" }];
    const r = checkReferentialIntegrity(d);
    expect(r.issues.some((i) => i.includes("evt_bad") && i.includes("unknown precursor"))).toBe(true);
  });

  it("flags a behavior referencing a non-existent precursor cell", () => {
    const d = dataset();
    d.behaviors = [...(d.behaviors ?? []), { ...fx.BEHAVIOR_CELLS[0], id: "beh_bad", cell_ids: ["cell_missing"] }];
    const r = checkReferentialIntegrity(d);
    expect(r.issues.some((i) => i.includes("beh_bad") && i.includes("unknown precursor"))).toBe(true);
  });

  it("counts the new framework objects", () => {
    const r = checkReferentialIntegrity(dataset());
    expect(r.counts.event_cells).toBe(fx.EVENT_CELLS.length);
    expect(r.counts.behavior_cells).toBe(fx.BEHAVIOR_CELLS.length);
  });
});
