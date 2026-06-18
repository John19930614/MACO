/**
 * SafetyIQ Predictability Engine (server-only). Provides three core analyses:
 *
 *   1. Chemical Hazard Analysis — assess GHS classification, incompatibilities,
 *      storage requirements, and regulatory obligations for a chemical record.
 *   2. Compliance Gap Detection — given a legal requirement and current status,
 *      identify gaps and generate prioritised CAPA recommendations.
 *   3. Training Gap Analysis — identify overdue / expiring training by employee,
 *      role, and site, and predict compliance trajectory.
 *
 * In live mode each analysis calls the configured LLM. In mock mode a
 * deterministic heuristic runs instead — every screen is fully demonstrable
 * without API keys.
 *
 * IMPORTANT: never import this into a client component — it reads server secrets.
 */
import "server-only";
import { MOCK_MODE, hasLiveAi, aiProvider, PROMPT_VERSION } from "@/lib/env";
import { generateStructuredJson } from "./provider";
import { recordAiCall } from "./telemetry";
import { nextId } from "@/lib/data/store";
import type { Chemical, LegalRequirement, AiFinding, AiAnalysisOutput, PredictabilityForecast } from "@/lib/types";
import { riskLevelFromScore, COMPLIANCE_STATUS_META } from "@/lib/constants";
import type { Severity, RiskLevel } from "@/lib/constants";

const MODEL_TIMEOUT_MS = 30_000;

// ── Schema contract shared with the provider ──────────────────────────────────

const ANALYSIS_JSON_SCHEMA = {
  name: "safetyiq_analysis",
  strict: true,
  schema: {
    type: "object",
    required: [
      "risk_level", "risk_score", "findings", "gaps",
      "regulatory_refs", "recommended_actions",
      "plain_language_summary", "human_review_required",
    ],
    additionalProperties: false,
    properties: {
      risk_level:   { type: "string", enum: ["negligible", "low", "medium", "high", "extreme"] },
      risk_score:   { type: "number", minimum: 0, maximum: 100 },
      findings: {
        type: "array",
        items: {
          type: "object",
          required: ["category", "description", "severity"],
          additionalProperties: false,
          properties: {
            category:    { type: "string" },
            description: { type: "string" },
            severity:    { type: "string", enum: ["low", "medium", "high", "critical"] },
          },
        },
      },
      gaps:            { type: "array", items: { type: "string" } },
      regulatory_refs: { type: "array", items: { type: "string" } },
      recommended_actions: {
        type: "array",
        items: {
          type: "object",
          required: ["action", "priority", "rationale", "capa_kind"],
          additionalProperties: false,
          properties: {
            action:    { type: "string" },
            priority:  { type: "string", enum: ["immediate", "short_term", "medium_term", "long_term"] },
            rationale: { type: "string" },
            capa_kind: { type: "string", enum: ["corrective", "preventive"] },
          },
        },
      },
      plain_language_summary: { type: "string" },
      human_review_required:  { type: "boolean" },
    },
  },
};

// ── Heuristic fallbacks (deterministic, no API required) ─────────────────────

