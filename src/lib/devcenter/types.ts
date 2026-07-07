/**
 * AI Software Development Command Center — manual table types (Phase 1).
 *
 * This project uses hand-written types (src/lib/types.ts), not generated Supabase
 * types, so these mirror the dev_* tables created in
 * supabase/migrations/20260627010000_dev_command_center.sql.
 *
 * All of these are INTERNAL, superadmin-only tables — never tenant/customer data.
 */

// ── Shared unions (mirror the SQL CHECK constraints) ─────────────────────────
export type RiskLevel = "low" | "medium" | "high" | "critical";

/** The ordered workflow stages a task moves through (Phase 5). */
export type WorkflowStage =
  | "intake" | "requirements_review" | "architecture_review" | "ui_ux_review"
  | "experience_review" | "code_plan" | "file_change_plan" | "approval_required"
  | "approved_for_drafting" | "code_draft" | "qa_review" | "security_review"
  | "experience_final_review" | "documentation" | "release_plan"
  | "human_final_approval" | "complete";

/** A task's status is its workflow stage, plus the two off-ramp states. */
export type DevTaskStatus = WorkflowStage | "rejected" | "blocked";

/**
 * The structured intake fields stored in dev_tasks.metadata (jsonb). Kept in
 * metadata (not columns) so Phase 3 needs only the status-constraint migration.
 */
export interface DevTaskMeta {
  business_goal?: string;
  feature_description?: string;
  who_uses_it?: string;
  data_involved?: string;
  ai_role?: string;
  success_criteria?: string;
  notes?: string;
  visual_reference?: string;  // base64 data URL of an uploaded reference image
  human_approval_required?: boolean;
  database_changes_allowed?: boolean;
  file_changes_allowed?: boolean;
  github_branch_allowed?: boolean;
  deployment_allowed?: boolean;
}

export type DevTaskPriority = "low" | "medium" | "high" | "urgent";

export type AgentRunPhase =
  | "plan" | "design" | "recommend" | "draft" | "test" | "review" | "document" | "other";

export type AgentRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type AgentMessageRole = "system" | "user" | "assistant" | "tool" | "thought";

export type ArtifactKind =
  | "plan" | "design" | "sql_draft" | "code_draft" | "doc" | "summary" | "test_plan" | "other";

/** Specific code-draft classification (Phase 8). */
export type ArtifactType =
  | "react_component" | "nextjs_route" | "server_action" | "api_route" | "supabase_sql"
  | "rls_policy" | "test_file" | "documentation" | "config_change" | "release_notes";

export type ArtifactStatus =
  | "draft" | "proposed" | "approved" | "rejected" | "applied" | "superseded"
  | "needs_review" | "revised" | "ready_for_branch";

export type FileChangeType =
  | "create" | "modify" | "delete" | "rename"
  | "migration" | "test" | "documentation" | "config";
export type FileChangeStatus =
  | "planned" | "needs_approval" | "approved" | "rejected" | "drafted" | "applied_later";

export type ReviewVerdict = "approved" | "changes_requested" | "rejected" | "pending";
export type SecurityVerdict = "pass" | "fail" | "needs_changes" | "pending";

export type TestKind = "unit" | "integration" | "system" | "lint" | "typecheck" | "qa" | "other";
export type TestStatus = "passed" | "failed" | "error" | "skipped" | "pending";

/** The 10 test types (Phase 16). */
export type TestType =
  | "unit" | "component" | "form_validation" | "route_loading" | "supabase_query"
  | "rls_access" | "approval_gate" | "agent_workflow" | "experience_review" | "audit_log";

export type ExperiencePerspective =
  | "ux" | "plain_english" | "accessibility" | "onboarding" | "simplification" | "other";

/** The full dangerous-action set the human approval gate covers. */
export type ApprovalType =
  | "database_change" | "auth_permission_change" | "rls_policy_change"
  | "file_write" | "file_delete" | "github_branch" | "pull_request"
  | "deployment" | "production_release" | "environment_variable_change"
  | "ai_tool_permission_change" | "delete_action";

export type ApprovalStatus =
  | "pending" | "approved" | "rejected" | "needs_revision" | "expired" | "cancelled";

