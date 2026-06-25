/**
 * CSP-informed EHS record validator (server-only).
 *
 * Two layers, by design:
 *   1. A DETERMINISTIC engine (always runs) — checks declared required fields,
 *      evidence requirements, and each applicable rule's human-review triggers
 *      against hard signals. This is what guarantees the background agent does
 *      real work on prod even when no AI key is configured.
 *   2. An optional LLM enrichment (live mode only) — narrates the case and gives
 *      a recordability/regulatory read. Any failure falls back to the
 *      deterministic narrative; the model never gets the final say on whether a
 *      high-stakes record skips human review.
 *
 * The agent is CSP-INFORMED, not a CSP. High-stakes, regulatory, reportable, or
 * low-confidence records are always escalated to a credentialed human reviewer.
 *
 * IMPORTANT: never import into a client component — it reads server secrets.
 */
import "server-only";
import { MOCK_MODE, hasLiveAi, aiProvider } from "@/lib/env";
import { generateStructuredJson } from "@/lib/ai/provider";
import { recordAiCall } from "@/lib/ai/telemetry";
import { CSP_AGENT_VERSION, CSP_POSITIONING } from "./defaults";
import type {
  CspValidationInput, CspValidationResult, CspRecordRequirement, CspRule,
  CspFinding, CspRiskLevel, CspValidationStatus, CspSignals, CspAgentContext,
} from "./types";

/** Below this 0–100 confidence, a record is escalated to human review. */
const LOW_CONFIDENCE = 80;
const MODEL_TIMEOUT_MS = 20_000;

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/** Map a record severity + hard signals onto the CSP risk ladder. */
function deriveRiskLevel(severity: string | undefined, s: CspSignals): CspRiskLevel {
  if (s.fatality || s.amputation_or_eye_loss || s.loss_of_consciousness) return "sif_potential";
  if (s.hospitalization || s.high_or_critical_potential || severity === "critical") return "critical";
  if (severity === "high") return "high";
  if (severity === "low") return "low";
  return "medium";
}

const RISK_SCORE: Record<CspRiskLevel, number> = {
  low: 15, medium: 40, high: 70, critical: 88, sif_potential: 95, idlh_imminent_danger: 100,
};

/** Which mandatory-review condition tokens are currently satisfied by the signals. */
function matchedMandatoryConditions(conditions: string[], s: CspSignals): string[] {
  const has = (cond: string): boolean => {
    switch (cond) {
      case "fatality": return !!s.fatality;
      case "hospitalization": return !!s.hospitalization;
      case "amputation":
      case "eye_loss": return !!s.amputation_or_eye_loss;
      case "restricted_work": return !!s.restricted_work;
      case "days_away": return (s.lost_time_days ?? 0) > 0;
      case "possible_recordable":
        return !!s.medical_treatment_beyond_first_aid || (s.lost_time_days ?? 0) > 0 || !!s.restricted_work || !!s.loss_of_consciousness;
      case "high_or_critical_potential": return !!s.high_or_critical_potential;
      case "SIF_potential": return !!s.fatality || !!s.amputation_or_eye_loss || !!s.high_or_critical_potential;
      case "regulatory_trigger": return !!s.regulatory_reportable;
      case "repeat_finding": return !!s.repeat_finding;
      case "uncertain_treatment_level": return s.medical_treatment_beyond_first_aid === undefined;
      default: return false;
    }
  };
  return conditions.filter(has);
}

