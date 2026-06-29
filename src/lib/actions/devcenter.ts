"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSuperadmin, getServerUser } from "@/lib/auth/session";
import { MOCK_MODE } from "@/lib/env";
import type { DevTask, DevFileChangePlan, DevReviewGate, DevApproval } from "@/lib/devcenter/types";
import {
  STAGE_CONFIG, STAGE_PLANNERS, nextStage, isGate, isTerminal, isWorkflowStage, buildDevManagerUpdate,
} from "@/lib/devcenter/workflow";
import { branchName, prMarkdown, rollbackPlan } from "@/lib/devcenter/github-plan";
import { checkPath, isDestructive } from "@/lib/devcenter/path-safety";
import { APPROVAL_TYPE_LABEL } from "@/lib/devcenter/labels";
import { releaseNotesMarkdown, type ReleaseDetail } from "@/lib/devcenter/release";
import { recordMemory } from "@/lib/devcenter/memory";
import { runPlanningAgent } from "@/lib/devcenter/planning-agents";
import { generateFilePlans } from "@/lib/devcenter/file-plans";
import { generateCodeDrafts } from "@/lib/devcenter/code-drafts";
import { generateReviewGate, STAGE_REVIEW_GATES, REQUIRED_FOR_RELEASE, gateCleared } from "@/lib/devcenter/review-gates";
import type { ReviewGateStatus } from "@/lib/devcenter/types";

const nowIso = () => new Date().toISOString();

export interface CreateTaskState {
  error?: string;
}

const schema = z.object({
  title: z.string().trim().min(3, "Please give the task a short title."),
  business_goal: z.string().trim().optional().default(""),
  feature_description: z.string().trim().optional().default(""),
  module_affected: z.string().trim().optional().default(""),
  who_uses_it: z.string().trim().optional().default(""),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  risk_level: z.enum(["low", "medium", "high", "critical"]).default("low"),
  data_involved: z.string().trim().optional().default(""),
  ai_role: z.string().trim().optional().default(""),
  success_criteria: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
});

const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";

/**
 * Create a new dev task (Phase 3 — real Supabase write).
 * Inserts the task (status 'intake'), an audit entry (task_created), and the
 * initial timeline message, then redirects to the task detail page.
 *
 * Superadmin-only and RLS-gated: the SSR client runs as the signed-in operator,
 * so the dev_*_superadmin policies reject anyone who isn't a Reliance admin.
 */
