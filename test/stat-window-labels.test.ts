import { test, expect } from "vitest";
import { STAT_CARD_WINDOW_LABELS } from "@/lib/devcommand/stat-window-labels";

const APPROVED_WINDOW_PHRASES = [
  "last 24h",
  "today",
  "currently open",
  "all time",
  "active right now",
];

test("every stat card label explicitly states an approved time window", () => {
  const entries = Object.entries(STAT_CARD_WINDOW_LABELS);
  expect(entries.length).toBeGreaterThan(0);

  for (const [id, label] of entries) {
    const normalized = label.toLowerCase();
    const matchesApprovedPhrase = APPROVED_WINDOW_PHRASES.some((phrase) =>
      normalized.includes(phrase)
    );
    expect(
      matchesApprovedPhrase,
      `Stat card "${id}" label "${label}" does not state an approved time window`
    ).toBe(true);
  }
});
