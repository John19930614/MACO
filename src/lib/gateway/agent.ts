/**
 * AI Gateway Agent (server-only) — monitors and helps maintain the existing AI
 * Gateway. It runs the live gateway pipeline, folds in AI telemetry and the
 * validation review backlog, judges overall gateway HEALTH, surfaces concrete
 * MAINTENANCE findings + recommendations, and (optionally) logs a snapshot so
 * health and trend are visible over time.
 *
 * It does not replace the gateway or gate any traffic — it watches it.
 *
 * IMPORTANT: never import into a client component — it reads server secrets.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MOCK_MODE } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runGatewayPipeline, loadGatewayDataset, evaluateGateways } from "./pipeline";
import { getPersistedTelemetry } from "@/lib/ai/telemetry";
import { summarizeTelemetry } from "@/lib/analytics/ai";
import { detectAiAnomalies } from "@/lib/analytics/alerts";
import { getCspReviewSummary } from "@/lib/csp/repo";

export type GatewayHealthStatus = "healthy" | "degraded" | "critical";
export type FindingSeverity = "critical" | "warning" | "info";

export interface GatewayHealthFinding {
  title: string;
  severity: FindingSeverity;
  detail: string;
  recommendation: string;
}

export interface GatewayHealthSnapshot {
  id?: string;
  checked_at: string;
  overall_status: GatewayHealthStatus;
  gateway_overall: "pass" | "warn" | "fail" | null;
  pass_count: number;
  warn_count: number;
  fail_count: number;
  reject_queue_count: number;
  resolvable_count: number;
  human_review_queue: number;
  csp_pending_reviews: number;
  ai_calls: number;
  ai_fallback_rate: number;
  ai_avg_latency_ms: number;
  ai_est_cost: number;
  anomaly_count: number;
  findings: GatewayHealthFinding[];
  generated_by: string | null;
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

/** Run a gateway health check. Persists a snapshot when persist=true. */
export async function runGatewayHealthCheck(
  opts: { persist?: boolean; generatedBy?: string; client?: SupabaseClient; tenantId?: string } = {},
): Promise<GatewayHealthSnapshot> {
  const nowIso = new Date().toISOString();
  // Session path (page/action) uses runGatewayPipeline; the cron passes a service
  // client + tenantId and we evaluate that tenant's dataset explicitly.
  const report = await (opts.tenantId
    ? loadGatewayDataset(opts.tenantId).then((d) => evaluateGateways(d, Date.now()))
    : runGatewayPipeline()
  ).catch(() => null);
  const telemetry = await getPersistedTelemetry(200).catch(() => []);
  const tsum = summarizeTelemetry(telemetry);
  const anomalies = detectAiAnomalies(tsum);

  let cspPending = 0;
  if (opts.client && opts.tenantId) {
    const { count } = await opts.client.from("csp_review_queue")
      .select("*", { count: "exact", head: true }).eq("status", "pending").eq("tenant_id", opts.tenantId);
    cspPending = count ?? 0;
  } else {
    cspPending = (await getCspReviewSummary().catch(() => ({ pending: 0 }))).pending;
  }

  const findings: GatewayHealthFinding[] = [];

  if (!report) {
    findings.push({
      title: "Gateway pipeline unavailable",
      severity: "critical",
      detail: "The gateway health check could not run the validation pipeline.",
      recommendation: "Confirm the EHS data layer and Supabase connection are healthy.",
    });
  }

  const rejectCount = report?.rejectQueue.length ?? 0;
  const resolvable = report?.rejectQueue.filter((r) => r.resolvable).length ?? 0;
  const humanReview = report?.humanReviewQueue ?? 0;

  // Gate-level health.
  if (report?.overall === "fail") {
    const failing = [
      ...report.gateways.flatMap((g) => g.checks.filter((c) => c.status === "fail").map((c) => `${g.name}: ${c.label}`)),
      ...report.finalReview.filter((c) => c.status === "fail").map((c) => c.label),
    ];
    findings.push({
      title: "Gateway is blocking records (overall FAIL)",
      severity: "critical",
      detail: `${rejectCount} record(s) are in the reject queue. Failing checks: ${failing.slice(0, 5).join("; ") || "see report"}.`,
      recommendation: "Clear the reject queue — fix the failing records or correct the gate rule if it is over-firing.",
    });
  } else if (report?.overall === "warn") {
    findings.push({
      title: "Gateway has warnings",
      severity: "warning",
      detail: `${report.counts.warn} check(s) are in a warning state across the three gates.`,
      recommendation: "Review the warnings on the gateway report; they are quality issues, not hard blocks.",
    });
  }

  // Reject-queue backlog (resolvable ones the agent can point at).
  if (rejectCount > 0 && report?.overall !== "fail") {
    findings.push({
      title: `${rejectCount} record(s) in the reject queue`,
      severity: rejectCount >= 10 ? "warning" : "info",
      detail: `${resolvable} of ${rejectCount} are auto-resolvable (overdue/calibration items).`,
      recommendation: "Work the reject queue so blocked records can enter the EHS database.",
    });
  }

  // Human-review backlog (gateway + CSP validation agent).
  const totalReview = humanReview + cspPending;
  if (totalReview >= 5) {
    findings.push({
      title: "Human review backlog building",
      severity: totalReview >= 15 ? "warning" : "info",
      detail: `${humanReview} AI finding(s) + ${cspPending} validation(s) awaiting a human reviewer.`,
      recommendation: "Triage the review queues; sign-offs also feed the validation agent's memory.",
    });
  }

  // AI engine health from telemetry.
  if (tsum.calls > 0 && tsum.fallbackRate >= 0.25) {
    findings.push({
      title: "AI fallback rate elevated",
      severity: tsum.fallbackRate >= 0.5 ? "critical" : "warning",
      detail: `${Math.round(tsum.fallbackRate * 100)}% of recent AI calls fell back to the heuristic — the model provider may be degraded.`,
      recommendation: "Check the AI provider key/quota and the circuit-breaker; the gateway is running on heuristics meanwhile.",
    });
  }
  for (const a of anomalies) {
    findings.push({
      title: a.message,
      severity: a.severity === "critical" ? "critical" : "warning",
      detail: "Detected by AI telemetry anomaly monitoring.",
      recommendation: "Investigate AI cost/latency/drift on the AI Model Configuration page.",
    });
  }

  const overall_status: GatewayHealthStatus = findings.some((f) => f.severity === "critical")
    ? "critical"
    : findings.some((f) => f.severity === "warning") || report?.overall === "warn"
      ? "degraded"
      : "healthy";

  const snapshot: GatewayHealthSnapshot = {
    checked_at: nowIso,
    overall_status,
    gateway_overall: report?.overall ?? null,
    pass_count: report?.counts.pass ?? 0,
    warn_count: report?.counts.warn ?? 0,
    fail_count: report?.counts.fail ?? 0,
    reject_queue_count: rejectCount,
    resolvable_count: resolvable,
    human_review_queue: humanReview,
    csp_pending_reviews: cspPending,
    ai_calls: tsum.calls,
    ai_fallback_rate: Math.round(tsum.fallbackRate * 100) / 100,
    ai_avg_latency_ms: Math.round(tsum.avgMs),
    ai_est_cost: Math.round(num(tsum.estCostUsd) * 100) / 100,
    anomaly_count: anomalies.length,
    findings,
    generated_by: opts.generatedBy ?? null,
  };

  if (opts.persist && !MOCK_MODE) {
    const client = opts.client ?? await createSupabaseServerClient();
    if (client) {
      const { data } = await client.from("gateway_agent_health_log").insert({
        tenant_id: opts.tenantId ?? null,
        overall_status: snapshot.overall_status,
        gateway_overall: snapshot.gateway_overall,
        pass_count: snapshot.pass_count, warn_count: snapshot.warn_count, fail_count: snapshot.fail_count,
        reject_queue_count: snapshot.reject_queue_count, resolvable_count: snapshot.resolvable_count,
        human_review_queue: snapshot.human_review_queue, csp_pending_reviews: snapshot.csp_pending_reviews,
        ai_calls: snapshot.ai_calls, ai_fallback_rate: snapshot.ai_fallback_rate,
        ai_avg_latency_ms: snapshot.ai_avg_latency_ms, ai_est_cost: snapshot.ai_est_cost,
        anomaly_count: snapshot.anomaly_count, findings: snapshot.findings,
        metrics: snapshot, generated_by: snapshot.generated_by,
      }).select("id").single();
      if (data) snapshot.id = data.id;
    }
  }

  return snapshot;
}

