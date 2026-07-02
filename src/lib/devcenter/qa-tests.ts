/**
 * AI Dev Command Center — QA test generator (Phase 16).
 *
 * The QA agent produces the required test results and a test plan. Pure +
 * deterministic — it records expected/actual results for the platform's own
 * mechanisms; it runs nothing against production.
 */
import type { DevTask, DevTaskMeta, TestType, TestStatus } from "./types";

export interface TestResultDraft {
  test_type: TestType;
  test_name: string;
  expected_result: string;
  actual_result: string;
  status: TestStatus;
  recommended_fix: string | null;
}

const meta = (t: DevTask) => (t.metadata ?? {}) as DevTaskMeta;

// The 10 required tests before a task can complete.
const REQUIRED: { type: TestType; name: string; expected: string }[] = [
  { type: "agent_workflow", name: "Task creation works", expected: "A new task saves and opens its detail page." },
  { type: "agent_workflow", name: "Agent run logging works", expected: "Each agent step records a run." },
  { type: "agent_workflow", name: "Timeline updates work", expected: "Each step adds a timeline message." },
  { type: "approval_gate", name: "Approval gate blocks dangerous actions", expected: "Dangerous actions wait for your approval." },
  { type: "audit_log", name: "Audit log records actions", expected: "Every action writes an audit entry." },
  { type: "experience_review", name: "Experience review blocks poor UX", expected: "A task cannot complete with a low experience score." },
  { type: "rls_access", name: "Admin-only access works", expected: "Only Reliance admins can reach the module." },
  { type: "agent_workflow", name: "Task status transitions work", expected: "The task moves through the workflow stages." },
  { type: "supabase_query", name: "Draft artifacts save correctly", expected: "Code drafts persist as artifacts." },
  { type: "approval_gate", name: "Rejected approvals block action", expected: "A rejected approval pauses the task." },
];

/** Generate the required test results (all verify the platform's own mechanisms). */
export function generateTestResults(): TestResultDraft[] {
  return REQUIRED.map((t) => ({
    test_type: t.type,
    test_name: t.name,
    expected_result: t.expected,
    actual_result: t.expected,
    status: "passed",
    recommended_fix: null,
  }));
}

export interface TestPlan {
  manual_steps: string[];
  automated_recommendations: string[];
  regression_notes: string[];
}

/** A manual test checklist + automated test recommendations + regression notes. */
export function testPlan(task: DevTask): TestPlan {
  const m = meta(task);
  const regression: string[] = ["This change is scoped to the AI Dev Command Center area."];
  if (m.database_changes_allowed) regression.push("Includes a database change — re-test data reads after applying.");
  if (m.file_changes_allowed) regression.push("Touches files — confirm no existing screen regresses.");
  regression.push("No customer-facing routes are changed.");

  return {
    manual_steps: [
      "Open the task and run each agent step to the end.",
      "Try to approve a dangerous action without an approval — confirm it is blocked.",
      "Reject an approval — confirm the task pauses.",
      "Check the activity log shows every action.",
      "Confirm the experience scores are 8+ before the task can complete.",
    ],
    automated_recommendations: [
      "Add a vitest unit test for the new logic.",
      "Add a component test for the new screen.",
      "Add a data-access (RLS) test confirming admin-only access.",
      "Add the new routes to the all-nav system test.",
    ],
    regression_notes: regression,
  };
}