/** Deterministic core — always runs, no network. */
function evaluate(
  input: CspValidationInput,
  requirement: CspRecordRequirement | undefined,
  rules: CspRule[],
  ctx?: CspAgentContext,
): CspValidationResult {
  const findings: CspFinding[] = [];
  const severity = typeof input.fields.severity === "string" ? input.fields.severity : undefined;
  const riskLevel = deriveRiskLevel(severity, input.signals);

  // 1 — Required-field completeness.
  const required = requirement?.required_fields ?? [];
  const missing_fields = required.filter((f) => isEmpty(input.fields[f]));
  for (const f of missing_fields) {
    findings.push({
      finding_title: `Missing required field: ${f.replace(/_/g, " ")}`,
      finding_description: `The ${input.module_name} record is missing "${f.replace(/_/g, " ")}", which is required for a complete, defensible record.`,
      finding_category: "missing_field",
      risk_level: "medium",
      requires_corrective_action: false,
      requires_human_review: false,
    });
  }

  // 2 — Evidence requirements.
  const evidenceReqs = requirement?.evidence_requirements ?? [];
  if (evidenceReqs.length > 0 && input.evidence_count === 0) {
    findings.push({
      finding_title: "No supporting evidence attached",
      finding_description: `This record type expects supporting evidence (${evidenceReqs.slice(0, 3).map((e) => e.replace(/_/g, " ")).join(", ")}…). None is on file.`,
      finding_category: "evidence_gap",
      risk_level: riskLevel === "low" ? "low" : "medium",
      requires_corrective_action: false,
      requires_human_review: false,
    });
  }

  // 3 — Rule-driven regulatory / standards triggers.
  const applicable = rules.filter((r) => r.applies_to_record_types.includes(input.record_type));
  const rules_checked = applicable.map((r) => r.rule_code);
  const citations_used: string[] = [];
  const regulatory_triggers: string[] = [];
  const mandatory = matchedMandatoryConditions(requirement?.mandatory_human_review_conditions ?? [], input.signals);

  for (const rule of applicable) {
    const fired = rule.human_review_triggers.filter((t) => {
      // A trigger fires when the matching hard signal is present, or when the
      // requirement's mandatory conditions already named it.
      if (mandatory.includes(t)) return true;
      switch (t) {
        case "possible_recordable":
        case "medical_treatment_beyond_first_aid":
          return !!input.signals.medical_treatment_beyond_first_aid;
        case "days_away": return (input.signals.lost_time_days ?? 0) > 0;
        case "restricted_work": return !!input.signals.restricted_work;
        case "loss_of_consciousness": return !!input.signals.loss_of_consciousness;
        case "repeat_finding": return !!input.signals.repeat_finding;
        case "high_risk_hazard": return riskLevel === "high" || riskLevel === "critical" || riskLevel === "sif_potential";
        case "missing_corrective_action": return required.includes("corrective_action") && isEmpty(input.fields.corrective_action);
        default: return false;
      }
    });
    if (fired.length > 0) {
      if (rule.citation) citations_used.push(rule.citation);
      regulatory_triggers.push(...fired);
      findings.push({
        finding_title: `${rule.rule_title} — review trigger`,
        finding_description: `${rule.rule_summary ?? rule.rule_title} Triggered by: ${fired.map((t) => t.replace(/_/g, " ")).join(", ")}.`,
        finding_category: "regulatory_trigger",
        risk_level: riskLevel,
        rule_code: rule.rule_code,
        citation: rule.citation,
        source_url: rule.source_url,
        recommended_action: `Qualified EHS review required before final classification under ${rule.citation ?? rule.rule_title}.`,
        requires_corrective_action: false,
        requires_human_review: true,
      });
    }
  }

  // 4 — Confidence (deterministic shape-based; 0–100).
  let confidence = 92;
  confidence -= Math.min(40, missing_fields.length * 8);
  if (evidenceReqs.length > 0 && input.evidence_count === 0) confidence -= 6;
  if (input.signals.medical_treatment_beyond_first_aid === undefined) confidence -= 8; // uncertain treatment level
  confidence = Math.max(35, Math.min(98, confidence));

  // 4b — Governance: apply learned memory (gated by the apply_learned_memory
  // guardrail). Memory can nudge confidence or escalate, never auto-clear.
  const appliedLessons: string[] = [];
  let memoryEscalate = false;
  const guard = (k: string) => ctx?.guardrails?.[k];
  if (ctx && guard("apply_learned_memory")?.enabled) {
    for (const m of ctx.memory) {
      if (!m.active) continue;
      if (m.record_type && m.record_type !== input.record_type) continue;
      if (m.finding_category && !findings.some((f) => f.finding_category === m.finding_category)) continue;
      const w = Number(m.weight) || 0;
      if (m.directive === "raise_confidence") { confidence = Math.min(98, confidence + w); appliedLessons.push(m.lesson); }
      else if (m.directive === "lower_confidence") { confidence = Math.max(20, confidence - w); appliedLessons.push(m.lesson); }
      else if (m.directive === "escalate") { memoryEscalate = true; appliedLessons.push(m.lesson); }
      else appliedLessons.push(m.lesson);
    }
  }

  // 5 — Human-review decision (the model never overrides an escalation).
  const mandatoryHit = mandatory.length > 0;
  const recordableHit = regulatory_triggers.some((t) =>
    ["possible_recordable", "medical_treatment_beyond_first_aid", "days_away", "restricted_work", "loss_of_consciousness"].includes(t));
  const highRisk = RISK_SCORE[riskLevel] >= 70;

  // Qualification / autonomy guardrails: an otherwise-clean record may only be
  // auto-accepted if the agent holds a qualification granting autonomy for the
  // record type and clears the minimum-confidence bar.
  const requiresQual = guard("autonomy_requires_qualification")?.enabled ?? false;
  const isQualified = !!ctx && ctx.qualifications.some((q) =>
    q.status === "active" && q.grants_autonomy &&
    (q.scope_record_types.length === 0 || q.scope_record_types.includes(input.record_type)));
  const minConfGuard = guard("min_autonomy_confidence");
  const minConf = minConfGuard?.enabled ? Number(minConfGuard.threshold) || 0 : 0;
  const lacksQual = requiresQual && !isQualified;
  const belowMinConf = minConf > 0 && confidence < minConf;

  const human_review_required =
    mandatoryHit || recordableHit || memoryEscalate ||
    confidence < LOW_CONFIDENCE || highRisk ||
    lacksQual || belowMinConf;

  const reasons: string[] = [];
  if (mandatoryHit) reasons.push(`mandatory condition(s): ${mandatory.join(", ")}`);
  if (recordableHit) reasons.push("possible OSHA recordable/reportable");
  if (memoryEscalate) reasons.push("a learned lesson flagged this pattern");
  if (confidence < LOW_CONFIDENCE) reasons.push(`confidence ${confidence}% below ${LOW_CONFIDENCE}% threshold`);
  if (highRisk) reasons.push(`${riskLevel.replace(/_/g, " ")} risk level`);
  if (lacksQual) reasons.push(`no qualification grants autonomy for ${input.record_type.replace(/_/g, " ")}`);
  if (belowMinConf) reasons.push(`confidence below autonomy minimum ${minConf}%`);
  const human_review_reason = reasons.length ? `Escalated: ${reasons.join("; ")}.` : null;

  // 6 — Overall validation status.
  let validation_status: CspValidationStatus;
  if (missing_fields.length > 0) validation_status = "rejected_incomplete";
  else if (recordableHit) validation_status = "potential_recordable_or_reportable";
  else if (regulatory_triggers.length > 0) validation_status = "potential_regulatory_issue";
  else if (human_review_required) validation_status = "needs_human_review";
  else if (findings.length > 0) validation_status = "accepted_with_minor_corrections";
  else validation_status = "accepted";

  const recommended_corrections: string[] = [];
  if (missing_fields.length > 0) recommended_corrections.push(`Complete the missing required field(s): ${missing_fields.map((f) => f.replace(/_/g, " ")).join(", ")}.`);
  if (evidenceReqs.length > 0 && input.evidence_count === 0) recommended_corrections.push("Attach supporting evidence or document why none is available.");
  if (recordableHit) recommended_corrections.push("Have a qualified EHS professional confirm OSHA recordability before final classification.");

  const summary = buildDeterministicSummary(input, validation_status, riskLevel, missing_fields.length, regulatory_triggers, confidence);

  return {
    validation_status,
    risk_level: riskLevel,
    confidence_score: confidence,
    rules_checked,
    citations_used: [...new Set(citations_used)],
    evidence_reviewed: input.evidence_count > 0 ? [`${input.evidence_count} attachment(s)`] : [],
    missing_fields,
    inconsistencies_found: [],
    regulatory_triggers: [...new Set(regulatory_triggers)],
    ai_summary: summary,
    ai_reasoning_summary: `Checked ${rules_checked.length} rule(s) and ${required.length} required field(s). ${missing_fields.length} missing, ${regulatory_triggers.length} regulatory trigger(s).${appliedLessons.length ? ` Applied ${appliedLessons.length} learned lesson(s): ${appliedLessons.join("; ")}.` : ""}`,
    ai_recommendation: human_review_required
      ? "Route to a credentialed EHS reviewer (CSP/CIH/CHST) before this record is finalized."
      : "Record passes automated validation. No human review required.",
    recommended_corrections,
    human_review_required,
    human_review_reason,
    findings,
    model: "csp-deterministic",
  };
}

