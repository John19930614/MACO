/**
 * AI Dev Command Center — Planning agents (Phase 6).
 *
 * The first six REAL planning agents. Each produces a structured planning output
 * from the task. They never write files, run SQL, or deploy — they only produce
 * plans saved as dev_artifacts.
 *
 * Each agent uses the platform AI engine (generateStructuredJson) when an API key
 * is configured, and falls back to a deterministic generator built from the
 * task's own fields otherwise — so the agents are useful with or without live AI.
 */
import "server-only";
import { z } from "zod";
import { MOCK_MODE, hasLiveAi } from "@/lib/env";
import { generateStructuredJson, type JsonSchemaSpec } from "@/lib/ai/provider";
import { codebaseContextForPrompt } from "./codebaseContext";
import { getActiveMemory, formatMemoryForPrompt } from "./memory";
import type { DevTask, DevTaskMeta, RiskLevel } from "./types";

const RISK = z.enum(["low", "medium", "high", "critical"]);
const strArr = { type: "array", items: { type: "string" } } as const;

// ── Output shapes (mirror the Phase 6 spec field lists) ───────────────────────
export interface RequirementsOutput {
  task_summary: string; business_goal: string; user_stories: string[];
  acceptance_criteria: string[]; in_scope: string[]; out_of_scope: string[];
  unknowns: string[]; risk_level: RiskLevel; human_approval_required: boolean;
}
export interface ArchitectureOutput {
  affected_modules: string[]; route_changes: string[]; component_changes: string[];
  api_changes: string[]; database_changes: string[]; permission_concerns: string[];
  ai_gateway_concerns: string[]; file_impact_estimate: string; risk_level: RiskLevel;
}
export interface UiUxOutput {
  screen_layout: string; cards: string[]; tables: string[]; forms: string[];
  buttons: string[]; status_labels: string[]; empty_states: string[];
  loading_states: string[]; error_states: string[];
}
export interface HumanExperienceOutput {
  experience_rating: number; confusing: string[]; simplify: string[]; rename: string[];
  remove: string[]; needs_guided_help: string[]; final_recommendation: string;
}
export interface PlainEnglishOutput {
  rewrites: { technical_label: string; plain_english_label: string; admin_explanation: string; recommended_wording: string }[];
}
export interface WorkflowSimplificationOutput {
  current_steps: string[]; improved_steps: string[]; steps_removed: string[];
  ai_automation_opportunities: string[]; human_approval_points: string[];
}

// ── Zod validators (defense in depth on AI output) ────────────────────────────
const zRequirements = z.object({
  task_summary: z.string(), business_goal: z.string(), user_stories: z.array(z.string()),
  acceptance_criteria: z.array(z.string()), in_scope: z.array(z.string()), out_of_scope: z.array(z.string()),
  unknowns: z.array(z.string()), risk_level: RISK, human_approval_required: z.boolean(),
});
const zArchitecture = z.object({
  affected_modules: z.array(z.string()), route_changes: z.array(z.string()), component_changes: z.array(z.string()),
  api_changes: z.array(z.string()), database_changes: z.array(z.string()), permission_concerns: z.array(z.string()),
  ai_gateway_concerns: z.array(z.string()), file_impact_estimate: z.string(), risk_level: RISK,
});
const zUiUx = z.object({
  screen_layout: z.string(), cards: z.array(z.string()), tables: z.array(z.string()), forms: z.array(z.string()),
  buttons: z.array(z.string()), status_labels: z.array(z.string()), empty_states: z.array(z.string()),
  loading_states: z.array(z.string()), error_states: z.array(z.string()),
});
const zHumanExp = z.object({
  experience_rating: z.number(), confusing: z.array(z.string()), simplify: z.array(z.string()),
  rename: z.array(z.string()), remove: z.array(z.string()), needs_guided_help: z.array(z.string()),
  final_recommendation: z.string(),
});
const zPlainEnglish = z.object({
  rewrites: z.array(z.object({
    technical_label: z.string(), plain_english_label: z.string(),
    admin_explanation: z.string(), recommended_wording: z.string(),
  })),
});
const zWorkflowSimp = z.object({
  current_steps: z.array(z.string()), improved_steps: z.array(z.string()), steps_removed: z.array(z.string()),
  ai_automation_opportunities: z.array(z.string()), human_approval_points: z.array(z.string()),
});