function chemicalHeuristicAnalysis(chem: Chemical): AiAnalysisOutput {
  const highHazardClasses = chem.ghs_classes.filter((c) =>
    ["H200", "H201", "H202", "H203", "H204", "H270", "H271", "H272",
     "H300", "H310", "H330", "H340", "H350", "H360"].includes(c)
  );
  const isHighHazard = highHazardClasses.length > 0;
  const sdsExpired = chem.sds_expiry ? new Date(chem.sds_expiry) < new Date() : false;
  const isScheduled = chem.is_scheduled;

  const risk_score = Math.min(
    100,
    (isHighHazard ? 40 : 15) +
    (sdsExpired ? 20 : 0) +
    (isScheduled ? 25 : 0) +
    (chem.ghs_classes.length > 4 ? 10 : 0)
  );

  const findings: AiAnalysisOutput["findings"] = [];
  if (sdsExpired) {
    findings.push({ category: "documentation", description: `Safety Data Sheet for ${chem.name} is expired or missing. An up-to-date SDS is required under HazCom regulations.`, severity: "high" });
  }
  if (isScheduled) {
    findings.push({ category: "regulatory", description: `${chem.name} is listed on a controlled substance schedule (${chem.schedule_ref ?? "regulatory list"}). Secure storage, quantity limits, and reporting obligations apply.`, severity: "high" });
  }
  if (isHighHazard) {
    findings.push({ category: "hazard", description: `${chem.name} carries ${highHazardClasses.join(", ")} GHS classifications indicating acute toxicity, carcinogenicity, or oxidising risk. Enhanced controls are required.`, severity: "critical" });
  }
  if (!chem.storage_location) {
    findings.push({ category: "storage", description: "No storage location recorded. Physical segregation from incompatible chemicals cannot be verified.", severity: "medium" });
  }

  const gaps: string[] = [];
  if (sdsExpired) gaps.push("Current Safety Data Sheet not on file");
  if (!chem.un_number && isHighHazard) gaps.push("UN transport number missing for high-hazard substance");
  if (chem.hazard_statements.length === 0) gaps.push("No H-statements recorded — GHS labelling cannot be verified");
  if (chem.precautionary_statements.length === 0) gaps.push("No P-statements recorded — emergency response information incomplete");

  const regulatory_refs: string[] = [];
  if (isHighHazard) regulatory_refs.push("OSHA 29 CFR 1910.1200 (HazCom / GHS)");
  if (isScheduled)  regulatory_refs.push(`EPA / ${chem.schedule_ref ?? "local authority"} — controlled substance obligations`);
  if (chem.ghs_classes.some((c) => ["H400", "H410", "H411"].includes(c))) {
    regulatory_refs.push("EPA TSCA — aquatic environmental hazard reporting");
  }

  const recommended_actions: AiAnalysisOutput["recommended_actions"] = [];
  if (sdsExpired) {
    recommended_actions.push({ action: "Obtain and upload a current Safety Data Sheet from the supplier", priority: "immediate", rationale: "Expired SDS creates a regulatory compliance gap under OSHA 1910.1200(g)", capa_kind: "corrective" });
  }
  if (isHighHazard) {
    recommended_actions.push({ action: "Review storage segregation against GHS incompatibility matrix", priority: "short_term", rationale: "High-hazard classifications require physical separation from reactive or oxidising substances", capa_kind: "preventive" });
    recommended_actions.push({ action: "Verify PPE requirements and post at storage location", priority: "short_term", rationale: "H-statements indicate significant exposure risk requiring certified PPE", capa_kind: "preventive" });
  }
  if (isScheduled) {
    recommended_actions.push({ action: "Confirm current quantity is within regulatory threshold and update inventory register", priority: "immediate", rationale: "Scheduled substance thresholds trigger mandatory reporting and secure storage requirements", capa_kind: "corrective" });
  }

  return {
    risk_level: riskLevelFromScore(Math.round(risk_score / 20)) as RiskLevel,
    risk_score,
    findings,
    gaps,
    regulatory_refs,
    recommended_actions,
    plain_language_summary: `${chem.name} (CAS ${chem.cas_number ?? "unknown"}) — ${findings.length} finding${findings.length !== 1 ? "s" : ""} identified. ${isHighHazard ? "High-hazard GHS classification requires enhanced controls. " : ""}${sdsExpired ? "SDS renewal is the immediate priority. " : ""}${gaps.length > 0 ? `${gaps.length} documentation gap${gaps.length !== 1 ? "s" : ""} to close.` : "Documentation complete."}`,
    human_review_required: isHighHazard || isScheduled,
  };
}

