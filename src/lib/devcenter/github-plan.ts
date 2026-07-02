/**
 * AI Dev Command Center — GitHub plan builder (Phase 11).
 *
 * Pure functions that PREPARE a branch name, a pull-request body, and a rollback
 * plan from a task and its records. Nothing here talks to GitHub or changes
 * anything — it only produces the text a human will approve before any real
 * branch/PR is ever created (a later phase).
 */
import type {
  DevApproval, DevFileChangePlan, DevReviewGate, DevTask, DevTaskMeta, ReviewGateType, RiskLevel,
} from "./types";
import { APPROVAL_TYPE_LABEL, APPROVAL_STATUS_META, REVIEW_STATUS_META } from "./labels";

const meta = (t: DevTask) => (t.metadata ?? {}) as DevTaskMeta;

/** Slugify a task title into a branch-safe segment. */
function safeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "") || "task";
}

/** Branch name: ai-dev/task-{taskId-short}-{safe-task-title} */
export function branchName(task: DevTask): string {
  const short = task.id.replace(/-/g, "").slice(0, 8);
  return `ai-dev/task-${short}-${safeTitle(task.title)}`;
}

export function prTitle(task: DevTask, template = "AI Dev: {task_title}"): string {
  return template.replace("{task_title}", task.title);
}

/** A plain-English rollback plan for the change. */
export function rollbackPlan(task: DevTask): string {
  const m = meta(task);
  const parts = ["Delete the branch / close the pull request — no production change has happened yet."];
  if (m.database_changes_allowed) parts.push("If a database change was applied to a preview branch, reset that branch database.");
  if (m.deployment_allowed) parts.push("If a preview was deployed, delete the preview deployment.");
  parts.push("Production is never touched in this phase, so there is nothing to roll back in production.");
  return parts.join(" ");
}

export interface PrInput {
  task: DevTask;
  filePlans: DevFileChangePlan[];
  reviewGates: DevReviewGate[];
  approvals: DevApproval[];
  agentsInvolved: string[];
}

export interface PrSection { label: string; lines: string[] }

function gateLine(gates: DevReviewGate[], type: ReviewGateType): string {
  const g = gates.find((x) => x.gate_type === type);
  if (!g) return "Not reviewed yet.";
  return `${REVIEW_STATUS_META[g.status].label}${g.summary ? ` — ${g.summary}` : ""}`;
}

/** The 10 pull-request sections, filled from the task's real records. */
export function prSections(input: PrInput): PrSection[] {
  const { task, filePlans, reviewGates, approvals, agentsInvolved } = input;
  const m = meta(task);
  const nonRejected = filePlans.filter((p) => p.status !== "rejected");
  const dbChanges = nonRejected.filter((p) => p.change_type === "migration");

  return [
    { label: "Task summary", lines: [task.title, task.description ?? ""].filter(Boolean) },
    { label: "Business goal", lines: [m.business_goal || "—"] },
    { label: "Files changed", lines: nonRejected.length ? nonRejected.map((p) => `${p.change_type}: ${p.file_path}`) : ["None"] },
    { label: "Database changes", lines: dbChanges.length ? dbChanges.map((p) => p.file_path) : ["None"] },
    { label: "AI agents involved", lines: agentsInvolved.length ? agentsInvolved : ["Dev Manager Agent"] },
    { label: "QA results", lines: [gateLine(reviewGates, "qa")] },
    { label: "Security review", lines: [gateLine(reviewGates, "security")] },
    { label: "Experience review", lines: [gateLine(reviewGates, "experience")] },
    { label: "Human approvals", lines: approvals.length ? approvals.map((a) => `${APPROVAL_TYPE_LABEL[a.approval_type]}: ${APPROVAL_STATUS_META[a.status].label}${a.decided_by ? ` (by ${a.decided_by})` : ""}`) : ["None requested yet"] },
    { label: "Rollback plan", lines: [rollbackPlan(task)] },
  ];
}

/** Render the PR sections to markdown (stored on the release artifact). */
export function prMarkdown(input: PrInput): string {
  return prSections(input)
    .map((s) => `## ${s.label}\n${s.lines.map((l) => (s.lines.length > 1 ? `- ${l}` : l)).join("\n")}`)
    .join("\n\n");
}

/** A short release-risk summary for the UI. */
export function releaseRisk(task: DevTask, filePlans: DevFileChangePlan[], approvals: DevApproval[]): { level: RiskLevel; notes: string[] } {
  const notes: string[] = [];
  const highPlans = filePlans.filter((p) => p.risk_level === "high" || p.risk_level === "critical").length;
  const pendingApprovals = approvals.filter((a) => a.status === "pending").length;
  if (highPlans) notes.push(`${highPlans} higher-risk file change${highPlans > 1 ? "s" : ""}.`);
  if (filePlans.some((p) => p.change_type === "migration")) notes.push("Includes a database change.");
  if (pendingApprovals) notes.push(`${pendingApprovals} approval${pendingApprovals > 1 ? "s" : ""} still waiting.`);
  if (!notes.length) notes.push("Low risk — additive changes only.");
  return { level: task.risk_level, notes };
}
