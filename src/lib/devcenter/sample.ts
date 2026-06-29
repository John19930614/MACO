/**
 * Sample data for the AI Dev Command Center UI shell (Phase 2).
 *
 * Phase 2 builds the screens with NO real AI calls, GitHub, or deployments. To
 * make the shell feel real, the pages render from this cohesive sample dataset.
 * The Agents page additionally tries the real seeded roster (getDevAgents) and
 * falls back to SAMPLE_AGENTS when the DB is empty or in MOCK_MODE.
 *
 * Everything here is inert make-believe — it triggers no side effects.
 */
import { getDevAgents } from "./repo";
import type {
  DevAgent, DevTask, DevAgentRun, DevAgentMessage, DevArtifact, DevFileChangePlan,
  DevCodeReview, DevTestResult, DevSecurityReview, DevExperienceReview, DevReviewGate,
  DevApproval, DevDeployment, DevAuditEntry, DevAgentMemory, DevFeedback,
} from "./types";

const now = Date.now();
const ago = (mins: number) => new Date(now - mins * 60_000).toISOString();

// ── Agent roster (mirrors the 19 seeded agents) ───────────────────────────────
const AGENT_DEFS: [string, string, string, string, boolean][] = [
  ["dev-manager", "Dev Manager Agent", "Orchestration & delivery lead", "Breaks a task into phases, assigns agents, and shepherds it to a human-approved result.", true],
  ["product-requirements", "Product Requirements Agent", "Requirements & acceptance criteria", "Turns a rough task into clear requirements and acceptance criteria.", false],
  ["platform-architect", "Platform Architect Agent", "Architecture & file impact", "Recommends the design, the files to change, and the risks — as drafts only.", false],
  ["ui-ux", "UI/UX Agent", "Interface & interaction design", "Proposes layouts and flows that match the existing design system.", false],
  ["frontend", "Frontend Agent", "React / Next.js drafts", "Writes frontend code drafts for proposed file changes.", false],
  ["backend-api", "Backend/API Agent", "Server & API drafts", "Writes server-side code drafts (routes, server actions, lib functions).", false],
  ["database-supabase", "Database/Supabase Agent", "Schema & migration drafts", "Drafts SQL with a plain-English explanation — never runs it.", false],
  ["ai-integration", "AI Integration Agent", "AI engine & gateway wiring", "Designs how a feature uses the existing AI engine and gateway.", false],
  ["qa-test", "QA/Test Agent", "Tests, lint, typecheck, QA", "Writes test plans and records test/lint/typecheck/QA results.", false],
  ["security-permissions", "Security/Permissions Agent", "Security & access review", "Reviews changes for login, data-access, and secret risks.", false],
  ["devops-release", "DevOps/Release Agent", "Branch, PR, preview, release", "Prepares branch/PR/preview/release plans — every step gated by your approval.", false],
  ["documentation", "Documentation Agent", "Docs & guides", "Drafts documentation and guide updates for a change.", false],
  ["human-experience", "Human Experience Agent", "End-to-end experience review", "Walks the change as a real user and flags friction.", false],
  ["plain-english", "Plain-English Agent", "Clarity & plain language", "Rewrites labels and explanations into plain language.", false],
  ["workflow-simplification", "Workflow Simplification Agent", "Fewer steps & less friction", "Finds ways to cut steps without losing capability.", false],
  ["onboarding", "Onboarding Agent", "First-run guidance", "Designs first-run guidance and empty states.", false],
  ["accessibility", "Accessibility Agent", "Accessibility review", "Reviews contrast, keyboard, and screen-reader support.", false],
  ["performance", "Performance Agent", "Speed & efficiency review", "Flags performance risks and suggests improvements.", false],
  ["admin-support", "Admin Support Agent", "Help & triage", "Helps you use the Command Center and explains what other agents produced.", false],
];

