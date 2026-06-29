/**
 * AI Software Development Command Center — query helpers (Phase 1).
 *
 * Server-only read/write helpers over the dev_* tables. They use the SSR cookie
 * client (createSupabaseServerClient), so every call runs UNDER RLS as the
 * signed-in operator — the dev_*_superadmin policies mean a non-superadmin sees
 * and writes nothing, even if these helpers are reached.
 *
 * MOCK_MODE-aware: with no Supabase configured the reads return safe empties and
 * the writes no-op, so the app still builds and runs without a database.
 *
 * Phase 1 scope: tasks + agents + the audit log, plus generic insert/list. The
 * agent-execution and approval-gate flows that write the review/deployment tables
 * arrive in later phases.
 */
import "server-only";
import { MOCK_MODE } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DevTask, DevTaskStatus, DevTaskPriority, RiskLevel,
  DevAgent, DevApproval, DevAuditEntry,
  DevAgentRun, DevAgentMessage, DevArtifact, DevFileChangePlan,
  DevCodeReview, DevTestResult, DevSecurityReview, DevExperienceReview, DevDeployment,
  DevReviewGate,
} from "./types";

/** Everything the task detail page needs, read from the live dev_* tables. */
export interface TaskDetail {
  task: DevTask | null;
  runs: DevAgentRun[];
  messages: DevAgentMessage[];
  artifacts: DevArtifact[];
  filePlans: DevFileChangePlan[];
  codeReviews: DevCodeReview[];
  testResults: DevTestResult[];
  securityReviews: DevSecurityReview[];
  experienceReviews: DevExperienceReview[];
  reviewGates: DevReviewGate[];
  approvals: DevApproval[];
  deployments: DevDeployment[];
  audit: DevAuditEntry[];
}

type ApprovalInsert = {
  task_id?: string | null;
  approval_type: DevApproval["approval_type"];
  target_type?: string | null;
  target_id?: string | null;
  risk_level?: RiskLevel;
  summary: string;
  proposed_change?: string | null;
  details?: Record<string, unknown>;
  requested_by?: string | null;
};

// ── Agents ───────────────────────────────────────────────────────────────────

/** The active agent roster, in display order. */
export async function getDevAgents(): Promise<DevAgent[]> {
  if (MOCK_MODE) return [];
  const client = await createSupabaseServerClient();
  if (!client) return [];
  const { data } = await client
    .from("dev_agents")
    .select("*")
    .eq("status", "active")
    .order("sort_order", { ascending: true });
  return (data ?? []) as DevAgent[];
}

export async function getDevAgentByKey(key: string): Promise<DevAgent | null> {
  if (MOCK_MODE) return null;
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const { data } = await client.from("dev_agents").select("*").eq("key", key).maybeSingle();
  return (data as DevAgent) ?? null;
}

// ── GitHub settings (Phase 11) ────────────────────────────────────────────────

import type { DevGithubSettings } from "./types";

const DEFAULT_GITHUB_SETTINGS: DevGithubSettings = {
  id: "", repo_owner: "John19930614", repo_name: "MACO", default_branch: "master",
  protected_branch: "master", branch_naming_format: "ai-dev/task-{taskId-short}-{safe-task-title}",
  pr_title_template: "AI Dev: {task_title}", pr_body_template: null,
  created_at: "", updated_at: "",
};

