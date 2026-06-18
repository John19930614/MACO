import { describe, it, expect } from "vitest";
import { buildCellLinks, layoutForce, connectedComponents, articulationPoints, bridges } from "@/lib/arc/linkage";
import * as fx from "@/lib/data/mock";

describe("buildCellLinks", () => {
  it("links cells across the whole population (cross-site)", () => {
    const links = buildCellLinks(fx.CELLS, fx.EDGES, 2);
    expect(links.length).toBeGreaterThan(0);
    // a link can connect cells from different sites (one mass space)
    const cellSite = new Map(fx.CELLS.map((c) => [c.id, c.site_id]));
    const crossSite = links.some((l) => cellSite.get(l.source) !== cellSite.get(l.target));
    expect(crossSite).toBe(true);
  });

  it("weights causal links above shared-attribute links", () => {
    const links = buildCellLinks(fx.CELLS, fx.EDGES, 1);
    const causal = links.find((l) => l.kinds.includes("causal"));
    expect(causal).toBeTruthy();
    expect(causal!.weight).toBeGreaterThanOrEqual(4);
  });

  it("threshold prunes weak links", () => {
    const lo = buildCellLinks(fx.CELLS, fx.EDGES, 1).length;
    const hi = buildCellLinks(fx.CELLS, fx.EDGES, 5).length;
    expect(hi).toBeLessThanOrEqual(lo);
  });

  it("never links a cell to itself and dedupes pairs", () => {
    const links = buildCellLinks(fx.CELLS, fx.EDGES, 1);
    for (const l of links) expect(l.source).not.toBe(l.target);
    const keys = links.map((l) => [l.source, l.target].sort().join("|"));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("layoutForce", () => {
  it("is deterministic and produces finite positions for every node", () => {
    const ids = fx.CELLS.map((c) => c.id);
    const links = buildCellLinks(fx.CELLS, fx.EDGES, 2);
    const a = layoutForce(ids, links, 120);
    const b = layoutForce(ids, links, 120);
    for (const id of ids) {
      expect(Number.isFinite(a[id].x)).toBe(true);
      expect(Number.isFinite(a[id].y)).toBe(true);
      expect(a[id]).toEqual(b[id]); // deterministic
    }
  });

  it("handles empty and single-node inputs", () => {
    expect(layoutForce([], [])).toEqual({});
    expect(layoutForce(["only"], [])).toEqual({ only: { x: 0, y: 0 } });
  });
});

describe("connectedComponents", () => {
  it("partitions all ids and puts linked cells in the same cluster", () => {
    const ids = fx.CELLS.map((c) => c.id);
    const links = buildCellLinks(fx.CELLS, fx.EDGES, 2);
    const comps = connectedComponents(ids, links);
    expect(comps.reduce((n, g) => n + g.length, 0)).toBe(ids.length);
    // every id appears exactly once
    expect(new Set(comps.flat()).size).toBe(ids.length);
    // a known shared link (cell_001 & cell_002 share Dock A) lands them together
    const comp = comps.find((g) => g.includes("cell_001"));
    expect(comp).toContain("cell_002");
  });

  it("sorts clusters largest-first and isolates unlinked nodes", () => {
    const comps = connectedComponents(["x", "y", "z"], [{ source: "x", target: "y" }]);
    expect(comps[0]).toHaveLength(2); // x,y
    expect(comps.some((g) => g.length === 1 && g[0] === "z")).toBe(true);
  });
});

describe("articulationPoints (linchpin cells)", () => {
  it("finds the cut vertex in a path a-b-c", () => {
    const ap = articulationPoints(["a", "b", "c"], [{ source: "a", target: "b" }, { source: "b", target: "c" }]);
    expect(ap).toEqual(["b"]);
  });

  it("a fully-connected triangle has no articulation points", () => {
    const ap = articulationPoints(["a", "b", "c"], [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
      { source: "a", target: "c" },
    ]);
    expect(ap).toHaveLength(0);
  });

  it("identifies the hub connecting two triangles", () => {
    // two triangles sharing node 'h' as the only bridge
    const ap = articulationPoints(["a", "b", "h", "d", "e"], [
      { source: "a", target: "b" }, { source: "a", target: "h" }, { source: "b", target: "h" },
      { source: "h", target: "d" }, { source: "d", target: "e" }, { source: "h", target: "e" },
    ]);
    expect(ap).toContain("h");
  });
});

describe("bridges (cut edges)", () => {
  it("every edge of a path is a bridge", () => {
    const b = bridges(["a", "b", "c"], [{ source: "a", target: "b" }, { source: "b", target: "c" }]);
    expect(b.length).toBe(2);
    const keys = b.map((p) => p.join("|")).sort();
    expect(keys).toEqual(["a|b", "b|c"]);
  });

  it("a triangle has no bridges", () => {
    const b = bridges(["a", "b", "c"], [{ source: "a", target: "b" }, { source: "b", target: "c" }, { source: "a", target: "c" }]);
    expect(b).toHaveLength(0);
  });

  it("the single edge joining two triangles is the only bridge", () => {
    const links = [
      { source: "a", target: "b" }, { source: "b", target: "c" }, { source: "a", target: "c" }, // triangle 1
      { source: "d", target: "e" }, { source: "e", target: "f" }, { source: "d", target: "f" }, // triangle 2
      { source: "c", target: "d" }, // the bridge
    ];
    const b = bridges(["a", "b", "c", "d", "e", "f"], links);
    expect(b).toEqual([["c", "d"]]);
  });
});
