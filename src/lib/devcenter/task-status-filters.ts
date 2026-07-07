/**
 * Shared vocabulary for linking an Overview stat card to a pre-filtered view
 * of the Tasks page. Keys mirror the real `dashboardMetrics()` keys in
 * `sample.ts` so there is exactly one name per bucket, not two.
 *
 * Bucket membership (which task ids belong to each key) depends on other
 * tables (dev_artifacts, dev_deployments, dev_security_reviews,
 * dev_review_gates / dev_experience_reviews) and is computed in repo.ts
 * (live) and sample.ts (mock) — this module stays a pure leaf with no data
 * dependencies so it's trivially unit-testable.
 */
import type { DevTask } from "./types";

export type TaskStatusFilterKey =
  | "draft_plans"
  | "active_prs"
  | "security_warnings"
  | "xp_failures";

export const TASK_STATUS_FILTER_LABELS: Record<TaskStatusFilterKey, string> = {
  draft_plans: "Draft artifacts",
  active_prs: "Open pull requests",
  security_warnings: "Security blockers",
  xp_failures: "Experience issues",
};

const VALID_KEYS = new Set<string>(Object.keys(TASK_STATUS_FILTER_LABELS));

/** Build the href for a stat card, e.g. buildTaskFilterHref('draft_plans') -> '/admin/dev-command/tasks?status=draft_plans' */
export function buildTaskFilterHref(status: TaskStatusFilterKey): string {
  return `/admin/dev-command/tasks?status=${encodeURIComponent(status)}`;
}

/** Normalize/validate an incoming searchParams.status value. Returns null if absent or unrecognized (falls back to unfiltered list). */
export function parseTaskStatusFilter(
  raw: string | string[] | undefined,
): TaskStatusFilterKey | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  return VALID_KEYS.has(value) ? (value as TaskStatusFilterKey) : null;
}

/** Keep only the tasks whose id appears in the given bucket's task-id set. */
export function filterTasksByBucket(
  tasks: DevTask[],
  bucketTaskIds: string[] | Set<string>,
): DevTask[] {
  const ids = bucketTaskIds instanceof Set ? bucketTaskIds : new Set(bucketTaskIds);
  return tasks.filter((t) => ids.has(t.id));
}