export async function createDevTask(
  _prev: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  if (MOCK_MODE) {
    return { error: "Saving tasks needs the live database — this preview is in demo mode." };
  }
  if (!(await isSuperadmin())) {
    return { error: "You don't have permission to create tasks." };
  }
  const client = await createSupabaseServerClient();
  if (!client) return { error: "Your session expired — please reload and try again." };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  const v = parsed.data;

  // Safety controls — dangerous options default OFF; human approval defaults ON.
  const metadata = {
    business_goal: v.business_goal,
    feature_description: v.feature_description,
    who_uses_it: v.who_uses_it,
    data_involved: v.data_involved,
    ai_role: v.ai_role,
    success_criteria: v.success_criteria,
    notes: v.notes,
    // Human approval is always required — it's the core safety guarantee and is
    // not user-disablable. The four below default OFF and are explicit opt-ins.
    human_approval_required: true,
    database_changes_allowed: bool(formData, "database_changes_allowed"),
    file_changes_allowed: bool(formData, "file_changes_allowed"),
    github_branch_allowed: bool(formData, "github_branch_allowed"),
    deployment_allowed: bool(formData, "deployment_allowed"),
  };

  const createdBy = (await getServerUser())?.display_name ?? "Reliance Admin";

  const { data, error } = await client
    .from("dev_tasks")
    .insert({
      title: v.title,
      description: v.feature_description || null,
      target_area: v.module_affected || null,
      priority: v.priority,
      risk_level: v.risk_level,
      status: "intake",
      metadata,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not save the task. Please try again." };
  }
  const taskId = data.id as string;

  // Best-effort audit + initial timeline message — never block task creation on these.
  await client.from("dev_audit_log").insert({
    task_id: taskId,
    actor_type: "human",
    actor_id: createdBy,
    action: "task_created",
    entity: "dev_tasks",
    entity_id: taskId,
    risk_level: v.risk_level,
    detail: { title: v.title },
  });
  await client.from("dev_agent_messages").insert({
    task_id: taskId,
    role: "system",
    content: "Task created and added to the queue. Waiting for the AI team to start.",
    seq: 1,
  });

  revalidatePath("/admin/dev-command/tasks");
  revalidatePath("/admin/dev-command");
  redirect(`/admin/dev-command/tasks/${taskId}`);
}

// ── Phase 5: workflow engine (Dev Manager) ────────────────────────────────────

export interface RunStepState {
  ok: boolean;
  message?: string;
  paused?: boolean;
}

/**
 * Run the next workflow step for a task (the "Run Next Agent Step" button).
 * Deterministic and manual — one click = one stage. The Dev Manager records an
 * agent run, two timeline messages, and an audit entry; gate stages create an
 * approval request and pause until you approve. No real AI/file/deploy actions.
 */
export async function runNextStep(taskId: string): Promise<RunStepState> {
  if (MOCK_MODE) return { ok: false, message: "Running steps needs the live database." };
  if (!(await isSuperadmin())) return { ok: false, message: "You don't have permission for this." };
  const client = await createSupabaseServerClient();
  if (!client) return { ok: false, message: "Your session expired — please reload." };

  const { data: taskRow } = await client.from("dev_tasks").select("*").eq("id", taskId).maybeSingle();
  if (!taskRow) return { ok: false, message: "Task not found." };
  const task = taskRow as DevTask;
  const status = task.status;

  if (isTerminal(status)) return { ok: false, message: "This task is already finished." };
  if (status === "blocked") return { ok: false, message: "This task is paused. Reopen it to continue." };
  if (!isWorkflowStage(status)) return { ok: false, message: "This task isn't in the workflow." };

  // Agent lookup (key → id/name).
  const { data: agentRows } = await client.from("dev_agents").select("id, key, name");
  const byKey = new Map((agentRows ?? []).map((a) => [a.key as string, a]));
  const nameOf = (key: string) => (byKey.get(key)?.name as string) ?? key;
  const idOf = (key: string) => (byKey.get(key)?.id as string) ?? null;

  // Gate: if we're sitting on a gate stage, its approval must be GRANTED to move on.
  if (isGate(status)) {
    const { data: appr } = await client.from("dev_approvals")
      .select("status").eq("task_id", taskId)
      .eq("approval_type", STAGE_CONFIG[status].gate!.approvalType)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!appr || appr.status !== "approved") {
      const message = appr?.status === "rejected"
        ? "This step was rejected — the task is paused."
        : appr?.status === "needs_revision"
          ? "This step needs changes before it can continue."
          : "Waiting for your approval before continuing.";
      return { ok: false, paused: true, message };
    }
  }

  const next = nextStage(status);
  if (!next) return { ok: false, message: "There are no further steps." };
  const cfg = STAGE_CONFIG[next];
  const workerId = idOf(cfg.agentKey);
  const workerName = nameOf(cfg.agentKey);
  const entersGate = !!cfg.gate;

  // Phase 9: block the move toward release until the required reviews are cleared
  // (passed or waived) and there are no approvals still waiting.
  if (next === "release_plan") {
    const { data: gateRows } = await client.from("dev_review_gates").select("gate_type, status").eq("task_id", taskId);
    const byType = new Map((gateRows ?? []).map((g) => [g.gate_type as string, g.status as ReviewGateStatus]));
    const missing = REQUIRED_FOR_RELEASE.filter((g) => !gateCleared(byType.get(g) ?? "pending"));
    const { count: pendingAppr } = await client.from("dev_approvals")
      .select("*", { count: "exact", head: true }).eq("task_id", taskId).eq("status", "pending");
    if (missing.length || (pendingAppr ?? 0) > 0) {
      const parts: string[] = [];
      if (missing.length) parts.push(`${missing.length} review(s) not passed yet`);
      if ((pendingAppr ?? 0) > 0) parts.push(`${pendingAppr} approval(s) still waiting`);
      return { ok: false, paused: true, message: `Can't move to release — ${parts.join(" and ")}. Pass, waive, or approve them below, then try again.` };
    }
  }

  // Phase 15: a task cannot be marked COMPLETE unless the experience layer and
  // required reviews are cleared and the final human approval is in place.
  if (next === "complete") {
    const { data: gateRows } = await client.from("dev_review_gates").select("gate_type, status").eq("task_id", taskId);
    const cleared = (t: string) => {
      const g = (gateRows ?? []).find((x) => x.gate_type === t);
      return !!g && (g.status === "passed" || g.status === "waived_by_admin");
    };
    const need: string[] = [];
    if (!cleared("experience")) need.push("Experience review (8+)");
    if (!cleared("plain_english")) need.push("Plain-English review (8+)");
    if (!cleared("security")) need.push("Security review");
    if (!cleared("qa")) need.push("QA review");
    if (!cleared("documentation")) need.push("Documentation review");
    const { data: prodAppr } = await client.from("dev_approvals")
      .select("id").eq("task_id", taskId).eq("approval_type", "production_release").eq("status", "approved").maybeSingle();
    if (!prodAppr) need.push("Final human approval");
    if (need.length) {
      return { ok: false, paused: true, message: `Can't mark complete — still needed: ${need.join(", ")}. Pass or waive them first.` };
    }
  }

  let seq = Date.now() % 1_000_000;
  const nextSeq = () => seq++;

  // 1. Run the stage. Planning stages (Phase 6) run real planning agents — one
  // run + artifact + message + audit per agent. Other stages get one stage run.
  const planners = STAGE_PLANNERS[next] ?? [];
  if (planners.length) {
    for (const key of planners) {
      const result = await runPlanningAgent(key, task);
      const aId = idOf(key);
      const { data: prun } = await client.from("dev_agent_runs").insert({
        task_id: taskId, agent_id: aId, phase: cfg.phase, status: "succeeded",
        input: { stage: next, agent: key }, output: result?.structured ?? { note: "no output" },
        model: result?.aiBacked ? "ai" : "heuristic", started_at: nowIso(), finished_at: nowIso(),
      }).select("id").single();
      if (!result) continue;
      await client.from("dev_artifacts").insert({
        task_id: taskId, run_id: prun?.id ?? null, kind: result.kind,
        title: `${result.label} — plan`, content: result.content, structured: result.structured,
        status: "proposed", created_by: `${result.label} Agent`,
      });
      await client.from("dev_agent_messages").insert({
        task_id: taskId, run_id: prun?.id ?? null, agent_id: aId, role: "assistant",
        content: `${result.label}: produced a structured plan${result.aiBacked ? " (AI-written)" : ""}.`,
        structured: result.structured, seq: nextSeq(),
      });
      await client.from("dev_audit_log").insert({
        task_id: taskId, actor_type: "agent", actor_id: key, agent_id: aId,
        action: "planning_output", entity: "dev_artifacts", entity_id: taskId,
        risk_level: task.risk_level, detail: { agent: key, ai_backed: result.aiBacked },
      });
    }
  } else {
    const { data: run } = await client.from("dev_agent_runs").insert({
      task_id: taskId, agent_id: workerId, phase: cfg.phase, status: "succeeded",
      input: { stage: next }, output: { summary: cfg.found },
      started_at: nowIso(), finished_at: nowIso(),
    }).select("id").single();
    await client.from("dev_agent_messages").insert({
      task_id: taskId, run_id: run?.id ?? null, agent_id: workerId, role: "assistant", content: cfg.found, seq: nextSeq(),
    });
  }

  // 1b. Phase 7: the file_change_plan stage produces proposed file changes
  // (plans only — nothing is written to disk or the database).
  if (next === "file_change_plan") {
    const plans = generateFilePlans(task);
    for (const p of plans) {
      const { data: fp } = await client.from("dev_file_change_plans").insert({
        task_id: taskId, file_path: p.file_path, change_type: p.change_type, language: p.language,
        diff: p.diff, rationale: p.rationale, proposed_summary: p.proposed_summary,
        approval_required: p.approval_required, risk_level: p.risk_level,
        status: p.approval_required ? "needs_approval" : "planned",
      }).select("id").single();
      await client.from("dev_audit_log").insert({
        task_id: taskId, actor_type: "agent", actor_id: "backend-api", agent_id: idOf("backend-api"),
        action: "file_plan_created", entity: "dev_file_change_plans", entity_id: fp?.id ?? taskId,
        risk_level: p.risk_level, detail: { file_path: p.file_path, change_type: p.change_type },
      });
    }
  }

  // 1c. Phase 8: the code_draft stage produces code/SQL/test/doc DRAFTS
  // (artifacts only — nothing is written to the codebase or database).
  if (next === "code_draft") {
    const { data: planRows } = await client.from("dev_file_change_plans")
      .select("file_path, change_type, risk_level, proposed_summary, status")
      .eq("task_id", taskId).neq("status", "rejected");
    const plans = planRows && planRows.length
      ? planRows.map((r) => ({ file_path: r.file_path as string, change_type: r.change_type, risk_level: r.risk_level, proposed_summary: r.proposed_summary as string | null }))
      : generateFilePlans(task).map((p) => ({ file_path: p.file_path, change_type: p.change_type, risk_level: p.risk_level, proposed_summary: p.proposed_summary }));
    for (const d of generateCodeDrafts(task, plans)) {
      const kind = d.artifact_type === "supabase_sql" || d.artifact_type === "rls_policy"
        ? "sql_draft"
        : d.artifact_type === "documentation" || d.artifact_type === "release_notes" ? "doc" : "code_draft";
      const { data: art } = await client.from("dev_artifacts").insert({
        task_id: taskId, kind, artifact_type: d.artifact_type, title: d.title, description: d.description,
        path: d.file_path_suggestion, content: d.content, language: d.language, risk_level: d.risk_level,
        approval_required: d.approval_required, structured: d.structured, status: "needs_review", created_by: d.agent_name,
      }).select("id").single();
      await client.from("dev_audit_log").insert({
        task_id: taskId, actor_type: "agent", actor_id: d.agent_name, agent_id: null,
        action: "code_draft_created", entity: "dev_artifacts", entity_id: art?.id ?? taskId,
        risk_level: d.risk_level, detail: { artifact_type: d.artifact_type, file: d.file_path_suggestion },
      });
    }
  }

  // 1d. Phase 9: review stages run their required review gates.
  for (const gateType of STAGE_REVIEW_GATES[next] ?? []) {
    const r = generateReviewGate(task, gateType);
    await client.from("dev_review_gates").upsert({
      task_id: taskId, gate_type: r.gate_type, agent_name: r.agent_name, status: r.status,
      summary: r.summary, checklist: r.checklist, required_fixes: r.required_fixes, score: r.score,
    }, { onConflict: "task_id,gate_type" });
    await client.from("dev_audit_log").insert({
      task_id: taskId, actor_type: "agent", actor_id: r.agent_name, agent_id: null,
      action: `review_${r.status}`, entity: "dev_review_gates", entity_id: taskId,
      risk_level: task.risk_level, detail: { gate: r.gate_type, status: r.status },
    });
    // Phase 14: record a reusable lesson from the review.
    if (gateType === "security" && r.status === "needs_revision" && r.required_fixes.length) {
      await recordMemory(client, { kind: "security_rule", title: `Security watch: ${task.target_area ?? "platform"}`, content: r.required_fixes.join(" "), taskId, createdBy: r.agent_name });
    } else if (gateType === "experience") {
      await recordMemory(client, { kind: "ux_rule", title: `Experience lesson: ${task.target_area ?? "platform"}`, content: r.summary, taskId, createdBy: r.agent_name });
    }
  }

  // 1e. Phase 11: the release_plan stage prepares a GitHub branch + PR plan and a
  // deployment placeholder. It performs NO GitHub action and touches no production.
  if (next === "release_plan") {
    const [fp, rg, ap] = await Promise.all([
      client.from("dev_file_change_plans").select("*").eq("task_id", taskId),
      client.from("dev_review_gates").select("*").eq("task_id", taskId),
      client.from("dev_approvals").select("*").eq("task_id", taskId),
    ]);
    const filePlans = (fp.data ?? []) as DevFileChangePlan[];
    const reviewGates = (rg.data ?? []) as DevReviewGate[];
    const approvals = (ap.data ?? []) as DevApproval[];
    const agentsInvolved = [...new Set(reviewGates.map((g) => g.agent_name).filter(Boolean) as string[])];
    const branch = branchName(task);
    const pr = prMarkdown({ task, filePlans, reviewGates, approvals, agentsInvolved });
    const rollback = rollbackPlan(task);

    await client.from("dev_deployments").insert({
      task_id: taskId, branch, environment: "preview", status: "planned",
      notes: rollback, created_by: "DevOps/Release Agent",
    });
    await client.from("dev_artifacts").insert({
      task_id: taskId, kind: "doc", artifact_type: "release_notes",
      title: "Release plan & pull request", description: "Prepared PR text + rollback plan. No GitHub action taken.",
      content: pr, language: "md", risk_level: task.risk_level, approval_required: true,
      status: "needs_review", created_by: "DevOps/Release Agent", structured: { branch, rollback },
    });
    await client.from("dev_audit_log").insert({
      task_id: taskId, actor_type: "agent", actor_id: "devops-release", agent_id: idOf("devops-release"),
      action: "branch_plan_prepared", entity: "dev_deployments", entity_id: taskId,
      risk_level: task.risk_level, detail: { branch },
    });
  }

  // 2. Dev Manager decision message.
  const after = nextStage(next);
  const dm = buildDevManagerUpdate({
    task, ranStage: next, agentName: workerName, next: after,
    nextAgentName: after ? nameOf(STAGE_CONFIG[after].agentKey) : null, paused: entersGate,
  });
  await client.from("dev_agent_messages").insert({
    task_id: taskId, agent_id: idOf("dev-manager"), role: "assistant",
    content: `Dev Manager: ${workerName} finished “${next.replace(/_/g, " ")}”. ${dm.next_action}`,
    structured: dm, seq: nextSeq(),
  });

  // 3. Audit the stage advance.
  await client.from("dev_audit_log").insert({
    task_id: taskId, actor_type: "agent", actor_id: cfg.agentKey, agent_id: workerId,
    action: "stage_advanced", entity: "dev_tasks", entity_id: taskId,
    risk_level: task.risk_level, detail: { from: status, to: next, agent: workerName },
  });

  // 4. Gate stage → create the (enriched) approval request and pause.
  if (entersGate) {
    const { data: planRows } = await client.from("dev_file_change_plans")
      .select("file_path, change_type").eq("task_id", taskId).neq("status", "rejected");
    const affectedFiles = (planRows ?? []).map((r) => r.file_path as string);
    const affectedTables = (planRows ?? []).some((r) => r.change_type === "migration")
      ? ["A database change is drafted — see the migration draft."] : [];
    const isRelease = cfg.gate!.approvalType === "production_release";
    await client.from("dev_approvals").insert({
      task_id: taskId, approval_type: cfg.gate!.approvalType, risk_level: task.risk_level,
      summary: cfg.gate!.summary, requested_by: "Dev Manager Agent", status: "pending",
      target_type: "dev_tasks", target_id: taskId,
      reason: isRelease ? "The task is ready and needs your final go-ahead to complete." : "The team is ready to start building and needs your go-ahead first.",
      plain_english_summary: cfg.gate!.summary,
      technical_summary: `Approval type: ${cfg.gate!.approvalType}. Stage: ${next.replace(/_/g, " ")}. Nothing is applied until you approve.`,
      experience_impact: "Keeps you in control — nothing risky happens without your yes.",
      affected_files: affectedFiles,
      affected_tables: affectedTables,
    });
    await client.from("dev_audit_log").insert({
      task_id: taskId, actor_type: "agent", actor_id: "dev-manager", agent_id: idOf("dev-manager"),
      action: "approval_requested", entity: "dev_approvals", entity_id: taskId,
      risk_level: task.risk_level, detail: { approval_type: cfg.gate!.approvalType },
    });
  }

  // 5. Advance the task.
  await client.from("dev_tasks").update({ status: next }).eq("id", taskId);

  revalidatePath(`/admin/dev-command/tasks/${taskId}`);
  revalidatePath("/admin/dev-command/tasks");
  revalidatePath("/admin/dev-command");
  return {
    ok: true, paused: entersGate,
    message: entersGate
      ? "Reached an approval step — your approval is needed to continue."
      : `Moved to “${next.replace(/_/g, " ")}”.`,
  };
}

