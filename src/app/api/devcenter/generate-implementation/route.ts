import { NextRequest, NextResponse } from "next/server";
import { isSuperadmin } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { MOCK_MODE, serverSecrets } from "@/lib/env";
import type { ImplementationBrief } from "@/lib/actions/generateImplementation";

// maxDuration on an API route is applied directly by Vercel to this function's
// lambda — this is the only reliable way to increase timeout beyond the default.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (MOCK_MODE) {
    return NextResponse.json({
      ok: true,
      brief: {
        summary: "Mock implementation brief — connect Supabase to generate real specs.",
        files: [],
        dbMigration: null,
        testingNotes: "Run the app and verify the feature works end-to-end.",
        deployCommand: "vercel --prod --yes",
      },
    });
  }

  try {
    if (!(await isSuperadmin())) {
      return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 403 });
    }

    const { taskId } = await req.json();
    if (!taskId || typeof taskId !== "string") {
      return NextResponse.json({ ok: false, error: "taskId is required." }, { status: 400 });
    }

    const db = createServiceRoleClient();
    if (!db) return NextResponse.json({ ok: false, error: "Database not available." }, { status: 500 });

    // Load the task and all its artifacts
    const [{ data: task }, { data: artifacts }, { data: filePlans }] = await Promise.all([
      db.from("dev_tasks").select("*").eq("id", taskId).single(),
      db.from("dev_artifacts").select("*").eq("task_id", taskId).order("created_at"),
      db.from("dev_file_change_plans").select("*").eq("task_id", taskId).order("created_at"),
    ]);

    if (!task) return NextResponse.json({ ok: false, error: "Task not found." }, { status: 404 });

    const meta = (task.metadata ?? {}) as Record<string, unknown>;

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

You will be given a software task that an AI planning team has already fully analyzed. Your job is to synthesize their work into a complete, precise implementation brief that another engineer (or AI coding assistant like Claude Code) can execute directly — no clarification needed.`;

    const userMessage = `TASK: ${task.title}

DESCRIPTION: ${task.description ?? ""}

BUSINESS GOAL: ${meta.business_goal ?? ""}
WHO USES IT: ${meta.who_uses_it ?? ""}
SUCCESS CRITERIA: ${meta.success_criteria ?? ""}
NOTES: ${meta.notes ?? ""}

--- PLANNING TEAM OUTPUTS ---
${artifactContext || "No artifacts generated yet."}

--- FILE CHANGE PLANS ---
${filePlanContext || "No file plans generated yet."}

Generate the complete implementation brief now.`;

    const { anthropicKey, anthropicModel } = serverSecrets();
    if (!anthropicKey) {
      return NextResponse.json({ ok: false, error: "AI API key not configured." }, { status: 500 });
    }

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: anthropicKey });

    const response = await client.messages.create({
      model: anthropicModel || "claude-sonnet-4-6",
      max_tokens: 8000,
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
              summary: { type: "string" },
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
              dbMigration:   { type: ["string", "null"] },
              testingNotes:  { type: "string" },
              deployCommand: { type: "string" },
            },
          },
        },
      ],
      tool_choice: { type: "tool" as const, name: "submit_implementation_brief" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolUse = (response.content as any[]).find(
      (b) => b.type === "tool_use" && b.name === "submit_implementation_brief"
    );
    if (!toolUse?.input) {
      return NextResponse.json({ ok: false, error: "AI did not return a usable response. Try again." }, { status: 500 });
    }

    const brief = toolUse.input as ImplementationBrief;

    // Persist as artifact (best-effort)
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
    try {
      await db.from("dev_audit_log").insert({
        task_id: taskId,
        actor: "system",
        action: "implementation_brief_generated",
        details: { files_count: brief.files.length, has_migration: !!brief.dbMigration },
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({ ok: true, brief, artifactId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
