import { describe, test, expect } from "vitest";
import {
  litresFromCapacity,
  labelSizeForContainer,
  isCompactTier,
} from "@/lib/chemicals/labelSizing";

describe("litresFromCapacity", () => {
  test("converts volume units to litres", () => {
    expect(litresFromCapacity(500, "mL")).toBeCloseTo(0.5);
    expect(litresFromCapacity(20, "L")).toBe(20);
    expect(litresFromCapacity(1, "gal")).toBeCloseTo(3.7854, 3);
  });

  test("approximates mass units at density ~1", () => {
    expect(litresFromCapacity(100, "kg")).toBe(100);
    expect(litresFromCapacity(500, "g")).toBeCloseTo(0.5);
  });

  test("returns null for missing/invalid capacity", () => {
    expect(litresFromCapacity(null, "L")).toBeNull();
    expect(litresFromCapacity(undefined, "L")).toBeNull();
    expect(litresFromCapacity(0, "L")).toBeNull();
    expect(litresFromCapacity(-5, "L")).toBeNull();
  });
});

describe("labelSizeForContainer — EU CLP tier boundaries", () => {
  test("≤ 3 L → 52 × 74 mm", () => {
    const s = labelSizeForContainer(3, "L");
    expect(s.tier).toBe("≤3 L");
    expect([s.labelWmm, s.labelHmm]).toEqual([52, 74]);
  });

  test("just over 3 L → 74 × 105 mm", () => {
    const s = labelSizeForContainer(3.5, "L");
    expect(s.tier).toBe("3–50 L");
    expect([s.labelWmm, s.labelHmm]).toEqual([74, 105]);
  });

  test("50 L is still the 3–50 tier; 51 L moves up", () => {
    expect(labelSizeForContainer(50, "L").tier).toBe("3–50 L");
    const s = labelSizeForContainer(51, "L");
    expect(s.tier).toBe("50–500 L");
    expect([s.labelWmm, s.labelHmm]).toEqual([105, 148]);
  });

  test("500 L is the 50–500 tier; 501 L is the largest tier", () => {
    expect(labelSizeForContainer(500, "L").tier).toBe("50–500 L");
    const s = labelSizeForContainer(501, "L");
    expect(s.tier).toBe(">500 L");
    expect([s.labelWmm, s.labelHmm]).toEqual([148, 210]);
  });

  test("unknown capacity falls back to the smallest tier and is flagged", () => {
    const s = labelSizeForContainer(null, null);
    expect(s.tier).toBe("≤3 L");
    expect(s.isFallback).toBe(true);
    expect(s.containerLitres).toBeNull();
  });
});

describe("pictogram minimum (≥1/15 of label area, ≥10 mm)", () => {
  test("scales up with the label tier and never below 10 mm", () => {
    expect(labelSizeForContainer(1, "L").pictogramMm).toBe(16);   // 52×74
    expect(labelSizeForContainer(20, "L").pictogramMm).toBe(23);  // 74×105
    expect(labelSizeForContainer(100, "L").pictogramMm).toBe(32); // 105×148
    expect(labelSizeForContainer(1000, "L").pictogramMm).toBe(46);// 148×210
  });
});

describe("isCompactTier", () => {
  test("true for the two smallest tiers, false for the two largest", () => {
    expect(isCompactTier(labelSizeForContainer(1, "L"))).toBe(true);
    expect(isCompactTier(labelSizeForContainer(20, "L"))).toBe(true);
    expect(isCompactTier(labelSizeForContainer(100, "L"))).toBe(false);
    expect(isCompactTier(labelSizeForContainer(1000, "L"))).toBe(false);
  });
});
