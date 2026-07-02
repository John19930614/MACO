"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSuperadmin, getServerUser } from "@/lib/auth/session";
import { MOCK_MODE } from "@/lib/env";

const FEEDBACK_TYPES = new Set([
  "helpful", "confusing", "wrong_recommendation", "feature_request",
  "broken_workflow", "bad_wording", "too_technical", "too_many_steps",
]);
const MEMORY_KINDS = new Set([
  "approved_pattern", "rejected_pattern", "user_preference", "lesson_learned",
  "preferred_label", "workflow_rule", "security_rule", "ux_rule",
  "performance_rule", "admin_support_rule", "platform_standard",
]);

type State = { ok: boolean; error?: string; message?: string };

async function admin() {
  if (MOCK_MODE) return { client: null, error: "This needs the live database." as string };
  if (!(await isSuperadmin())) return { client: null, error: "You don't have permission for this." };
  const client = await createSupabaseServerClient();
  if (!client) return { client: null, error: "Your session expired — please reload." };
  return { client, error: null };
}

/** Submit feedback (the 8 quick types). */
export async function submitFeedback(_prev: State, formData: FormData): Promise<State> {
  const { client, error } = await admin();
  if (!client) return { ok: false, error: error! };
  const feedbackType = String(formData.get("feedback_type") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  const pageRoute = String(formData.get("page_route") ?? "").trim() || null;
  if (!FEEDBACK_TYPES.has(feedbackType)) return { ok: false, error: "Please choose a feedback type." };
  if (!message && feedbackType !== "helpful") return { ok: false, error: "Please add a short message." };
  const by = (await getServerUser())?.display_name ?? "Reliance Admin";

  // Map the quick type onto the existing coarse category for back-compat.
  const category = feedbackType === "confusing" ? "confusing_screen"
    : feedbackType === "wrong_recommendation" ? "wrong_recommendation"
    : feedbackType === "broken_workflow" ? "bug"
    : feedbackType === "feature_request" ? "improvement" : "other";

  const { error: err } = await client.from("dev_feedback").insert({
    feedback_type: feedbackType, category, message: message || "(was helpful)",
    screen: pageRoute, status: "open", created_by: by,
  });
  if (err) return { ok: false, error: err.message };
  revalidatePath("/admin/dev-command/settings");
  return { ok: true, message: "Thanks — your feedback was recorded." };
}

/** Update a feedback item's status. */
export async function resolveFeedback(_prev: State, formData: FormData): Promise<State> {
  const { client, error } = await admin();
  if (!client) return { ok: false, error: error! };
  const id = String(formData.get("feedback_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["open", "triaged", "in_progress", "resolved", "wontfix"].includes(status)) return { ok: false, error: "Something went wrong." };
  const by = (await getServerUser())?.display_name ?? "Reliance Admin";
  const patch: Record<string, unknown> = { status };
  if (status === "resolved" || status === "wontfix") { patch.resolved_by = by; patch.resolved_at = new Date().toISOString(); }
  const { error: err } = await client.from("dev_feedback").update(patch).eq("id", id);
  if (err) return { ok: false, error: err.message };
  revalidatePath("/admin/dev-command/settings");
  return { ok: true };
}

/** Add a memory item by hand. */
export async function addMemory(_prev: State, formData: FormData): Promise<State> {
  const { client, error } = await admin();
  if (!client) return { ok: false, error: error! };
  const kind = String(formData.get("kind") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim() || null;
  if (!MEMORY_KINDS.has(kind)) return { ok: false, error: "Please choose a memory type." };
  if (!title) return { ok: false, error: "Please add a short title." };
  const by = (await getServerUser())?.display_name ?? "Reliance Admin";
  const { error: err } = await client.from("dev_agent_memory").insert({ kind, title, content, status: "active", created_by: by, tags: [] });
  if (err) return { ok: false, error: err.message };
  revalidatePath("/admin/dev-command/settings");
  return { ok: true, message: "Memory added." };
}

/** Permanently delete a memory item. */
export async function deleteMemory(memoryId: string): Promise<State> {
  const { client, error } = await admin();
  if (!client) return { ok: false, error: error! };
  const { error: err } = await client.from("dev_agent_memory").delete().eq("id", memoryId);
  if (err) return { ok: false, error: err.message };
  revalidatePath("/admin/dev-command/settings");
  return { ok: true };
}

/** Enable / disable a memory item (disabled memory is not used by agents). */
export async function toggleMemory(memoryId: string): Promise<State> {
  const { client, error } = await admin();
  if (!client) return { ok: false, error: error! };
  const { data: row } = await client.from("dev_agent_memory").select("status").eq("id", memoryId).maybeSingle();
  if (!row) return { ok: false, error: "Memory not found." };
  const next = row.status === "active" ? "archived" : "active";
  const { error: err } = await client.from("dev_agent_memory").update({ status: next }).eq("id", memoryId);
  if (err) return { ok: false, error: err.message };
  revalidatePath("/admin/dev-command/settings");
  return { ok: true };
}
