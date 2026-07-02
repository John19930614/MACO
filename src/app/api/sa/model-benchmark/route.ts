/**
 * POST /api/sa/model-benchmark — superadmin-only trigger for the AI model
 * benchmark (see src/lib/actions/runModelBenchmark.ts). Each run makes up to
 * 32 live Anthropic calls (4 models × 8 prompts), so maxDuration is raised
 * well above the default function window.
 */
import { NextRequest, NextResponse } from "next/server";
import { isSuperadmin } from "@/lib/auth/session";
import { MOCK_MODE } from "@/lib/env";
import { runModelBenchmark } from "@/lib/actions/runModelBenchmark";
import {
  aggregateRows,
  recommend,
  BASELINE_MODEL,
  type BenchmarkRowResult,
  type BenchmarkRunResult,
} from "@/lib/ai/benchmarkModels";

export const maxDuration = 300;

/** Canned result so the panel is demo-able in mock mode (no live AI there). */
function demoResult(): BenchmarkRunResult {
  const mk = (
    model: string,
    score: number,
    latency: number,
    cost: number,
  ): BenchmarkRowResult[] =>
    ["hazmat_classification", "incident_root_cause"].map((key, i) => ({
      model,
      prompt_key: key,
      prompt_label: key === "hazmat_classification" ? "Hazardous material classification" : "Incident root-cause analysis",
      latency_ms: latency + i * 180,
      input_tokens: 240,
      output_tokens: 610,
      score: score - i * 2,
      cost_est_usd: cost,
    }));
  const rows = [
    ...mk(BASELINE_MODEL, 96, 2200, 0.0098),
    ...mk("claude-haiku-4-5", 86, 1300, 0.0033),
    ...mk("claude-sonnet-4-6", 90, 2400, 0.0098),
    ...mk("claude-opus-4-8", 97, 3900, 0.0165),
  ];
  const aggregates = aggregateRows(rows);
  const { winner, recommendation, summary } = recommend(aggregates);
  return {
    rows,
    aggregates,
    winner,
    recommendation,
    summary: `Demo mode — canned data, no live API calls were made.\n${summary}`,
    run_at: new Date().toISOString(),
    persisted: false,
    demo: true,
  };
}

export async function POST(req: NextRequest) {
  if (MOCK_MODE) return NextResponse.json(demoResult());

  if (!(await isSuperadmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let models: string[] | undefined;
  try {
    const body = await req.json();
    if (Array.isArray(body?.models)) {
      models = body.models.filter((m: unknown): m is string => typeof m === "string");
    }
  } catch {
    // empty/invalid body → run the full catalog
  }

  try {
    const result = await runModelBenchmark({ models });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Benchmark failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
