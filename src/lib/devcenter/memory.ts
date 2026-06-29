/**
 * AI Dev Command Center — Agent memory (Phase 14).
 *
 * Server-only helpers for the learning loop: record reusable lessons, read the
 * active memory, and format it for an agent's prompt. Memory stores ONLY reusable
 * platform-improvement lessons — never customer data.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MOCK_MODE } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MEMORY_KIND_LABEL } from "./labels";
import type { AgentMemoryKind, DevAgentMemory } from "./types";

/** Record a reusable lesson. Best-effort + de-duplicated by (kind, title). */
export async function recordMemory(
  client: SupabaseClient,
  opts: { kind: AgentMemoryKind; title: string; content?: string; agentId?: string | null; taskId?: string | null; createdBy?: string; tags?: string[] },
): Promise<void> {
  try {
    const { data: existing } = await client.from("dev_agent_memory")
      .select("id").eq("kind", opts.kind).eq("title", opts.title).maybeSingle();
    if (existing) return;
    await client.from("dev_agent_memory").insert({
      kind: opts.kind, title: opts.title, content: opts.content ?? null,
      agent_id: opts.agentId ?? null, task_id: opts.taskId ?? null,
      tags: opts.tags ?? [], status: "active", created_by: opts.createdBy ?? "AI agent",
    });
  } catch {
    /* never block the workflow on a memory write */
  }
}

/** Active memory items, newest first (used by the planning agents). */
export async function getActiveMemory(limit = 40, client?: SupabaseClient): Promise<DevAgentMemory[]> {
  if (MOCK_MODE) return [];
  const c = client ?? (await createSupabaseServerClient());
  if (!c) return [];
  const { data } = await c.from("dev_agent_memory").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as DevAgentMemory[];
}

/**
 * Format memory as guidance for an agent prompt. Rejected patterns become
 * explicit "avoid" warnings; everything else becomes "remember" guidance.
 */
export function formatMemoryForPrompt(items: DevAgentMemory[]): string {
  if (!items.length) return "";
  const avoid = items.filter((m) => m.kind === "rejected_pattern");
  const remember = items.filter((m) => m.kind !== "rejected_pattern");
  const lines: string[] = [];
  if (remember.length) {
    lines.push("Remember these platform lessons:");
    for (const m of remember.slice(0, 12)) lines.push(`- (${MEMORY_KIND_LABEL[m.kind]}) ${m.title}${m.content ? `: ${m.content}` : ""}`);
  }
  if (avoid.length) {
    lines.push("AVOID these rejected patterns:");
    for (const m of avoid.slice(0, 8)) lines.push(`- ${m.title}${m.content ? `: ${m.content}` : ""}`);
  }
  return lines.join("\n");
}
