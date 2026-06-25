/**
 * Built-in fallback rules and record requirements.
 *
 * The agent prefers the DB-backed, versioned csp_rules / csp_record_requirements
 * tables (managed by the superadmin). These constants are the safety net: they
 * let validation run in MOCK_MODE, before the governance tables are seeded, and
 * if the DB read fails — so the background agent is never silently a no-op.
 *
 * Mirrors the seed data in migration 20260625050000.
 */
import type { CspRecordRequirement, CspRule } from "./types";

export const DEFAULT_REQUIREMENTS: CspRecordRequirement[] = [
  {
    record_type: "incident",
    module_name: "Incident Management",
    required_fields: [
      "event_date", "location", "person_involved", "description",
      "immediate_action", "injury_or_illness", "treatment_level",
      "work_relatedness", "corrective_action",
    ],
    recommended_fields: [
      "witness_statement", "root_cause", "potential_severity",
      "actual_severity", "equipment_involved",
    ],
    evidence_requirements: [
      "photo_or_documented_reason_no_photo", "supervisor_statement",
      "medical_or_first_aid_note_if_treatment", "corrective_action_closeout_evidence",
    ],
    mandatory_human_review_conditions: [
      "fatality", "hospitalization", "amputation", "eye_loss",
      "possible_recordable", "restricted_work", "days_away",
      "high_or_critical_potential", "SIF_potential", "uncertain_treatment_level",
    ],
    version_label: "v1.0",
  },
  {
    record_type: "audit_finding",
    module_name: "Audit Management",
    required_fields: [
      "audit_date", "auditor", "location", "finding_description",
      "risk_level", "responsible_party", "corrective_action", "due_date",
    ],
    recommended_fields: [
      "rule_reference", "repeat_finding_status", "trade", "contractor", "verification_method",
    ],
    evidence_requirements: [
      "photo_or_documented_reason_no_photo", "corrective_action_evidence", "closeout_verification",
    ],
    mandatory_human_review_conditions: [
      "critical_risk", "SIF_potential", "repeat_finding", "imminent_danger",
      "regulatory_trigger", "overdue_corrective_action",
    ],
    version_label: "v1.0",
  },
];

export const DEFAULT_RULES: CspRule[] = [
  {
    rule_code: "OSHA-1904-RECORDABLE-DECISION",
    rule_title: "OSHA Recordability Decision Review",
    source_type: "osha",
    citation: "29 CFR Part 1904",
    rule_summary:
      "Determine whether an injury or illness may be OSHA recordable based on work-relatedness, new case status, and general recording criteria.",
    applies_to_record_types: ["incident"],
    human_review_triggers: [
      "possible_recordable", "medical_treatment_beyond_first_aid", "days_away",
      "restricted_work", "loss_of_consciousness", "significant_diagnosis",
      "uncertain_classification",
    ],
    source_url: "https://www.osha.gov/recordkeeping",
    version_label: "v1.0",
  },
  {
    rule_code: "EHS-HIERARCHY-OF-CONTROLS",
    rule_title: "Hierarchy of Controls Review",
    source_type: "industry_standard",
    citation: "NIOSH Hierarchy of Controls",
    rule_summary:
      "Evaluate whether corrective actions use the strongest feasible controls before relying on PPE alone.",
    applies_to_record_types: [
      "incident", "near_miss", "negative_observation", "audit_finding",
      "inspection", "corrective_action",
    ],
    human_review_triggers: [
      "high_risk_hazard", "ppe_only_control_for_serious_hazard",
      "missing_corrective_action", "repeat_finding",
    ],
    source_url: "https://www.cdc.gov/niosh/hierarchy-of-controls/about/index.html",
    version_label: "v1.0",
  },
];

export const CSP_AGENT_NAME = "Senior EHS Record Validation Agent";
export const CSP_AGENT_VERSION = "csp-v1.0";
export const CSP_PROMPT_VERSION = "csp-v1.0";
export const CSP_POSITIONING =
  "CSP-informed EHS Records Validation Agent. The AI is not a licensed CSP and does not replace a qualified EHS professional.";
