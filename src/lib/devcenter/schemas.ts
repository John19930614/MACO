// Zod schemas for AI Dev Command Center payloads: API request bodies and the
// structured tool_use outputs returned by the Anthropic SDK. This module is a
// plain module (not "use server"), so both route handlers and server-action
// modules can import the schemas and their inferred types without violating
// Next's async-only export rule for server-action files.

import { z } from "zod";

// ── Request bodies ────────────────────────────────────────────────────────────

/** Body for POST /api/devcenter/generate-implementation. */
export const TaskIdBodySchema = z.object({
  taskId: z.string().min(1),
});

// ── Implementation brief (submit_brief / submit_implementation_brief tools) ──

/** One planned file change — mirrors GeneratedFile in lib/actions/generateImplementation.ts. */
export const GeneratedFileSchema = z.object({
  path: z.string(),
  operation: z.enum(["create", "edit", "delete"]),
  description: z.string(),
  content: z.string(),
});

// dbMigration defaults to null when omitted: the tool input_schema marks it
// optional but ImplementationBrief requires `string | null`.
export const ImplementationBriefSchema = z.object({
  summary: z.string(),
  files: z.array(GeneratedFileSchema),
  dbMigration: z.string().nullable().default(null),
  testingNotes: z.string(),
  deployCommand: z.string(),
});

export type ImplementationBriefParsed = z.infer<typeof ImplementationBriefSchema>;

// ── Import-notes extraction (submit_tasks tool) ───────────────────────────────

/** One extracted dev task — mirrors ProposedTask in the import-notes route. */
export const ProposedTaskSchema = z.object({
  title: z.string(),
  business_goal: z.string(),
  description: z.string(),
  module_affected: z.string(),
  who_uses_it: z.string(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  risk_level: z.enum(["low", "medium", "high", "critical"]),
  success_criteria: z.string(),
  notes: z.string(),
});

export const ImportResultSchema = z.object({
  tasks: z.array(ProposedTaskSchema),
  rawSummary: z.string(),
});

export type ImportResultParsed = z.infer<typeof ImportResultSchema>;
