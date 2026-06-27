"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSuperadmin, getServerUser } from "@/lib/auth/session";
import { MOCK_MODE } from "@/lib/env";

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
