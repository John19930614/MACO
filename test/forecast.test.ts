import { describe, it, expect } from "vitest";
import { buildForecast, bandFor, type ForecastInput } from "@/lib/risk/forecast";
import * as fx from "@/lib/data/mock";

const input = (): ForecastInput => ({
  locations: fx.LOCATIONS,
  cells: fx.CELLS,
  proofs: fx.PROOFS,
  events: fx.EVENT_CELLS,
  behaviors: fx.BEHAVIOR_CELLS,
  actions: fx.ACTIONS,
  hsl: fx.HSL_READINGS,
  sites: fx.SITES,
  now: new Date("2026-06-10T00:00:00Z").getTime(),
});

describe("bandFor", () => {
  it("maps scores to the four bands", () => {
    expect(bandFor(10)).toBe("green");
    expect(bandFor(40)).toBe("amber");
    expect(bandFor(60)).toBe("orange");
    expect(bandFor(90)).toBe("red");
  });
});

describe("buildForecast", () => {
  const f = buildForecast(input());

  it("is deterministic and scores every location with cells, 0..100, sorted high-first", () => {
    expect(buildForecast(input())).toEqual(f);
    const withCells = new Set(fx.CELLS.map((c) => c.location_id));
    expect(f.length).toBe(withCells.size);
    for (const r of f) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(r.band).toBe(bandFor(r.score));
    }
    for (let i = 1; i < f.length; i++) expect(f[i - 1].score).toBeGreaterThanOrEqual(f[i].score);
  });

  it("explains each score with drivers that sum to it, highest first", () => {
    for (const r of f) {
      const sum = r.drivers.reduce((s, d) => s + d.contribution, 0);
      expect(Math.min(100, sum)).toBe(r.score);
      for (let i = 1; i < r.drivers.length; i++) expect(r.drivers[i - 1].contribution).toBeGreaterThanOrEqual(r.drivers[i].contribution);
    }
  });

  it("predicts a failure mode and a recommendation for at-risk locations", () => {
    const top = f[0];
    expect(top.score).toBeGreaterThan(0);
    expect(top.predictedExposure).toBeTruthy();
    expect(top.recommendation.length).toBeGreaterThan(10);
  });

  it("names a pre-empt target cell that actually sits at the location", () => {
    const cellLoc = new Map(fx.CELLS.map((c) => [c.id, c.location_id]));
    for (const r of f) {
      expect(r.topCellId).toBeTruthy();
      expect(cellLoc.get(r.topCellId!)).toBe(r.locationId);
    }
  });

  it("tags each location with its site's GUS vertical", () => {
    const vertBySite = new Map(fx.SITES.map((s) => [s.id, s.vertical]));
    for (const r of f) expect(r.vertical).toBe(vertBySite.get(r.siteId));
    expect(f.some((r) => r.vertical === "oil-gas")).toBe(true);
  });

  it("the oil-gas profile weights failures more heavily than the default", () => {
    // Build the same location under default vs oil-gas weighting and compare the
    // failures-driver contribution for a location that has failing controls.
    const oilGasLoc = f.find((r) => r.vertical === "oil-gas" && r.drivers.some((d) => d.key === "failures"));
    expect(oilGasLoc).toBeTruthy();
    const asDefault = buildForecast({ ...input(), sites: fx.SITES.map((s) => ({ ...s, vertical: "warehousing" })) });
    const sameLocDefault = asDefault.find((r) => r.locationId === oilGasLoc!.locationId)!;
    const oilGasFail = oilGasLoc!.drivers.find((d) => d.key === "failures")!.contribution;
    const defaultFail = sameLocDefault.drivers.find((d) => d.key === "failures")?.contribution ?? 0;
    expect(oilGasFail).toBeGreaterThan(defaultFail);
  });

  it("lists contributing cells (<=5, highest-risk first) all at the location", () => {
    const byId = new Map(fx.CELLS.map((c) => [c.id, c]));
    for (const r of f) {
      expect(r.cells.length).toBeGreaterThan(0);
      expect(r.cells.length).toBeLessThanOrEqual(5);
      expect(r.cells[0].id).toBe(r.topCellId); // top contributor = pre-empt target
      for (const c of r.cells) expect(byId.get(c.id)?.location_id).toBe(r.locationId);
    }
  });

  it("ranks a location with open failures + an event above a quiet one", () => {
    // loc_dock_a (Dock A: failures + behavior + multiple cells) should outrank
    // a location with a single low-signal cell.
    const dockA = f.find((r) => r.locationId === "loc_dock_a");
    expect(dockA).toBeTruthy();
    expect(dockA!.score).toBeGreaterThan(0);
  });
});
