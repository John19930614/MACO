import { describe, it, expect } from "vitest";
import { reorderStatCards, RISK_CARD_KEYS } from "@/lib/devcenter/stat-card-order";

interface Card {
  key: string;
  label: string;
  value: number;
}

const baseCards: Card[] = [
  { key: "open_tasks", label: "Open tasks", value: 5 },
  { key: "need_approval", label: "Need your approval", value: 1 },
  { key: "runs_today", label: "Active agents", value: 3 },
  { key: "failed_runs", label: "Failed reviews", value: 0 },
  { key: "security_warnings", label: "Security blockers", value: 0 },
  { key: "xp_failures", label: "Experience issues", value: 0 },
  { key: "draft_plans", label: "Draft artifacts", value: 2 },
  { key: "active_prs", label: "Open pull requests", value: 4 },
  { key: "recent_deploys", label: "Deployments", value: 7 },
  { key: "audit_today", label: "Audit entries today", value: 42 },
];

describe("reorderStatCards", () => {
  it("places the three risk cards first, in the specified order", () => {
    const result = reorderStatCards(baseCards);
    expect(result.slice(0, 3).map((c) => c.key)).toEqual([
      "security_warnings",
      "failed_runs",
      "xp_failures",
    ]);
  });

  it("preserves relative order of remaining cards after the risk cards", () => {
    const result = reorderStatCards(baseCards);
    expect(result.slice(3).map((c) => c.key)).toEqual([
      "open_tasks",
      "need_approval",
      "runs_today",
      "draft_plans",
      "active_prs",
      "recent_deploys",
      "audit_today",
    ]);
  });

  it("keeps risk cards first even when all risk values are zero", () => {
    const zeroRisk = baseCards.map((c) =>
      (RISK_CARD_KEYS as readonly string[]).includes(c.key) ? { ...c, value: 0 } : c
    );
    const result = reorderStatCards(zeroRisk);
    expect(result.slice(0, 3).map((c) => c.key)).toEqual([
      "security_warnings",
      "failed_runs",
      "xp_failures",
    ]);
  });

  it("keeps risk cards first even when risk values are non-zero", () => {
    const nonZeroRisk = baseCards.map((c) =>
      (RISK_CARD_KEYS as readonly string[]).includes(c.key) ? { ...c, value: 9 } : c
    );
    const result = reorderStatCards(nonZeroRisk);
    expect(result.slice(0, 3).map((c) => c.key)).toEqual([
      "security_warnings",
      "failed_runs",
      "xp_failures",
    ]);
  });

  it("does not mutate the input array or change card values", () => {
    const copy = JSON.parse(JSON.stringify(baseCards));
    reorderStatCards(baseCards);
    expect(baseCards).toEqual(copy);
  });

  it("handles a missing risk card gracefully (no crash, no duplicates)", () => {
    const partial = baseCards.filter((c) => c.key !== "failed_runs");
    const result = reorderStatCards(partial);
    expect(result.map((c) => c.key)).toEqual([
      "security_warnings",
      "xp_failures",
      "open_tasks",
      "need_approval",
      "runs_today",
      "draft_plans",
      "active_prs",
      "recent_deploys",
      "audit_today",
    ]);
  });
});