export const SAMPLE_AGENTS: DevAgent[] = AGENT_DEFS.map(([key, name, role, description, is_manager], i) => ({
  id: `sample-agent-${key}`,
  key, name, role, description,
  system_prompt: null,
  allowed_tools: ["read", "plan"],
  restrictions: ["no_deploy", "no_migrate", "no_file_write", "no_auth_change", "no_rls_change", "no_delete"],
  model: null,
  is_manager,
  sort_order: (i + 1) * 10,
  status: "active",
  created_at: ago(60 * 24 * 30),
  updated_at: ago(60 * 24 * 30),
}));

const agentName = (key: string) => SAMPLE_AGENTS.find((a) => a.key === key)?.name ?? key;

// ── Tasks ─────────────────────────────────────────────────────────────────────
export const SAMPLE_TASKS: DevTask[] = [
  { id: "task-1", title: "Add a CSV export button to the Incidents page", description: "Let safety managers download the incident list as a spreadsheet.", target_area: "HSE Management", priority: "high", status: "code_draft", risk_level: "medium", metadata: { business_goal: "Save safety managers time pulling incident data for reports.", who_uses_it: "Safety managers", success_criteria: "A working Export button that downloads the current incident list as a CSV.", human_approval_required: true, file_changes_allowed: true, database_changes_allowed: false, github_branch_allowed: false, deployment_allowed: false }, created_by: "you", created_at: ago(180), updated_at: ago(12) },
  { id: "task-2", title: "Fix the login redirect for invited users", description: "Invited users land on the wrong page after setting their password.", target_area: "User Management", priority: "urgent", status: "approval_required", risk_level: "high", metadata: { business_goal: "Stop new users from getting lost right after they sign up.", who_uses_it: "Newly invited users", success_criteria: "Invited users land on the welcome page after setting a password.", human_approval_required: true, file_changes_allowed: true, database_changes_allowed: false, github_branch_allowed: false, deployment_allowed: false }, created_by: "you", created_at: ago(420), updated_at: ago(8) },
  { id: "task-3", title: "Make the Chemicals list page load faster", description: "The list is slow when a site has thousands of chemicals.", target_area: "HSE Management", priority: "medium", status: "architecture_review", risk_level: "medium", metadata: { business_goal: "Faster page loads for large sites.", who_uses_it: "EHS coordinators at large facilities", success_criteria: "The Chemicals list loads quickly even with thousands of items." }, created_by: "you", created_at: ago(1500), updated_at: ago(95) },
  { id: "task-4", title: "Add a dark theme to the Reports screens", description: "Match the dark theme used elsewhere in the platform.", target_area: "Document Control", priority: "low", status: "intake", risk_level: "low", metadata: { business_goal: "Consistent look across the platform.", who_uses_it: "All users", success_criteria: "Reports screens support the dark theme." }, created_by: "you", created_at: ago(60), updated_at: ago(60) },
  { id: "task-5", title: "Refresh the empty-state messages on the dashboard", description: "Friendlier wording when there is no data yet.", target_area: "Admin Console", priority: "low", status: "complete", risk_level: "low", metadata: { business_goal: "Make first-run feel welcoming.", who_uses_it: "New customers", success_criteria: "Empty states use friendly, plain-English wording." }, created_by: "you", created_at: ago(4320), updated_at: ago(2880) },
  { id: "task-6", title: "Find out why last night's data import failed", description: "The nightly import job stopped halfway.", target_area: "Platform Operations", priority: "high", status: "blocked", risk_level: "high", metadata: { business_goal: "Keep data fresh and complete.", who_uses_it: "Operations team", success_criteria: "The nightly import runs to completion reliably." }, created_by: "you", created_at: ago(700), updated_at: ago(540) },
];

