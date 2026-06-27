/**
 * AI Dev Command Center — Workflow engine (Phase 5).
 *
 * The Dev Manager moves a task through an ordered set of stages. Each stage is
 * worked by one agent; the Dev Manager records the outcome and decides the next
 * stage. Gate stages pause for human approval. Dangerous actions create approval
 * requests. This module is the pure, deterministic definition + helpers — the
 * server action in actions/devcenter.ts drives it against Supabase.
 *
 * Phase 5 is manual (one click = one step) and runs no real AI yet: each step
 * produces a deterministic, plain-English summary so the flow is visible.
 */
import type { ApprovalType, DevTask, DevTaskMeta, RiskLevel, WorkflowStage } from "./types";

export const WORKFLOW_STAGES: WorkflowStage[] = [
  "intake", "requirements_review", "architecture_review", "ui_ux_review",
  "experience_review", "code_plan", "file_change_plan", "approval_required",
  "approved_for_drafting", "code_draft", "qa_review", "security_review",
  "experience_final_review", "documentation", "release_plan",
  "human_final_approval", "complete",
];

type Phase = "plan" | "design" | "recommend" | "draft" | "test" | "review" | "document" | "other";

export interface StageConfig {
  stage: WorkflowStage;
  /** Agent (registry/dev_agents key) that works this stage. */
  agentKey: string;
  /** Maps to dev_agent_runs.phase. */
  phase: Phase;
  /** A gate pauses the workflow until a human approves. */
  gate?: { approvalType: ApprovalType; summary: string };
  /** What the worker agent "did" at this stage (deterministic placeholder). */
  found: string;
}

export const STAGE_CONFIG: Record<WorkflowStage, StageConfig> = {
  intake: { stage: "intake", agentKey: "dev-manager", phase: "plan",
    found: "Logged the task and set up the workflow." },
  requirements_review: { stage: "requirements_review", agentKey: "product-requirements", phase: "plan",
    found: "Turned the request into clear requirements and acceptance criteria." },
  architecture_review: { stage: "architecture_review", agentKey: "platform-architect", phase: "design",
    found: "Decided how the feature fits the platform and which areas it touches." },
  ui_ux_review: { stage: "ui_ux_review", agentKey: "ui-ux", phase: "design",
    found: "Proposed the screen layout and user flow." },
  experience_review: { stage: "experience_review", agentKey: "human-experience", phase: "review",
    found: "Checked the plan for ease of use and flagged any confusion." },
  code_plan: { stage: "code_plan", agentKey: "platform-architect", phase: "plan",
    found: "Planned the code approach and the pieces to build." },
  file_change_plan: { stage: "file_change_plan", agentKey: "backend-api", phase: "recommend",
    found: "Listed the exact files that would change (proposed, not applied)." },
  approval_required: { stage: "approval_required", agentKey: "dev-manager", phase: "other",
    gate: { approvalType: "file_write", summary: "Approve the plan so the team can start drafting the code" },
    found: "Paused for your approval before any drafting begins." },
  approved_for_drafting: { stage: "approved_for_drafting", agentKey: "dev-manager", phase: "other",
    found: "Approval received — cleared the team to start drafting." },
  code_draft: { stage: "code_draft", agentKey: "frontend", phase: "draft",
    found: "Wrote the draft code for the change (saved as a draft, not applied)." },
  qa_review: { stage: "qa_review", agentKey: "qa-test", phase: "test",
    found: "Wrote and ran checks against the acceptance criteria." },
  security_review: { stage: "security_review", agentKey: "security-permissions", phase: "review",
    found: "Reviewed for login, data-access, and secret risks." },
  experience_final_review: { stage: "experience_final_review", agentKey: "human-experience", phase: "review",
    found: "Did a final ease-of-use and clarity pass." },
  documentation: { stage: "documentation", agentKey: "documentation", phase: "document",
    found: "Drafted the user and admin notes for the change." },
  release_plan: { stage: "release_plan", agentKey: "devops-release", phase: "plan",
    found: "Prepared a branch, pull request, and rollback plan (nothing deployed)." },
  human_final_approval: { stage: "human_final_approval", agentKey: "dev-manager", phase: "other",
    gate: { approvalType: "production_release", summary: "Final approval to mark this task complete and ready to release" },
    found: "Paused for your final approval before completing." },
  complete: { stage: "complete", agentKey: "dev-manager", phase: "other",
    found: "Task complete." },
};