// ── Shared helpers ────────────────────────────────────────────────────────────
function meta(task: DevTask): DevTaskMeta {
  return (task.metadata ?? {}) as DevTaskMeta;
}
function taskContext(task: DevTask): string {
  const m = meta(task);
  const lines = [
    `Title: ${task.title}`,
    task.description ? `Description: ${task.description}` : "",
    m.business_goal ? `Business goal: ${m.business_goal}` : "",
    task.target_area ? `Module: ${task.target_area}` : "",
    m.who_uses_it ? `Who uses it: ${m.who_uses_it}` : "",
    m.data_involved ? `Data involved: ${m.data_involved}` : "",
    m.ai_role ? `AI's role: ${m.ai_role}` : "",
    m.success_criteria ? `Success criteria: ${m.success_criteria}` : "",
    `Risk estimate: ${task.risk_level}`,
    `Allowed: db=${!!m.database_changes_allowed} files=${!!m.file_changes_allowed} branch=${!!m.github_branch_allowed} deploy=${!!m.deployment_allowed}`,
  ];
  return lines.filter(Boolean).join("\n");
}
const splitCriteria = (s?: string): string[] =>
  (s ?? "").split(/[\n;.]+/).map((x) => x.trim()).filter(Boolean);

/** Try the AI engine; validate; fall back to the deterministic output. */
async function withAI<T>(opts: {
  system: string; user: string; schema: JsonSchemaSpec; zod: z.ZodType<T>; fallback: T;
}): Promise<{ data: T; aiBacked: boolean }> {
  if (MOCK_MODE || !hasLiveAi()) return { data: opts.fallback, aiBacked: false };
  try {
    // Ground every planning agent in the real codebase (cached as the system
    // prefix by the provider, so it's cheap across all agents/records).
    const system = `${opts.system}\n\n${codebaseContextForPrompt()}`;
    const res = await generateStructuredJson({ system, user: opts.user, schema: opts.schema, maxTokens: 1600, tier: "deep" });
    const parsed = opts.zod.safeParse(res.data);
    return parsed.success ? { data: parsed.data, aiBacked: true } : { data: opts.fallback, aiBacked: false };
  } catch {
    return { data: opts.fallback, aiBacked: false };
  }
}
const jsonSchema = (name: string, properties: Record<string, unknown>): JsonSchemaSpec => ({
  name, strict: false, schema: { type: "object", properties, additionalProperties: false },
});

// ── Agent: Product Requirements ───────────────────────────────────────────────
async function requirements(task: DevTask, mem: string) {
  const m = meta(task);
  const fallback: RequirementsOutput = {
    task_summary: task.title,
    business_goal: m.business_goal || `Deliver: ${task.title}`,
    user_stories: [`As ${m.who_uses_it || "a user"}, I want ${task.title.toLowerCase()} so that ${m.business_goal || "the work is easier"}.`],
    acceptance_criteria: splitCriteria(m.success_criteria).length ? splitCriteria(m.success_criteria) : ["The feature works as described.", "A non-technical user can complete it without help."],
    in_scope: [task.title, m.feature_description || ""].filter(Boolean),
    out_of_scope: ["Anything not described in this task", "Changes to unrelated modules"],
    unknowns: ["Exact data fields involved", "Edge cases and error handling"],
    risk_level: task.risk_level,
    human_approval_required: true,
  };
  return withAI({
    system: "You are the Product Requirements agent for an internal admin platform. Turn the task into clear, testable requirements. Be concise and plain. Never assume access to write code.",
    user: `Task:\n${taskContext(task)}${mem ? "\n\n" + mem : ""}\n\nProduce requirements.`,
    schema: jsonSchema("requirements", {
      task_summary: { type: "string" }, business_goal: { type: "string" }, user_stories: strArr,
      acceptance_criteria: strArr, in_scope: strArr, out_of_scope: strArr, unknowns: strArr,
      risk_level: { type: "string", enum: ["low", "medium", "high", "critical"] }, human_approval_required: { type: "boolean" },
    }),
    zod: zRequirements, fallback,
  });
}