// ── Agent runs (several today; 1 failed) ──────────────────────────────────────
export const SAMPLE_RUNS: DevAgentRun[] = [
  { id: "run-1", task_id: "task-1", agent_id: "sample-agent-platform-architect", phase: "plan", status: "succeeded", input: {}, output: { summary: "Proposed adding an export helper + a button in the Incidents toolbar." }, model: null, tokens_used: 1840, error: null, started_at: ago(170), finished_at: ago(168), created_at: ago(170), updated_at: ago(168) },
  { id: "run-2", task_id: "task-1", agent_id: "sample-agent-frontend", phase: "draft", status: "succeeded", input: {}, output: { summary: "Drafted the export button and CSV builder." }, model: null, tokens_used: 3120, error: null, started_at: ago(60), finished_at: ago(58), created_at: ago(60), updated_at: ago(58) },
  { id: "run-3", task_id: "task-1", agent_id: "sample-agent-qa-test", phase: "test", status: "running", input: {}, output: {}, model: null, tokens_used: null, error: null, started_at: ago(11), finished_at: null, created_at: ago(11), updated_at: ago(11) },
  { id: "run-4", task_id: "task-2", agent_id: "sample-agent-security-permissions", phase: "review", status: "succeeded", input: {}, output: { summary: "Change touches login behavior — flagged for approval." }, model: null, tokens_used: 2010, error: null, started_at: ago(30), finished_at: ago(28), created_at: ago(30), updated_at: ago(28) },
  { id: "run-5", task_id: "task-3", agent_id: "sample-agent-performance", phase: "review", status: "succeeded", input: {}, output: { summary: "Suggested adding an index and paginating the query." }, model: null, tokens_used: 1560, error: null, started_at: ago(100), finished_at: ago(98), created_at: ago(100), updated_at: ago(98) },
  { id: "run-6", task_id: "task-6", agent_id: "sample-agent-backend-api", phase: "plan", status: "failed", input: {}, output: {}, model: null, tokens_used: 240, error: "Agent execution failed: could not reach the import logs.", started_at: ago(540), finished_at: ago(539), created_at: ago(540), updated_at: ago(539) },
];

// ── Timeline messages (for task-1) ────────────────────────────────────────────
export const SAMPLE_MESSAGES: DevAgentMessage[] = [
  { id: "msg-1", run_id: "run-1", task_id: "task-1", agent_id: "sample-agent-dev-manager", role: "assistant", content: "Breaking this into plan → draft → test. Assigning the Architect first.", structured: {}, seq: 1, created_at: ago(172) },
  { id: "msg-2", run_id: "run-1", task_id: "task-1", agent_id: "sample-agent-platform-architect", role: "assistant", content: "We can add a small CSV helper and a button in the Incidents toolbar. No database change needed.", structured: {}, seq: 2, created_at: ago(168) },
  { id: "msg-3", run_id: "run-2", task_id: "task-1", agent_id: "sample-agent-frontend", role: "assistant", content: "Drafted the button and the CSV builder. Saved as a code draft for your review.", structured: {}, seq: 3, created_at: ago(58) },
  { id: "msg-4", run_id: "run-3", task_id: "task-1", agent_id: "sample-agent-qa-test", role: "thought", content: "Writing a quick test for the CSV output…", structured: {}, seq: 4, created_at: ago(11) },
];

