"use client";

/**
 * AI Model Benchmark panel (superadmin, /sa/gateway). Triggers
 * POST /api/sa/model-benchmark and renders the per-call table plus the
 * upgrade/keep recommendation. Read-only beyond the trigger: changing the
 * SAFETYIQ_ANTHROPIC_MODEL default stays a human-approved env.ts edit.
 */
import { useState } from "react";
import { Play, CheckCircle2, XCircle, AlertTriangle, Loader2, FlaskConical } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/primitives";
import type { BenchmarkRunResult } from "@/lib/ai/benchmarkModels";

type Status = "idle" | "running" | "done" | "error";

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

export default function ModelBenchmarkPanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<BenchmarkRunResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleRun() {
    setStatus("running");
    setResult(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/sa/model-benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Benchmark failed");
      setResult(data as BenchmarkRunResult);
      setStatus("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
    }
  }

  return (
    <Card>
      <CardHeader
        title="AI Model Benchmark"
        subtitle="Compare the current default (Sonnet 5 · Haiku 4.5 triage) against Opus 4.8 and the previous default (Sonnet 4.6) on 8 synthetic EHS prompts. Each run makes up to 32 live Anthropic calls."
        right={
          <button
            onClick={handleRun}
            disabled={status === "running"}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {status === "running" ? "Running…" : "Run Benchmark"}
          </button>
        }
      />

      <div className="mt-4 space-y-4">
        {status === "idle" && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            <FlaskConical className="h-4 w-4 shrink-0 text-slate-400" />
            Benchmark not yet run — click <strong>Run Benchmark</strong> to compare models.
          </div>
        )}

        {status === "running" && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-700">
            Sending the EHS analysis samples to each model sequentially. This can take a minute or two.
          </div>
        )}

        {status === "error" && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>The benchmark could not complete: {errorMsg}</span>
          </div>
        )}

        {status === "done" && result && (
          <>
            {result.demo && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                Demo mode — canned data, no live API calls were made.
              </div>
            )}

            {result.recommendation === "upgrade" ? (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Upgrade recommended</p>
                  <p className="mt-0.5 text-sm text-emerald-700">
                    <strong>{result.winner}</strong> beat the current default on completeness within the cost
                    limit. A Platform Operations lead must review these results and approve the{" "}
                    <code className="rounded bg-emerald-100 px-1">SAFETYIQ_ANTHROPIC_MODEL</code> default change
                    in <code className="rounded bg-emerald-100 px-1">src/lib/env.ts</code> before anything ships.
                  </p>
                </div>
              </div>
            ) : result.recommendation === "keep" ? (
              <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Keep current model</p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    No candidate cleared the completeness and cost gates on these samples. The existing default
                    stays.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Inconclusive</p>
                  <p className="mt-0.5 text-sm text-amber-700">
                    The baseline model produced no successful calls — check the API key, provider status, and
                    circuit breaker, then re-run.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {result.aggregates.map((a) => (
                <div key={a.model} className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                  <div className="truncate font-mono text-xs text-slate-500">{a.model}</div>
                  <div className={`text-base font-bold ${a.failures === a.calls ? "text-red-600" : scoreColor(a.meanScore)}`}>
                    {a.failures === a.calls ? "failed" : `${a.meanScore.toFixed(1)} / 100`}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">
                    ${a.meanCostUsd.toFixed(4)}/call · {Math.round(a.meanLatencyMs)} ms · {a.failures}/{a.calls} failed
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-500">Model</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-500">Prompt</th>
                    <th className="px-4 py-2.5 text-right font-medium text-slate-500">Score /100</th>
                    <th className="px-4 py-2.5 text-right font-medium text-slate-500">Latency (ms)</th>
                    <th className="px-4 py-2.5 text-right font-medium text-slate-500">Cost per call (USD)</th>
                    <th className="px-4 py-2.5 text-center font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {result.rows.map((row, i) => (
                    <tr key={i} className={row.error ? "bg-red-50" : ""}>
                      <td className="px-4 py-2 font-mono text-xs text-slate-700">{row.model}</td>
                      <td className="px-4 py-2 text-slate-700">{row.prompt_label}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {row.score !== null ? (
                          <span className={`font-semibold ${scoreColor(row.score)}`}>{row.score}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                        {row.latency_ms !== null ? row.latency_ms.toLocaleString() : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                        {row.score !== null ? `$${row.cost_est_usd.toFixed(4)}` : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {row.error ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                            title={row.error}
                          >
                            <XCircle className="h-3 w-3" /> Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-400">Summary</p>
              <pre className="whitespace-pre-wrap text-xs text-slate-700">{result.summary}</pre>
              <p className="mt-2 text-xs text-slate-400">
                Run at {new Date(result.run_at).toLocaleString()} · {result.rows.length} calls ·{" "}
                {result.persisted ? "persisted to ai_model_benchmarks" : "not persisted"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
              <strong>Human approval required.</strong> The score measures JSON completeness (schema compliance),
              not regulatory accuracy. Changing the default model means editing{" "}
              <code>SAFETYIQ_ANTHROPIC_MODEL</code> in <code>src/lib/env.ts</code> — only after a Platform
              Operations lead has reviewed these results and the raw responses, and approved the change in a PR.
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
