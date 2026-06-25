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
}

export interface StructuredResult {
  /** The raw parsed JSON — the caller validates it against its Zod schema. */
  data: unknown;
  /** The concrete model that produced it (recorded on the finding for audit). */
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

const DEFAULT_TIMEOUT_MS = 30_000;

export async function generateStructuredJson(call: StructuredCall): Promise<StructuredResult> {
  const provider = aiProvider();
  const started = Date.now();
  const result = provider === "anthropic" ? await viaAnthropic(call) : await viaOpenAI(call);
  const ms = Date.now() - started;
  // Observability: in-app telemetry entry per call (no console output in production).
  recordAiCall({ provider, model: result.model, ms, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, ok: true });
  return result;
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
  const client = new Anthropic({ apiKey: anthropicKey, timeout: call.timeoutMs ?? DEFAULT_TIMEOUT_MS, maxRetries: 2 });
  const resp = await client.messages.create({
    model: anthropicModel,
    max_tokens: call.maxTokens,
    system: call.system,
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
    model: anthropicModel,
    usage: { inputTokens: resp.usage.input_tokens, outputTokens: resp.usage.output_tokens },
  };
}
