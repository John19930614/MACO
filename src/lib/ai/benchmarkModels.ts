/**
 * AI model benchmark harness (pure logic). Compares candidate Anthropic models
 * against the configured default on a fixed set of synthetic EHS analysis
 * prompts, so a platform operator can decide whether to change the
 * SAFETYIQ_ANTHROPIC_MODEL default with evidence instead of vibes.
 *
 * HONEST SCOPE: the "score" here is JSON field-completeness — a measure of
 * schema compliance / instruction following — combined with latency and cost.
 * It is NOT a measure of regulatory accuracy; a human reviews the raw
 * responses before any default-model change ships.
 *
 * No DOM, no Supabase, no network — safe to import in the node test env and
 * in client components (types only).
 */

/**
 * The current production default (serverSecrets().anthropicModel fallback).
 * Upgraded from claude-sonnet-4-6 on 2026-07-02 after the first benchmark run
 * (sonnet-5: 100/100, 0 failures vs sonnet-4-6: 75/100 at the same price).
 */
export const BASELINE_MODEL = "claude-sonnet-5";

/**
 * Models included in a benchmark run. Baseline first; haiku is the existing
 * triage tier and sonnet-4-6 the previous default — both run as reference
 * points, not upgrade candidates.
 */
export const CANDIDATE_MODELS = [
  BASELINE_MODEL,
  "claude-haiku-4-5",
  "claude-sonnet-4-6",
  "claude-opus-4-8",
] as const;

/** Models the recommendation logic may crown as an upgrade over the baseline. */
export const UPGRADE_CANDIDATES = ["claude-opus-4-8"] as const;

/** A candidate must beat the baseline's mean score by at least this much. */
export const ACCURACY_THRESHOLD = 5;
/** …and must not cost more than this multiple of the baseline per call. */
export const COST_MULTIPLIER_LIMIT = 3;

export interface BenchPrompt {
  key: string;
  label: string;
  system: string;
  user: string;
  /** Field keys expected in the structured JSON response (completeness scoring). */
  expectedFields: string[];
}

const BENCH_SYSTEM = "You are an EHS regulatory assistant. Respond with valid JSON only.";

/**
 * 8 synthetic EHS regulatory analysis prompts. No real PII or tenant data —
 * all scenarios are illustrative.
 */
export const EHS_BENCH_PROMPTS: BenchPrompt[] = [
  {
    key: "hazmat_classification",
    label: "Hazardous material classification",
    system: BENCH_SYSTEM,
    user: "Classify the following substance and return JSON with fields: un_number, hazard_class, packing_group, regulatory_notes. Substance: Hydrofluoric acid, 48% solution.",
    expectedFields: ["un_number", "hazard_class", "packing_group", "regulatory_notes"],
  },
  {
    key: "incident_root_cause",
    label: "Incident root-cause analysis",
    system: BENCH_SYSTEM,
    user: "A worker slipped on a wet floor in a chemical storage area and sustained a fractured wrist. Return JSON with fields: immediate_cause, root_causes (array), contributing_factors (array), recommended_controls (array).",
    expectedFields: ["immediate_cause", "root_causes", "contributing_factors", "recommended_controls"],
  },
  {
    key: "risk_matrix_score",
    label: "Risk matrix scoring",
    system: BENCH_SYSTEM,
    user: "Score the following risk: Exposure to benzene vapours during tank cleaning, 2 workers, monthly frequency, no respiratory PPE. Return JSON with fields: likelihood_score (1-5), consequence_score (1-5), risk_rating (Low/Medium/High/Critical), justification.",
    expectedFields: ["likelihood_score", "consequence_score", "risk_rating", "justification"],
  },
  {
    key: "sds_summary",
    label: "SDS section summary",
    system: BENCH_SYSTEM,
    user: "Summarise the key regulatory obligations from GHS Section 15 for acetone. Return JSON with fields: applicable_regulations (array), inventory_thresholds, reporting_obligations (array).",
    expectedFields: ["applicable_regulations", "inventory_thresholds", "reporting_obligations"],
  },
  {
    key: "permit_to_work",
    label: "Permit-to-work checklist generation",
    system: BENCH_SYSTEM,
    user: "Generate a hot-work permit checklist for welding operations inside a confined space. Return JSON with fields: pre_work_checks (array), during_work_controls (array), emergency_provisions (array).",
    expectedFields: ["pre_work_checks", "during_work_controls", "emergency_provisions"],
  },
  {
    key: "environmental_compliance",
    label: "Environmental compliance gap analysis",
    system: BENCH_SYSTEM,
    user: "A manufacturing site discharges 500 L/day of cooling water containing trace copper (0.3 mg/L) to a municipal sewer. Identify compliance gaps and return JSON with fields: applicable_standards (array), gaps (array), recommended_actions (array).",
    expectedFields: ["applicable_standards", "gaps", "recommended_actions"],
  },
  {
    key: "toolbox_talk",
    label: "Toolbox talk generation",
    system: BENCH_SYSTEM,
    user: "Create a 5-minute toolbox talk on manual handling injury prevention for warehouse workers. Return JSON with fields: key_messages (array, max 5), demonstration_steps (array), quiz_questions (array, max 3).",
    expectedFields: ["key_messages", "demonstration_steps", "quiz_questions"],
  },
  {
    key: "contractor_induction",
    label: "Contractor induction content",
    system: BENCH_SYSTEM,
    user: "List the mandatory EHS induction topics for a contractor working on a high-voltage electrical installation at an industrial site. Return JSON with fields: mandatory_topics (array), site_specific_hazards (array), emergency_procedures (array).",
    expectedFields: ["mandatory_topics", "site_specific_hazards", "emergency_procedures"],
  },
];