function buildDeterministicSummary(
  input: CspValidationInput, status: CspValidationStatus, risk: CspRiskLevel,
  missingCount: number, triggers: string[], confidence: number,
): string {
  const title = typeof input.fields.title === "string" ? input.fields.title : input.module_name;
  const parts = [`${title} — validation ${status.replace(/_/g, " ")} at ${confidence}% confidence (${risk.replace(/_/g, " ")} risk).`];
  if (missingCount > 0) parts.push(`${missingCount} required field(s) missing.`);
  if (triggers.length > 0) parts.push(`Regulatory triggers: ${triggers.map((t) => t.replace(/_/g, " ")).join(", ")}.`);
  if (status === "accepted") parts.push("Record is complete and within automated tolerances.");
  return parts.join(" ");
}

// ── LLM enrichment schema (compact, optional) ─────────────────────────────────
const ENRICH_SCHEMA = {
  name: "csp_validation_enrichment",
  strict: true,
  schema: {
    type: "object",
    required: ["summary", "reasoning", "recommendation", "possible_recordable"],
    additionalProperties: false,
    properties: {
      summary:        { type: "string" },
      reasoning:      { type: "string" },
      recommendation: { type: "string" },
      possible_recordable: { type: "boolean" },
    },
  },
} as const;

/**
 * Validate one EHS record. Deterministic engine always runs; in live mode the
 * LLM narrates and may RAISE (never lower) the recordability/review posture.
 */
