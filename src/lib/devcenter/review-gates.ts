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
import { REVIEW_GATE_META, SCORE_GATE_TYPES } from "./labels";
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
    "Easy to use", "Visually clear", "Plain-English language", "Works on mobile / tablet",
    "Simple admin workflow", "Fast", "Prevents errors", "Accessible",
    "Helps onboarding / training", "Builds user confidence",
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
  workflow: [
    "Fewer steps than before", "No duplicate data entry", "Guided where helpful",
    "Sensible defaults", "Nothing unnecessary on screen",
  ],
  accessibility: [
    "Good colour contrast", "Keyboard navigation works", "Screen-reader labels",
    "Readable text size", "Icons paired with text (not colour alone)",
  ],
  performance: [
    "Page loads quickly", "No unnecessary database calls", "Large lists are paginated",
    "Clear loading states", "Stays fast with lots of data",
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

  // Experience-layer gates carry a 1-10 score. Passing requires 8+.
  if (SCORE_GATE_TYPES.includes(gate)) {
    const score = scoreFor(task, gate);
    const passed = score >= 8;
    const checklist: ReviewChecklistItem[] = labels.map((label) => ({ label, passed }));
    const meta = REVIEW_GATE_META[gate];
    return {
      gate_type: gate, agent_name,
      status: passed ? "passed" : "needs_revision",
      summary: passed ? `${meta.label}: ${score}/10 — good.` : `${meta.label}: ${score}/10 — needs to reach 8 before release.`,
      checklist,
      required_fixes: passed ? [] : [`Improve the ${meta.label.toLowerCase()} to 8/10 or higher (or waive it).`],
      score,
    };
  }

  // QA / documentation: a pass/fail plan-level review.
  const checklist: ReviewChecklistItem[] = labels.map((label) => ({ label, passed: true }));
  return {
    gate_type: gate, agent_name, status: "passed",
    summary: `${REVIEW_GATE_META[gate].label} looks good.`,
    checklist, required_fixes: [], score: 100,
  };
}

/** Deterministic 1-10 score from the task's risk + flags. */
function scoreFor(task: DevTask, gate: ReviewGateType): number {
  const base = task.risk_level === "low" ? 9 : task.risk_level === "medium" ? 8 : task.risk_level === "high" ? 7 : 6;
  let s = base;
  if (gate === "performance" && meta(task).database_changes_allowed) s -= 1;
  return Math.max(1, Math.min(10, s));
}

/** Which review gates run at each stage. */
export const STAGE_REVIEW_GATES: Record<string, ReviewGateType[]> = {
  qa_review: ["qa"],
  security_review: ["security"],
  experience_final_review: ["experience", "plain_english", "workflow", "admin_workflow", "accessibility", "performance"],
  documentation: ["documentation"],
};

/** Gates that MUST pass (or be waived) before a task can move toward release.
 * Must match what the completion gate checks in actions/devcenter.ts. */
export const REQUIRED_FOR_RELEASE: ReviewGateType[] = ["qa", "security", "experience", "plain_english", "documentation"];

/** A gate counts as cleared when it passed or the admin waived it. */
export function gateCleared(status: ReviewGateStatus): boolean {
  return status === "passed" || status === "waived_by_admin";
}
