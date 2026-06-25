/**
 * AI drift / cost alerting (pure). Turns the telemetry rollup
 * (summarizeTelemetry) into operator-facing anomalies: a provider degrading
 * (fallback-rate spike), latency creeping up, or spend running over the window
 * budget. Thresholds are tunable; each anomaly escalates to "critical" at 2× the
 * threshold. Deterministic over its input — feed it persisted telemetry to power
 * a dashboard banner or a scheduled alert.
 */
import type { TelemetrySummary } from "./ai";

export type AlertSeverity = "warn" | "critical";

export interface AiAnomaly {
  key: "fallback_rate" | "avg_latency" | "cost";
  severity: AlertSeverity;
  message: string;
}

export interface AiAlertThresholds {
  maxFallbackRate?: number; // share 0–1 of calls that fell back to the heuristic
  maxAvgMs?: number;        // average latency ceiling (ms)
  maxCostUsd?: number;      // spend ceiling for the telemetry window (USD)
}

export const DEFAULT_AI_THRESHOLDS: Required<AiAlertThresholds> = {
  maxFallbackRate: 0.25,
  maxAvgMs: 8000,
  maxCostUsd: 5,
};

const sev = (value: number, threshold: number): AlertSeverity => (value >= threshold * 2 ? "critical" : "warn");

export function detectAiAnomalies(s: TelemetrySummary, thresholds: AiAlertThresholds = {}): AiAnomaly[] {
  const th = { ...DEFAULT_AI_THRESHOLDS, ...thresholds };
  const out: AiAnomaly[] = [];
  if (s.calls === 0) return out; // no signal yet

  if (s.fallbackRate >= th.maxFallbackRate) {
    out.push({
      key: "fallback_rate",
      severity: sev(s.fallbackRate, th.maxFallbackRate),
      message: `AI fallback rate ${(s.fallbackRate * 100).toFixed(0)}% (${s.fallbacks}/${s.calls}) — the provider may be degraded`,
    });
  }
  if (s.avgMs >= th.maxAvgMs) {
    out.push({
      key: "avg_latency",
      severity: sev(s.avgMs, th.maxAvgMs),
      message: `Average AI latency ${Math.round(s.avgMs)}ms exceeds the ${th.maxAvgMs}ms ceiling`,
    });
  }
  if (s.estCostUsd >= th.maxCostUsd) {
    out.push({
      key: "cost",
      severity: sev(s.estCostUsd, th.maxCostUsd),
      message: `AI spend $${s.estCostUsd.toFixed(2)} over the $${th.maxCostUsd} window budget`,
    });
  }
  return out;
}