export type DeploymentEnvironment = "preview" | "staging" | "production";
export type DeploymentStatus =
  // existing (kept)
  | "planned" | "branch_created" | "pr_open" | "preview_ready"
  | "merged" | "released" | "failed" | "rolled_back"
  // Phase 13 lifecycle
  | "not_started" | "pr_created" | "preview_pending" | "preview_failed"
  | "approved_for_production" | "production_released" | "cancelled";

export type AuditActorType = "agent" | "human" | "system";

export type AgentMemoryKind =
  | "approved_pattern" | "rejected_pattern" | "user_preference" | "lesson_learned"
  | "preferred_label" | "workflow_rule" | "security_rule" | "ux_rule"
  | "performance_rule" | "admin_support_rule" | "platform_standard";

export type FeedbackCategory =
  | "confusing_screen" | "wrong_recommendation" | "improvement" | "bug" | "other";
export type FeedbackStatus = "open" | "triaged" | "in_progress" | "resolved" | "wontfix";

/** The 8 quick feedback types (Phase 14). */
export type FeedbackType =
  | "helpful" | "confusing" | "wrong_recommendation" | "feature_request"
  | "broken_workflow" | "bad_wording" | "too_technical" | "too_many_steps";

// ── Review gates (Phase 9) ────────────────────────────────────────────────────
export type ReviewGateType =
  | "qa" | "security" | "experience" | "plain_english" | "admin_workflow" | "documentation"
  | "workflow" | "accessibility" | "performance";
export type ReviewGateStatus =
  | "pending" | "passed" | "failed" | "needs_revision" | "waived_by_admin";

export interface ReviewChecklistItem { label: string; passed: boolean; note?: string }

// ── Applied changes / working area (Phase 12) ─────────────────────────────────
export interface DevAppliedChange {
  id: string;
  task_id: string;
  artifact_id: string | null;
  file_path: string;
  change_type: string | null;
  content: string | null;
  rollback_note: string | null;
  dangerous: boolean;
  status: "applied" | "rolled_back";
  applied_by: string | null;
  applied_at: string;
  created_at: string;
  updated_at: string;
}

// ── GitHub workflow settings (Phase 11) ───────────────────────────────────────
export interface DevGithubSettings {
  id: string;
  repo_owner: string | null;
  repo_name: string | null;
  default_branch: string;
  protected_branch: string;
  branch_naming_format: string;
  pr_title_template: string;
  pr_body_template: string | null;
  created_at: string;
  updated_at: string;
}

