/**
 * Plain-English label maps for the AI Dev Command Center UI.
 *
 * The Command Center is operated by a non-engineer, so technical states are
 * translated into plain language and every status carries a word + icon (never
 * color alone). Shared by the badge components and the panels.
 */
import type {
  DevTaskStatus, DevTaskPriority, RiskLevel, ApprovalType, ApprovalStatus,
  AgentRunStatus, DeploymentStatus, TestStatus, SecurityVerdict, ReviewVerdict,
  ExperiencePerspective, AgentMemoryKind, FeedbackCategory,
} from "./types";

/** Tone of a badge — drives the shared color/shape classes. */
export type Tone = "neutral" | "info" | "success" | "warn" | "danger" | "violet";

export const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  info:    "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  warn:    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  danger:  "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  violet:  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

export const TONE_DOT: Record<Tone, string> = {
  neutral: "#94a3b8", info: "#3b82f6", success: "#10b981",
  warn: "#f59e0b", danger: "#ef4444", violet: "#8b5cf6",
};

interface Meta { label: string; tone: Tone }

// ── Task status ───────────────────────────────────────────────────────────────
export const TASK_STATUS_META: Record<DevTaskStatus, Meta> = {
  queued:            { label: "Waiting to start", tone: "neutral" },
  planning:          { label: "Planning",         tone: "info" },
  in_progress:       { label: "In progress",      tone: "info" },
  awaiting_approval: { label: "Needs your approval", tone: "violet" },
  in_review:         { label: "In review",        tone: "info" },
  blocked:           { label: "Blocked",          tone: "warn" },
  done:              { label: "Done",             tone: "success" },
  rejected:          { label: "Rejected",         tone: "neutral" },
  cancelled:         { label: "Cancelled",        tone: "neutral" },
  failed:            { label: "Failed",           tone: "danger" },
};

// ── Priority ──────────────────────────────────────────────────────────────────
export const PRIORITY_META: Record<DevTaskPriority, Meta> = {
  low:    { label: "Low",    tone: "neutral" },
  medium: { label: "Medium", tone: "info" },
  high:   { label: "High",   tone: "warn" },
  urgent: { label: "Urgent", tone: "danger" },
};

// ── Risk level ────────────────────────────────────────────────────────────────
export const RISK_META: Record<RiskLevel, Meta> = {
  low:      { label: "Low risk",      tone: "success" },
  medium:   { label: "Medium risk",   tone: "warn" },
  high:     { label: "High risk",     tone: "danger" },
  critical: { label: "Critical risk", tone: "danger" },
};

// ── Agent run status ──────────────────────────────────────────────────────────
export const RUN_STATUS_META: Record<AgentRunStatus, Meta> = {
  queued:    { label: "Waiting",   tone: "neutral" },
  running:   { label: "Working",   tone: "info" },
  succeeded: { label: "Finished",  tone: "success" },
  failed:    { label: "AI task failed", tone: "danger" },
  cancelled: { label: "Stopped",   tone: "neutral" },
};

// ── Approval ──────────────────────────────────────────────────────────────────
export const APPROVAL_TYPE_LABEL: Record<ApprovalType, string> = {
  database_change:           "Database change",
  auth_permission_change:    "Login permission change",
  file_write:                "Save code to a file",
  github_branch:             "Create a code branch",
  pull_request:              "Open a pull request",
  deployment:                "Deploy a preview",
  production_release:        "Release to production",
  delete_action:             "Delete something",
  ai_tool_permission_change: "Change an AI agent's permissions",
};

export const APPROVAL_STATUS_META: Record<ApprovalStatus, Meta> = {
  pending:   { label: "Waiting for you", tone: "violet" },
  approved:  { label: "Approved",        tone: "success" },
  rejected:  { label: "Rejected",        tone: "neutral" },
  expired:   { label: "Expired",         tone: "neutral" },
  cancelled: { label: "Cancelled",       tone: "neutral" },
};

// ── Deployment ────────────────────────────────────────────────────────────────
export const DEPLOYMENT_STATUS_META: Record<DeploymentStatus, Meta> = {
  planned:        { label: "Planned",          tone: "neutral" },
  branch_created: { label: "Branch created",   tone: "info" },
  pr_open:        { label: "Pull request open", tone: "info" },
  preview_ready:  { label: "Preview ready",    tone: "info" },
  merged:         { label: "Merged",           tone: "success" },
  released:       { label: "Released",         tone: "success" },
  failed:         { label: "Failed",           tone: "danger" },
  rolled_back:    { label: "Rolled back",      tone: "warn" },
};

// ── Test / review verdicts ────────────────────────────────────────────────────
export const TEST_STATUS_META: Record<TestStatus, Meta> = {
  passed:  { label: "Passed",  tone: "success" },
  failed:  { label: "Failed",  tone: "danger" },
  error:   { label: "Error",   tone: "danger" },
  skipped: { label: "Skipped", tone: "neutral" },
  pending: { label: "Not run yet", tone: "neutral" },
};

export const SECURITY_VERDICT_META: Record<SecurityVerdict, Meta> = {
  pass:          { label: "Looks safe",     tone: "success" },
  fail:          { label: "Problem found",  tone: "danger" },
  needs_changes: { label: "Needs changes",  tone: "warn" },
  pending:       { label: "Not reviewed yet", tone: "neutral" },
};

export const REVIEW_VERDICT_META: Record<ReviewVerdict, Meta> = {
  approved:          { label: "Approved",        tone: "success" },
  changes_requested: { label: "Changes requested", tone: "warn" },
  rejected:          { label: "Rejected",        tone: "danger" },
  pending:           { label: "Not reviewed yet", tone: "neutral" },
};

export const PERSPECTIVE_LABEL: Record<ExperiencePerspective, string> = {
  ux:             "Ease of use",
  plain_english:  "Plain language",
  accessibility:  "Accessibility",
  onboarding:     "First-time guidance",
  simplification: "Fewer steps",
  other:          "Other",
};

export const MEMORY_KIND_LABEL: Record<AgentMemoryKind, string> = {
  approved_pattern: "Approved pattern",
  rejected_pattern: "Rejected pattern",
  user_preference:  "Your preference",
  lesson_learned:   "Lesson learned",
};

export const FEEDBACK_CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  confusing_screen:     "Confusing screen",
  wrong_recommendation: "Wrong AI recommendation",
  improvement:          "Improvement idea",
  bug:                  "Something is broken",
  other:                "Other",
};

/**
 * Technical-phrase → plain-English translation, per the Phase 2 spec examples.
 * Used when surfacing raw error/log text to the operator.
 */
const PLAIN_ENGLISH: { pattern: RegExp; friendly: string }[] = [
  { pattern: /api route failure|api failure|route handler error/i, friendly: "Page Connection Issue" },
  { pattern: /database latency|db latency|slow quer/i,             friendly: "Database Running Slow" },
  { pattern: /auth policy error|authentication policy/i,           friendly: "Login Permission Issue" },
  { pattern: /agent execution failed|execution failed/i,           friendly: "AI Task Failed" },
  { pattern: /rls conflict|row level security|row-level security/i, friendly: "Data Access Rule Problem" },
  { pattern: /migration pending|pending migration/i,               friendly: "Database Change Needs Review" },
];

/** Translate a raw technical message into a friendlier one when we recognize it. */
export function toPlainEnglish(message: string): string {
  for (const { pattern, friendly } of PLAIN_ENGLISH) {
    if (pattern.test(message)) return friendly;
  }
  return message;
}
