// Guards the shared vocabulary that links Overview stat cards to a
// pre-filtered Tasks view: the URL builder, the incoming ?status= validator,
// and the bucket-membership filter must all agree on the same 4 keys so the
// card link and the Tasks page filter can never drift apart.

import { describe, it, expect } from "vitest";
import {
  buildTaskFilterHref,
  parseTaskStatusFilter,
  filterTasksByBucket,
  TASK_STATUS_FILTER_LABELS,
} from "../src/lib/devcenter/task-status-filters";
import type { DevTask } from "../src/lib/devcenter/types";

const task = (id: string): DevTask => ({
  id,
  title: `Task ${id}`,
  description: null,
  target_area: null,
  priority: "medium",
  status: "code_draft",
  risk_level: "low",
  metadata: {},
  created_by: "you",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

describe("buildTaskFilterHref", () => {
  it("builds correct hrefs for each status key", () => {
    expect(buildTaskFilterHref("draft_plans")).toBe("/admin/dev-command/tasks?status=draft_plans");
    expect(buildTaskFilterHref("active_prs")).toBe("/admin/dev-command/tasks?status=active_prs");
    expect(buildTaskFilterHref("security_warnings")).toBe("/admin/dev-command/tasks?status=security_warnings");
    expect(buildTaskFilterHref("xp_failures")).toBe("/admin/dev-command/tasks?status=xp_failures");
  });
});

describe("parseTaskStatusFilter", () => {
  it("returns null for missing or invalid values", () => {
    expect(parseTaskStatusFilter(undefined)).toBeNull();
    expect(parseTaskStatusFilter("")).toBeNull();
    expect(parseTaskStatusFilter("bogus")).toBeNull();
  });

  it("returns the key for valid values, including array searchParams", () => {
    expect(parseTaskStatusFilter("draft_plans")).toBe("draft_plans");
    expect(parseTaskStatusFilter(["security_warnings", "draft_plans"])).toBe("security_warnings");
  });
});

describe("filterTasksByBucket", () => {
  const tasks = [task("t1"), task("t2"), task("t3")];

  it("keeps only tasks whose id is in the bucket", () => {
    expect(filterTasksByBucket(tasks, ["t2"]).map((t) => t.id)).toEqual(["t2"]);
  });

  it("accepts a Set as well as an array", () => {
    expect(filterTasksByBucket(tasks, new Set(["t1", "t3"])).map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("does not cross-match a task from a different bucket", () => {
    const securityBucket = ["t1"];
    const experienceBucket = ["t2"];
    expect(filterTasksByBucket(tasks, securityBucket).some((t) => t.id === "t2")).toBe(false);
    expect(filterTasksByBucket(tasks, experienceBucket).some((t) => t.id === "t1")).toBe(false);
  });

  it("returns an empty list for an empty bucket", () => {
    expect(filterTasksByBucket(tasks, [])).toEqual([]);
  });
});

describe("TASK_STATUS_FILTER_LABELS", () => {
  it("every filter key has a friendly label", () => {
    Object.keys(TASK_STATUS_FILTER_LABELS).forEach((key) => {
      expect(TASK_STATUS_FILTER_LABELS[key as keyof typeof TASK_STATUS_FILTER_LABELS]).toBeTruthy();
    });
  });
});
