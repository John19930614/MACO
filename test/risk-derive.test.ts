import { describe, it, expect } from "vitest";
import { detectBehaviors, proposeLearning, similarOutcomes } from "@/lib/risk/derive";
import { heatWeight } from "@/lib/arc/intelligence";
import * as fx from "@/lib/data/mock";

describe("detectBehaviors", () => {
  const behaviors = detectBehaviors(fx.CELLS);

  it("emerges behaviors from recurring patterns", () => {
    expect(behaviors.length).toBeGreaterThan(0);
  });

  it("is deterministic and references only real cells with a consistent tenant", () => {
    const a = detectBehaviors(fx.CELLS);
    const b = detectBehaviors(fx.CELLS);
    expect(a).toEqual(b);
    const cellById = new Map(fx.CELLS.map((c) => [c.id, c]));
    for (const beh of behaviors) {
      expect(beh.cell_ids.length).toBeGreaterThanOrEqual(2); // a pattern needs repetition
      for (const cid of beh.cell_ids) {
        const cell = cellById.get(cid);
        expect(cell, cid).toBeTruthy();
        expect(cell!.tenant_id).toBe(beh.tenant_id);
        expect(cell!.site_id).toBe(beh.site_id);
      }
    }
  });

  it("surfaces a production-pressure pattern where triggers point to schedule pressure", () => {
    expect(behaviors.some((b) => b.pattern === "production_pressure")).toBe(true);
  });
});

describe("proposeLearning", () => {
  const proposals = proposeLearning(fx.EVENT_CELLS, fx.CELLS);

  it("proposes a learning cell for each event with a known precursor", () => {
    const withCell = fx.EVENT_CELLS.filter((e) => e.cell_id && fx.CELLS.some((c) => c.id === e.cell_id));
    expect(proposals).toHaveLength(withCell.length);
    for (const p of proposals) expect(["control", "scoring", "prompt"]).toContain(p.kind);
  });

  it("recommends hardening the control when the precursor's gap was missing/expired/unverified", () => {
    const evt = fx.EVENT_CELLS.find((e) => e.id === "evt_003")!; // cell_022, bypassed→ not gap-needs-control; pick one
    void evt;
    const cell = fx.CELLS.find((c) => c.hazard_genome.controlGap === "missing")!;
    const fakeEvent = { ...fx.EVENT_CELLS[0], id: "evt_x", cell_id: cell.id, severity: "high" as const };
    const [p] = proposeLearning([fakeEvent], fx.CELLS);
    expect(p.kind).toBe("control");
  });
});

describe("similarOutcomes", () => {
  const cell = fx.CELLS.find((c) => c.id === "cell_001")!; // Dock A forklift, struck_by
  const out = similarOutcomes(cell, fx.EVENT_CELLS, fx.CELLS, 5);

  it("ranks past outcomes by resemblance, never the cell's own, sorted desc", () => {
    expect(buildOrderOk(out.map((o) => o.similarity))).toBe(true);
    for (const o of out) {
      expect(o.sourceCellId).not.toBe(cell.id);
      expect(o.similarity).toBeGreaterThan(0);
      expect(o.similarity).toBeLessThanOrEqual(1);
      expect(fx.EVENT_CELLS.some((e) => e.id === o.event.id)).toBe(true);
    }
  });

  it("is deterministic", () => {
    expect(similarOutcomes(cell, fx.EVENT_CELLS, fx.CELLS, 5)).toEqual(out);
  });
});

function buildOrderOk(xs: number[]): boolean {
  for (let i = 1; i < xs.length; i++) if (xs[i - 1] < xs[i]) return false;
  return true;
}

describe("heatWeight event weighting", () => {
  const cell = fx.CELLS.find((c) => c.status !== "closed")!;
  const now = new Date("2026-06-10T00:00:00Z").getTime();

  it("burns hotter when the cell already produced an outcome", () => {
    const without = heatWeight(cell, 0, now, 0);
    const withEvent = heatWeight(cell, 0, now, 1);
    expect(withEvent).toBeGreaterThanOrEqual(without);
  });

  it("stays within 0..1 and caps the event amplification", () => {
    const v = heatWeight(cell, 4, now, 99);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });
});
