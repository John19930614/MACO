import { describe, it, expect } from "vitest";
import {
  buildPlatformReview,
  getFindingById,
  getFindingPrefill,
} from "../src/lib/devcenter/platform-review";

const NOW = "2026-07-02T00:00:00.000Z";

describe("Platform Review — converted findings move to the task board", () => {
  it("includes every curated finding when nothing has been converted", () => {
    const result = buildPlatformReview(null, NOW);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.convertedCount).toBe(0);
  });

  it("drops findings whose id already has a task and counts them", () => {
    const all = buildPlatformReview(null, NOW);
    const [first, second] = all.findings;
    const result = buildPlatformReview(null, NOW, [first.id, second.id]);
    expect(result.findings.map((f) => f.id)).not.toContain(first.id);
    expect(result.findings.map((f) => f.id)).not.toContain(second.id);
    expect(result.findings.length).toBe(all.findings.length - 2);
    expect(result.convertedCount).toBe(2);
  });

  it("ignores converted ids that don't match any curated finding", () => {
    const all = buildPlatformReview(null, NOW);
    const result = buildPlatformReview(null, NOW, ["no-such-finding"]);
    expect(result.findings.length).toBe(all.findings.length);
    expect(result.convertedCount).toBe(0);
  });

  it("check summaries reflect the filtered list", () => {
    const all = buildPlatformReview(null, NOW);
    const dbFinding = all.findings.find((f) => f.check === "database");
    expect(dbFinding).toBeDefined();
    const before = all.checks.find((c) => c.key === "database")!.findingCount;
    const after = buildPlatformReview(null, NOW, [dbFinding!.id]).checks.find(
      (c) => c.key === "database",
    )!.findingCount;
    expect(after).toBe(before - 1);
  });

  it("prefill carries the finding id so the created task links back to it", () => {
    const f = getFindingById("db-confirm-prod-migrations");
    expect(f).toBeDefined();
    const prefill = getFindingPrefill(f!);
    expect(prefill.source_finding_id).toBe("db-confirm-prod-migrations");
  });
});