function complianceGapHeuristicAnalysis(req: LegalRequirement): AiAnalysisOutput {
  const statusScore = COMPLIANCE_STATUS_META[req.status]?.score ?? 0;
  const isNonCompliant = req.status === "non_compliant" || req.status === "major_gap";
  const isOverdue = req.next_review_date ? new Date(req.next_review_date) < new Date() : false;

  const risk_score = Math.min(100, (100 - statusScore) * 0.7 + (isOverdue ? 20 : 0));

  const findings: AiAnalysisOutput["findings"] = [];
  if (req.status === "non_compliant") {
    findings.push({ category: "compliance", description: `Organisation is non-compliant with ${req.regulation_ref} — ${req.title}. Immediate corrective action required.`, severity: "critical" });
  } else if (req.status === "major_gap") {
    findings.push({ category: "compliance", description: `Major compliance gap identified for ${req.regulation_ref}. Current controls or documentation are materially insufficient.`, severity: "high" });
  } else if (req.status === "minor_gap") {
    findings.push({ category: "compliance", description: `Minor gap against ${req.regulation_ref}. Controls are in place but documentation or implementation is incomplete.`, severity: "medium" });
  }
  if (isOverdue) {
    findings.push({ category: "schedule", description: `Compliance review for ${req.regulation_ref} was due on ${req.next_review_date}. Overdue review creates evidence of non-systematic compliance management.`, severity: "medium" });
  }

  const gaps: string[] = [];
  if (!req.evidence_url) gaps.push("No compliance evidence document linked");
  if (req.status === "not_assessed")  gaps.push("Regulatory requirement has not been formally assessed");
  if (isOverdue) gaps.push(`Periodic review is overdue (was due ${req.next_review_date})`);

  return {
    risk_level: riskLevelFromScore(isNonCompliant ? 5 : isOverdue ? 3 : 2) as RiskLevel,
    risk_score: Math.round(risk_score),
    findings,
    gaps,
    regulatory_refs: [req.regulation_ref],
    recommended_actions: [
      ...(isNonCompliant ? [{ action: `Initiate formal compliance response plan for ${req.regulation_ref} — assign owner, timeline, and interim controls`, priority: "immediate" as const, rationale: "Non-compliance carries enforcement, penalty, and reputational risk", capa_kind: "corrective" as const }] : []),
      ...(isOverdue ? [{ action: `Schedule and complete overdue compliance review for ${req.regulation_ref}`, priority: "short_term" as const, rationale: "Systematic review cadence is itself a compliance evidence requirement", capa_kind: "corrective" as const }] : []),
      { action: "Upload evidence of current controls to the compliance record", priority: "medium_term" as const, rationale: "Documented evidence is required for regulatory audit and self-assessment", capa_kind: "preventive" as const },
    ],
    plain_language_summary: `${req.regulation_ref} — ${req.title}. Status: ${req.status.replace(/_/g, " ")}. ${findings.length} finding${findings.length !== 1 ? "s" : ""}, ${gaps.length} gap${gaps.length !== 1 ? "s" : ""}. ${isNonCompliant ? "Immediate action required — enforcement risk is present." : isOverdue ? "Review is overdue — schedule now to maintain evidence of compliance." : "On track with minor items to close."}`,
    human_review_required: isNonCompliant,
  };
}

// ── Confidence scoring ────────────────────────────────────────────────────────

export function deriveConfidence(o: AiAnalysisOutput): number {
  let s = 0.45;
  if (o.findings.length >= 1)              s += 0.10;
  if (o.recommended_actions.length >= 1)   s += 0.13;
  if (o.plain_language_summary.length >= 60) s += 0.05;
  if (o.regulatory_refs.length >= 1)       s += 0.08;
  s -= Math.min(0.15, o.gaps.length * 0.03);
  return Math.max(0.3, Math.min(0.95, Math.round(s * 100) / 100));
}

// ── Live model call ───────────────────────────────────────────────────────────

