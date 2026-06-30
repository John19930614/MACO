"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { getServerTenantId } from "@/lib/auth/session";
import { MOCK_MODE, serverSecrets } from "@/lib/env";

export interface GeneratedFile {
  path: string;
  operation: "create" | "edit" | "delete";
  description: string;
  content: string;
}

export interface ImplementationBrief {
  summary: string;
  files: GeneratedFile[];
  dbMigration: string | null;
  testingNotes: string;
  deployCommand: string;
}

export async function generateImplementation(taskId: string): Promise<{
  ok: boolean;
  brief?: ImplementationBrief;
  artifactId?: string;
  error?: string;
}> {
  if (MOCK_MODE) {
    return {
      ok: true,
      brief: {
        summary: "Mock implementation brief — connect Supabase to generate real specs.",
        files: [],
        dbMigration: null,
        testingNotes: "Run the app and verify the feature works end-to-end.",
        deployCommand: "vercel --prod --yes",
      },
    };
  }

  const db = createServiceRoleClient();
  if (!db) return { ok: false, error: "Database not available." };

  const tenantId = await getServerTenantId();

  // Load the task and all its artifacts
  const [{ data: task }, { data: artifacts }, { data: filePlans }] = await Promise.all([
    db.from("dev_tasks").select("*").eq("id", taskId).single(),
    db.from("dev_artifacts").select("*").eq("task_id", taskId).order("created_at"),
    db.from("dev_file_change_plans").select("*").eq("task_id", taskId).order("created_at"),
  ]);

  if (!task) return { ok: false, error: "Task not found." };

  const meta = (task.metadata ?? {}) as Record<string, unknown>;

  // Build context from all artifacts
  const artifactContext = (artifacts ?? [])
    .filter((a) => a.content || a.structured)
    .map((a) => {
      const label = a.artifact_type ?? a.kind ?? "artifact";
      const body = a.content ?? (a.structured ? JSON.stringify(a.structured, null, 2) : "");
      return `=== ${label.toUpperCase()}: ${a.title ?? a.path ?? "untitled"} ===\n${body}`;
    })
    .join("\n\n");

  const filePlanContext = (filePlans ?? [])
    .map((fp) => {
      const s = (fp.structured ?? {}) as Record<string, unknown>;
      return `File: ${fp.path ?? "unknown"}\nOperation: ${fp.operation ?? "edit"}\nReason: ${fp.reason ?? ""}\n${s.changes ? JSON.stringify(s.changes, null, 2) : ""}`;
    })
    .join("\n\n");

  const systemPrompt = `You are a senior full-stack TypeScript/Next.js engineer on the SafetyIQ platform (Next.js 15 App Router, Supabase, Tailwind CSS, Vercel deployment).

You will be given a software task that an AI planning team has already fully analyzed. Your job is to synthesize their work into a complete, precise implementation brief that another engineer (or AI coding assistant like Claude Code) can execute directly — no clarification needed.

Output ONLY valid JSON matching this exact schema:
{
  "summary": "2-3 sentence plain-English summary of what this implementation does",
  "files": [
    {
      "path": "src/path/to/file.tsx",
      "operation": "create" | "edit" | "delete",
      "description": "one sentence: what changes and why",
      "content": "complete file content OR the specific code block to add/change (be precise about location if editing)"
    }
  ],
  "dbMigration": "SQL migration string OR null if no DB changes needed",
  "testingNotes": "plain English — what to click/check to verify it works",
  "deployCommand": "vercel --prod --yes"
}

Be specific: include real file paths relative to the project root, real TypeScript/React code, real SQL. Do not use placeholder comments like '// implement here'. If you must write partial file content for edits, clearly identify the exact function or block being changed.`;

  const userMessage = `TASK: ${task.title}

DESCRIPTION: ${task.description ?? ""}

BUSINESS GOAL: ${meta.business_goal ?? ""}
WHO USES IT: ${meta.who_uses_it ?? ""}
SUCCESS CRITERIA: ${meta.success_criteria ?? ""}
DATABASE CHANGES ALLOWED: ${meta.database_changes_allowed ? "yes" : "no"}
NOTES: ${meta.notes ?? ""}

--- PLANNING TEAM OUTPUTS ---
${artifactContext || "No artifacts generated yet."}

--- FILE CHANGE PLANS ---
${filePlanContext || "No file plans generated yet."}

Generate the complete implementation brief now.`;

  try {
    const { anthropicKey, anthropicModel } = serverSecrets();
    if (!anthropicKey) return { ok: false, error: "AI API key not configured." };

    // Lazy import to avoid module evaluation during static page generation
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: anthropicKey });

    // Use tool use (structured output) so Claude is forced to return complete,
    // properly-escaped JSON — avoids truncated strings from raw JSON generation.
    const response = await client.messages.create({
      model: anthropicModel || "claude-sonnet-4-6",
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: [
        {
          name: "submit_implementation_brief",
          description: "Submit the complete implementation brief for this task.",
          input_schema: {
            type: "object" as const,
            required: ["summary", "files", "testingNotes", "deployCommand"],
            properties: {
              summary: { type: "string", description: "2-3 sentence plain-English summary" },
              files: {
                type: "array",
                items: {
                  type: "object",
                  required: ["path", "operation", "description", "content"],
                  properties: {
                    path:        { type: "string" },
                    operation:   { type: "string", enum: ["create", "edit", "delete"] },
                    description: { type: "string" },
                    content:     { type: "string" },
                  },
                },
              },
              dbMigration:  { type: ["string", "null"], description: "SQL migration or null" },
              testingNotes: { type: "string" },
              deployCommand: { type: "string" },
            },
          },
        },
      ],
      // Force the specific tool so the model can't return plain text instead
      tool_choice: { type: "tool" as const, name: "submit_implementation_brief" },
    });

    // Extract the tool call input
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents = response.content as any[];
    const toolUse = contents.find((b) => b.type === "tool_use" && b.name === "submit_implementation_brief");

    let brief: ImplementationBrief;
    if (toolUse?.input) {
      brief = toolUse.input as ImplementationBrief;
    } else {
      // Fallback: try to extract JSON from any text block
      const textBlock = contents.find((b) => b.type === "text");
      const raw = textBlock?.text ?? "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { ok: false, error: "AI did not return a usable response. Try again." };
      }
      try {
        brief = JSON.parse(jsonMatch[0]) as ImplementationBrief;
      } catch {
        return { ok: false, error: "AI response could not be parsed. Try again." };
      }
    }

    // Save as an artifact so it persists (best-effort — don't block response on DB failure)
    let artifactId: string | undefined;
    try {
      const { data: artifact } = await db.from("dev_artifacts").insert({
        task_id: taskId,
        kind: "implementation_brief",
        artifact_type: "implementation_brief",
        title: "Generated implementation brief",
        content: JSON.stringify(brief, null, 2),
        structured: brief as unknown as Record<string, unknown>,
        status: "ready_for_review",
        created_by: "claude-code-generator",
        risk_level: "medium",
        approval_required: false,
      }).select("id").single();
      artifactId = artifact?.id as string | undefined;
    } catch { /* non-fatal */ }

    // Audit log (best-effort)
    if (tenantId) {
      try {
        await db.from("dev_audit_log").insert({
          task_id: taskId,
          actor: "system",
          action: "implementation_brief_generated",
          details: { files_count: brief.files.length, has_migration: !!brief.dbMigration },
        });
      } catch { /* non-fatal */ }
    }

    return { ok: true, brief, artifactId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Generation failed." };
  }
}

/** Load the most recent saved implementation brief for a task. */
export async function getImplementationBrief(taskId: string): Promise<{
  brief: ImplementationBrief | null;
  artifactId: string | null;
}> {
  if (MOCK_MODE) return { brief: null, artifactId: null };

  const db = createServiceRoleClient();
  if (!db) return { brief: null, artifactId: null };

  const { data } = await db
    .from("dev_artifacts")
    .select("id, structured")
    .eq("task_id", taskId)
    .eq("artifact_type", "implementation_brief")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!data?.structured) return { brief: null, artifactId: null };
  return {
    brief: data.structured as unknown as ImplementationBrief,
    artifactId: data.id as string,
  };
}
