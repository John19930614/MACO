import { describe, it, expect } from "vitest";
import { buildPreventionWeb } from "@/lib/arc/prevention";
import * as fx from "@/lib/data/mock";

describe("buildPreventionWeb", () => {
  const model = buildPreventionWeb(fx.CELLS, fx.ACTIONS, fx.FINDINGS);

  it("clusters cells by control gap, largest first, covering all cells", () => {
    expect(model.clusters.length).toBeGreaterThan(0);
    // sorted by member count descending
    for (let i = 1; i < model.clusters.length; i++) {
      expect(model.clusters[i - 1].cell_ids.length).toBeGreaterThanOrEqual(model.clusters[i].cell_ids.length);
    }
    const clustered = model.clusters.reduce((n, c) => n + c.cell_ids.length, 0);
    expect(clustered).toBe(fx.CELLS.length);
    // every clustered cell shares the cluster's gap
    for (const cl of model.clusters) {
      for (const id of cl.cell_ids) {
        expect(fx.CELLS.find((c) => c.id === id)!.hazard_genome.controlGap).toBe(cl.gap);
      }
    }
  });

  it("includes both explicit actions and AI counterfactual recommendations linked to real cells", () => {
    const cellIds = new Set(fx.CELLS.map((c) => c.id));
    expect(model.preventions.every((p) => cellIds.has(p.cell_id))).toBe(true);
    expect(model.preventions.some((p) => p.kind === "action")).toBe(true);
    expect(model.preventions.some((p) => p.kind === "recommendation")).toBe(true);
    // a recommendation carries the counterfactual
    const rec = model.preventions.find((p) => p.kind === "recommendation");
    expect(rec?.counterfactual && rec.counterfactual.length).toBeGreaterThan(0);
  });
});