// ── Artifacts (drafts) ────────────────────────────────────────────────────────
export const SAMPLE_ARTIFACTS: DevArtifact[] = [
  { id: "art-1", task_id: "task-1", run_id: "run-1", kind: "plan", artifact_type: null, title: "Plan: CSV export for Incidents", description: null, path: null, content: "1. Add a CSV helper\n2. Add an Export button to the toolbar\n3. Add a test", language: null, risk_level: null, approval_required: false, structured: {}, status: "approved", version: 1, created_by: "Platform Architect Agent", created_at: ago(168), updated_at: ago(160) },
  { id: "art-2", task_id: "task-1", run_id: "run-2", kind: "code_draft", artifact_type: "react_component", title: "Export button component", description: "A button that downloads the current incident list as a spreadsheet.", path: "src/app/(app)/incidents/ExportButton.tsx", content: "\"use client\";\nexport function ExportButton({ rows }) {\n  // draft — not applied to the codebase\n  return <button onClick={() => download(rows)}>Export CSV</button>;\n}", language: "tsx", risk_level: "low", approval_required: true, structured: { what_it_does: "Adds an Export button to the Incidents page.", where_it_goes: "src/app/(app)/incidents/ExportButton.tsx", files_affected: ["Incidents page toolbar"], tests_needed: "A test that the CSV includes a header row.", ux_improved: "Saves managers time — one click to download." }, status: "needs_review", version: 1, created_by: "Frontend Agent", created_at: ago(58), updated_at: ago(58) },
  { id: "art-3", task_id: "task-3", run_id: "run-5", kind: "sql_draft", artifact_type: "supabase_sql", title: "Index for the Chemicals list", description: "A database index so the Chemicals list loads faster.", path: "supabase/migrations/DRAFT_chemicals_index.sql", content: "-- DRAFT (not applied)\ncreate index if not exists chem_tenant_name_idx\n  on chemical_inventory (tenant_id, name);", language: "sql", risk_level: "medium", approval_required: true, structured: { what_it_does: "Speeds up the Chemicals list with an index.", where_it_goes: "A new migration file.", files_affected: ["chemical_inventory table"], tests_needed: "Confirm the list still shows the right rows.", ux_improved: "The page loads faster for big sites." }, status: "needs_review", version: 1, created_by: "Database/Supabase Agent", created_at: ago(98), updated_at: ago(98) },
];

// ── File change plans (draft code plans) ──────────────────────────────────────
export const SAMPLE_FILE_PLANS: DevFileChangePlan[] = [
  { id: "fcp-1", task_id: "task-1", artifact_id: "art-2", file_path: "src/app/(app)/incidents/ExportButton.tsx", change_type: "create", language: "tsx", diff: "+ export function ExportButton() { /* … */ }", rationale: "New button component for CSV export.", proposed_summary: "Add an Export button to the Incidents toolbar.", approval_required: true, risk_level: "low", status: "needs_approval", applied_at: null, created_at: ago(58), updated_at: ago(58) },
  { id: "fcp-2", task_id: "task-1", artifact_id: "art-2", file_path: "src/lib/incidents/csv.ts", change_type: "create", language: "ts", diff: "+ export function incidentsToCsv(rows) { /* … */ }", rationale: "Helper that turns incidents into CSV text.", proposed_summary: "Add a small helper that builds the CSV file.", approval_required: true, risk_level: "low", status: "needs_approval", applied_at: null, created_at: ago(58), updated_at: ago(58) },
  { id: "fcp-3", task_id: "task-2", artifact_id: null, file_path: "src/middleware.ts", change_type: "modify", language: "ts", diff: "~ adjust post-login redirect for invited users", rationale: "Send invited users to the right page after setting a password.", proposed_summary: "Fix where invited users land after login.", approval_required: true, risk_level: "high", status: "needs_approval", applied_at: null, created_at: ago(28), updated_at: ago(28) },
];

// ── Code reviews ──────────────────────────────────────────────────────────────
export const SAMPLE_CODE_REVIEWS: DevCodeReview[] = [
  { id: "cr-1", task_id: "task-1", run_id: "run-2", artifact_id: "art-2", reviewer_agent_id: "sample-agent-platform-architect", summary: "Clean and matches the existing toolbar pattern. One small naming nit.", findings: [{ file: "ExportButton.tsx", severity: "low", note: "Rename `doExport` to `handleExport` for consistency." }], verdict: "changes_requested", risk_level: "low", status: "open", created_at: ago(50), updated_at: ago(50) },
];

// ── Test results ──────────────────────────────────────────────────────────────
export const SAMPLE_TEST_RESULTS: DevTestResult[] = [
  { id: "tr-1", task_id: "task-1", run_id: "run-3", kind: "typecheck", status: "passed", summary: "No type errors.", passed: 1, failed: 0, skipped: 0, details: {}, log: null, created_at: ago(10), updated_at: ago(10) },
  { id: "tr-2", task_id: "task-1", run_id: "run-3", kind: "unit", status: "failed", summary: "1 of 4 checks failed — empty list should export a header row.", passed: 3, failed: 1, skipped: 0, details: {}, log: "expected header row when there are no incidents", created_at: ago(9), updated_at: ago(9) },
  { id: "tr-3", task_id: "task-3", run_id: "run-5", kind: "lint", status: "passed", summary: "No lint issues.", passed: 1, failed: 0, skipped: 0, details: {}, log: null, created_at: ago(96), updated_at: ago(96) },
];

