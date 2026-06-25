/**
 * AI call telemetry (server-only). The provider records one entry per model
 * call; the engine records a marker when it falls back to the heuristic.
 *
 * Two tiers:
 *   • A small ring buffer on globalThis — survives dev hot-reloads, mirrors the
 *     mock store, and gives a fast "recent calls" view.
 *   • Durable persistence to the `ai_telemetry` table in live mode, so the
 *     observability survives serverless cold starts (which wipe the buffer).
 *     The write is fire-and-forget: best-effort instrumentation must never block
 *     or break the AI response.
 */
import "server-only";
import type { AiCall } from "@/lib/analytics/ai";
import { MOCK_MODE } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CAP = 200;
const g = globalThis as unknown as { __macoAiTelemetry?: AiCall[] };
const buf: AiCall[] = g.__macoAiTelemetry ?? (g.__macoAiTelemetry = []);

export function recordAiCall(entry: Omit<AiCall, "at">): void {
  const call: AiCall = { ...entry, at: Date.now() };
  buf.push(call);
  if (buf.length > CAP) buf.splice(0, buf.length - CAP);
  // Durable persistence (live only), fire-and-forget so a slow or failing insert
  // never blocks or breaks the AI response.
  void persistAiCall(call);
}

export function getAiTelemetry(): AiCall[] {
  return [...buf];
}

async function persistAiCall(call: AiCall): Promise<void> {
  if (MOCK_MODE) return;
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return;
    const { error } = await supabase.from("ai_telemetry").insert({
      at: new Date(call.at).toISOString(),
      provider: call.provider,
      model: call.model,
      ms: call.ms,
      input_tokens: call.inputTokens,
      output_tokens: call.outputTokens,
      ok: call.ok,
    });
    if (error && process.env.NODE_ENV !== "production") {
      console.error("[safetyiq] ai_telemetry insert failed:", error.message);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[safetyiq] ai_telemetry persist error:", String(err));
    }
  }
}

interface AiTelemetryRow {
  at: string;
  provider: string | null;
  model: string | null;
  ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  ok: boolean | null;
}

/**
 * Telemetry for the observability dashboards. In live mode reads the durable
 * `ai_telemetry` table (survives cold starts); in mock mode, or if the query
 * fails, returns the in-memory buffer so the caller always gets something usable.
 */
export async function getPersistedTelemetry(limit = 200): Promise<AiCall[]> {
  if (MOCK_MODE) return [...buf];
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [...buf];
    const { data, error } = await supabase
      .from("ai_telemetry")
      .select("at, provider, model, ms, input_tokens, output_tokens, ok")
      .order("at", { ascending: false })
      .limit(limit);
    if (error || !data) return [...buf];
    return (data as AiTelemetryRow[]).map((r) => ({
      at: new Date(r.at).getTime(),
      provider: r.provider ?? "",
      model: r.model ?? "",
      ms: r.ms ?? 0,
      inputTokens: r.input_tokens ?? 0,
      outputTokens: r.output_tokens ?? 0,
      ok: r.ok ?? true,
    }));
  } catch {
    return [...buf];
  }
}
