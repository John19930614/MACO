/**
 * Types for the CSP-informed EHS Records Validation Agent.
 *
 * These mirror the csp_* tables (migration 20260625050000). They are kept in a
 * dedicated module rather than the global types.ts because the agent is a
 * self-contained subsystem bridged onto the live platform via tenant_id /
 * site_id and a polymorphic (source_type, source_id) pointer.
 */

export type CspRecordType =
  | "incident" | "near_miss" | "positive_observation" | "negative_observation"
  | "audit_finding" | "inspection" | "training_record" | "permit"
  | "chemical_sds" | "chemical_inventory" | "waste_record" | "equipment_inspection"
  | "dot_record" | "contractor_record" | "corrective_action" | "other";

export type CspRiskLevel =
  | "low" | "medium" | "high" | "critical" | "sif_potential" | "idlh_imminent_danger";

export type CspValidationStatus =
  | "accepted" | "accepted_with_minor_corrections" | "rejected_incomplete"
  | "needs_human_review" | "potential_regulatory_issue"
  | "potential_recordable_or_reportable" | "system_error";

export type CspReviewStatus =
  | "not_required" | "pending" | "approved" | "approved_with_changes"
  | "rejected" | "escalated" | "closed";

export type CspFindingCategory =
  | "missing_field" | "evidence_gap" | "regulatory_trigger"
  | "risk_escalation" | "inconsistency" | "corrective_action_needed";

/** A single thing the agent flagged on a record. */
export interface CspFinding {
  finding_title: string;
  finding_description: string;
  finding_category: CspFindingCategory;
  risk_level: CspRiskLevel;
  rule_code?: string | null;
  citation?: string | null;
  source_url?: string | null;
  recommended_action?: string | null;
  requires_corrective_action: boolean;
  requires_human_review: boolean;
}

/** The complete result of validating one record — shaped to persist as a run + findings. */
export interface CspValidationResult {
  validation_status: CspValidationStatus;
  risk_level: CspRiskLevel;
  confidence_score: number;            // 0–100
  rules_checked: string[];             // rule codes evaluated
  citations_used: string[];
  evidence_reviewed: string[];
  missing_fields: string[];
  inconsistencies_found: string[];
  regulatory_triggers: string[];
  ai_summary: string;
  ai_reasoning_summary: string;
  ai_recommendation: string;
  recommended_corrections: string[];
  human_review_required: boolean;
  human_review_reason: string | null;
  findings: CspFinding[];
  model: string;
}

/** Declarative requirement set per record type (csp_record_requirements). */
export interface CspRecordRequirement {
  record_type: CspRecordType;
  module_name: string;
  required_fields: string[];
  recommended_fields: string[];
  evidence_requirements: string[];
  mandatory_human_review_conditions: string[];
  version_label: string;
}

/** A regulatory / standard rule the agent checks against (csp_rules). */
export interface CspRule {
  rule_code: string;
  rule_title: string;
  source_type: string;
  citation: string | null;
  rule_summary: string | null;
  applies_to_record_types: CspRecordType[];
  human_review_triggers: string[];
  source_url: string | null;
  version_label: string;
}

/** Normalised input the validator consumes — module mapping happens upstream. */
export interface CspValidationInput {
  tenant_id: string;
  site_id: string | null;
  source_type: string;          // 'incident', 'audit_finding', ...
  source_id: string;
  record_type: CspRecordType;
  module_name: string;
  /** Logical field name -> value, already mapped from the module row. */
  fields: Record<string, unknown>;
  /** Count of evidence files / attachments on the record. */
  evidence_count: number;
  /** Hard signals that drive mandatory human-review triggers. */
  signals: CspSignals;
}

export interface CspSignals {
  fatality?: boolean;
  hospitalization?: boolean;
  amputation_or_eye_loss?: boolean;
  medical_treatment_beyond_first_aid?: boolean;
  lost_time_days?: number | null;
  restricted_work?: boolean;
  loss_of_consciousness?: boolean;
  regulatory_reportable?: boolean;
  repeat_finding?: boolean;
  high_or_critical_potential?: boolean;
}

/** A row from csp_validation_runs joined with its tenant, for the review panel. */
export interface CspValidationRunRow {
  id: string;
  tenant_id: string;
  tenant_name: string;
  site_id: string | null;
  source_type: string;
  source_id: string | null;
  record_type: CspRecordType;
  module_name: string;
  agent_name: string;
  agent_version: string;
  model_name: string | null;
  prompt_version: string;
  validation_status: CspValidationStatus;
  risk_level: CspRiskLevel;
  confidence_score: number | null;
  missing_fields: string[];
  regulatory_triggers: string[];
  ai_summary: string | null;
  ai_recommendation: string | null;
  human_review_required: boolean;
  human_review_status: CspReviewStatus;
  human_review_reason: string | null;
  input_hash: string | null;
  final_output_hash: string | null;
  created_at: string;
  findings: CspFindingRow[];
  decision: CspDecisionRow | null;
  queue_id: string | null;
  queue_priority: string | null;
}

export interface CspFindingRow {
  id: string;
  finding_title: string;
  finding_description: string | null;
  finding_category: string;
  risk_level: CspRiskLevel;
  citation: string | null;
  source_url: string | null;
  recommended_action: string | null;
  requires_corrective_action: boolean;
  status: string;
}

export interface CspDecisionRow {
  id: string;
  reviewer_name: string;
  reviewer_credentials: string | null;
  decision: CspReviewStatus;
  decision_summary: string;
  signed_at: string | null;
  created_at: string;
}