export interface DevReviewGate {
  id: string;
  task_id: string;
  gate_type: ReviewGateType;
  agent_name: string | null;
  status: ReviewGateStatus;
  summary: string | null;
  checklist: ReviewChecklistItem[];
  required_fixes: string[];
  score: number | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

type Json = Record<string, unknown>;

// ── Row types ────────────────────────────────────────────────────────────────
export interface DevTask {
  id: string;
  title: string;
  description: string | null;
  target_area: string | null;
  priority: DevTaskPriority;
  status: DevTaskStatus;
  risk_level: RiskLevel;
  metadata: Json;
  source_suggestion_id?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DevAgent {
  id: string;
  key: string;
  name: string;
  role: string;
  description: string | null;
  system_prompt: string | null;
  allowed_tools: string[];
  restrictions: string[];
  model: string | null;
  is_manager: boolean;
  sort_order: number;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface DevAgentRun {
  id: string;
  task_id: string;
  agent_id: string | null;
  phase: AgentRunPhase;
  status: AgentRunStatus;
  input: Json;
  output: Json;
  model: string | null;
  tokens_used: number | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DevAgentMessage {
  id: string;
  run_id: string | null;
  task_id: string | null;
  agent_id: string | null;
  role: AgentMessageRole;
  content: string | null;
  structured: Json;
  seq: number | null;
  created_at: string;
}

export interface DevArtifact {
  id: string;
  task_id: string;
  run_id: string | null;
  kind: ArtifactKind;
  artifact_type: ArtifactType | null;   // Phase 8 code-draft classification
  title: string | null;
  description: string | null;
  path: string | null;                   // file_path_suggestion
  content: string | null;
  language: string | null;
  risk_level: RiskLevel | null;
  approval_required: boolean;
  structured: Json;
  status: ArtifactStatus;
  version: number;
  created_by: string | null;             // agent_name
  created_at: string;
  updated_at: string;
}

export interface DevFileChangePlan {
  id: string;
  task_id: string;
  artifact_id: string | null;
  file_path: string;
  change_type: FileChangeType;
  language: string | null;
  diff: string | null;            // proposed_diff
  rationale: string | null;       // reason
  proposed_summary: string | null;
  approval_required: boolean;
  risk_level: RiskLevel;
  status: FileChangeStatus;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DevCodeReview {
  id: string;
  task_id: string;
  run_id: string | null;
  artifact_id: string | null;
  reviewer_agent_id: string | null;
  summary: string | null;
  findings: unknown[];
  verdict: ReviewVerdict;
  risk_level: RiskLevel;
  status: "open" | "resolved";
  created_at: string;
  updated_at: string;
}

export interface DevTestResult {
  id: string;
  task_id: string;
  run_id: string | null;
  kind: TestKind;
  test_type: TestType | null;
  test_name: string | null;
  expected_result: string | null;
  actual_result: string | null;
  recommended_fix: string | null;
  created_by_agent: string | null;
  status: TestStatus;
  summary: string | null;
  passed: number;
  failed: number;
  skipped: number;
  details: Json;
  log: string | null;            // error_output
  created_at: string;
  updated_at: string;
}

export interface DevSecurityReview {
  id: string;
  task_id: string;
  run_id: string | null;
  reviewer_agent_id: string | null;
  summary: string | null;
  findings: unknown[];
  risk_level: RiskLevel;
  verdict: SecurityVerdict;
  status: "open" | "resolved";
  created_at: string;
  updated_at: string;
}

export interface DevExperienceReview {
  id: string;
  task_id: string;
  run_id: string | null;
  reviewer_agent_id: string | null;
  perspective: ExperiencePerspective;
  summary: string | null;
  findings: unknown[];
  score: number | null;
  verdict: ReviewVerdict;
  status: "open" | "resolved";
  created_at: string;
  updated_at: string;
}

export interface DevApproval {
  id: string;
  task_id: string | null;
  approval_type: ApprovalType;
  target_type: string | null;
  target_id: string | null;
  risk_level: RiskLevel;
  summary: string;
  proposed_change: string | null;
  reason: string | null;
  plain_english_summary: string | null;
  technical_summary: string | null;
  experience_impact: string | null;
  affected_files: string[];
  affected_tables: string[];
  details: Json;
  status: ApprovalStatus;
  requested_by: string | null;      // requested_by_agent
  decided_by: string | null;        // approved_by
  decided_at: string | null;
  decision_note: string | null;     // decision_notes
  created_at: string;
  updated_at: string;
}

export interface DevDeployment {
  id: string;
  task_id: string | null;
  approval_id: string | null;
  branch: string | null;
  pull_request_url: string | null;
  pr_number: number | null;
  preview_url: string | null;
  release_tag: string | null;
  commit_sha: string | null;
  environment: DeploymentEnvironment;
  status: DeploymentStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DevAuditEntry {
  id: string;
  task_id: string | null;
  actor_type: AuditActorType;
  actor_id: string | null;
  agent_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  risk_level: RiskLevel | null;
  detail: Json;
  created_at: string;
}

export interface DevAgentMemory {
  id: string;
  agent_id: string | null;
  task_id: string | null;
  kind: AgentMemoryKind;
  title: string | null;
  content: string | null;
  structured: Json;
  tags: string[];
  status: "active" | "archived";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DevToolPermission {
  id: string;
  agent_id: string;
  tool: string;
  allowed: boolean;
  requires_approval: boolean;
  scope: Json;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DevFeedback {
  id: string;
  task_id: string | null;
  screen: string | null;            // page_route
  category: FeedbackCategory;
  feedback_type: FeedbackType | null;
  risk_level: RiskLevel;
  message: string;
  status: FeedbackStatus;
  assigned_to: string | null;
  reviewed_by_agent: string | null;
  created_by: string | null;        // submitted_by
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}