async function modelAnalysis(systemPrompt: string, userPrompt: string): Promise<{ output: AiAnalysisOutput; model: string }> {
  const { data, model } = await generateStructuredJson({
    system: systemPrompt,
    user: userPrompt,
    schema: ANALYSIS_JSON_SCHEMA,
    maxTokens: 1400,
    timeoutMs: MODEL_TIMEOUT_MS,
  });

  const out = data as AiAnalysisOutput;
  if (!out || typeof out.risk_score !== "number" || !Array.isArray(out.recommended_actions)) {
    console.error("[safetyiq] AI analysis failed schema validation", { raw: data });
    throw new Error("model output failed validation");
  }
  return { output: out, model };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Analyse a chemical inventory entry for hazards, gaps, and regulatory obligations. */
export async function analyzeChemical(chem: Chemical): Promise<AiFinding> {
  const systemPrompt = `You are a senior EHS advisor specialising in chemical safety and GHS compliance. Analyse the chemical inventory record provided and return a structured JSON analysis covering hazards, regulatory gaps, storage requirements, and prioritised corrective actions. Be specific — reference the actual GHS H-statements and CAS number. Always recommend SDS review for chemicals with H300-H373 classifications.`;
  const userPrompt = `Chemical inventory record:
Name: ${chem.name}
CAS: ${chem.cas_number ?? "unknown"}
UN number: ${chem.un_number ?? "not recorded"}
Formula: ${chem.chemical_formula ?? "not recorded"}
GHS classes: ${chem.ghs_classes.join(", ") || "none recorded"}
H-statements: ${chem.hazard_statements.join(", ") || "none"}
P-statements: ${chem.precautionary_statements.join(", ") || "none"}
Quantity: ${chem.quantity} ${chem.unit}
Storage location: ${chem.storage_location || "not recorded"}
SDS expiry: ${chem.sds_expiry ?? "not recorded"}
Scheduled substance: ${chem.is_scheduled ? `Yes — ${chem.schedule_ref ?? "regulatory list"}` : "No"}
Supplier: ${chem.supplier ?? "not recorded"}`;

  return runAnalysis({
    job: "chemical_hazard_analysis",
    source_type: "chemical",
    source_id: chem.id,
    tenant_id: chem.tenant_id,
    site_id: chem.site_id,
    input_summary: `${chem.name} — CAS ${chem.cas_number ?? "unknown"} — ${chem.ghs_classes.length} GHS class${chem.ghs_classes.length !== 1 ? "es" : ""}`,
    systemPrompt,
    userPrompt,
    heuristic: () => chemicalHeuristicAnalysis(chem),
    forceReview: chem.is_scheduled || chem.ghs_classes.some((c) => ["H340", "H350", "H360"].includes(c)),
  });
}

/** Detect compliance gaps for a legal requirement and recommend actions. */
export async function analyzeComplianceGap(req: LegalRequirement): Promise<AiFinding> {
  const systemPrompt = `You are a regulatory compliance specialist for EHS management. Analyse the legal requirement record provided and identify compliance gaps, missing evidence, and required actions. Reference the specific regulation code in all recommendations. Prioritise actions by enforcement risk and deadline proximity.`;
  const userPrompt = `Legal requirement:
Regulation: ${req.regulation_ref}
Title: ${req.title}
Description: ${req.description}
Jurisdiction: ${req.jurisdiction}
Category: ${req.category}
Current status: ${req.status}
Compliance notes: ${req.compliance_notes ?? "none"}
Next review date: ${req.next_review_date}
Evidence on file: ${req.evidence_url ? "Yes" : "No"}`;

  return runAnalysis({
    job: "compliance_gap_detection",
    source_type: "legal_requirement",
    source_id: req.id,
    tenant_id: req.tenant_id,
    site_id: req.site_id ?? null,
    input_summary: `${req.regulation_ref} — ${req.title} — status: ${req.status}`,
    systemPrompt,
    userPrompt,
    heuristic: () => complianceGapHeuristicAnalysis(req),
    forceReview: req.status === "non_compliant",
  });
}

// ── Predictability forecast (P-Engine equivalent of P-CLSS) ──────────────────

export function buildPredictabilityForecast(params: {
  complianceScores: Record<string, number>;
  overdueCapaCount: number;
  overdueTrainingCount: number;
  expiringSdsCount: number;
  openIncidentCount: number;
}): PredictabilityForecast {
  const { complianceScores, overdueCapaCount, overdueTrainingCount, expiringSdsCount, openIncidentCount } = params;

  const avgScore = Object.values(complianceScores).length > 0
    ? Object.values(complianceScores).reduce((a, b) => a + b, 0) / Object.values(complianceScores).length
    : 50;

  const pressurePoints = overdueCapaCount * 3 + overdueTrainingCount * 2 + expiringSdsCount + openIncidentCount * 2;
  const trend: "improving" | "stable" | "declining" =
    pressurePoints > 20 ? "declining" : pressurePoints > 8 ? "stable" : "improving";
  const predicted_compliance_score_30d = Math.max(0, Math.min(100, avgScore - pressurePoints * 0.5));

  const topRiskModules = Object.entries(complianceScores)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)
    .map(([m]) => m);

  return {
    compliance_trend: trend,
    predicted_compliance_score_30d: Math.round(predicted_compliance_score_30d),
    overdue_training_count: overdueTrainingCount,
    expiring_sds_count: expiringSdsCount,
    open_capa_overdue_count: overdueCapaCount,
    top_risk_modules: topRiskModules,
    leading_indicators: [
      { indicator: "Overdue CAPA actions",     value: overdueCapaCount,    direction: overdueCapaCount > 5 ? "up" : "flat",    significance: overdueCapaCount > 5 ? "high" : "medium" },
      { indicator: "Training gaps",            value: overdueTrainingCount, direction: overdueTrainingCount > 3 ? "up" : "flat", significance: overdueTrainingCount > 3 ? "high" : "low" },
      { indicator: "Expiring SDS",             value: expiringSdsCount,     direction: expiringSdsCount > 2 ? "up" : "flat",    significance: expiringSdsCount > 2 ? "medium" : "low"  },
      { indicator: "Open incident reports",    value: openIncidentCount,    direction: openIncidentCount > 1 ? "up" : "flat",   significance: openIncidentCount > 1 ? "high" : "medium" },
    ],
  };
}

