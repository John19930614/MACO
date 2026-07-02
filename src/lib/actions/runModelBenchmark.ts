/**
 * Server-side benchmark runner. Fans the EHS_BENCH_PROMPTS out to each
 * candidate model through the existing generateStructuredJson provider (so
 * benchmark calls get the same prompt caching, telemetry, and circuit-breaker
 * treatment as production calls), scores each response, persists rows to
 * ai_model_benchmarks via the service-role client, and returns the aggregated
 * recommendation.
 *
 * Runs SEQUENTIALLY per model with an early abort after 2 consecutive
 * failures: the provider shares one circuit breaker with production traffic
 * (threshold 4), so a broken candidate model must not be allowed to rack up 8
 * failures and open the breaker for real callers.
 */
import "server-only";
import { generateStructuredJson } from "@/lib/ai/provider";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isSuperadmin, getServerProfileId, getServerTenantId } from "@/lib/auth/session";
import { aiProvider } from "@/lib/env";
import { estimateCost } from "@/lib/analytics/ai";
import {
  EHS_BENCH_PROMPTS,
  CANDIDATE_MODELS,
  scoreCompleteness,
  normaliseScore,
  aggregateRows,
  recommend,
  type BenchmarkRowResult,
  type BenchmarkRunResult,
} from "@/lib/ai/benchmarkModels";

const CALL_TIMEOUT_MS = 20_000;
const MAX_TOKENS = 2_000;
const CONSECUTIVE_FAILURE_ABORT = 2;
const RAW_RESPONSE_CAP = 4_000;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export async function runModelBenchmark({
  models,
}: {
  models?: string[];
} = {}): Promise<BenchmarkRunResult> {
  // Defense in depth — the API route also guards, but this function writes
  // with the service-role client so it re-checks on its own.
  if (!(await isSuperadmin())) throw new Error("Forbidden — superadmin only");
  if (aiProvider() !== "anthropic") {
    throw new Error("Benchmark requires the Anthropic provider (set SAFETYIQ_AI_PROVIDER / keys)");
  }

  // Only known catalog models may be requested — never bill arbitrary slugs
  // from a request body.
  const known = CANDIDATE_MODELS as readonly string[];
  const selected = (models?.length ? models.filter((m) => known.includes(m)) : [...known]);
  if (selected.length === 0) throw new Error("No valid models selected");

  const run_at = new Date().toISOString();
  const rows: BenchmarkRowResult[] = [];
  const rawResponses: string[] = []; // parallel to rows; persisted, not returned

  for (const model of selected) {
    let consecutiveFailures = 0;
    for (const prompt of EHS_BENCH_PROMPTS) {
      if (consecutiveFailures >= CONSECUTIVE_FAILURE_ABORT) {
        rows.push({
          model,
          prompt_key: prompt.key,
          prompt_label: prompt.label,
          latency_ms: null,
          input_tokens: 0,
          output_tokens: 0,
          score: null,
          cost_est_usd: 0,
          error: "skipped — model aborted after repeated failures",
        });
        rawResponses.push("");
        continue;
      }
      const started = Date.now();
      try {
        const result = await generateStructuredJson({
          system: prompt.system,
          user: prompt.user,
          // Loose schema on purpose: a strict schema would force every model
          // to emit all fields and flatten the completeness signal.
          schema: { name: "ehs_benchmark_response", schema: { type: "object" } },
          maxTokens: MAX_TOKENS,
          timeoutMs: CALL_TIMEOUT_MS,
          model,
        });
        const latency_ms = Date.now() - started;
        const raw = JSON.stringify(result.data ?? null);
        const score = normaliseScore({
          completenessRatio: scoreCompleteness(result.data, prompt.expectedFields),
          responseLength: raw.length,
        });
        rows.push({
          model,
          prompt_key: prompt.key,
          prompt_label: prompt.label,
          latency_ms,
          input_tokens: result.usage.inputTokens,
          output_tokens: result.usage.outputTokens,
          score,
          cost_est_usd: estimateCost(model, result.usage.inputTokens, result.usage.outputTokens),
        });
        rawResponses.push(raw.slice(0, RAW_RESPONSE_CAP));
        consecutiveFailures = 0;
      } catch (err) {
        consecutiveFailures += 1;
        rows.push({
          model,
          prompt_key: prompt.key,
          prompt_label: prompt.label,
          latency_ms: null,
          input_tokens: 0,
          output_tokens: 0,
          score: null,
          cost_est_usd: 0,
          error: err instanceof Error ? err.message : String(err),
        });
        rawResponses.push("");
      }
    }
  }

  // Persist (best-effort — a storage hiccup must not lose the run result the
  // operator is looking at).
  let persisted = false;
  const svc = createServiceRoleClient();
  if (svc) {
    const profileId = await getServerProfileId();
    const tenantId = await getServerTenantId(); // null for superadmins — column is nullable
    const { error } = await svc.from("ai_model_benchmarks").insert(
      rows.map((r, i) => ({
        run_at,
        model: r.model,
        prompt_key: r.prompt_key,
        latency_ms: r.latency_ms,
        input_tokens: r.input_tokens,
        output_tokens: r.output_tokens,
        score: r.score,
        cost_est_usd: r.cost_est_usd,
        raw_response: rawResponses[i] ?? "",
        error: r.error ?? null,
        created_by: profileId && profileId !== NIL_UUID ? profileId : null,
        tenant_id: tenantId,
      })),
    );
    persisted = !error;
  }

  const aggregates = aggregateRows(rows);
  const { winner, recommendation, summary } = recommend(aggregates);
  return { rows, aggregates, winner, recommendation, summary, run_at, persisted };
}