/**
 * Which real planning agents run at each stage (Phase 6). The experience_review
 * stage runs the three experience agents so their review lands before code_plan.
 */
export const STAGE_PLANNERS: Partial<Record<WorkflowStage, string[]>> = {
  requirements_review: ["product-requirements"],
  architecture_review: ["platform-architect"],
  ui_ux_review: ["ui-ux"],
  experience_review: ["human-experience", "plain-english", "workflow-simplification"],
};

export function stageIndex(stage: WorkflowStage): number {
  return WORKFLOW_STAGES.indexOf(stage);
}

/** The stage after `stage`, or null if it's the last. */
export function nextStage(stage: WorkflowStage): WorkflowStage | null {
  const i = stageIndex(stage);
  if (i < 0 || i >= WORKFLOW_STAGES.length - 1) return null;
  return WORKFLOW_STAGES[i + 1];
}

export function isGate(stage: WorkflowStage): boolean {
  return !!STAGE_CONFIG[stage]?.gate;
}

export function isTerminal(status: string): boolean {
  return status === "complete" || status === "rejected";
}

/** Whether the given status is a real workflow stage (vs rejected/blocked). */
export function isWorkflowStage(status: string): status is WorkflowStage {
  return WORKFLOW_STAGES.includes(status as WorkflowStage);
}

// ── Risk checker ──────────────────────────────────────────────────────────────

export interface RiskAssessment {
  level: RiskLevel;
  /** Approval types this task will require, based on what it's allowed to touch. */
  requiredApprovals: ApprovalType[];
}

export function assessRisk(task: DevTask): RiskAssessment {
  const meta = (task.metadata ?? {}) as DevTaskMeta;
  const required: ApprovalType[] = [];
  if (meta.database_changes_allowed) required.push("database_change");
  if (meta.file_changes_allowed) required.push("file_write");
  if (meta.github_branch_allowed) required.push("github_branch", "pull_request");
  if (meta.deployment_allowed) required.push("deployment");
  return { level: task.risk_level, requiredApprovals: required };
}

// ── Dev Manager output (the 8-field decision) ─────────────────────────────────

export interface DevManagerUpdate {
  current_status: WorkflowStage;
  what_completed: string;
  agent_worked: string;
  what_found: string;
  risk_level: RiskLevel;
  required_approvals: ApprovalType[];
  next_agent: string;
  next_action: string;
}

/**
 * Build the Dev Manager's structured decision after a stage runs.
 * `agentName`/`nextAgentName` are display names looked up by the caller.
 */
export function buildDevManagerUpdate(opts: {
  task: DevTask;
  ranStage: WorkflowStage;
  agentName: string;
  next: WorkflowStage | null;
  nextAgentName: string | null;
  paused: boolean;
}): DevManagerUpdate {
  const { task, ranStage, agentName, next, nextAgentName, paused } = opts;
  const risk = assessRisk(task);
  const cfg = STAGE_CONFIG[ranStage];
  return {
    current_status: ranStage,
    what_completed: cfg.found,
    agent_worked: agentName,
    what_found: cfg.found,
    risk_level: risk.level,
    required_approvals: risk.requiredApprovals,
    next_agent: paused ? "You (approval needed)" : (nextAgentName ?? "—"),
    next_action: paused
      ? "Waiting for your approval before the next step."
      : next
        ? `Next: ${nextAgentName} will handle “${next.replace(/_/g, " ")}”.`
        : "All stages complete.",
  };
}
