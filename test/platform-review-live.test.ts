import { describe, expect, it } from "vitest";
import {
  buildPlatformReview,
  buildLiveFindings,
  type GateSignal,
  type MigrationsSignal,
  type ReviewFinding,
  type RlsSignal,
} from "../src/lib/devcenter/platform-review";

const NOW = "2026-07-02T12:00:00.000Z";

const gatePass: GateSignal = {
  typecheck: "pass", test: "pass", build: "pass", system: "pass",
  sha: "abc1234", branch: "master", at: "2026-07-02T10:00:00.000Z",
};

const scanFinding: ReviewFinding = {
  id: "scan:ghost-table:event_embeddings",
  check: "database",
  title: "Code queries table event_embeddings that no migration creates",
  detail: "src/lib/ai/embeddings.ts queries a table that does not exist.",
  recommendation: "Add a migration or gate the code path.",
  severity: "red",
  source: "scan",
  module: "Database",
  priority: "high",
  risk_level: "high",
  effort: "medium",
  success_criteria: "Table exists or path is gated.",
};

describe("buildPlatformReview live signals", () => {
  it("marks Build & Type live and green on a passing CI gate", () => {
    const check = buildPlatformReview({ gate: gatePass }, NOW).checks.find((c) => c.key === "build_type")!;
    expect(check.live).toBe(true);
    expect(check.status).toBe("green");
    expect(check.summary).toContain("abc1234");
  });

  it("turns Build & Type red when a CI gate step failed", () => {
    const check = buildPlatformReview(
      { gate: { ...gatePass, test: "fail" } },
      NOW,
    ).checks.find((c) => c.key === "build_type")!;
    expect(check.status).toBe("red");
  });

  it("falls back to the catalog summary with no gate signal", () => {
    const check = buildPlatformReview(null, NOW).checks.find((c) => c.key === "build_type")!;
    expect(check.live).toBe(false);
    expect(check.summary).toContain("Last full review");
  });

  it("flags the database check when migrations are pending", () => {
    const migrations: MigrationsSignal = {
      localCount: 47, appliedCount: 46, probedApplied: 3,
      pending: [{ filename: "20260702020000_dev_review_findings.sql", name: "dev_review_findings" }],
    };
    const check = buildPlatformReview({ migrations }, NOW).checks.find((c) => c.key === "database")!;
    expect(check.live).toBe(true);
    expect(check.status).toBe("amber");
    expect(check.summary).toContain("dev_review_findings");
  });

  it("turns security red when the RLS probe finds unprotected tables", () => {
    const rls: RlsSignal = { total: 130, disabled: ["oops_table"] };
    const result = buildPlatformReview({ rls }, NOW, [], [], buildLiveFindings(null, rls));
    const check = result.checks.find((c) => c.key === "security")!;
    expect(check.live).toBe(true);
    expect(check.status).toBe("red");
    expect(result.findings.some((f) => f.id === "live-rls-disabled")).toBe(true);
  });

  it("merges pipeline findings and lets converted/dismissed filtering apply to them", () => {
    const withFinding = buildPlatformReview(null, NOW, [], [], [scanFinding]);
    expect(withFinding.findings.some((f) => f.id === scanFinding.id)).toBe(true);
    expect(withFinding.checks.find((c) => c.key === "database")!.status).toBe("red");

    const converted = buildPlatformReview(null, NOW, [scanFinding.id], [], [scanFinding]);
    expect(converted.findings.some((f) => f.id === scanFinding.id)).toBe(false);

    const dismissed = buildPlatformReview(null, NOW, [], [scanFinding.id], [scanFinding]);
    expect(dismissed.findings.some((f) => f.id === scanFinding.id)).toBe(false);
    expect(dismissed.dismissed.some((f) => f.id === scanFinding.id)).toBe(true);
  });

  it("synthesizes a task-able finding per pending migration", () => {
    const migrations: MigrationsSignal = {
      localCount: 47, appliedCount: 45, probedApplied: 0,
      pending: [
        { filename: "a.sql", name: "a" },
        { filename: "b.sql", name: "b" },
      ],
    };
    const findings = buildLiveFindings(migrations, null);
    expect(findings).toHaveLength(2);
    expect(findings[0].id).toBe("live-pending-migration:a");
    expect(findings[0].check).toBe("database");
  });
});
