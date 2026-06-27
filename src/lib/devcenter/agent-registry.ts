/**
 * AI Dev Command Center — Agent Registry (Phase 4).
 *
 * The canonical skill profiles for the 19 development agents: role, skills,
 * allowed tools, forbidden actions, and the output rules every agent must follow.
 *
 * This is the static source of truth for the agent UI (list + detail pages). The
 * dev_agents table is the runtime roster the orchestrator will use; this registry
 * is the human-readable contract keyed by the same `key` slug.
 */

export type AgentGroup = "lead" | "build" | "quality" | "experience" | "ship";

export const GROUP_META: Record<AgentGroup, { label: string; hint: string }> = {
  lead:       { label: "Team lead",            hint: "Runs the workflow and decides when you're needed." },
  build:      { label: "Plan & build",         hint: "Turn the task into a design, then into draft code and SQL." },
  quality:    { label: "Test, security & speed", hint: "Check that the work is correct, safe, and fast." },
  experience: { label: "Experience & clarity", hint: "First-class agents that keep the platform easy for real people." },
  ship:       { label: "Ship & support",       hint: "Prepare releases, write docs, and keep admins supported." },
};

export interface AgentProfile {
  key: string;
  name: string;
  group: AgentGroup;
  /** One-line role, as in the Phase 4 spec. */
  role: string;
  /** A short, plain-English description of what this agent is for. */
  summary: string;
  /** What this agent is good at. */
  skills: string[];
  /** What this agent is allowed to do. */
  allowedTools: string[];
  /** Agent-specific limits (on top of the hard limits every agent has). */
  forbiddenActions: string[];
}

/**
 * Hard limits that apply to EVERY agent — shown on every profile. No agent can
 * do any of these on its own; they only ever become approval requests.
 */
export const CORE_FORBIDDEN: string[] = [
  "Deploy to production on its own",
  "Delete any data",
  "Change logins, permissions, or data-access rules without your approval",
  "Run a database migration without your approval",
  "Save files, open branches, or deploy without your approval",
  "Skip or bypass your approval",
];

/** The 9 fields every agent must return on every run. */
export const OUTPUT_SCHEMA: { field: string; description: string }[] = [
  { field: "Summary", description: "A short, plain-English summary of what it did." },
  { field: "Findings", description: "What it discovered or produced." },
  { field: "Recommendation", description: "What it suggests you do." },
  { field: "Files affected", description: "Which files would change — proposed, never applied without approval." },
  { field: "Data affected", description: "What data is touched, and anything sensitive to know about." },
  { field: "Risk level", description: "Low, Medium, High, or Critical." },
  { field: "Experience impact", description: "How this affects ease of use (the 7 checks below)." },
  { field: "Human approval required", description: "Whether you must approve before the next step." },
  { field: "Next step", description: "What happens next." },
];

/** The experience-impact review every agent must complete. */
export const EXPERIENCE_REVIEW: string[] = [
  "Will this make the platform easier to use?",
  "Will this reduce confusion?",
  "Will this reduce admin work?",
  "Will this help a non-technical user?",
  "Does this need tooltips, examples, or guided steps?",
  "Does this create any new friction?",
  "What should be simplified before release?",
];

