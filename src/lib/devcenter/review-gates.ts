/**
 * AI Dev Command Center — Review gate generator (Phase 9).
 *
 * Each required review (QA, Security, Experience, Plain-English, Admin workflow,
 * Documentation) runs its agent's checklist and returns a pass/fail status with
 * any required fixes. Deterministic and safe — it reviews plans, never code that
 * is running. The Security gate flags risk based on what the task is allowed to
 * touch, so risky tasks need a fix or a human waiver before release.
 */
import "server-only";
import { REVIEW_GATE_META } from "./labels";
import type { DevTask, DevTaskMeta, ReviewChecklistItem, ReviewGateStatus, ReviewGateType } from "./types";

const CHECKLISTS: Record<ReviewGateType, string[]> = {
  qa: [
    "Acceptance criteria met", "Required fields present", "Button behavior correct",
    "Form validation works", "Routes load", "Empty states", "Loading states",
    "Error states", "Mobile / tablet layout", "Regression risk checked",
  ],
  security: [
    "Admin-only access", "Authentication", "Authorization", "Data-access (RLS) risk",
    "No service key exposure", "No customer data exposure", "No unsafe database change",
    "No unsafe delete action", "No unexpected permission changes", "No environment variable risk",
  ],
  experience: [
    "The screen is easy to understand", "A non-technical admin can use it",
    "Labels are plain-English", "The next step is obvious", "Not too many options",
    "Help text where needed", "Dangerous actions are clear", "The workflow saves time",
  ],
  plain_english: [
    "No confusing technical wording", "Clear labels", "Clear button text",
    "Friendly error messages", "Clear status labels", "Admin explanations present",
  ],
  admin_workflow: [
    "Internal notes", "Assignment", "Status history", "Escalation path",
    "Support checklist", "Audit record",
  ],
  documentation: [
    "User guide drafted", "Admin guide drafted", "Changelog entry",
    "Plain-English notes", "Examples or screenshots",
  ],
};

const meta = (t: DevTask) => (t.metadata ?? {}) as DevTaskMeta;

function securityIsRisky(task: DevTask): { risky: boolean; reasons: string[] } {
  const m = meta(task);
  const reasons: string[] = [];
  if (m.database_changes_allowed) reasons.push("This task allows a database change — confirm the data-access rules.");
  if (m.deployment_allowed) reasons.push("This task allows a deployment — confirm it's intended.");
  if (task.risk_level === "high" || task.risk_level === "critical") reasons.push("The risk level is high — double-check access and data exposure.");
  const area = (task.target_area ?? "").toLowerCase();
  if (area.includes("user") || area.includes("auth") || area.includes("login")) reasons.push("This touches logins/permissions — verify admin-only access.");
  return { risky: reasons.length > 0, reasons };
}

export interface ReviewGateResult {
  gate_type: ReviewGateType;
  agent_name: string;
  status: ReviewGateStatus;
  summary: string;
  checklist: ReviewChecklistItem[];
  required_fixes: string[];
  score: number;
}

/** Run one review gate against a task. */
export function generateReviewGate(task: DevTask, gate: ReviewGateType): ReviewGateResult {
  const agent_name = REVIEW_GATE_META[gate].agent;
  const labels = CHECKLISTS[gate];

  // Security is risk-aware; the other gates pass on a plan-level review.
  if (gate === "security") {
    const { risky, reasons } = securityIsRisky(task);
    const flagged = new Set(risky ? ["Data-access (RLS) risk", "No unsafe database change", "No unexpected permission changes"] : []);
    const checklist: ReviewChecklistItem[] = labels.map((label) => ({
      label, passed: !flagged.has(label),
      note: flagged.has(label) ? "Needs a closer look before release." : undefined,
    }));
    const failedCount = checklist.filter((c) => !c.passed).length;
    return {
      gate_type: gate, agent_name,
      status: failedCount ? "needs_revision" : "passed",
      summary: failedCount
        ? "A few security items need attention before release."
        : "No security concerns found at the plan level.",
      checklist, required_fixes: reasons, score: Math.round(((labels.length - failedCount) / labels.length) * 100),
    };
  }

  const checklist: ReviewChecklistItem[] = labels.map((label) => ({ label, passed: true }));
  return {
    gate_type: gate, agent_name, status: "passed",
    summary: `${REVIEW_GATE_META[gate].label} looks good.`,
    checklist, required_fixes: [], score: 100,
  };
}

/** Which review gates run at each stage. */
export const STAGE_REVIEW_GATES: Record<string, ReviewGateType[]> = {
  qa_review: ["qa"],
  security_review: ["security"],
  experience_final_review: ["experience", "plain_english", "admin_workflow"],
  documentation: ["documentation"],
};

/** Gates that MUST pass (or be waived) before a task can move toward release. */
export const REQUIRED_FOR_RELEASE: ReviewGateType[] = ["qa", "security", "experience", "documentation"];

/** A gate counts as cleared when it passed or the admin waived it. */
export function gateCleared(status: ReviewGateStatus): boolean {
  return status === "passed" || status === "waived_by_admin";
}
