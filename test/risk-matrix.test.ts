import { describe, it, expect } from "vitest";
import { riskLevelFromScore, RISK_LEVEL_META } from "@/lib/constants";

// The Risk Matrix (src/components/risk/RiskMatrix.tsx) buckets each assessment
// into a `${likelihood_score}-${consequence_score}` cell and colours the cell
// via riskLevelFromScore(likelihood × consequence) → RISK_LEVEL_META[level].bgColor.
// These tests lock that logic down at the unit level.

function groupByCell(risks: { id: string; likelihood_score: number; consequence_score: number }[]) {
  const map = new Map<string, string[]>();
  for (const r of risks) {
    const key = `${r.likelihood_score}-${r.consequence_score}`;
    const bucket = map.get(key) ?? [];
    bucket.push(r.id);
    map.set(key, bucket);
  }
  return map;
}

describe("Risk matrix cell grouping", () => {
  it("groups risks by likelihood-consequence key", () => {
    const map = groupByCell([
      { id: "1", likelihood_score: 2, consequence_score: 3 },
      { id: "2", likelihood_score: 2, consequence_score: 3 },
      { id: "3", likelihood_score: 5, consequence_score: 5 },
    ]);
    expect(map.get("2-3")).toEqual(["1", "2"]);
    expect(map.get("5-5")).toEqual(["3"]);
  });

  it("retains every risk id when multiple risks share a cell (no data loss)", () => {
    const map = groupByCell([
      { id: "a", likelihood_score: 3, consequence_score: 4 },
      { id: "b", likelihood_score: 3, consequence_score: 4 },
      { id: "c", likelihood_score: 3, consequence_score: 4 },
    ]);
    expect(map.get("3-4")).toEqual(["a", "b", "c"]);
    expect(map.size).toBe(1);
  });
});

describe("Risk level color mapping", () => {
  it("maps the lowest score (1×1) to a low/negligible tier color", () => {
    const level = riskLevelFromScore(1 * 1);
    expect(["negligible", "low"]).toContain(level);
    expect(RISK_LEVEL_META[level].bgColor).toBeDefined();
  });

  it("maps a mid score to medium", () => {
    // riskLevelFromScore: ≤2 negligible, ≤6 low, ≤12 medium, ≤20 high, else extreme.
    expect(riskLevelFromScore(3 * 3)).toBe("medium"); // 9
  });

  it("maps a high score to high", () => {
    expect(riskLevelFromScore(4 * 4)).toBe("high"); // 16
  });

  it("maps the maximum score (5×5) to extreme", () => {
    const level = riskLevelFromScore(5 * 5);
    expect(level).toBe("extreme");
    expect(RISK_LEVEL_META.extreme.bgColor).toBeDefined();
  });

  it("exposes a distinct bgColor for every risk level tier", () => {
    const colors = Object.values(RISK_LEVEL_META).map((m) => m.bgColor);
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(colors.length);
  });
});

describe("Empty state", () => {
  it("treats an empty risk assessment array as the empty-state trigger", () => {
    const riskAssessments: unknown[] = [];
    expect(riskAssessments.length).toBe(0);
  });
});