// ── Agent: Platform Architect ─────────────────────────────────────────────────
async function architecture(task: DevTask, mem: string) {
  const m = meta(task);
  const fallback: ArchitectureOutput = {
    affected_modules: [task.target_area || "Platform"].filter(Boolean),
    route_changes: ["Likely a new or updated page route in the affected module."],
    component_changes: ["New or updated UI components for the feature."],
    api_changes: ["A server action or API route to handle the logic, with input validation."],
    database_changes: m.database_changes_allowed ? ["May add a table/column or index — proposed as a migration draft for approval."] : ["None expected for this task."],
    permission_concerns: ["Must stay admin-only and respect existing data-access rules."],
    ai_gateway_concerns: m.ai_role ? ["Reuse the existing AI engine/gateway — no new AI plumbing."] : ["None — no AI needed for this feature."],
    file_impact_estimate: "Small — a handful of new/updated files in one module.",
    risk_level: task.risk_level,
  };
  return withAI({
    system: "You are the Platform Architect for a Next.js + Supabase admin platform. Decide how the feature fits routes, components, server actions, database, permissions, and the AI gateway. Recommend only — never apply changes.",
    user: `Task:\n${taskContext(task)}${mem ? "\n\n" + mem : ""}\n\nProduce the architecture plan.`,
    schema: jsonSchema("architecture", {
      affected_modules: strArr, route_changes: strArr, component_changes: strArr, api_changes: strArr,
      database_changes: strArr, permission_concerns: strArr, ai_gateway_concerns: strArr,
      file_impact_estimate: { type: "string" }, risk_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
    }),
    zod: zArchitecture, fallback,
  });
}

// ── Agent: UI/UX ──────────────────────────────────────────────────────────────
async function uiux(task: DevTask, mem: string) {
  const fallback: UiUxOutput = {
    screen_layout: `A clean page in the ${task.target_area || "platform"} with a clear heading, a short helper line, and the main content in cards.`,
    cards: ["A main content card", "A summary card with key numbers"],
    tables: ["A list/table of the relevant items"],
    forms: ["A simple form for the main action, grouped into short sections"],
    buttons: ["A primary action button", "A cancel/back button"],
    status_labels: ["Clear status badges with a word and an icon (never color alone)"],
    empty_states: ["A friendly 'nothing here yet' message with a next step"],
    loading_states: ["A simple loading indicator while data loads"],
    error_states: ["A plain-English error message with what to do next"],
  };
  return withAI({
    system: "You are the UI/UX agent. Propose a simple, clean screen design that matches an existing admin design system (cards, tables, forms, badges). Plain language, accessible, responsive.",
    user: `Task:\n${taskContext(task)}${mem ? "\n\n" + mem : ""}\n\nProduce the screen design.`,
    schema: jsonSchema("uiux", {
      screen_layout: { type: "string" }, cards: strArr, tables: strArr, forms: strArr, buttons: strArr,
      status_labels: strArr, empty_states: strArr, loading_states: strArr, error_states: strArr,
    }),
    zod: zUiUx, fallback,
  });
}

// ── Agent: Human Experience ───────────────────────────────────────────────────
async function humanExperience(task: DevTask, mem: string) {
  const m = meta(task);
  const fallback: HumanExperienceOutput = {
    experience_rating: task.risk_level === "low" ? 8 : task.risk_level === "medium" ? 7 : 6,
    confusing: ["Technical terms could confuse a non-technical admin."],
    simplify: ["Keep the screen to one clear action.", "Use short helper text under each heading."],
    rename: ["Replace any code-style labels with plain words."],
    remove: ["Anything not needed to complete the main task."],
    needs_guided_help: m.who_uses_it ? [`First-run guidance for ${m.who_uses_it}.`] : ["A short example or tooltip on first use."],
    final_recommendation: "Keep it simple and obvious. A first-time user should finish without help.",
  };
  return withAI({
    system: "You are the Human Experience agent. Judge the feature as a non-technical person. Rate 1-10 and give concrete, kind, plain-language guidance.",
    user: `Task:\n${taskContext(task)}${mem ? "\n\n" + mem : ""}\n\nReview the experience.`,
    schema: jsonSchema("human_experience", {
      experience_rating: { type: "number" }, confusing: strArr, simplify: strArr, rename: strArr,
      remove: strArr, needs_guided_help: strArr, final_recommendation: { type: "string" },
    }),
    zod: zHumanExp, fallback,
  });
}

