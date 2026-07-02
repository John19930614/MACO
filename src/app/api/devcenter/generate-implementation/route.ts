import { NextRequest, NextResponse } from "next/server";
import { MOCK_MODE, serverSecrets } from "@/lib/env";
import { isSuperadmin } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Set to Vercel Pro max. Also set in vercel.json for belt-and-suspenders.
export const maxDuration = 300;

// Inline types so we don't import from a "use server" module
interface GeneratedFile {
  path: string;
  operation: "create" | "edit" | "delete";
  description: string;
  content: string;
}
interface ImplementationBrief {
  summary: string;
  files: GeneratedFile[];
  dbMigration: string | null;
  testingNotes: string;
  deployCommand: string;
}

export async function POST(req: NextRequest) {
  if (MOCK_MODE) {
    return NextResponse.json({
      ok: true,
      mock: true,
      brief: {
        summary: "Mock implementation brief — connect Supabase to generate real specs.",
        files: [],
        dbMigration: null,
        testingNotes: "Run the app and verify the feature works end-to-end.",
        deployCommand: "vercel --prod --yes",
      },
    });
  }

  // Superadmin only — this route uses the service-role client (bypasses RLS)
  // and exposes internal dev-task data. Mirrors the import-notes route gate;
  // the /admin middleware superadmin check does NOT cover /api/devcenter/*.
  if (!(await isSuperadmin())) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 403 });
  }

  try {
    const { taskId } = (await req.json()) as { taskId?: string };
    if (!taskId || typeof taskId !== "string") {
      return NextResponse.json({ ok: false, error: "taskId is required." }, { status: 400 });
    }

    // Service-role client — bypass RLS entirely (superadmin context, gated above)
    const db = createServiceRoleClient();
    if (!db) {
      return NextResponse.json({ ok: false, error: "Database not configured." }, { status: 500 });
    }

    // Load task + artifacts
    const [{ data: task }, { data: artifacts }, { data: filePlans }] = await Promise.all([
      db.from("dev_tasks").select("*").eq("id", taskId).single(),
      db.from("dev_artifacts").select("*").eq("task_id", taskId).order("created_at"),
      db.from("dev_file_change_plans").select("*").eq("task_id", taskId).order("created_at"),
    ]);

    if (!task) {
      return NextResponse.json({ ok: false, error: "Task not found." }, { status: 404 });
    }

    const meta = (task.metadata ?? {}) as Record<string, unknown>;

    const artifactContext = ((artifacts ?? []) as { artifact_type?: string; kind?: string; content?: string; structured?: unknown; title?: string; path?: string }[])
      .filter((a) => a.content || a.structured)
      .map((a) => {
        const label = a.artifact_type ?? a.kind ?? "artifact";
        const body = a.content ?? (a.structured ? JSON.stringify(a.structured, null, 2) : "");
        return `=== ${label.toUpperCase()}: ${a.title ?? a.path ?? "untitled"} ===\n${body}`;
      })
      .join("\n\n");

    const filePlanContext = ((filePlans ?? []) as { path?: string; operation?: string; reason?: string; structured?: unknown }[])
      .map((fp) => {
        const s = (fp.structured ?? {}) as Record<string, unknown>;
        return `File: ${fp.path ?? "unknown"}\nOperation: ${fp.operation ?? "edit"}\nReason: ${fp.reason ?? ""}\n${s.changes ? JSON.stringify(s.changes, null, 2) : ""}`;
      })
      .join("\n\n");

    const { anthropicKey, anthropicModel } = serverSecrets();
    if (!anthropicKey) {
      return NextResponse.json({ ok: false, error: "AI API key not configured." }, { status: 500 });
    }

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: anthropicKey });

    const response = await client.messages.create({
      model: anthropicModel || "claude-sonnet-4-6",
      max_tokens: 16000,
      system: `You are a senior full-stack TypeScript/Next.js engineer on the SafetyIQ platform (Next.js 15 App Router, Supabase, Tailwind CSS, Vercel deployment). Synthesize the task plan into a precise implementation brief another developer can execute directly.`,
      messages: [
        {
          role: "user",
          content: `TASK: ${task.title}
DESCRIPTION: ${task.description ?? ""}
GOAL: ${meta.business_goal ?? ""}
WHO: ${meta.who_uses_it ?? ""}
CRITERIA: ${meta.success_criteria ?? ""}
NOTES: ${meta.notes ?? ""}

PLANNING OUTPUTS:
${artifactContext || "None yet."}

FILE PLANS:
${filePlanContext || "None yet."}

Generate the implementation brief now.`,
        },
      ],
      tools: [
        {
          name: "submit_brief",
          description: "Submit the implementation brief.",
          input_schema: {
            type: "object" as const,
            required: ["summary", "files", "testingNotes", "deployCommand"],
            properties: {
              summary:       { type: "string" },
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
      tool_choice: { type: "tool" as const, name: "submit_brief" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolUse = (response.content as any[]).find((b) => b.type === "tool_use" && b.name === "submit_brief");
    if (!toolUse?.input) {
      return NextResponse.json({ ok: false, error: "AI did not return a usable response. Try again." }, { status: 500 });
    }

    const brief = toolUse.input as ImplementationBrief;

    // Persist (best-effort)
    try {
      await db.from("dev_artifacts").insert({
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
      });
      await db.from("dev_audit_log").insert({
        task_id: taskId,
        actor_type: "system",
        action: "implementation_brief_generated",
        detail: { files_count: brief.files.length, has_migration: !!brief.dbMigration },
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({ ok: true, brief });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