// ── Security reviews ──────────────────────────────────────────────────────────
export const SAMPLE_SECURITY_REVIEWS: DevSecurityReview[] = [
  { id: "sr-1", task_id: "task-2", run_id: "run-4", reviewer_agent_id: "sample-agent-security-permissions", summary: "This change affects login behavior, so it needs your approval before going further.", findings: [{ category: "Login permission issue", severity: "high", note: "Redirect logic runs before the session is confirmed." }], risk_level: "high", verdict: "needs_changes", status: "open", created_at: ago(27), updated_at: ago(27) },
];

// ── Experience reviews ────────────────────────────────────────────────────────
export const SAMPLE_EXPERIENCE_REVIEWS: DevExperienceReview[] = [
  { id: "er-1", task_id: "task-1", run_id: null, reviewer_agent_id: "sample-agent-plain-english", perspective: "plain_english", summary: "Button label “Export CSV” is clear. Add a short tooltip explaining what downloads.", findings: [], score: 88, verdict: "approved", status: "open", created_at: ago(40), updated_at: ago(40) },
  { id: "er-2", task_id: "task-3", run_id: null, reviewer_agent_id: "sample-agent-human-experience", perspective: "ux", summary: "The page jumps when results reload. Smooth this out before shipping.", findings: [], score: 64, verdict: "changes_requested", status: "open", created_at: ago(90), updated_at: ago(90) },
];

// ── Approvals (the human gate) ────────────────────────────────────────────────
const APPR_DEFAULTS = { reason: null, plain_english_summary: null, technical_summary: null, experience_impact: null, affected_files: [] as string[], affected_tables: [] as string[], details: {} };
export const SAMPLE_APPROVALS: DevApproval[] = [
  { id: "apr-1", task_id: "task-2", approval_type: "auth_permission_change", target_type: "dev_file_change_plans", target_id: "fcp-3", risk_level: "high", summary: "Change how invited users are redirected after login", proposed_change: "Modify src/middleware.ts to redirect invited users to the welcome page once their session is confirmed.", reason: "This changes login behavior, so it needs your go-ahead.", plain_english_summary: "Send invited users to the right page after they set a password.", technical_summary: "Adjust the post-login redirect in middleware.ts after the session is confirmed.", experience_impact: "New users won't get lost right after signing up.", affected_files: ["src/middleware.ts"], affected_tables: [], details: {}, status: "pending", requested_by: "Security/Permissions Agent", decided_by: null, decided_at: null, decision_note: null, created_at: ago(26), updated_at: ago(26) },
  { id: "apr-2", task_id: "task-1", approval_type: "file_write", target_type: "dev_file_change_plans", target_id: "fcp-1", risk_level: "low", summary: "Save the new Export button and CSV helper to files", proposed_change: "Create src/app/(app)/incidents/ExportButton.tsx and src/lib/incidents/csv.ts from the approved drafts.", reason: "The team is ready to save the drafted code.", plain_english_summary: "Add the Export button and the helper that builds the spreadsheet.", technical_summary: "Create two new files from the approved drafts.", experience_impact: "Managers get a one-click download.", affected_files: ["src/app/(app)/incidents/ExportButton.tsx", "src/lib/incidents/csv.ts"], affected_tables: [], details: {}, status: "pending", requested_by: "Frontend Agent", decided_by: null, decided_at: null, decision_note: null, created_at: ago(20), updated_at: ago(20) },
  { id: "apr-3", task_id: "task-3", approval_type: "database_change", target_type: "dev_artifacts", target_id: "art-3", risk_level: "medium", summary: "Add a database index to speed up the Chemicals list", proposed_change: "create index on chemical_inventory (tenant_id, name);", reason: "A database change needs your approval before it runs.", plain_english_summary: "Add an index so the Chemicals list loads faster.", technical_summary: "create index on chemical_inventory (tenant_id, name);", experience_impact: "The page loads faster for big sites.", affected_files: ["supabase/migrations/DRAFT_chemicals_index.sql"], affected_tables: ["chemical_inventory"], details: {}, status: "pending", requested_by: "Database/Supabase Agent", decided_by: null, decided_at: null, decision_note: null, created_at: ago(15), updated_at: ago(15) },
  { id: "apr-4", task_id: "task-5", approval_type: "file_write", target_type: "dev_file_change_plans", target_id: null, risk_level: "low", summary: "Save the refreshed empty-state messages", proposed_change: "Update dashboard empty-state copy.", ...APPR_DEFAULTS, plain_english_summary: "Save the friendlier empty-state wording.", status: "approved", requested_by: "Frontend Agent", decided_by: "you", decided_at: ago(2900), decision_note: "Looks good.", created_at: ago(3000), updated_at: ago(2900) },
];

