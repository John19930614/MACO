import { describe, it, expect } from "vitest";
import { timelineByWeek, distribution, byVertical, severityMix, kpis } from "@/lib/analytics/trends";
import * as fx from "@/lib/data/mock";

describe("trends aggregation", () => {
  it("timeline buckets sum to the total cell count and split by severity", () => {
    const buckets = timelineByWeek(fx.CELLS);
    const total = buckets.reduce((n, b) => n + b.total, 0);
    expect(total).toBe(fx.CELLS.length);
    const sevTotal = buckets.reduce((n, b) => n + b.counts.low + b.counts.medium + b.counts.high + b.counts.critical, 0);
    expect(sevTotal).toBe(fx.CELLS.length);
  });

  it("handles an empty dataset", () => {
    expect(timelineByWeek([])).toEqual([]);
  });

  it("distribution is sorted descending and sums to total", () => {
    const d = distribution(fx.CELLS, (c) => c.hazard_genome.controlGap);
    expect(d.reduce((n, x) => n + x.count, 0)).toBe(fx.CELLS.length);
    for (let i = 1; i < d.length; i++) expect(d[i - 1].count).toBeGreaterThanOrEqual(d[i].count);
  });

  it("severityMix totals to the cell count", () => {
    const m = severityMix(fx.CELLS);
    expect(m.low + m.medium + m.high + m.critical).toBe(fx.CELLS.length);
  });

  it("byVertical produces one row per vertical with bounded percentages", () => {
    const rows = byVertical(fx.CELLS, fx.SITES);
    const verticals = new Set(fx.SITES.map((s) => s.vertical));
    expect(rows.length).toBe(verticals.size);
    for (const r of rows) {
      expect(r.count).toBeGreaterThan(0);
      expect(r.pctHigh).toBeGreaterThanOrEqual(0);
      expect(r.pctHigh).toBeLessThanOrEqual(100);
      expect(r.pctOpen).toBeLessThanOrEqual(100);
    }
    expect(rows.reduce((n, r) => n + r.count, 0)).toBe(fx.CELLS.length);
  });

  it("kpis are bounded and consistent", () => {
    const k = kpis(fx.CELLS, fx.ACTIONS, fx.PROOFS);
    expect(k.total).toBe(fx.CELLS.length);
    expect(k.open).toBeLessThanOrEqual(k.total);
    expect(k.gapRate).toBeGreaterThanOrEqual(0);
    expect(k.gapRate).toBeLessThanOrEqual(100);
    expect(k.actionClosure).toBeLessThanOrEqual(100);
  });
});