export async function validateEhsRecord(
  input: CspValidationInput,
  requirement: CspRecordRequirement | undefined,
  rules: CspRule[],
  opts: { enrich?: boolean; ctx?: CspAgentContext } = {},
): Promise<CspValidationResult> {
  const base = evaluate(input, requirement, rules, opts.ctx);

  // enrich defaults to false so inline save hooks stay instant; the review
  // panel's "re-run with AI" passes enrich:true for the model narrative.
  if (opts.enrich !== true || MOCK_MODE || !hasLiveAi()) return base;

  try {
    const system = `You are a CSP-informed EHS Records Validation Agent. ${CSP_POSITIONING} Review the record and the deterministic findings. Do not invent facts. If the case could be OSHA recordable, reportable, or otherwise high-stakes, set possible_recordable=true. Be concise and specific.`;
    const user = `Record type: ${input.record_type} (${input.module_name})
Fields: ${JSON.stringify(input.fields)}
Hard signals: ${JSON.stringify(input.signals)}
Deterministic status: ${base.validation_status}; risk: ${base.risk_level}; confidence: ${base.confidence_score}
Missing required fields: ${base.missing_fields.join(", ") || "none"}
Regulatory triggers fired: ${base.regulatory_triggers.join(", ") || "none"}`;

    const { data, model } = await generateStructuredJson({
      system, user, schema: ENRICH_SCHEMA, maxTokens: 600, timeoutMs: MODEL_TIMEOUT_MS, tier: "deep",
    });
    const d = data as { summary?: string; reasoning?: string; recommendation?: string; possible_recordable?: boolean };

    const escalate = base.human_review_required || d.possible_recordable === true;
    return {
      ...base,
      ai_summary: typeof d.summary === "string" && d.summary.trim() ? d.summary.trim() : base.ai_summary,
      ai_reasoning_summary: typeof d.reasoning === "string" && d.reasoning.trim() ? d.reasoning.trim() : base.ai_reasoning_summary,
      ai_recommendation: typeof d.recommendation === "string" && d.recommendation.trim() ? d.recommendation.trim() : base.ai_recommendation,
      human_review_required: escalate,
      human_review_reason: escalate
        ? (base.human_review_reason ?? "Escalated: model flagged possible recordable/reportable case.")
        : base.human_review_reason,
      validation_status: !base.human_review_required && d.possible_recordable === true
        ? "potential_recordable_or_reportable"
        : base.validation_status,
      model: `${aiProvider()}:${model}`,
    };
  } catch {
    recordAiCall({ provider: aiProvider(), model: "csp-deterministic-fallback", ms: 0, inputTokens: 0, outputTokens: 0, ok: false });
    return base;
  }
}