// ── Deployments (branch / PR / preview / release) ─────────────────────────────
export const SAMPLE_DEPLOYMENTS: DevDeployment[] = [
  { id: "dep-1", task_id: "task-3", approval_id: null, branch: "devcmd/chemicals-speed", pull_request_url: "https://github.com/example/repo/pull/142", pr_number: 142, preview_url: "https://preview-142.example.app", release_tag: null, commit_sha: "a1b2c3d", environment: "preview", status: "pr_open", notes: "Awaiting review.", created_by: "DevOps/Release Agent", created_at: ago(80), updated_at: ago(70) },
  { id: "dep-2", task_id: "task-5", approval_id: "apr-4", branch: "devcmd/dashboard-empty-states", pull_request_url: "https://github.com/example/repo/pull/138", pr_number: 138, preview_url: "https://preview-138.example.app", release_tag: "v1.4.2", commit_sha: "9f8e7d6", environment: "production", status: "released", notes: "Shipped.", created_by: "DevOps/Release Agent", created_at: ago(3000), updated_at: ago(2700) },
];

// ── Audit log ─────────────────────────────────────────────────────────────────
export const SAMPLE_AUDIT: DevAuditEntry[] = [
  { id: "aud-1", task_id: "task-1", actor_type: "human", actor_id: "you", agent_id: null, action: "Created task", entity: "dev_tasks", entity_id: "task-1", risk_level: "low", detail: {}, created_at: ago(180) },
  { id: "aud-2", task_id: "task-1", actor_type: "agent", actor_id: "platform-architect", agent_id: "sample-agent-platform-architect", action: "Wrote a plan", entity: "dev_artifacts", entity_id: "art-1", risk_level: "low", detail: {}, created_at: ago(168) },
  { id: "aud-3", task_id: "task-1", actor_type: "agent", actor_id: "frontend", agent_id: "sample-agent-frontend", action: "Drafted code", entity: "dev_artifacts", entity_id: "art-2", risk_level: "low", detail: {}, created_at: ago(58) },
  { id: "aud-4", task_id: "task-2", actor_type: "agent", actor_id: "security-permissions", agent_id: "sample-agent-security-permissions", action: "Requested approval (Login permission change)", entity: "dev_approvals", entity_id: "apr-1", risk_level: "high", detail: {}, created_at: ago(26) },
  { id: "aud-5", task_id: "task-6", actor_type: "system", actor_id: "system", agent_id: null, action: "AI task failed", entity: "dev_agent_runs", entity_id: "run-6", risk_level: "high", detail: {}, created_at: ago(539) },
  { id: "aud-6", task_id: "task-5", actor_type: "human", actor_id: "you", agent_id: null, action: "Approved a file save", entity: "dev_approvals", entity_id: "apr-4", risk_level: "low", detail: {}, created_at: ago(2900) },
];

