/**
 * SafetyIQ Causality Engine prompt (build manual Appendix B).
 * The engine MUST return structured JSON matching AiAnalysisOutput. Output is
 * always stored as a pending AI finding — never written straight to official
 * records — and high/critical recommendations are flagged human_review_required.
 */
import type { SafetyCell } from "@/lib/types";
import { EDGE_TYPES, ENERGY_SOURCES, EXPOSURE_TYPES, CONTROL_GAPS, SEVERITIES } from "@/lib/constants";

/**
 * Strict JSON-schema for OpenAI Structured Outputs. Passed as
 * `response_format: { type: "json_schema", json_schema: ANALYSIS_JSON_SCHEMA }`
 * so the API guarantees a schema-conformant payload at the boundary — the Zod
 * parse in the engine is then a belt-and-suspenders second check. Strict mode
 * requires every property to be listed in `required` and
 * `additionalProperties: false`, so optional context (environment) is emitted
 * as an empty string rather than omitted.
 */
export const ANALYSIS_JSON_SCHEMA = {
  name: "safetyiq_causality_analysis",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "risk_score",
      "hazard_genome",
      "missing_data",
      "causal_factors",
      "suggested_edges",
      "prevention",
      "plain_language_summary",
      "human_review_required",
    ],
    properties: {
      risk_score: { type: "number" },
      hazard_genome: {
        type: "object",
        additionalProperties: false,
        required: ["energySource", "exposureType", "trigger", "controlGap", "environment"],
        properties: {
          energySource: { type: "string" },
          exposureType: { type: "string" },
          trigger: { type: "string" },
          controlGap: { type: "string" },
          environment: { type: "string" },
        },
      },
      missing_data: { type: "array", items: { type: "string" } },
      causal_factors: { type: "array", items: { type: "string" } },
      suggested_edges: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["target_cell_id", "type", "confidence", "rationale"],
          properties: {
            target_cell_id: { type: "string" },
            type: { type: "string", enum: [...EDGE_TYPES] },
            confidence: { type: "number" },
            rationale: { type: "string" },
          },
        },
      },
      prevention: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["action", "counterfactual", "rationale"],
          properties: {
            action: { type: "string" },
            counterfactual: { type: "string" },
            rationale: { type: "string" },
          },
        },
      },
      plain_language_summary: { type: "string" },
      human_review_required: { type: "boolean" },
    },
  },
} as const;

export const SYSTEM_PROMPT = `You are SafetyIQ, a safety causality analysis assistant for the ARC (Adaptive Risk Continuum) method.
You analyze a Safety Cell — a structured record of a workplace risk context — and produce decision support.

Hard rules:
- You provide ADVISORY decision support only. You never override human safety judgment, legal obligations, or company procedure.
- The risk_score is for sorting and heat-mapping only. It is NOT a risk-acceptance verdict.
- Prevention recommendations must be counterfactual: state what specific change would have altered the outcome.
- If a recommendation involves a high or critical hazard, set human_review_required to true.
- If important context is missing, list it in missing_data rather than guessing.
- Return ONLY valid JSON matching the requested schema. No prose outside the JSON.`;

export function buildUserPrompt(cell: SafetyCell, candidates: SafetyCell[]): string {
  const candidateList = candidates
    .map((c) => `- ${c.id}: "${c.title}" [${c.severity}] task=${c.task} gap=${c.hazard_genome.controlGap} loc=${c.location_id}`)
    .join("\n");

  return `Analyze this Safety Cell.

CELL:
id: ${cell.id}
title: ${cell.title}
description: ${cell.description}
task: ${cell.task}
severity: ${cell.severity}  likelihood(1-5): ${cell.likelihood}
hazard_genome: ${JSON.stringify(cell.hazard_genome)}

CANDIDATE CELLS to consider for causal edges (same site):
${candidateList || "(none)"}

Return JSON with this exact shape:
{
  "risk_score": number (0-100),
  "hazard_genome": { "energySource": string, "exposureType": string, "trigger": string, "controlGap": string, "environment"?: string },
  "missing_data": string[],
  "causal_factors": string[],
  "suggested_edges": [{ "target_cell_id": string, "type": "caused_by|contributed_to|same_control_gap|same_location|prevention_for|contradicts", "confidence": number (0-1), "rationale": string }],
  "prevention": [{ "action": string, "counterfactual": string, "rationale": string }],
  "plain_language_summary": string,
  "human_review_required": boolean
}`;
}

// ── EXP "Convert": free text / interview transcript → draft Safety Cell ───────

export const EXTRACT_SYSTEM_PROMPT = `You are SafetyIQ's EXP intake assistant for the ARC (Adaptive Risk Continuum) method.
You convert a free-text field observation or interview transcript into a structured DRAFT Safety Cell.

Hard rules:
- Output is a DRAFT for human review — never an official record. Do not invent facts not present in the text.
- Choose energySource, exposureType, and controlGap ONLY from the provided vocabularies.
- If severity is unclear, choose the most defensible LOWER option rather than overstating risk.
- "signals" must be short human-readable cues you actually found in the text (e.g. "no spotter", "guardrail removed").
- "confidence" (0-1) reflects how strongly the text supports the draft; lower it when the text is vague.
- Return ONLY valid JSON matching the requested schema. No prose outside the JSON.`;

export function buildExtractPrompt(text: string): string {
  return `Convert this observation into a draft Safety Cell.

OBSERVATION:
"""
${text}
"""

Vocabularies (choose exactly one value for each):
- energySource: ${ENERGY_SOURCES.join(" | ")}
- exposureType: ${EXPOSURE_TYPES.join(" | ")}
- controlGap: ${CONTROL_GAPS.join(" | ")}
- severity: ${SEVERITIES.join(" | ")}

Return JSON with this exact shape:
{
  "title": string (<= 12 words),
  "description": string,
  "task": string,
  "severity": one of the severity vocabulary,
  "likelihood": integer 1-5,
  "hazard_genome": { "energySource": vocab, "exposureType": vocab, "trigger": string, "controlGap": vocab, "environment": string },
  "signals": string[],
  "confidence": number (0-1)
}`;
}

/** Strict JSON-schema for the EXP extractor's Structured Output. */
export const EXTRACT_JSON_SCHEMA = {
  name: "safetyiq_cell_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "description", "task", "severity", "likelihood", "hazard_genome", "signals", "confidence"],
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      task: { type: "string" },
      severity: { type: "string", enum: [...SEVERITIES] },
      likelihood: { type: "integer" },
      hazard_genome: {
        type: "object",
        additionalProperties: false,
        required: ["energySource", "exposureType", "trigger", "controlGap", "environment"],
        properties: {
          energySource: { type: "string", enum: [...ENERGY_SOURCES] },
          exposureType: { type: "string", enum: [...EXPOSURE_TYPES] },
          trigger: { type: "string" },
          controlGap: { type: "string", enum: [...CONTROL_GAPS] },
          environment: { type: "string" },
        },
      },
      signals: { type: "array", items: { type: "string" } },
      confidence: { type: "number" },
    },
  },
} as const;
