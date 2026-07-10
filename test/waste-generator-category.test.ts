import { test, expect, describe } from "vitest";
import { computeGeneratorCategory } from "@/lib/waste/generator-category";
import { computeRoiPct } from "@/lib/waste/minimization";
import { summarizeHierarchy } from "@/lib/waste/hierarchy";

describe("computeGeneratorCategory — EPA boundary conditions", () => {
  test("classifies VSQG below 100 kg/mo", () => {
    expect(computeGeneratorCategory(0, 0)).toBe("VSQG");
    expect(computeGeneratorCategory(99, 0)).toBe("VSQG");
    expect(computeGeneratorCategory(99.999, 0)).toBe("VSQG");
  });

  test("classifies SQG at 100 kg through just under 1,000 kg", () => {
    expect(computeGeneratorCategory(100, 0)).toBe("SQG");
    expect(computeGeneratorCategory(500, 0)).toBe("SQG");
    expect(computeGeneratorCategory(999, 0)).toBe("SQG");
    expect(computeGeneratorCategory(999.999, 0)).toBe("SQG");
  });

  test("classifies LQG at or above 1,000 kg", () => {
    expect(computeGeneratorCategory(1000, 0)).toBe("LQG");
    expect(computeGeneratorCategory(5000, 0)).toBe("LQG");
  });

  test("acute-hazardous at/above 1 kg forces LQG regardless of total", () => {
    expect(computeGeneratorCategory(0, 1)).toBe("LQG");
    expect(computeGeneratorCategory(10, 1)).toBe("LQG");
    expect(computeGeneratorCategory(99, 5)).toBe("LQG");
  });

  test("acute-hazardous below 1 kg does not by itself escalate", () => {
    expect(computeGeneratorCategory(50, 0.5)).toBe("VSQG");
    expect(computeGeneratorCategory(150, 0.9)).toBe("SQG");
  });

  test("back-filled / missing month reads as zero → VSQG (safe default)", () => {
    // A month with no reported waste computes to the lowest category, so a
    // back-fill that later adds waste can only escalate, never silently drop.
    expect(computeGeneratorCategory(0, 0)).toBe("VSQG");
  });
});

describe("waste hierarchy split — prevention kept distinct from recycling", () => {
  test("prevented equals eliminate+substitute+reduce; recycled/landfilled reported separately", () => {
    const rows = [
      {
        eliminated_kg: 10,
        substituted_kg: 5,
        reduced_kg: 5,
        reused_kg: 2,
        recycled_kg: 20,
        treated_kg: 3,
        landfilled_kg: 1,
      },
    ];
    const split = summarizeHierarchy(rows);
    expect(split.prevented).toBe(20); // 10 + 5 + 5
    expect(split.recycled).toBe(25); // 2 + 20 + 3
    expect(split.landfilled).toBe(1);
    // Prevention must never be merged into recycling.
    expect(split.prevented).not.toBe(split.recycled);
    expect(split.total).toBe(46);
  });

  test("sums across multiple rows", () => {
    const split = summarizeHierarchy([
      { eliminated_kg: 1, substituted_kg: 0, reduced_kg: 0, reused_kg: 0, recycled_kg: 0, treated_kg: 0, landfilled_kg: 0 },
      { eliminated_kg: 0, substituted_kg: 0, reduced_kg: 0, reused_kg: 0, recycled_kg: 4, treated_kg: 0, landfilled_kg: 2 },
    ]);
    expect(split.prevented).toBe(1);
    expect(split.recycled).toBe(4);
    expect(split.landfilled).toBe(2);
  });
});

describe("computeRoiPct", () => {
  test("returns percentage gain when cost is positive", () => {
    expect(computeRoiPct(100, 150)).toBe(50);
    expect(computeRoiPct(200, 100)).toBe(-50);
  });

  test("returns null without a positive cost or with no savings", () => {
    expect(computeRoiPct(0, 100)).toBeNull();
    expect(computeRoiPct(undefined, 100)).toBeNull();
    expect(computeRoiPct(100, undefined)).toBeNull();
    expect(computeRoiPct(-5, 100)).toBeNull();
  });
});