export async function getGithubSettings(): Promise<DevGithubSettings> {
  if (MOCK_MODE) return DEFAULT_GITHUB_SETTINGS;
  const client = await createSupabaseServerClient();
  if (!client) return DEFAULT_GITHUB_SETTINGS;
  const { data } = await client.from("dev_github_settings").select("*").order("created_at").limit(1).maybeSingle();
  return (data as DevGithubSettings) ?? DEFAULT_GITHUB_SETTINGS;
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export async function getDevTasks(opts: { status?: DevTaskStatus; limit?: number } = {}): Promise<DevTask[]> {
  if (MOCK_MODE) return [];
  const client = await createSupabaseServerClient();
  if (!client) return [];
  let q = client.from("dev_tasks").select("*").order("created_at", { ascending: false });
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as DevTask[];
}

export async function getDevTask(id: string): Promise<DevTask | null> {
  if (MOCK_MODE) return null;
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const { data } = await client.from("dev_tasks").select("*").eq("id", id).maybeSingle();
  return (data as DevTask) ?? null;
}

/**
 * Load a task and every related record for the detail page. Returns
 * { task: null, ... } when the id isn't a real task (so the page can fall back
 * to sample data for the Phase 2 example tasks).
 */
export async function getTaskDetail(id: string): Promise<TaskDetail> {
  const empty: TaskDetail = {
    task: null, runs: [], messages: [], artifacts: [], filePlans: [],
    codeReviews: [], testResults: [], securityReviews: [], experienceReviews: [],
    reviewGates: [], approvals: [], deployments: [], audit: [],
  };
  if (MOCK_MODE) return empty;
  const client = await createSupabaseServerClient();
  if (!client) return empty;

  const { data: task } = await client.from("dev_tasks").select("*").eq("id", id).maybeSingle();
  if (!task) return empty;

  const byTask = (table: string, order = "created_at", asc = true) =>
    client.from(table).select("*").eq("task_id", id).order(order, { ascending: asc });

  const [
    runs, messages, artifacts, filePlans, codeReviews,
    testResults, securityReviews, experienceReviews, reviewGates, approvals, deployments, audit,
  ] = await Promise.all([
    byTask("dev_agent_runs", "created_at", false),
    byTask("dev_agent_messages", "seq", true),
    byTask("dev_artifacts", "created_at", false),
    byTask("dev_file_change_plans", "created_at", false),
    byTask("dev_code_reviews", "created_at", false),
    byTask("dev_test_results", "created_at", false),
    byTask("dev_security_reviews", "created_at", false),
    byTask("dev_experience_reviews", "created_at", false),
    byTask("dev_review_gates", "created_at", true),
    byTask("dev_approvals", "created_at", false),
    byTask("dev_deployments", "created_at", false),
    byTask("dev_audit_log", "created_at", false),
  ]);

  return {
    task: task as DevTask,
    runs: (runs.data ?? []) as DevAgentRun[],
    messages: (messages.data ?? []) as DevAgentMessage[],
    artifacts: (artifacts.data ?? []) as DevArtifact[],
    filePlans: (filePlans.data ?? []) as DevFileChangePlan[],
    codeReviews: (codeReviews.data ?? []) as DevCodeReview[],
    testResults: (testResults.data ?? []) as DevTestResult[],
    securityReviews: (securityReviews.data ?? []) as DevSecurityReview[],
    experienceReviews: (experienceReviews.data ?? []) as DevExperienceReview[],
    reviewGates: (reviewGates.data ?? []) as DevReviewGate[],
    approvals: (approvals.data ?? []) as DevApproval[],
    deployments: (deployments.data ?? []) as DevDeployment[],
    audit: (audit.data ?? []) as DevAuditEntry[],
  };
}

export async function createDevTask(input: {
  title: string;
  description?: string;
  target_area?: string;
  priority?: DevTaskPriority;
  risk_level?: RiskLevel;
  created_by?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (MOCK_MODE) return { ok: false, error: "Mock mode — no database." };
  const client = await createSupabaseServerClient();
  if (!client) return { ok: false, error: "Session expired — please reload." };
  const { data, error } = await client
    .from("dev_tasks")
    .insert({
      title: input.title,
      description: input.description ?? null,
      target_area: input.target_area ?? null,
      priority: input.priority ?? "medium",
      risk_level: input.risk_level ?? "low",
      created_by: input.created_by ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id as string };
}

export async function updateDevTaskStatus(
  id: string,
  status: DevTaskStatus,
): Promise<{ ok: boolean; error?: string }> {
  if (MOCK_MODE) return { ok: false, error: "Mock mode — no database." };
  const client = await createSupabaseServerClient();
  if (!client) return { ok: false, error: "Session expired — please reload." };
  const { error } = await client.from("dev_tasks").update({ status }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ── Approvals (the human gate — read + request; deciding comes in a later phase) ─

/** Every approval across all tasks — the Approval Center queue (newest first). */
export async function getAllApprovals(limit = 100): Promise<DevApproval[]> {
  if (MOCK_MODE) return [];
  const client = await createSupabaseServerClient();
  if (!client) return [];
  const { data } = await client
    .from("dev_approvals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as DevApproval[];
}

export async function getPendingApprovals(limit = 50): Promise<DevApproval[]> {
  if (MOCK_MODE) return [];
  const client = await createSupabaseServerClient();
  if (!client) return [];
  const { data } = await client
    .from("dev_approvals")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as DevApproval[];
}

export async function getApprovalsForTask(taskId: string): Promise<DevApproval[]> {
  if (MOCK_MODE) return [];
  const client = await createSupabaseServerClient();
  if (!client) return [];
  const { data } = await client
    .from("dev_approvals")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  return (data ?? []) as DevApproval[];
}

/** Create a pending approval request (an agent asks the human to decide). */
export async function requestApproval(input: ApprovalInsert): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (MOCK_MODE) return { ok: false, error: "Mock mode — no database." };
  const client = await createSupabaseServerClient();
  if (!client) return { ok: false, error: "Session expired — please reload." };
  const { data, error } = await client
    .from("dev_approvals")
    .insert({
      task_id: input.task_id ?? null,
      approval_type: input.approval_type,
      target_type: input.target_type ?? null,
      target_id: input.target_id ?? null,
      risk_level: input.risk_level ?? "high",
      summary: input.summary,
      proposed_change: input.proposed_change ?? null,
      details: input.details ?? {},
      requested_by: input.requested_by ?? null,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id as string };
}

// ── Audit log (append-only) ───────────────────────────────────────────────────

export async function logDevAudit(entry: {
  task_id?: string | null;
  actor_type?: DevAuditEntry["actor_type"];
  actor_id?: string | null;
  agent_id?: string | null;
  action: string;
  entity?: string | null;
  entity_id?: string | null;
  risk_level?: RiskLevel | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  if (MOCK_MODE) return;
  const client = await createSupabaseServerClient();
  if (!client) return;
  await client.from("dev_audit_log").insert({
    task_id: entry.task_id ?? null,
    actor_type: entry.actor_type ?? "system",
    actor_id: entry.actor_id ?? null,
    agent_id: entry.agent_id ?? null,
    action: entry.action,
    entity: entry.entity ?? null,
    entity_id: entry.entity_id ?? null,
    risk_level: entry.risk_level ?? null,
    detail: entry.detail ?? {},
  });
}

export async function getDevAuditLog(opts: { taskId?: string; limit?: number } = {}): Promise<DevAuditEntry[]> {
  if (MOCK_MODE) return [];
  const client = await createSupabaseServerClient();
  if (!client) return [];
  let q = client.from("dev_audit_log").select("*").order("created_at", { ascending: false });
  if (opts.taskId) q = q.eq("task_id", opts.taskId);
  q = q.limit(opts.limit ?? 100);
  const { data } = await q;
  return (data ?? []) as DevAuditEntry[];
}
