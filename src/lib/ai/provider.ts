/**
 * LLM provider abstraction (server-only). A single entry point —
 * generateStructuredJson — that returns a schema-constrained JSON object from
 * whichever provider is configured (OpenAI or Anthropic). This lets the engine
 * and EXP extractor stay provider-agnostic: switch SAFETYIQ_AI_PROVIDER (or just
 * the configured keys) to A/B gpt-4o-mini against claude-haiku-4-5 /
 * claude-sonnet-4-6 with no call-site changes.
 *
 * Structured output is enforced at the provider boundary:
 *   • OpenAI   — response_format json_schema (strict)
 *   • Anthropic — a single forced tool whose input_schema IS the JSON schema
 * The caller still validates the returned object with Zod (defense in depth).
 *
 * IMPORTANT: never import this into a client component — it reads server secrets.
 */
import "server-only";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { serverSecrets, aiProvider } from "@/lib/env";
import { recordAiCall } from "./telemetry";
import { CircuitBreaker } from "./circuit";
import { anthropicModelForTier, type ModelTier } from "./model-routing";

/** OpenAI-shaped JSON schema spec; reused for both providers. */
export interface JsonSchemaSpec {
  name: string;
  strict?: boolean;
  schema: Record<string, unknown>;
}

export interface StructuredCall {
  system: string;
  user: string;
  schema: JsonSchemaSpec;
  maxTokens: number;
  timeoutMs?: number;
  /** Model tier — "triage" routes to a cheaper model, "deep" to the strong one. */
  tier?: ModelTier;
}

export interface StructuredResult {
  /** The raw parsed JSON — the caller validates it against its Zod schema. */
  data: unknown;
  /** The concrete model that produced it (recorded on the finding for audit). */
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

const DEFAULT_TIMEOUT_MS = 30_000;

// One breaker per provider, kept on globalThis so it survives dev hot-reload and
// is shared across requests within a warm serverless instance — exactly where a
// breaker helps (repeated calls during a provider outage).
const g = globalThis as unknown as { __macoAiBreakers?: Record<string, CircuitBreaker> };
const breakers: Record<string, CircuitBreaker> = g.__macoAiBreakers ?? (g.__macoAiBreakers = {});
function breakerFor(provider: string): CircuitBreaker {
  // Thresholds are ops-tunable via env (NaN/empty → defaults), so a noisy
  // provider can be tightened/loosened without a redeploy.
  const threshold = Number(process.env.SAFETYIQ_AI_BREAKER_THRESHOLD) || 4;
  const cooldownMs = Number(process.env.SAFETYIQ_AI_BREAKER_COOLDOWN_MS) || 30_000;
  return (breakers[provider] ??= new CircuitBreaker(threshold, cooldownMs));
}

export async function generateStructuredJson(call: StructuredCall): Promise<StructuredResult> {
  const provider = aiProvider();
  const breaker = breakerFor(provider);
  if (!breaker.canRequest(Date.now())) {
    // Circuit open — skip the network entirely so the caller falls back to the
    // heuristic immediately instead of waiting out the request timeout.
    throw new Error(`AI provider circuit open for ${provider} — short-circuiting to fallback`);
  }

  const started = Date.now();
  try {
    const result = provider === "anthropic" ? await viaAnthropic(call) : await viaOpenAI(call);
    breaker.onSuccess();
    const ms = Date.now() - started;
    // Observability: in-app telemetry entry per call (no console output in production).
    recordAiCall({ provider, model: result.model, ms, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, ok: true });
    return result;
  } catch (err) {
    breaker.onFailure(Date.now());
    throw err;
  }
}

async function viaOpenAI(call: StructuredCall): Promise<StructuredResult> {
  const { openaiKey, aiModel } = serverSecrets();
  const client = new OpenAI({ apiKey: openaiKey, timeout: call.timeoutMs ?? DEFAULT_TIMEOUT_MS, maxRetries: 2 });
  const completion = await client.chat.completions.create({
    model: aiModel,
    messages: [
      { role: "system", content: call.system },
      { role: "user", content: call.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: call.schema.name, strict: call.schema.strict ?? true, schema: call.schema.schema },
    },
    temperature: 0.2,
    max_tokens: call.maxTokens,
    seed: 7, // reproducibility for safety audit
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("empty model response");
  return {
    data: JSON.parse(raw),
    model: aiModel,
    usage: {
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    },
  };
}

async function viaAnthropic(call: StructuredCall): Promise<StructuredResult> {
  const { anthropicKey, anthropicModel } = serverSecrets();
  // Tier routing: "triage" → cheaper model, "deep"/unset → configured model.
  const model = call.tier ? anthropicModelForTier(call.tier, anthropicModel) : anthropicModel;
  const client = new Anthropic({ apiKey: anthropicKey, timeout: call.timeoutMs ?? DEFAULT_TIMEOUT_MS, maxRetries: 2 });
  const resp = await client.messages.create({
    model,
    max_tokens: call.maxTokens,
    // Prompt caching: a single cache_control breakpoint on the system block
    // caches the static request prefix (tools schema + system prompt), which is
    // identical across every record of a given job. The per-record user prompt
    // stays uncached. No-op below the model's cache minimum, so it's safe to
    // leave on and it pays off as prompts/tool schemas grow. Guarded against an
    // empty system (a cache_control text block must be non-empty).
    system: call.system
      ? [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }]
      : call.system,
    messages: [{ role: "user", content: call.user }],
    // Structured output via a single forced tool — the most portable approach
    // across SDK versions, and pixel-equivalent to a strict JSON schema.
    tools: [
      {
        name: call.schema.name,
        description: "Return the structured result for this request.",
        input_schema: call.schema.schema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: call.schema.name },
  });
  const block = resp.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("no tool_use block in response");
  return {
    data: block.input,
    model,
    usage: { inputTokens: resp.usage.input_tokens, outputTokens: resp.usage.output_tokens },
  };
}
