import { describe, it, expect } from "vitest";
import {
  getAllSuggestions,
  getDailySuggestion,
  getNextEligibleSuggestion,
  getEligibleDailySuggestion,
  getSuggestionPrefill,
} from "@/lib/devcenter/suggestions";

describe("getNextEligibleSuggestion", () => {
  it("skips dismissed/actioned ids and cycles through the pool", () => {
    const pool = getAllSuggestions();
    const [a, b, c] = pool;
    const exclude = new Set([b.id]);

    const first = getNextEligibleSuggestion(exclude, a.id);
    expect(first?.id).not.toBe(a.id);
    expect(first?.id).not.toBe(b.id);
    expect(first?.id).toBe(c.id);
  });

  it("wraps around to the start of the eligible list", () => {
    const pool = getAllSuggestions();
    const last = pool[pool.length - 1];
    const next = getNextEligibleSuggestion(new Set(), last.id);
    expect(next?.id).toBe(pool[0].id);
  });

  it("returns null when every suggestion has been excluded", () => {
    const allIds = new Set(getAllSuggestions().map((s) => s.id));
    expect(getNextEligibleSuggestion(allIds)).toBeNull();
  });

  it("with no currentId, returns the first eligible suggestion", () => {
    const pool = getAllSuggestions();
    const exclude = new Set([pool[0].id]);
    const next = getNextEligibleSuggestion(exclude);
    expect(next?.id).toBe(pool[1].id);
  });
});

describe("getEligibleDailySuggestion", () => {
  it("returns today's suggestion when it hasn't been excluded", () => {
    const today = getDailySuggestion("2026-07-07");
    const result = getEligibleDailySuggestion(new Set(), "2026-07-07");
    expect(result?.id).toBe(today.id);
  });

  it("falls through to the next eligible suggestion when today's was dismissed", () => {
    const today = getDailySuggestion("2026-07-07");
    const result = getEligibleDailySuggestion(new Set([today.id]), "2026-07-07");
    expect(result).not.toBeNull();
    expect(result?.id).not.toBe(today.id);
  });

  it("returns null when the whole pool is excluded", () => {
    const allIds = new Set(getAllSuggestions().map((s) => s.id));
    expect(getEligibleDailySuggestion(allIds, "2026-07-07")).toBeNull();
  });
});

describe("getSuggestionPrefill", () => {
  it("carries the suggestion id as source_suggestion_id so the task can be linked back", () => {
    const suggestion = getAllSuggestions()[0];
    const prefill = getSuggestionPrefill(suggestion);
    expect(prefill.source_suggestion_id).toBe(suggestion.id);
  });
});
