import { describe, it, expect } from "vitest";
import { generateStructuredJson } from "@/lib/ai/provider";
import { ANALYSIS_JSON_SCHEMA, SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/prompt";
import { aiAnalysisOutputSchema } from "@/lib/schemas";
import { estimateCost } from "@/lib/analytics/ai";
import { aiProvider } from "@/lib/env";
import type { SafetyCell } from "@/lib/types";

/**
 * LIVE AI eval — runs the REAL provider (OpenAI or Claude) against a golden
 * cell and asserts the structured output validates. Gated on an AI key, so the
 * default offline `npm test` skips it. Logs token usage + estimated cost so a
 * provider/model A/B is measurable. Bypasses MOCK_MODE by calling the provider
 * directly rather than analyzeCell.
 */
const ready = Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
const suite = ready ? describe : describe.skip;

const GOLDEN: SafetyCell = {
  id: "eval_live_1",
  tenant_id: "t",
  site_id: "s",
  location_id: "l",
  title: "Forklift unloading at blind corner without verified spotter",
  description: "Forklift unloading near the dock blind corner while pedestrians transit; spotter on paper but not present.",
  task: "Container unloading",
  crew: null,
  company: null,
  permit_ref: null,
  hazard_genome: { energySource: "motion", exposureType: "struck_by", trigger: "congestion", controlGap: "unverified" },
  severity: "high",
  likelihood: 4,
  risk_score: 78,
  status: "open",
  owner_id: null,
  created_by: "u",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

suite(`LIVE: ${aiProvider()} produces a schema-valid causality analysis`, () => {
  it("returns structured output that passes the AiAnalysisOutput contract", async () => {
    const { data, model, usage } = await generateStructuredJson({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(GOLDEN, []),
      schema: ANALYSIS_JSON_SCHEMA,
      maxTokens: 1200,
    });
    const parsed = aiAnalysisOutputSchema.safeParse(data);
    expect(parsed.success, JSON.stringify(parsed.success ? {} : parsed.error.flatten())).toBe(true);
    if (parsed.success) {
      expect(parsed.data.plain_language_summary.length).toBeGreaterThan(10);
      expect(parsed.data.prevention.length).toBeGreaterThan(0);
    }
    const cost = estimateCost(model, usage.inputTokens, usage.outputTokens);
    // eslint-disable-next-line no-console
    console.log(`[live-eval] ${model}: ${usage.inputTokens}+${usage.outputTokens} tok ≈ $${cost.toFixed(5)}`);
  }, 60_000);
});