// ── Internal runner ───────────────────────────────────────────────────────────

interface RunParams {
  job: AiFinding["job"];
  source_type: string;
  source_id: string | null;
  tenant_id: string;
  site_id: string | null;
  input_summary: string;
  systemPrompt: string;
  userPrompt: string;
  heuristic: () => AiAnalysisOutput;
  forceReview: boolean;
}

async function runAnalysis(p: RunParams): Promise<AiFinding> {
  let output: AiAnalysisOutput;
  let model: string;
  let confidence: number;

  if (!MOCK_MODE && hasLiveAi()) {
    try {
      const r = await modelAnalysis(p.systemPrompt, p.userPrompt);
      output = r.output;
      model  = r.model;
      confidence = deriveConfidence(output);
    } catch (err) {
      console.error("[safetyiq] AI analysis fell back to heuristic", { job: p.job, error: String(err) });
      recordAiCall({ provider: aiProvider(), model: "safetyiq-heuristic-fallback", ms: 0, inputTokens: 0, outputTokens: 0, ok: false });
      output = p.heuristic();
      model  = "safetyiq-heuristic-fallback";
      confidence = Math.min(0.8, deriveConfidence(output));
    }
  } else {
    output = p.heuristic();
    model  = "safetyiq-heuristic-mock";
    confidence = Math.min(0.8, deriveConfidence(output));
  }

  if (p.forceReview) output.human_review_required = true;

  return {
    id: nextId("ai"),
    tenant_id: p.tenant_id,
    site_id: p.site_id,
    job: p.job,
    source_type: p.source_type,
    source_id: p.source_id,
    model,
    prompt_version: PROMPT_VERSION,
    input_summary: p.input_summary,
    output,
    confidence,
    review_status: "pending",
    human_review_required: output.human_review_required,
    created_at: new Date().toISOString(),
  };
}
