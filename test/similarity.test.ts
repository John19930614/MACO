import { describe, it, expect } from "vitest";
import { normalizeTokens, titleSimilarity, countNearDuplicates } from "@/lib/text/similarity";

describe("normalizeTokens", () => {
  it("lowercases, strips punctuation, drops stopwords, keeps digits", () => {
    expect(normalizeTokens("Spill in the Lab 3!")).toEqual(["spill", "lab", "3"]);
  });
  it("drops single letters but keeps numeric tokens", () => {
    expect(normalizeTokens("Dock A — bay 7")).toEqual(["dock", "bay", "7"]);
  });
});

describe("titleSimilarity", () => {
  it("is 1 for identical titles", () => {
    expect(titleSimilarity("Forklift struck racking", "Forklift struck racking")).toBe(1);
  });

  it("is 1 for re-ordered words (which exact-match would miss)", () => {
    expect(titleSimilarity("Forklift struck the racking", "Racking struck by forklift")).toBe(1);
  });

  it("distinguishes titles separated only by a number", () => {
    expect(titleSimilarity("Spill in Lab 1", "Spill in Lab 3")).toBeLessThan(1);
  });

  it("is low for unrelated titles", () => {
    expect(titleSimilarity("Forklift struck racking", "Overdue respirator fit test")).toBeLessThan(0.3);
  });
});

describe("countNearDuplicates", () => {
  it("counts an exact duplicate (generalises the old check)", () => {
    expect(countNearDuplicates(["Chemical spill", "Chemical spill"])).toBe(1);
  });

  it("catches a re-ordered near-duplicate the exact-match check missed", () => {
    expect(countNearDuplicates(["Chemical spill in lab", "Spill of chemical in lab"])).toBe(1);
  });

  it("does not flag genuinely distinct records", () => {
    expect(countNearDuplicates(["Forklift near-miss at dock", "Respirator fit test overdue", "Guardrail missing on mezzanine"])).toBe(0);
  });

  it("ignores blank titles and is order-deterministic", () => {
    const texts = ["", "Slip on wet floor", "   ", "Slip on the wet floor"];
    expect(countNearDuplicates(texts)).toBe(1);
    expect(countNearDuplicates([...texts].reverse())).toBe(1);
  });
});