export async function getGatewayHealthSnapshots(limit = 12): Promise<GatewayHealthSnapshot[]> {
  if (MOCK_MODE) return [];
  const client = await createSupabaseServerClient();
  if (!client) return [];
  const { data } = await client.from("gateway_agent_health_log").select("*").order("checked_at", { ascending: false }).limit(limit);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    checked_at: String(r.checked_at),
    overall_status: r.overall_status as GatewayHealthStatus,
    gateway_overall: (r.gateway_overall as GatewayHealthSnapshot["gateway_overall"]) ?? null,
    pass_count: num(r.pass_count), warn_count: num(r.warn_count), fail_count: num(r.fail_count),
    reject_queue_count: num(r.reject_queue_count), resolvable_count: num(r.resolvable_count),
    human_review_queue: num(r.human_review_queue), csp_pending_reviews: num(r.csp_pending_reviews),
    ai_calls: num(r.ai_calls), ai_fallback_rate: num(r.ai_fallback_rate),
    ai_avg_latency_ms: num(r.ai_avg_latency_ms), ai_est_cost: num(r.ai_est_cost),
    anomaly_count: num(r.anomaly_count),
    findings: (r.findings as GatewayHealthFinding[]) ?? [],
    generated_by: (r.generated_by as string) ?? null,
  }));
}