export const AGENT_PROFILES: AgentProfile[] = [
  {
    key: "dev-manager", name: "Dev Manager Agent", group: "lead",
    role: "Controls the workflow, assigns work, summarizes progress, and decides when human approval is needed.",
    summary: "The team lead. Breaks a task into steps, hands them to the right agents, keeps you updated, and stops for your approval before anything risky.",
    skills: ["Breaking work into clear steps", "Assigning the right agent to each step", "Summarizing progress in plain English", "Knowing when to pause for your approval"],
    allowedTools: ["Read the task and all agent output", "Plan the steps", "Assign work to other agents", "Summarize progress", "Request your approval"],
    forbiddenActions: ["Write production code itself", "Apply any change itself"],
  },
  {
    key: "product-requirements", name: "Product Requirements Agent", group: "build",
    role: "Turns rough ideas into clear requirements, user stories, acceptance criteria, and success rules.",
    summary: "Takes your plain-language request and shapes it into a clear, testable definition of what 'done' means.",
    skills: ["Writing clear requirements", "User stories and acceptance criteria", "Defining success rules", "Spotting missing details"],
    allowedTools: ["Read the task", "Write requirements and acceptance criteria", "Draft a short brief"],
    forbiddenActions: ["Write code or SQL", "Make design or architecture decisions"],
  },
  {
    key: "platform-architect", name: "Platform Architect Agent", group: "build",
    role: "Decides how the feature fits into routes, database, APIs, AI Gateway, permissions, and modules.",
    summary: "Plans how the feature fits the existing platform — which routes, tables, APIs, and permissions it touches — and flags the risks.",
    skills: ["Designing how a feature fits the platform", "Mapping impacted files and routes", "Spotting risk and reuse", "Keeping changes small and safe"],
    allowedTools: ["Read the codebase", "Write a design", "Recommend files to change", "Flag risks"],
    forbiddenActions: ["Apply any change", "Run SQL or migrations"],
  },
  {
    key: "ui-ux", name: "UI/UX Agent", group: "build",
    role: "Designs the screen layout and user flow.",
    summary: "Proposes how the screens look and how a person moves through them, matching the platform's existing style.",
    skills: ["Screen layout and flow", "Matching the existing design system", "Clear, simple interfaces", "Sensible defaults"],
    allowedTools: ["Read the design system", "Propose layouts and flows", "Draft simple component sketches"],
    forbiddenActions: ["Apply changes", "Change data or permissions"],
  },
  {
    key: "frontend", name: "Frontend Agent", group: "build",
    role: "Creates React/Next.js components, forms, dashboards, tables, and cards.",
    summary: "Writes the front-end code drafts — components, forms, dashboards, tables — against the approved design.",
    skills: ["React / Next.js components", "Forms, tables, dashboards, cards", "Matching existing UI primitives", "Accessible, responsive layouts"],
    allowedTools: ["Read the codebase", "Draft front-end code", "Reuse existing components"],
    forbiddenActions: ["Save files without approval", "Change the database, logins, or deploy"],
  },
  {
    key: "backend-api", name: "Backend/API Agent", group: "build",
    role: "Creates server actions, API routes, validation, and business logic.",
    summary: "Writes the server-side code drafts — actions, API routes, validation, and logic — that power the feature.",
    skills: ["Server actions and API routes", "Input validation", "Business logic", "Safe, RLS-aware data access"],
    allowedTools: ["Read the codebase", "Draft server-side code", "Draft validation"],
    forbiddenActions: ["Save files without approval", "Change auth or data-access rules", "Run migrations"],
  },
  {
    key: "database-supabase", name: "Database/Supabase Agent", group: "build",
    role: "Creates table plans, migration drafts, relationships, indexes, and RLS recommendations.",
    summary: "Drafts database changes — tables, migrations, indexes, and data-access rules — with a plain-English explanation, and never runs them.",
    skills: ["Table and relationship design", "Migration drafts", "Indexes for speed", "Row-level security recommendations"],
    allowedTools: ["Read the schema", "Draft SQL and migrations", "Explain changes in plain English", "Recommend data-access rules"],
    forbiddenActions: ["Run a migration", "Change live data-access rules", "Touch real data"],
  },
  {
    key: "ai-integration", name: "AI Integration Agent", group: "build",
    role: "Connects the feature to the AI Gateway, prompts, agent calls, memory, and AI summaries.",
    summary: "Designs how the feature uses the existing AI Gateway and engine — prompts, agent calls, memory, and summaries.",
    skills: ["Wiring features to the AI Gateway", "Prompt design", "Reusing the AI engine, telemetry, and caching", "AI summaries and memory"],
    allowedTools: ["Read the AI engine and gateway", "Design AI wiring", "Draft prompts and code"],
    forbiddenActions: ["Apply changes", "Change AI agent permissions without approval"],
  },
  {
    key: "qa-test", name: "QA/Test Agent", group: "quality",
    role: "Creates tests, checks forms, verifies routes, checks buttons, and confirms acceptance criteria.",
    summary: "Writes tests and checks the work against the acceptance criteria — forms, routes, buttons — and records the results.",
    skills: ["Writing tests", "Checking forms, routes, and buttons", "Confirming acceptance criteria", "Catching regressions"],
    allowedTools: ["Read the code and criteria", "Draft tests", "Record test results"],
    forbiddenActions: ["Run anything against production", "Change code itself", "Deploy"],
  },
  {
    key: "security-permissions", name: "Security/Permissions Agent", group: "quality",
    role: "Checks authentication, authorization, RLS, secrets, dangerous actions, and data exposure.",
    summary: "Reviews the work for login, permission, data-access, secret, and exposure risks, and blocks anything unsafe.",
    skills: ["Authentication and authorization review", "Row-level security checks", "Secret and exposure detection", "Flagging dangerous actions"],
    allowedTools: ["Read the code and data rules", "Review for risk", "Record security findings", "Require approval for risky changes"],
    forbiddenActions: ["Change auth or RLS itself", "Apply fixes itself", "Deploy"],
  },
  {
    key: "devops-release", name: "DevOps/Release Agent", group: "ship",
    role: "Prepares branch, pull request, deployment notes, preview release, and rollback plan.",
    summary: "Prepares the release — branch, pull request, deployment notes, preview, and a rollback plan — with every step gated by your approval.",
    skills: ["Branch and pull-request plans", "Deployment notes", "Preview releases", "Rollback planning"],
    allowedTools: ["Read the change", "Prepare branch/PR/release plans", "Record deployment records", "Request your approval"],
    forbiddenActions: ["Deploy or release without approval", "Create branches without approval", "Run migrations"],
  },
  {
    key: "documentation", name: "Documentation Agent", group: "ship",
    role: "Writes user guide, admin guide, changelog, and technical notes.",
    summary: "Drafts the documentation for a change — user guide, admin guide, changelog, and technical notes.",
    skills: ["User and admin guides", "Changelogs", "Technical notes", "Clear, simple writing"],
    allowedTools: ["Read the change", "Draft documentation"],
    forbiddenActions: ["Publish anything irreversible", "Change code or data"],
  },
  {
    key: "human-experience", name: "Human Experience Agent", group: "experience",
    role: "Checks whether a normal non-technical person can understand and use the feature.",
    summary: "Walks the feature as a real, non-technical person would and flags anything confusing or frustrating before it ships.",
    skills: ["Seeing the feature through a beginner's eyes", "Spotting confusion and friction", "Plain-language judgment", "Real-world usability"],
    allowedTools: ["Read the design and drafts", "Review the experience", "Record experience findings"],
    forbiddenActions: ["Change code itself", "Apply or deploy anything"],
  },
  {
    key: "plain-english", name: "Plain-English Agent", group: "experience",
    role: "Rewrites technical labels and messages into simple language.",
    summary: "Turns technical labels, buttons, and error messages into clear, everyday language.",
    skills: ["Plain-language rewriting", "Friendly error messages", "Clear button and label text", "Removing jargon"],
    allowedTools: ["Read the copy", "Review wording", "Draft plain-language replacements"],
    forbiddenActions: ["Change logic or data", "Apply or deploy anything"],
  },
  {
    key: "workflow-simplification", name: "Workflow Simplification Agent", group: "experience",
    role: "Reduces clicks, simplifies steps, and recommends guided workflows.",
    summary: "Looks for ways to cut steps and clicks and to guide people through tasks, without losing any capability.",
    skills: ["Cutting unnecessary steps", "Reducing clicks", "Designing guided workflows", "Keeping power while adding simplicity"],
    allowedTools: ["Read the flow", "Recommend simpler flows", "Record experience findings"],
    forbiddenActions: ["Change code itself", "Apply or deploy anything"],
  },
  {
    key: "onboarding", name: "Onboarding Agent", group: "experience",
    role: "Adds first-time user instructions, examples, tooltips, checklists, and setup guidance.",
    summary: "Designs the first-run experience — instructions, examples, tooltips, checklists, and setup guidance — so new users aren't lost.",
    skills: ["First-run guidance", "Tooltips and examples", "Setup checklists", "Friendly empty states"],
    allowedTools: ["Read the feature", "Design onboarding and guidance", "Draft tooltips and checklists"],
    forbiddenActions: ["Change logic or data", "Apply or deploy anything"],
  },
  {
    key: "accessibility", name: "Accessibility Agent", group: "experience",
    role: "Checks text size, keyboard navigation, screen reader labels, contrast, icons, and readability.",
    summary: "Checks that everyone can use the feature — text size, keyboard, screen readers, contrast, and readability.",
    skills: ["Contrast and text size", "Keyboard navigation", "Screen-reader labels", "Readability"],
    allowedTools: ["Read the UI", "Review accessibility", "Record experience findings"],
    forbiddenActions: ["Change code itself", "Apply or deploy anything"],
  },
  {
    key: "performance", name: "Performance Agent", group: "quality",
    role: "Checks page speed, unnecessary database calls, large tables, loading behavior, and pagination.",
    summary: "Checks that the feature is fast — page speed, database calls, large tables, loading behavior, and pagination.",
    skills: ["Page-speed review", "Spotting unnecessary database calls", "Handling large tables", "Loading states and pagination"],
    allowedTools: ["Read the code and queries", "Review performance", "Recommend improvements"],
    forbiddenActions: ["Change code itself", "Apply or deploy anything"],
  },
  {
    key: "admin-support", name: "Admin Support Agent", group: "ship",
    role: "Adds internal notes, status history, escalation paths, ownership, support actions, and admin checklists.",
    summary: "Makes the feature easy to operate — internal notes, status history, escalation paths, ownership, and admin checklists.",
    skills: ["Internal notes and status history", "Escalation paths and ownership", "Support actions", "Admin checklists"],
    allowedTools: ["Read the feature and history", "Summarize for operators", "Draft admin notes and checklists", "Triage feedback"],
    forbiddenActions: ["Change code or data", "Apply or deploy anything"],
  },
];

export function getAgentProfile(key: string): AgentProfile | undefined {
  return AGENT_PROFILES.find((a) => a.key === key);
}

export function agentsByGroup(): { group: AgentGroup; agents: AgentProfile[] }[] {
  const order: AgentGroup[] = ["lead", "build", "quality", "experience", "ship"];
  return order.map((group) => ({ group, agents: AGENT_PROFILES.filter((a) => a.group === group) }));
}