// ── Agent memory + feedback (used on settings) ────────────────────────────────
export const SAMPLE_MEMORY: DevAgentMemory[] = [
  { id: "mem-1", agent_id: null, task_id: null, kind: "user_preference", title: "Always explain database changes in plain English first", content: "Before any database change, describe it plainly and wait for approval.", structured: {}, tags: ["database", "approvals"], status: "active", created_by: "you", created_at: ago(5000), updated_at: ago(5000) },
  { id: "mem-2", agent_id: null, task_id: null, kind: "approved_pattern", title: "Reuse the existing Card and Stat components", content: "New screens should use the shared UI primitives, not custom cards.", structured: {}, tags: ["ui"], status: "active", created_by: "you", created_at: ago(4000), updated_at: ago(4000) },
];

export const SAMPLE_FEEDBACK: DevFeedback[] = [
  { id: "fb-1", task_id: null, screen: "/admin/dev-command/approvals", category: "improvement", risk_level: "low", message: "Add a one-line summary of what each approval will change.", status: "open", created_by: "you", resolved_by: null, resolved_at: null, created_at: ago(200), updated_at: ago(200) },
];

// ── Review gates (Phase 9) ────────────────────────────────────────────────────
const qaItems = ["Acceptance criteria met", "Form validation works", "Empty states", "Loading states", "Error states", "Mobile / tablet layout"].map((label) => ({ label, passed: true }));
export const SAMPLE_REVIEW_GATES: DevReviewGate[] = [
  { id: "rg-1", task_id: "task-1", gate_type: "qa", agent_name: "QA/Test Agent", status: "passed", summary: "QA review looks good.", checklist: qaItems, required_fixes: [], score: 100, decided_by: null, decided_at: null, created_at: ago(40), updated_at: ago(40) },
  { id: "rg-2", task_id: "task-1", gate_type: "experience", agent_name: "Human Experience Agent", status: "passed", summary: "Easy to understand and use.", checklist: ["The screen is easy to understand", "Labels are plain-English", "The next step is obvious"].map((label) => ({ label, passed: true })), required_fixes: [], score: 100, decided_by: null, decided_at: null, created_at: ago(38), updated_at: ago(38) },
  { id: "rg-3", task_id: "task-2", gate_type: "security", agent_name: "Security/Permissions Agent", status: "needs_revision", summary: "A few security items need attention before release.", checklist: [{ label: "Admin-only access", passed: true }, { label: "Authentication", passed: true }, { label: "Data-access (RLS) risk", passed: false, note: "Needs a closer look before release." }, { label: "No unexpected permission changes", passed: false, note: "Needs a closer look before release." }], required_fixes: ["This touches logins/permissions — verify admin-only access.", "The risk level is high — double-check access and data exposure."], score: 50, decided_by: null, decided_at: null, created_at: ago(25), updated_at: ago(25) },
];

// ── Lookups + dashboard metrics ───────────────────────────────────────────────
export function agentNameById(id: string | null, agents: DevAgent[] = SAMPLE_AGENTS): string {
  if (!id) return "—";
  return agents.find((a) => a.id === id)?.name ?? "AI agent";
}

export interface DashboardMetric {
  key: string;
  label: string;
  value: number;
  hint: string;
  tone: "neutral" | "info" | "success" | "warn" | "danger" | "violet";
  href: string;
}

