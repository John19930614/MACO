/**
 * AI Dev Command Center — File change plan generator (Phase 7).
 *
 * Produces a PROPOSED set of file changes for a task — files to create/modify,
 * a migration draft, tests, and docs. These are plans only: nothing is written
 * to disk or the database. Each plan carries a risk level, a plain summary, and
 * an explicit "needs your approval" flag.
 */
import "server-only";
import type { DevTask, DevTaskMeta, FileChangeType, RiskLevel } from "./types";

export interface FilePlanDraft {
  file_path: string;
  change_type: FileChangeType;
  language: string | null;
  diff: string;              // proposed_diff (illustrative, not real code)
  rationale: string;         // reason
  proposed_summary: string;
  approval_required: boolean;
  risk_level: RiskLevel;
}

const meta = (t: DevTask) => (t.metadata ?? {}) as DevTaskMeta;

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").split("-").slice(0, 4).join("-") || "feature";
}
function pascal(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).slice(0, 3).map((w) => w[0]?.toUpperCase() + w.slice(1)).join("") || "Feature";
}
const MODULE_FOLDER: Record<string, string> = {
  "Admin Console": "admin", "AI Gateway": "sa/gateway", "Document Control": "documents",
  "HSE Management": "hse", "Onboarding": "onboarding", "Contractor Management": "contractors",
  "Audit System": "audits", "Training Matrix": "training", "Maintenance Dashboard": "maintenance",
  "Database": "lib", "User Management": "team", "Platform Operations": "sa", "Other": "platform",
};

/** Build the proposed file change plan for a task. Deterministic + safe. */
export function generateFilePlans(task: DevTask): FilePlanDraft[] {
  const m = meta(task);
  const fslug = slug(task.title);
  const Feature = pascal(task.title);
  const folder = MODULE_FOLDER[task.target_area ?? ""] ?? "platform";
  const drafts: FilePlanDraft[] = [];

  // 1. New UI component / screen.
  drafts.push({
    file_path: `src/app/(app)/${folder}/${Feature}.tsx`,
    change_type: "create", language: "tsx",
    diff: `+ export function ${Feature}() {\n+   // draft UI for: ${task.title}\n+ }`,
    rationale: "A new screen/component is needed for this feature.",
    proposed_summary: `Add the ${task.title} screen.`,
    approval_required: true, risk_level: "low",
  });

  // 2. Server action / API for the logic.
  drafts.push({
    file_path: `src/lib/actions/${fslug}.ts`,
    change_type: "create", language: "ts",
    diff: `+ "use server";\n+ export async function ${pascal(task.title).charAt(0).toLowerCase() + pascal(task.title).slice(1)}() {\n+   // validated server logic — admin-gated\n+ }`,
    rationale: "A server action handles the logic with input validation.",
    proposed_summary: "Add the server-side logic for the feature.",
    approval_required: true, risk_level: "medium",
  });

  // 3. Nav entry (modify) — only when it's a new screen in a module.
  drafts.push({
    file_path: "src/components/layout/LeftNav.tsx",
    change_type: "modify", language: "tsx",
    diff: `~ add a nav link to the new ${task.title} screen`,
    rationale: "Users need a way to reach the new screen.",
    proposed_summary: "Add a menu link for the new screen.",
    approval_required: true, risk_level: "low",
  });

  // 4. Migration draft — only if the task allows database changes.
  if (m.database_changes_allowed) {
    drafts.push({
      file_path: `supabase/migrations/DRAFT_${fslug}.sql`,
      change_type: "migration", language: "sql",
      diff: `-- DRAFT (not applied)\n-- proposed schema for: ${task.title}\ncreate table if not exists ... ;`,
      rationale: "The feature needs to store data, so a database change is drafted.",
      proposed_summary: "Draft a database change (you approve before it runs).",
      approval_required: true, risk_level: "high",
    });
  }

  // 5. Tests.
  drafts.push({
    file_path: `src/lib/${fslug}/__tests__/${fslug}.test.ts`,
    change_type: "test", language: "ts",
    diff: `+ test("${task.title}", () => { /* checks acceptance criteria */ });`,
    rationale: "Tests confirm the feature meets its acceptance criteria.",
    proposed_summary: "Add tests for the feature.",
    approval_required: false, risk_level: "low",
  });

  // 6. Documentation.
  drafts.push({
    file_path: `docs/${fslug}.md`,
    change_type: "documentation", language: "md",
    diff: `+ # ${task.title}\n+ Plain-English notes for users and admins.`,
    rationale: "A short guide helps admins and users understand the feature.",
    proposed_summary: "Add a short guide for the feature.",
    approval_required: false, risk_level: "low",
  });

  return drafts;
}