/**
 * Approve or reject a pending approval (the real human gate). Approving lets the
 * next "Run Next Agent Step" continue; rejecting pauses the task.
 */
export async function decideApproval(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (MOCK_MODE) return { ok: false, error: "Approvals need the live database." };
  if (!(await isSuperadmin())) return { ok: false, error: "You don't have permission for this." };
  const client = await createSupabaseServerClient();
  if (!client) return { ok: false, error: "Your session expired — please reload." };

  const id = String(formData.get("approval_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = (String(formData.get("note") ?? "").trim() || null) as string | null;
  if (!id || (decision !== "approved" && decision !== "rejected" && decision !== "needs_revision")) {
    return { ok: false, error: "Something went wrong — please try again." };
  }
  // Rejections must explain why.
  if (decision === "rejected" && !note) {
    return { ok: false, error: "Please add a note explaining why you're rejecting this." };
  }
  const decidedBy = (await getServerUser())?.display_name ?? "Reliance Admin";

  const { data: appr, error } = await client.from("dev_approvals")
    .update({ status: decision, decided_by: decidedBy, decided_at: nowIso(), decision_note: note })
    .eq("id", id).eq("status", "pending")
    .select("task_id, approval_type").single();
  if (error || !appr) return { ok: false, error: error?.message ?? "That request was already decided." };

  await client.from("dev_audit_log").insert({
    task_id: appr.task_id, actor_type: "human", actor_id: decidedBy,
    action: decision === "approved" ? "approval_granted" : decision === "rejected" ? "approval_rejected" : "approval_revision_requested",
    entity: "dev_approvals", entity_id: id, detail: { approval_type: appr.approval_type, note },
  });
  if (appr.task_id) {
    await client.from("dev_agent_messages").insert({
      task_id: appr.task_id, role: "user",
      content: decision === "approved" ? "You approved this step." : decision === "rejected" ? `You rejected this step.${note ? ` (${note})` : ""}` : "You sent this back for changes.",
      seq: Date.now() % 1_000_000,
    });
    if (decision === "rejected") {
      await client.from("dev_tasks").update({ status: "blocked" }).eq("id", appr.task_id);
    }
    revalidatePath(`/admin/dev-command/tasks/${appr.task_id}`);
  }
  revalidatePath("/admin/dev-command/approvals");
  revalidatePath("/admin/dev-command");
  return { ok: true };
}

/**
 * Approve or reject a proposed file change plan (Phase 7). No file is touched —
 * this records your decision. Applying real changes comes in a later phase.
 */
export async function decideFilePlan(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (MOCK_MODE) return { ok: false, error: "Approvals need the live database." };
  if (!(await isSuperadmin())) return { ok: false, error: "You don't have permission for this." };
  const client = await createSupabaseServerClient();
  if (!client) return { ok: false, error: "Your session expired — please reload." };

  const id = String(formData.get("plan_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!id || (decision !== "approved" && decision !== "rejected")) {
    return { ok: false, error: "Something went wrong — please try again." };
  }
  const decidedBy = (await getServerUser())?.display_name ?? "Reliance Admin";

  const { data: plan, error } = await client.from("dev_file_change_plans")
    .update({ status: decision })
    .eq("id", id).in("status", ["planned", "needs_approval"])
    .select("task_id, file_path").single();
  if (error || !plan) return { ok: false, error: error?.message ?? "That plan was already decided." };

  await client.from("dev_audit_log").insert({
    task_id: plan.task_id, actor_type: "human", actor_id: decidedBy,
    action: decision === "approved" ? "file_plan_approved" : "file_plan_rejected",
    entity: "dev_file_change_plans", entity_id: id, detail: { file_path: plan.file_path },
  });
  revalidatePath(`/admin/dev-command/tasks/${plan.task_id}`);
  revalidatePath("/admin/dev-command");
  return { ok: true };
}

/**
 * Approve, reject, or request a revision on a code draft artifact (Phase 8).
 * Records your decision — no code is applied to the project.
 */
export async function decideArtifact(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (MOCK_MODE) return { ok: false, error: "Reviews need the live database." };
  if (!(await isSuperadmin())) return { ok: false, error: "You don't have permission for this." };
  const client = await createSupabaseServerClient();
  if (!client) return { ok: false, error: "Your session expired — please reload." };

  const id = String(formData.get("artifact_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const next = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : decision === "revise" ? "revised" : null;
  if (!id || !next) return { ok: false, error: "Something went wrong — please try again." };
  const decidedBy = (await getServerUser())?.display_name ?? "Reliance Admin";

  const { data: art, error } = await client.from("dev_artifacts")
    .update({ status: next })
    .eq("id", id).in("status", ["draft", "needs_review", "revised"])
    .select("task_id, title").single();
  if (error || !art) return { ok: false, error: error?.message ?? "That draft was already decided." };

  await client.from("dev_audit_log").insert({
    task_id: art.task_id, actor_type: "human", actor_id: decidedBy,
    action: `artifact_${next}`, entity: "dev_artifacts", entity_id: id, detail: { title: art.title },
  });
  // Phase 14: the team learns from your decision (approved/rejected pattern).
  if (next === "approved" || next === "rejected") {
    await recordMemory(client, {
      kind: next === "approved" ? "approved_pattern" : "rejected_pattern",
      title: `${next === "approved" ? "Approved" : "Rejected"}: ${art.title ?? "code draft"}`,
      content: `A code draft was ${next} by the operator — ${next === "approved" ? "reuse this approach" : "avoid this approach"}.`,
      taskId: art.task_id, createdBy: decidedBy,
    });
  }
  revalidatePath(`/admin/dev-command/tasks/${art.task_id}`);
  revalidatePath("/admin/dev-command");
  return { ok: true };
}

// ── Phase 13: release planning + preview tracking ─────────────────────────────

const DEPLOY_STATUSES = new Set([
  "planned", "not_started", "branch_created", "pr_open", "pr_created",
  "preview_pending", "preview_ready", "preview_failed",
  "approved_for_production", "production_released", "merged", "released", "rolled_back", "cancelled",
]);

/**
 * Update a deployment's preview URL, status, and notes (manual preview tracking).
 * SAFETY: this performs NO deploy. It only records status. Marking a deployment
 * 'production_released' requires an APPROVED production_release approval — the
 * app never releases to production on its own.
 */
export async function updateDeployment(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (MOCK_MODE) return { ok: false, error: "This needs the live database." };
  if (!(await isSuperadmin())) return { ok: false, error: "You don't have permission for this." };
  const client = await createSupabaseServerClient();
  if (!client) return { ok: false, error: "Your session expired — please reload." };

  const id = String(formData.get("deployment_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const previewUrl = (String(formData.get("preview_url") ?? "").trim() || null) as string | null;
  const notes = (String(formData.get("notes") ?? "").trim() || null) as string | null;
  if (!id || !DEPLOY_STATUSES.has(status)) return { ok: false, error: "Something went wrong — please try again." };
  if (previewUrl && !/^https?:\/\//.test(previewUrl)) return { ok: false, error: "Preview URL must start with http(s)://." };

  const { data: dep } = await client.from("dev_deployments").select("task_id").eq("id", id).maybeSingle();
  if (!dep) return { ok: false, error: "Deployment not found." };

  // Production release requires an approved production_release approval.
  if (status === "production_released") {
    const { data: appr } = await client.from("dev_approvals")
      .select("id").eq("task_id", dep.task_id).eq("approval_type", "production_release").eq("status", "approved").maybeSingle();
    if (!appr) return { ok: false, error: "Production release needs an approved production-release request first." };
  }

  const decidedBy = (await getServerUser())?.display_name ?? "Reliance Admin";
  const patch: Record<string, unknown> = { status };
  if (previewUrl !== null) patch.preview_url = previewUrl;
  if (notes !== null) patch.notes = notes;
  const { error } = await client.from("dev_deployments").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await client.from("dev_audit_log").insert({
    task_id: dep.task_id, actor_type: "human", actor_id: decidedBy,
    action: "deployment_updated", entity: "dev_deployments", entity_id: id, detail: { status, preview_url: previewUrl },
  });
  revalidatePath(`/admin/dev-command/tasks/${dep.task_id}`);
  revalidatePath("/admin/dev-command");
  return { ok: true };
}

/**
 * Request approval to release to production (Phase 13) + generate the changelog.
 * Creates a production_release approval only (idempotent) and stores a release-
 * notes artifact. NO production deploy happens — that stays manual/approved.
 */
export async function requestProductionApproval(taskId: string): Promise<{ ok: boolean; message?: string }> {
  if (MOCK_MODE) return { ok: false, message: "This needs the live database." };
  if (!(await isSuperadmin())) return { ok: false, message: "You don't have permission for this." };
  const client = await createSupabaseServerClient();
  if (!client) return { ok: false, message: "Your session expired — please reload." };

  const { data: taskRow } = await client.from("dev_tasks").select("*").eq("id", taskId).maybeSingle();
  if (!taskRow) return { ok: false, message: "Task not found." };
  const task = taskRow as DevTask;

  // Build the changelog from the task's real records.
  const [fp, rg, ap, art, dep] = await Promise.all([
    client.from("dev_file_change_plans").select("*").eq("task_id", taskId),
    client.from("dev_review_gates").select("*").eq("task_id", taskId),
    client.from("dev_approvals").select("*").eq("task_id", taskId),
    client.from("dev_artifacts").select("*").eq("task_id", taskId),
    client.from("dev_deployments").select("*").eq("task_id", taskId),
  ]);
  const detail: ReleaseDetail = {
    filePlans: (fp.data ?? []) as ReleaseDetail["filePlans"],
    reviewGates: (rg.data ?? []) as ReleaseDetail["reviewGates"],
    approvals: (ap.data ?? []) as ReleaseDetail["approvals"],
    artifacts: (art.data ?? []) as ReleaseDetail["artifacts"],
    deployments: (dep.data ?? []) as ReleaseDetail["deployments"],
  };
  const changelog = releaseNotesMarkdown(task, detail);

  // production_release approval (idempotent).
  let created = false;
  const { data: existing } = await client.from("dev_approvals")
    .select("id").eq("task_id", taskId).eq("approval_type", "production_release")
    .in("status", ["pending", "approved"]).maybeSingle();
  if (!existing) {
    await client.from("dev_approvals").insert({
      task_id: taskId, approval_type: "production_release", status: "pending", risk_level: task.risk_level,
      summary: `Release “${task.title}” to production`,
      plain_english_summary: "Approve releasing this change to production. Production is never deployed automatically — this is your explicit go-ahead.",
      technical_summary: "Promote the reviewed change to production (still a manual, gated step).",
      experience_impact: "The change reaches real users only after your approval.",
      reason: "Production releases require your explicit approval.",
      requested_by: "DevOps/Release Agent", affected_files: [], affected_tables: [],
    });
    created = true;
  }

  // Store/refresh the changelog as a release-notes artifact (no duplicate).
  const { data: existingChangelog } = await client.from("dev_artifacts")
    .select("id").eq("task_id", taskId).eq("artifact_type", "release_notes").eq("title", "Changelog / release notes").maybeSingle();
  if (existingChangelog) {
    await client.from("dev_artifacts").update({ content: changelog }).eq("id", existingChangelog.id);
  } else {
    await client.from("dev_artifacts").insert({
      task_id: taskId, kind: "doc", artifact_type: "release_notes", title: "Changelog / release notes",
      description: "Generated release notes (9 sections).", content: changelog, language: "md",
      risk_level: task.risk_level, approval_required: false, status: "needs_review", created_by: "Documentation Agent",
    });
  }

  await client.from("dev_audit_log").insert({
    task_id: taskId, actor_type: "human", actor_id: (await getServerUser())?.display_name ?? "Reliance Admin",
    action: "production_approval_requested", entity: "dev_approvals", entity_id: taskId, risk_level: task.risk_level, detail: {},
  });
  revalidatePath(`/admin/dev-command/tasks/${taskId}`);
  revalidatePath("/admin/dev-command/approvals");
  return { ok: true, message: created ? "Requested production-release approval and generated the changelog. Decide it in the Approval Center." : "Production approval was already requested; changelog refreshed." };
}

/**
 * Phase 12: apply an APPROVED artifact to the staging working area (NOT the real
 * codebase). Runs every safety check first; on any failure it applies nothing and
 * returns a plain-English reason. Never writes real files, never deploys, never
 * pushes. The actual real-file write is a separate, later, gated step.
 */
export async function applyApprovedArtifact(artifactId: string): Promise<{ ok: boolean; message?: string }> {
  if (MOCK_MODE) return { ok: false, message: "Applying needs the live database." };
  if (!(await isSuperadmin())) return { ok: false, message: "You don't have permission for this." };
  const client = await createSupabaseServerClient();
  if (!client) return { ok: false, message: "Your session expired — please reload." };

  // 1–2. Artifact + task exist.
  const { data: artRow } = await client.from("dev_artifacts").select("*").eq("id", artifactId).maybeSingle();
  if (!artRow) return { ok: false, message: "Draft not found." };
  const a = artRow as { id: string; task_id: string; title: string | null; path: string | null; content: string | null; status: string; risk_level: string | null; artifact_type: string | null };
  const { data: task } = await client.from("dev_tasks").select("id, risk_level").eq("id", a.task_id).maybeSingle();
  if (!task) return { ok: false, message: "Task not found." };

  // 3. Artifact is approved (and not already applied).
  if (a.status === "applied") return { ok: false, message: "This draft is already applied." };
  if (a.status !== "approved") return { ok: false, message: "Blocked: this draft must be approved before it can be applied." };

  // 7–8. Path safety + destructive check.
  const pc = checkPath(a.path);
  if (!pc.allowed && !pc.dangerous) return { ok: false, message: `Blocked: ${pc.reason}` };

  // 4. Required approvals (file_write always; SQL ⇒ database_change; dangerous ⇒ its type).
  const { data: apprRows } = await client.from("dev_approvals").select("approval_type, status").eq("task_id", a.task_id);
  const approved = (t: string) => (apprRows ?? []).some((x) => x.approval_type === t && x.status === "approved");
  if (!approved("file_write")) return { ok: false, message: "Blocked: a file-write approval must be approved first." };
  if ((a.artifact_type === "supabase_sql" || a.artifact_type === "rls_policy") && !approved("database_change")) {
    return { ok: false, message: "Blocked: a database-change approval is required before applying SQL." };
  }
  if (isDestructive(a.artifact_type) && !approved("file_delete")) {
    return { ok: false, message: "Blocked: deleting needs a file-delete approval." };
  }
  if (pc.dangerous) {
    if (!pc.requiredApproval || !approved(pc.requiredApproval)) {
      return { ok: false, message: `Blocked: this path needs an approved “${pc.requiredApproval ? APPROVAL_TYPE_LABEL[pc.requiredApproval] : "extra"}” first.` };
    }
  }

  // 5–6. Security + experience reviews: passed or waived, or not required yet.
  const { data: gateRows } = await client.from("dev_review_gates").select("gate_type, status").eq("task_id", a.task_id);
  const gateBlocks = (t: string) => {
    const g = (gateRows ?? []).find((x) => x.gate_type === t);
    return g ? !(g.status === "passed" || g.status === "waived_by_admin") : false; // none yet = not required yet
  };
  if (gateBlocks("security")) return { ok: false, message: "Blocked: the security review must pass (or be waived) first." };
  if (gateBlocks("experience")) return { ok: false, message: "Blocked: the experience review must pass (or be waived) first." };

  // All checks pass → apply to the staging working area (never the real codebase).
  const appliedBy = (await getServerUser())?.display_name ?? "Reliance Admin";
  const rollback = "Applied to the staging working area only — no real file or production was changed. To undo, roll back this staged change; nothing reached your codebase.";
  await client.from("dev_applied_changes").insert({
    task_id: a.task_id, artifact_id: a.id, file_path: a.path, change_type: "modify",
    content: a.content, rollback_note: rollback, dangerous: pc.dangerous, status: "applied", applied_by: appliedBy,
  });
  await client.from("dev_artifacts").update({ status: "applied" }).eq("id", a.id);
  await client.from("dev_audit_log").insert({
    task_id: a.task_id, actor_type: "human", actor_id: appliedBy,
    action: "artifact_applied", entity: "dev_artifacts", entity_id: a.id,
    risk_level: a.risk_level ?? task.risk_level, detail: { path: a.path, dangerous: pc.dangerous, working_area: true },
  });
  revalidatePath(`/admin/dev-command/tasks/${a.task_id}`);
  revalidatePath("/admin/dev-command");
  return { ok: true, message: `Applied “${a.title ?? "draft"}” to the working area (no real file changed).` };
}

/**
 * Request approval to create the GitHub branch + pull request (Phase 11).
 * This creates approval requests only — NO branch or PR is created, and nothing
 * is pushed or deployed. The actual GitHub action is a later, separately-gated
 * phase. Returns a friendly message.
 */
export async function requestGithubApproval(taskId: string): Promise<{ ok: boolean; message?: string }> {
  if (MOCK_MODE) return { ok: false, message: "This needs the live database." };
  if (!(await isSuperadmin())) return { ok: false, message: "You don't have permission for this." };
  const client = await createSupabaseServerClient();
  if (!client) return { ok: false, message: "Your session expired — please reload." };

  const { data: taskRow } = await client.from("dev_tasks").select("*").eq("id", taskId).maybeSingle();
  if (!taskRow) return { ok: false, message: "Task not found." };
  const task = taskRow as DevTask;
  const branch = branchName(task);

  const wanted: { type: "github_branch" | "pull_request"; plain: string; tech: string }[] = [
    { type: "github_branch", plain: `Create a code branch named ${branch}. No code is pushed to your main branch.`, tech: `git branch ${branch}` },
    { type: "pull_request", plain: "Open a pull request so the change can be reviewed on GitHub before anything merges.", tech: `gh pr create --base master --head ${branch}` },
  ];

  let created = 0;
  for (const w of wanted) {
    const { data: existing } = await client.from("dev_approvals")
      .select("id").eq("task_id", taskId).eq("approval_type", w.type)
      .in("status", ["pending", "approved"]).maybeSingle();
    if (existing) continue;
    await client.from("dev_approvals").insert({
      task_id: taskId, approval_type: w.type, status: "pending", risk_level: task.risk_level,
      summary: w.type === "github_branch" ? `Create branch ${branch}` : `Open a pull request for “${task.title}”`,
      plain_english_summary: w.plain, technical_summary: w.tech,
      experience_impact: "Lets a human review the change on GitHub before anything merges.",
      reason: "GitHub actions require your approval before they happen.",
      requested_by: "DevOps/Release Agent", affected_files: [], affected_tables: [],
    });
    await client.from("dev_audit_log").insert({
      task_id: taskId, actor_type: "agent", actor_id: "devops-release",
      action: "github_approval_requested", entity: "dev_approvals", entity_id: taskId,
      risk_level: task.risk_level, detail: { approval_type: w.type, branch },
    });
    created++;
  }
  revalidatePath(`/admin/dev-command/tasks/${taskId}`);
  revalidatePath("/admin/dev-command/approvals");
  return { ok: true, message: created ? `Requested ${created} GitHub approval${created > 1 ? "s" : ""}. Approve them in the Approval Center.` : "GitHub approvals were already requested." };
}

/**
 * Waive a failed review or send it back for a revision (Phase 9). Waiving lets
 * the task move toward release; requesting a revision keeps it blocked.
 */
export async function decideReviewGate(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (MOCK_MODE) return { ok: false, error: "Reviews need the live database." };
  if (!(await isSuperadmin())) return { ok: false, error: "You don't have permission for this." };
  const client = await createSupabaseServerClient();
  if (!client) return { ok: false, error: "Your session expired — please reload." };

  const id = String(formData.get("gate_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const next = decision === "waive" ? "waived_by_admin" : decision === "revise" ? "needs_revision" : null;
  if (!id || !next) return { ok: false, error: "Something went wrong — please try again." };
  const decidedBy = (await getServerUser())?.display_name ?? "Reliance Admin";

  const { data: gate, error } = await client.from("dev_review_gates")
    .update({ status: next, decided_by: decidedBy, decided_at: nowIso() })
    .eq("id", id).select("task_id, gate_type").single();
  if (error || !gate) return { ok: false, error: error?.message ?? "Could not update the review." };

  await client.from("dev_audit_log").insert({
    task_id: gate.task_id, actor_type: "human", actor_id: decidedBy,
    action: next === "waived_by_admin" ? "review_waived" : "review_revision_requested",
    entity: "dev_review_gates", entity_id: id, detail: { gate: gate.gate_type },
  });
  revalidatePath(`/admin/dev-command/tasks/${gate.task_id}`);
  revalidatePath("/admin/dev-command");
  return { ok: true };
}