export function dashboardMetrics(): DashboardMetric[] {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const isToday = (iso: string) => new Date(iso) >= startOfDay;
  const openTasks = SAMPLE_TASKS.filter((t) => !["complete", "rejected"].includes(t.status)).length;
  const needApproval = SAMPLE_APPROVALS.filter((a) => a.status === "pending").length;
  const runsToday = SAMPLE_RUNS.filter((r) => isToday(r.created_at)).length;
  const failedRuns = SAMPLE_RUNS.filter((r) => r.status === "failed").length;
  const securityWarnings = SAMPLE_SECURITY_REVIEWS.filter((s) => s.verdict === "fail" || s.verdict === "needs_changes").length;
  const xpFailures = SAMPLE_EXPERIENCE_REVIEWS.filter((e) => e.verdict === "changes_requested" || e.verdict === "rejected").length;
  const draftPlans = SAMPLE_FILE_PLANS.filter((p) => p.status === "planned" || p.status === "needs_approval").length;
  const activePRs = SAMPLE_DEPLOYMENTS.filter((d) => d.status === "pr_open").length;
  const recentDeploys = SAMPLE_DEPLOYMENTS.length;
  const auditActivity = SAMPLE_AUDIT.filter((a) => isToday(a.created_at)).length;

  return [
    { key: "open_tasks", label: "Open dev tasks", value: openTasks, hint: "Tasks that aren't finished yet", tone: "info", href: "/admin/dev-command/tasks" },
    { key: "need_approval", label: "Tasks needing approval", value: needApproval, hint: "Waiting for your yes/no", tone: "violet", href: "/admin/dev-command/approvals" },
    { key: "runs_today", label: "Agent runs today", value: runsToday, hint: "AI work started today", tone: "neutral", href: "/admin/dev-command/audit-log" },
    { key: "failed_runs", label: "Failed agent runs", value: failedRuns, hint: "AI tasks that errored", tone: failedRuns ? "danger" : "neutral", href: "/admin/dev-command/audit-log" },
    { key: "security_warnings", label: "Security warnings", value: securityWarnings, hint: "Reviews that need attention", tone: securityWarnings ? "danger" : "success", href: "/admin/dev-command/tasks" },
    { key: "xp_failures", label: "Experience review issues", value: xpFailures, hint: "Ease-of-use problems found", tone: xpFailures ? "warn" : "success", href: "/admin/dev-command/tasks" },
    { key: "draft_plans", label: "Draft code plans", value: draftPlans, hint: "Proposed file changes, not yet applied", tone: "info", href: "/admin/dev-command/tasks" },
    { key: "active_prs", label: "Active pull requests", value: activePRs, hint: "Open code reviews on GitHub", tone: "info", href: "/admin/dev-command/tasks" },
    { key: "recent_deploys", label: "Recent deployments", value: recentDeploys, hint: "Previews and releases", tone: "neutral", href: "/admin/dev-command/tasks" },
    { key: "audit_today", label: "Audit log activity today", value: auditActivity, hint: "Actions recorded today", tone: "neutral", href: "/admin/dev-command/audit-log" },
  ];
}

/** A single task with all of its related sample records, for the detail page. */
export function taskBundle(taskId: string) {
  const task = SAMPLE_TASKS.find((t) => t.id === taskId) ?? null;
  return {
    task,
    runs: SAMPLE_RUNS.filter((r) => r.task_id === taskId),
    messages: SAMPLE_MESSAGES.filter((m) => m.task_id === taskId),
    artifacts: SAMPLE_ARTIFACTS.filter((a) => a.task_id === taskId),
    filePlans: SAMPLE_FILE_PLANS.filter((p) => p.task_id === taskId),
    codeReviews: SAMPLE_CODE_REVIEWS.filter((c) => c.task_id === taskId),
    testResults: SAMPLE_TEST_RESULTS.filter((t) => t.task_id === taskId),
    securityReviews: SAMPLE_SECURITY_REVIEWS.filter((s) => s.task_id === taskId),
    experienceReviews: SAMPLE_EXPERIENCE_REVIEWS.filter((e) => e.task_id === taskId),
    reviewGates: SAMPLE_REVIEW_GATES.filter((g) => g.task_id === taskId),
    approvals: SAMPLE_APPROVALS.filter((a) => a.task_id === taskId),
    deployments: SAMPLE_DEPLOYMENTS.filter((d) => d.task_id === taskId),
  };
}

/** Real seeded agents when available (live), else the sample roster. */
export async function getAgentsOrSample(): Promise<{ agents: DevAgent[]; usingSample: boolean }> {
  try {
    const real = await getDevAgents();
    if (real.length) return { agents: real, usingSample: false };
  } catch {
    /* fall through to sample */
  }
  return { agents: SAMPLE_AGENTS, usingSample: true };
}

export { agentName };
