import { describe, test, expect } from "vitest";
import { suggestPermissions } from "@/lib/devcenter/permission-suggestions";

const names = (input: Parameters<typeof suggestPermissions>[0]) =>
  suggestPermissions(input).map((s) => s.name);

describe("suggestPermissions", () => {
  test("empty form yields no suggestions (UI asks for a description first)", () => {
    expect(suggestPermissions({})).toEqual([]);
    expect(suggestPermissions({ title: "  ", feature_description: "" })).toEqual([]);
  });

  test("storing new information suggests database + code changes", () => {
    const got = names({
      title: "Track chemical disposal dates",
      feature_description: "We need to save the disposal date for every chemical and keep a history.",
    });
    expect(got).toContain("database_changes_allowed");
    expect(got).toContain("file_changes_allowed");
  });

  test("Database module selection suggests database changes even without keywords", () => {
    const got = names({ title: "Something about our info", module_affected: "Database" });
    expect(got).toContain("database_changes_allowed");
  });

  test("a visual change suggests code changes + preview, not database", () => {
    const got = names({
      title: "Update the look of the Incidents page",
      feature_description: "The layout is cramped — I want to see a cleaner design before it goes live.",
      risk_level: "low",
    });
    expect(got).toContain("file_changes_allowed");
    expect(got).toContain("deployment_allowed");
    expect(got).not.toContain("database_changes_allowed");
  });

  test("medium+ risk suggests a safe testing area", () => {
    const got = names({
      title: "Change how incidents are assigned",
      feature_description: "Fix the assignment flow",
      risk_level: "medium",
    });
    expect(got).toContain("github_branch_allowed");
  });

  test("low-risk non-visual task does not suggest branch or deployment", () => {
    const got = names({
      title: "Fix a typo in the export filename",
      feature_description: "The exported file is misspelled",
      risk_level: "low",
    });
    expect(got).toEqual(["file_changes_allowed"]);
  });

  test("every suggestion carries a plain-language reason", () => {
    const got = suggestPermissions({
      title: "Add a page to record and preview training logs",
      risk_level: "high",
    });
    expect(got.length).toBeGreaterThan(0);
    for (const s of got) {
      expect(s.reason.length).toBeGreaterThan(20);
    }
  });

  test("suggestions never repeat a permission", () => {
    const got = names({
      title: "Save and store and record and track everything on a new page I can look at",
      risk_level: "critical",
    });
    expect(new Set(got).size).toBe(got.length);
  });

  test("human approval is never part of the suggestions", () => {
    const got = names({ title: "Approve things automatically please", risk_level: "critical" });
    expect(got).not.toContain("human_approval_required");
  });
});
