import "server-only";
import { cache } from "react";
import { MOCK_MODE } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { estimateCost } from "@/lib/analytics/ai";
import { getAiTelemetry } from "@/lib/ai/telemetry";

export interface AiUsagePeriodSummary {
  runCount: number;
  estimatedCostUsd: number | null;
  hasData: boolean;
}

export interface AiUsageSummary {
  today: AiUsagePeriodSummary;
  month: AiUsagePeriodSummary;
}

export interface AiUsageRow {
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

/** Pure rollup over already-fetched rows — exported for unit tests. */
export function summarizePeriod(rows: AiUsageRow[]): AiUsagePeriodSummary {
  const runCount = rows.length;
  if (runCount === 0) return { runCount: 0, estimatedCostUsd: null, hasData: false };
  const estimatedCostUsd = rows.reduce(
    (sum, r) => sum + estimateCost(r.model ?? "", r.inputTokens ?? 0, r.outputTokens ?? 0),
    0,
  );
  return { runCount, estimatedCostUsd, hasData: true };
}

const EMPTY_SUMMARY: AiUsageSummary = {
  today: { runCount: 0, estimatedCostUsd: null, hasData: false },
  month: { runCount: 0, estimatedCostUsd: null, hasData: false },
};

/**
 * AI Gateway usage rollup for the dev-command Overview panel, sourced from the
 * durable `ai_telemetry` log (src/lib/ai/telemetry.ts) that every AI call
 * already writes to. This is an internal ops view of the platform's own AI
 * usage — not a per-tenant metric — so it is intentionally platform-wide
 * rather than scoped by tenant.
 */
export const getAiUsageSummary = cache(async (): Promise<AiUsageSummary> => {
  const now = new Date();
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startOfMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);

  if (MOCK_MODE) {
    const calls = getAiTelemetry();
    const toRow = (c: { model: string; inputTokens: number; outputTokens: number }): AiUsageRow => ({
      model: c.model,
      inputTokens: c.inputTokens,
      outputTokens: c.outputTokens,
    });
    return {
      today: summarizePeriod(calls.filter((c) => c.at >= startOfToday).map(toRow)),
      month: summarizePeriod(calls.filter((c) => c.at >= startOfMonth).map(toRow)),
    };
  }

  try {
    const client = await createSupabaseServerClient();
    if (!client) return EMPTY_SUMMARY;

    const [{ data: todayRows }, { data: monthRows }] = await Promise.all([
      client
        .from("ai_telemetry")
        .select("model, input_tokens, output_tokens")
        .gte("at", new Date(startOfToday).toISOString()),
      client
        .from("ai_telemetry")
        .select("model, input_tokens, output_tokens")
        .gte("at", new Date(startOfMonth).toISOString()),
    ]);

    const toRow = (r: { model: string | null; input_tokens: number | null; output_tokens: number | null }): AiUsageRow => ({
      model: r.model,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
    });

    return {
      today: summarizePeriod((todayRows ?? []).map(toRow)),
      month: summarizePeriod((monthRows ?? []).map(toRow)),
    };
  } catch {
    return EMPTY_SUMMARY;
  }
});
