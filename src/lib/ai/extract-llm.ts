/**
 * EXP "Convert" — live LLM extractor (server-only). Turns a free-text
 * observation into a draft Safety Cell using the configured model with strict
 * Structured Outputs, then validates the payload before returning it. Any API
 * error or invalid payload degrades gracefully to the deterministic heuristic
 * in src/lib/ai/extract.ts, which is also what mock mode uses. The result is
 * ALWAYS a draft for human review.
 *
 * IMPORTANT: never import this into a client component — it reads server secrets.
 * Client code calls POST /api/ai/extract-cell instead.
 */
import "server-only";
import { MOCK_MODE, hasLiveAi } from "@/lib/env";
import { EXTRACT_SYSTEM_PROMPT, buildExtractPrompt, EXTRACT_JSON_SCHEMA } from "./prompt";
import { generateStructuredJson } from "./provider";
import { extractedCellSchema } from "@/lib/schemas";
import { extractCellDraft, type ExtractResult } from "./extract";

const MODEL_TIMEOUT_MS = 20_000;

async function modelExtract(text: string): Promise<ExtractResult> {
  const { data } = await generateStructuredJson({
    system: EXTRACT_SYSTEM_PROMPT,
    user: buildExtractPrompt(text),
    schema: EXTRACT_JSON_SCHEMA,
    maxTokens: 600,
    timeoutMs: MODEL_TIMEOUT_MS,
  });

  const parsed = extractedCellSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[amaya] EXP extraction failed schema validation", { issues: parsed.error.flatten(), raw: data });
    throw new Error("extractor output failed validation");
  }
  const d = parsed.data;
  return {
    draft: {
      title: d.title,
      description: d.description,
      task: d.task,
      severity: d.severity,
      likelihood: d.likelihood,
      hazard_genome: {
        energySource: d.hazard_genome.energySource,
        exposureType: d.hazard_genome.exposureType,
        trigger: d.hazard_genome.trigger,
        controlGap: d.hazard_genome.controlGap,
        environment: d.hazard_genome.environment ?? "",
      },
    },
    confidence: d.confidence,
    signals: d.signals.length ? d.signals : ["model-extracted"],
  };
}

/**
 * Convert free text to a draft cell, preferring the live LLM and falling back
 * to the heuristic on mock mode, a missing key, or any model/validation error.
 */
export async function extractCellDraftSmart(text: string): Promise<ExtractResult> {
  if (MOCK_MODE || !hasLiveAi()) return extractCellDraft(text);
  try {
    return await modelExtract(text);
  } catch (err) {
    console.error("[amaya] EXP extraction fell back to heuristic", { error: String(err) });
    return extractCellDraft(text);
  }
}