// ── Result shapes (shared by the runner, the API route, and the panel) ────────

export interface BenchmarkRowResult {
  model: string;
  prompt_key: string;
  prompt_label: string;
  latency_ms: number | null;
  input_tokens: number;
  output_tokens: number;
  /** Completeness score 0-100; null = call failed or was skipped. */
  score: number | null;
  cost_est_usd: number;
  error?: string;
}

export interface ModelAggregate {
  model: string;
  /** Mean over successful calls only. 0 when every call failed. */
  meanScore: number;
  meanCostUsd: number;
  meanLatencyMs: number;
  failures: number;
  calls: number;
}

export interface BenchmarkRunResult {
  rows: BenchmarkRowResult[];
  aggregates: ModelAggregate[];
  winner: string | null;
  recommendation: "upgrade" | "keep" | "inconclusive";
  summary: string;
  run_at: string;
  /** True when rows were written to ai_model_benchmarks. */
  persisted: boolean;
  /** True for the canned mock-mode payload. */
  demo?: boolean;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Fraction (0-1) of expected field keys present and non-empty in a structured
 * JSON response.
 */
export function scoreCompleteness(parsed: unknown, expectedFields: string[]): number {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || expectedFields.length === 0) {
    return 0;
  }
  const record = parsed as Record<string, unknown>;
  const present = expectedFields.filter((field) => {
    const val = record[field];
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "string") return val.trim().length > 0;
    return true;
  });
  return present.length / expectedFields.length;
}

/**
 * Normalise a completeness ratio (0-1) to a 0-100 score, with a mild penalty
 * for very short responses (< 100 chars) as a proxy for low-effort output.
 */
export function normaliseScore({
  completenessRatio,
  responseLength,
}: {
  completenessRatio: number;
  responseLength: number;
}): number {
  const base = Math.round(completenessRatio * 100);
  const lengthPenalty = responseLength < 100 ? 10 : 0;
  return Math.max(0, base - lengthPenalty);
}

// ── Aggregation & recommendation ──────────────────────────────────────────────

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/** Collapse per-call rows into one aggregate per model, in first-seen order. */
export function aggregateRows(rows: BenchmarkRowResult[]): ModelAggregate[] {
  const order: string[] = [];
  const byModel = new Map<string, BenchmarkRowResult[]>();
  for (const row of rows) {
    if (!byModel.has(row.model)) {
      byModel.set(row.model, []);
      order.push(row.model);
    }
    byModel.get(row.model)!.push(row);
  }
  return order.map((model) => {
    const modelRows = byModel.get(model)!;
    const ok = modelRows.filter((r) => r.score !== null);
    return {
      model,
      meanScore: mean(ok.map((r) => r.score as number)),
      meanCostUsd: mean(ok.map((r) => r.cost_est_usd)),
      meanLatencyMs: mean(ok.map((r) => r.latency_ms ?? 0)),
      failures: modelRows.length - ok.length,
      calls: modelRows.length,
    };
  });
}

/**
 * Decide upgrade / keep / inconclusive against the baseline. A candidate
 * qualifies only if it had zero failures, beat the baseline's mean score by
 * ≥ ACCURACY_THRESHOLD points, and cost ≤ COST_MULTIPLIER_LIMIT× per call.
 * Every candidate is evaluated (no first-match short-circuit); the
 * highest-scoring qualifier wins, cheaper model breaking ties.
 */
export function recommend(aggregates: ModelAggregate[]): {
  winner: string | null;
  recommendation: BenchmarkRunResult["recommendation"];
  summary: string;
} {
  const lines = aggregates.map(
    (a) =>
      `${a.model}: score ${a.meanScore.toFixed(1)}/100 · $${a.meanCostUsd.toFixed(4)}/call · ${Math.round(
        a.meanLatencyMs,
      )} ms · ${a.failures}/${a.calls} failed`,
  );
  const detail = lines.join("\n");

  const baseline = aggregates.find((a) => a.model === BASELINE_MODEL);
  if (!baseline || baseline.failures === baseline.calls || baseline.meanCostUsd <= 0) {
    return {
      winner: null,
      recommendation: "inconclusive",
      summary: `Inconclusive — the baseline model produced no successful calls.\n${detail}`,
    };
  }

  const qualifiers = aggregates.filter(
    (a) =>
      (UPGRADE_CANDIDATES as readonly string[]).includes(a.model) &&
      a.calls > 0 &&
      a.failures === 0 &&
      a.meanScore - baseline.meanScore >= ACCURACY_THRESHOLD &&
      a.meanCostUsd / baseline.meanCostUsd <= COST_MULTIPLIER_LIMIT,
  );

  if (qualifiers.length === 0) {
    return {
      winner: BASELINE_MODEL,
      recommendation: "keep",
      summary: `Keep ${BASELINE_MODEL} — no candidate cleared the completeness (+${ACCURACY_THRESHOLD} pts) and cost (≤${COST_MULTIPLIER_LIMIT}×) gates.\n${detail}`,
    };
  }

  qualifiers.sort((a, b) => b.meanScore - a.meanScore || a.meanCostUsd - b.meanCostUsd);
  const winner = qualifiers[0];
  return {
    winner: winner.model,
    recommendation: "upgrade",
    summary: `Upgrade recommended — ${winner.model} scored ≥${ACCURACY_THRESHOLD} points above ${BASELINE_MODEL} within the cost limit. Human approval required before changing the env.ts default.\n${detail}`,
  };
}