// ── Agent: Plain-English ──────────────────────────────────────────────────────
async function plainEnglish(task: DevTask, mem: string) {
  const fallback: PlainEnglishOutput = {
    rewrites: [
      { technical_label: "Submit", plain_english_label: "Save", admin_explanation: "Saves what you entered.", recommended_wording: "Save" },
      { technical_label: "Execute", plain_english_label: "Run", admin_explanation: "Starts the action.", recommended_wording: "Run" },
      { technical_label: "Validation error", plain_english_label: "Please check the form", admin_explanation: "Something entered isn't quite right.", recommended_wording: "Please check the highlighted fields." },
    ],
  };
  return withAI({
    system: "You are the Plain-English agent. Find technical labels/messages this feature would likely use and rewrite them into clear, everyday language. Return several rewrites.",
    user: `Task:\n${taskContext(task)}${mem ? "\n\n" + mem : ""}\n\nSuggest plain-English rewrites for labels and messages this feature will need.`,
    schema: jsonSchema("plain_english", {
      rewrites: {
        type: "array",
        items: {
          type: "object",
          properties: {
            technical_label: { type: "string" }, plain_english_label: { type: "string" },
            admin_explanation: { type: "string" }, recommended_wording: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    }),
    zod: zPlainEnglish, fallback,
  });
}

// ── Agent: Workflow Simplification ────────────────────────────────────────────
async function workflowSimplification(task: DevTask, mem: string) {
  const fallback: WorkflowSimplificationOutput = {
    current_steps: ["Open the page", "Find the action", "Fill in details", "Submit", "Confirm"],
    improved_steps: ["Open the page", "Fill one short form", "Save"],
    steps_removed: ["Extra confirmation screens", "Duplicate data entry"],
    ai_automation_opportunities: ["Pre-fill fields from existing data", "Suggest sensible defaults"],
    human_approval_points: ["Before anything is saved or changed for real"],
  };
  return withAI({
    system: "You are the Workflow Simplification agent. Reduce steps and clicks without losing capability. Show current vs improved steps and where humans must still approve.",
    user: `Task:\n${taskContext(task)}${mem ? "\n\n" + mem : ""}\n\nSimplify the workflow.`,
    schema: jsonSchema("workflow_simplification", {
      current_steps: strArr, improved_steps: strArr, steps_removed: strArr,
      ai_automation_opportunities: strArr, human_approval_points: strArr,
    }),
    zod: zWorkflowSimp, fallback,
  });
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
export type ArtifactKindForPlan = "plan" | "design" | "summary";

export interface PlanningResult {
  agentKey: string;
  label: string;
  kind: ArtifactKindForPlan;
  structured: Record<string, unknown>;
  content: string;
  aiBacked: boolean;
}

const HUMANIZE = (k: string) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** A readable text form of the structured output (stored on the artifact). */
function toText(structured: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(structured)) {
    if (Array.isArray(v)) {
      if (v.length && typeof v[0] === "object") {
        parts.push(`${HUMANIZE(k)}:`);
        for (const item of v as Record<string, unknown>[]) {
          parts.push("  • " + Object.values(item).map(String).join(" → "));
        }
      } else {
        parts.push(`${HUMANIZE(k)}:`);
        for (const item of v as unknown[]) parts.push(`  • ${String(item)}`);
      }
    } else {
      parts.push(`${HUMANIZE(k)}: ${String(v)}`);
    }
  }
  return parts.join("\n");
}

const REGISTRY: Record<string, { label: string; kind: ArtifactKindForPlan; run: (t: DevTask, mem: string) => Promise<{ data: object; aiBacked: boolean }> }> = {
  "product-requirements": { label: "Product Requirements", kind: "plan", run: requirements },
  "platform-architect": { label: "Platform Architect", kind: "design", run: architecture },
  "ui-ux": { label: "UI/UX", kind: "design", run: uiux },
  "human-experience": { label: "Human Experience", kind: "summary", run: humanExperience },
  "plain-english": { label: "Plain-English", kind: "summary", run: plainEnglish },
  "workflow-simplification": { label: "Workflow Simplification", kind: "summary", run: workflowSimplification },
};

export function isPlanningAgent(agentKey: string): boolean {
  return agentKey in REGISTRY;
}

/** Run one planning agent and return a saveable artifact payload. */
export async function runPlanningAgent(agentKey: string, task: DevTask): Promise<PlanningResult | null> {
  const entry = REGISTRY[agentKey];
  if (!entry) return null;
  // Phase 14: the agent consults the active memory (lessons + rejected patterns).
  const memItems = await getActiveMemory(40);
  const mem = formatMemoryForPrompt(memItems);
  const { data, aiBacked } = await entry.run(task, mem);
  const d = data as Record<string, unknown>;
  const structured: Record<string, unknown> = {
    ...d, _agent: agentKey, _label: entry.label, _ai: aiBacked,
    _memory_applied: memItems.slice(0, 8).map((m) => m.title),
  };
  return { agentKey, label: entry.label, kind: entry.kind, structured, content: toText(d), aiBacked };
}
