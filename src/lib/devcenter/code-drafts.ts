/**
 * AI Dev Command Center — Code draft generator (Phase 8).
 *
 * Turns the proposed file changes into reviewable code/SQL/test/doc DRAFTS saved
 * as dev_artifacts. Nothing is written to the real codebase or database — these
 * are drafts the admin reviews and approves. Each draft carries the seven things
 * every code draft must include (what it does, where it goes, files affected,
 * tests needed, risk, approval, experience).
 */
import "server-only";
import type { ArtifactType, DevTask, FileChangeType, RiskLevel } from "./types";

export interface CodeDraft {
  artifact_type: ArtifactType;
  agent_name: string;
  title: string;
  description: string;
  file_path_suggestion: string;
  content: string;
  language: string;
  risk_level: RiskLevel;
  approval_required: boolean;
  structured: Record<string, unknown>;
}

/** Minimal shape we need from a file plan (works for DB rows and drafts). */
export interface PlanLike {
  file_path: string;
  change_type: FileChangeType;
  risk_level: RiskLevel;
  proposed_summary?: string | null;
}

const AGENT: Record<ArtifactType, string> = {
  react_component: "Frontend Agent", nextjs_route: "Frontend Agent",
  server_action: "Backend/API Agent", api_route: "Backend/API Agent", config_change: "Backend/API Agent",
  supabase_sql: "Database/Supabase Agent", rls_policy: "Database/Supabase Agent",
  test_file: "QA/Test Agent", documentation: "Documentation Agent", release_notes: "Documentation Agent",
};
const LANG: Record<ArtifactType, string> = {
  react_component: "tsx", nextjs_route: "tsx", server_action: "ts", api_route: "ts",
  config_change: "ts", supabase_sql: "sql", rls_policy: "sql", test_file: "ts",
  documentation: "md", release_notes: "md",
};

const base = (p: string) => p.split("/").pop() ?? p;
const compName = (p: string) => (base(p).replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]/g, "") || "Feature");

function classify(plan: PlanLike): ArtifactType {
  const p = plan.file_path.toLowerCase();
  if (plan.change_type === "migration" || p.includes("/migrations/")) return p.includes("policy") || p.includes("rls") ? "rls_policy" : "supabase_sql";
  if (plan.change_type === "test" || p.includes(".test.")) return "test_file";
  if (plan.change_type === "documentation" || p.endsWith(".md")) return "documentation";
  if (plan.change_type === "config") return "config_change";
  if (p.includes("/api/")) return "api_route";
  if (p.includes("/lib/actions/")) return "server_action";
  if (p.endsWith("page.tsx")) return "nextjs_route";
  if (p.endsWith(".tsx")) return "react_component";
  return "server_action";
}

function scaffold(type: ArtifactType, task: DevTask, plan: PlanLike): string {
  const name = compName(plan.file_path);
  const fn = name.charAt(0).toLowerCase() + name.slice(1);
  switch (type) {
    case "react_component":
      return `"use client";\n// DRAFT — not applied. For: ${task.title}\nexport function ${name}() {\n  return <div>{/* ${task.title} */}</div>;\n}`;
    case "nextjs_route":
      return `// DRAFT page — not applied. For: ${task.title}\nexport default function Page() {\n  return <main>{/* ${task.title} */}</main>;\n}`;
    case "server_action":
      return `"use server";\n// DRAFT — not applied. Admin-gated, validated.\nexport async function ${fn}() {\n  // logic for: ${task.title}\n}`;
    case "api_route":
      return `import { NextResponse } from "next/server";\n// DRAFT — not applied.\nexport async function GET() {\n  // ${task.title}\n  return NextResponse.json({ ok: true });\n}`;
    case "supabase_sql":
      return `-- DRAFT migration — NOT applied.\n-- ${task.title}\ncreate table if not exists ... ( /* columns */ );`;
    case "rls_policy":
      return `-- DRAFT data-access rule — NOT applied.\n-- ${task.title}\ncreate policy ... using ( /* condition */ );`;
    case "test_file":
      return `import { test, expect } from "vitest";\n// DRAFT — checks acceptance criteria for: ${task.title}\ntest("${task.title}", () => {\n  expect(true).toBe(true);\n});`;
    case "documentation":
      return `# ${task.title}\n\nPlain-English notes for users and admins. (Draft.)`;
    case "config_change":
      return `// DRAFT config change — not applied. For: ${task.title}`;
    case "release_notes":
      return `# Release notes (draft)\n\n- ${task.title}`;
  }
}

export function generateCodeDrafts(task: DevTask, plans: PlanLike[]): CodeDraft[] {
  return plans.map((plan) => {
    const type = classify(plan);
    const noApprovalNeeded = type === "test_file" || type === "documentation" || type === "release_notes";
    const approval_required = !noApprovalNeeded;
    const summary = plan.proposed_summary || `Draft ${type.replace(/_/g, " ")} for ${task.title}.`;
    return {
      artifact_type: type,
      agent_name: AGENT[type],
      title: `${base(plan.file_path)} (${type.replace(/_/g, " ")})`,
      description: summary,
      file_path_suggestion: plan.file_path,
      content: scaffold(type, task, plan),
      language: LANG[type],
      risk_level: plan.risk_level,
      approval_required,
      structured: {
        what_it_does: summary,
        where_it_goes: plan.file_path,
        files_affected: [plan.file_path],
        tests_needed: type === "test_file" ? "This is the test." : "A test covering the acceptance criteria.",
        risk: plan.risk_level,
        approval_required,
        ux_improved: "Keeps the feature simple and clear for a non-technical admin.",
      },
    };
  });
}
