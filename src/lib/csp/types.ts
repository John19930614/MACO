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
  | "rejected" | "escalated" | "closed" | "returned_for_correction";

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
  autonomy_blockers_triggered: CspTriggeredBlocker[];
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
  autonomy_blockers_triggered: CspTriggeredBlocker[];
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

// ── Guardrails / Qualifications / Memory (agent governance + learning) ─────────

export interface CspGuardrail {
  id: string;
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  threshold: number | null;
  locked: boolean;
}

export type CspQualKind = "certification" | "skill" | "qualification";

export interface CspQualification {
  id: string;
  kind: CspQualKind;
  code: string;
  title: string;
  description: string | null;
  scope_record_types: CspRecordType[];
  record_types: string[];
  grants_autonomy: boolean;
  status: "active" | "revoked" | "expired";
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
}

export type CspMemoryDirective = "raise_confidence" | "lower_confidence" | "escalate" | "note";

export interface CspMemoryLesson {
  id: string;
  tenant_id: string | null;
  scope: "global" | "tenant";
  record_type: CspRecordType | null;
  finding_category: string | null;
  directive: CspMemoryDirective;
  lesson: string;
  weight: number;
  source: "human_decision" | "manual";
  times_applied: number;
  active: boolean;
  expiration_date: string | null;
  review_date: string | null;
  created_at: string;
}

export interface CspAutonomyBlocker {
  id: string;
  trigger_key: string;
  label: string;
  action: "human_review_required" | "immediate_escalation";
  active: boolean;
}

export interface CspEvidenceRule {
  id: string;
  record_type: string;
  module_label: string | null;
  required_fields: string[];
  optional_fields: string[];
  autonomy_allowed: boolean;
  autonomy_limit: string | null;
  active: boolean;
}

export interface CspTriggeredBlocker {
  key: string;
  label: string;
  action: "human_review_required" | "immediate_escalation";
}

export interface CspEscalationRule {
  id: string;
  condition_key: string;
  label: string;
  escalate_to: string[];
  urgency: "immediate" | "same_day" | "normal";
  active: boolean;
}

export interface CspModelVersion {
  id: string;
  agent_name: string;
  agent_version: string;
  ai_model_name: string | null;
  ai_model_version: string | null;
  rule_version: string;
  change_summary: string | null;
  changed_by_name: string | null;
  active: boolean;
  created_at: string;
}

export interface CspOverrideLogRow {
  id: string;
  record_type: string;
  ai_recommendation: string | null;
  ai_status: string | null;
  human_decision: string;
  override_reason: string;
  reviewer_name: string | null;
  created_at: string;
}

/** Everything the validator needs to apply guardrails, qualifications, and memory. */
export interface CspAgentContext {
  guardrails: Record<string, CspGuardrail>;
  qualifications: CspQualification[];
  memory: CspMemoryLesson[];
  blockers: CspAutonomyBlocker[];
  evidenceRules: CspEvidenceRule[];
}

// ── Daily agent standup (GUS × EHS Validation Agent) ──────────────────────────

export interface CspMeetingExchange {
  speaker: string;        // "GUS" | "EHS Validation Agent"
  message: string;
}

export interface CspMeetingGap {
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
}

export interface CspMeetingActionItem {
  item: string;
  owner: string;          // "GUS" | "EHS Agent" | "Operator"
  priority: "low" | "normal" | "high";
}

export interface CspAgendaItem {
  key: string;
  title: string;
  covered: boolean;
  note: string;
}

export interface CspReflection {
  speaker: string;        // "GUS" | "EHS Validation Agent"
  thought: string;
}

export interface CspMeeting {
  id: string;
  meeting_date: string;
  title: string;
  status: string;
  participants: string[];
  gus_briefing: string | null;
  ehs_briefing: string | null;
  exchange: CspMeetingExchange[];
  agenda: CspAgendaItem[];
  reflections: CspReflection[];
  gaps_found: CspMeetingGap[];
  action_items: CspMeetingActionItem[];
  shared_summary: string | null;
  metrics: Record<string, unknown>;
  model: string | null;
  generated_by: string | null;
  created_at: string;
}
