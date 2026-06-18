/**
 * SafetyIQ — MACO EHS domain types. These mirror the database schema in
 * supabase/migrations and are used by the data layer, API routes, and UI.
 *
 * Multi-tenancy (Option A): every tenant-scoped record carries `tenant_id`.
 * A Profile with `tenant_id: null` is a global operator (Reliance Internal —
 * sees all client tenants). Cross-tenant intelligence has NO tenant_id.
 */
import type {
  Severity,
  ComplianceStatus,
  CapaStatus,
  AuditStatus,
  TrainingDelivery,
  ReviewStatus,
  Role,
  IncidentType,
  WasteClassification,
  EquipmentStatus,
  RiskLevel,
  GhsHazardClass,
  DocumentStatus,
} from "./constants";

// ── Tenancy & identity ────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  sector: string;          // e.g. "pharmaceutical", "mining", "construction"
  country: string;
  active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  tenant_id: string | null; // null = Reliance global operator (cross-tenant)
  default_site_id: string | null;
  job_title: string | null;
  department: string | null;
  active: boolean;
}

export interface Site {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  country: string;
  state: string | null;
  sector: string;
  headcount: number | null;
  metadata?: Record<string, unknown>;
}

// ── Chemical Inventory ────────────────────────────────────────────────────────

export interface Chemical {
  id: string;
  tenant_id: string;
  site_id: string;
  name: string;
  cas_number: string | null;         // CAS Registry Number (e.g. "7647-01-0")
  un_number: string | null;          // UN transport number (e.g. "UN1789")
  chemical_formula: string | null;
  ghs_classes: GhsHazardClass[];     // GHS hazard classification codes
  quantity: number;
  unit: string;                      // kg, L, t, m³
  storage_location: string;
  sds_url: string | null;            // Safety Data Sheet link
  sds_expiry: string | null;         // SDS review date
  hazard_statements: string[];       // H-statements (H200-H420)
  precautionary_statements: string[]; // P-statements (P200-P501)
  is_scheduled: boolean;             // listed on a regulatory controlled substance list
  schedule_ref: string | null;       // e.g. "OSHA HAP", "EPA Toxic", "Schedule 10"
  supplier: string | null;
  date_received: string | null;
  status: "active" | "disposed" | "depleted";
  owner_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ── Legal & Regulatory Compliance ─────────────────────────────────────────────

export interface LegalRequirement {
  id: string;
  tenant_id: string;
  site_id: string | null;            // null = applies to all sites in tenant
  regulation_ref: string;            // e.g. "OSHA 1910.119", "EPA 40 CFR 68"
  title: string;
  description: string;
  jurisdiction: string;              // e.g. "Federal US", "California", "EU"
  category: string;                  // "chemical", "training", "emergency", "waste", "air", "water"
  applicable_sectors: string[];
  review_frequency_days: number;
  next_review_date: string;
  status: ComplianceStatus;
  compliance_notes: string | null;
  evidence_url: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Audits ────────────────────────────────────────────────────────────────────

export type AuditType =
  | "internal"
  | "external"
  | "regulatory"
  | "supplier"
  | "system"
  | "process";

export interface Audit {
  id: string;
  tenant_id: string;
  site_id: string;
  title: string;
  type: AuditType;
  scheduled_date: string;
  completed_date: string | null;
  status: AuditStatus;
  lead_auditor_id: string | null;
  scope: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditFinding {
  id: string;
  tenant_id: string;
  audit_id: string;
  title: string;
  description: string;
  category: string;                  // "procedure", "training", "equipment", "chemical", "waste"
  severity: Severity;
  status: "open" | "in_progress" | "closed" | "accepted_risk";
  owner_id: string | null;
  due_date: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── CAPA (Corrective & Preventive Actions) ────────────────────────────────────

export type CapaSourceType =
  | "audit_finding"
  | "incident"
  | "legal_requirement"
  | "risk_assessment"
  | "ai_finding"
  | "manual";

export interface CapaAction {
  id: string;
  tenant_id: string;
  site_id: string;
  title: string;
  description: string;
  kind: "corrective" | "preventive";
  source_type: CapaSourceType;
  source_id: string | null;          // FK to the originating record
  root_cause: string | null;
  severity: Severity;
  owner_id: string | null;
  due_date: string | null;
  status: CapaStatus;
  verification_method: string | null;
  closed_at: string | null;
  closure_note: string | null;
  closed_with_evidence: boolean;
  created_at: string;
  updated_at: string;
}

// ── Training ──────────────────────────────────────────────────────────────────

export interface TrainingCourse {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  course_type: string;               // "induction", "chemical", "emergency", "equipment", "compliance"
  duration_minutes: number;
  pass_score: number | null;         // percentage required to pass
  validity_period_days: number | null; // null = no expiry
  required_roles: Role[];            // which roles must complete this course
  regulatory_ref: string | null;     // e.g. "OSHA 1910.1200(h)" for HazCom training
  active: boolean;
  created_at: string;
}

export interface TrainingRecord {
  id: string;
  tenant_id: string;
  site_id: string;
  profile_id: string;
  course_id: string;
  completed_date: string;
  expiry_date: string | null;
  score: number | null;
  passed: boolean;
  delivery_method: TrainingDelivery;
  instructor_id: string | null;
  notes: string | null;
  created_at: string;
}

// ── Documents ─────────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  tenant_id: string;
  site_id: string | null;            // null = applies to all sites
  title: string;
  category: string;                  // "sop", "policy", "procedure", "form", "permit", "msds"
  version: string;
  storage_path: string;              // Supabase Storage path
  effective_date: string;
  review_date: string;
  status: DocumentStatus;
  owner_id: string | null;
  acknowledgment_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceTask {
  id: string;
  tenant_id: string;
  profile_id: string;
  title: string;
  type: string;
  due_date: string | null;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "done";
  assigned_by: string | null;
  completed_by: string | null;
  completed_at: string | null;
  completion_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BiosafetyLab {
  id: string;
  tenant_id: string;
  lab_code: string;
  name: string;
  bsl_level: string;
  personnel_count: number;
  last_inspection: string | null;
  next_inspection: string | null;
  status: "compliant" | "minor_gap" | "major_gap" | "inspection_due";
  open_findings: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BiohazardAgent {
  id: string;
  tenant_id: string;
  agent_code: string;
  agent_name: string;
  risk_class: string;
  storage_location: string;
  quantity: string;
  status: "registered" | "review_required" | "suspended";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentAcknowledgment {
  id: string;
  tenant_id: string;
  document_id: string;
  profile_id: string;
  acknowledged_at: string;
  created_at: string;
}

// ── Waste Management ──────────────────────────────────────────────────────────

export interface WasteStream {
  id: string;
  tenant_id: string;
  site_id: string;
  waste_name: string;
  waste_code: string | null;         // e.g. "D001" EPA hazardous waste code
  classification: WasteClassification;
  quantity: number;
  unit: string;                      // kg, L, m³, drums
  disposal_method: string;           // "landfill", "incineration", "recycling", "treatment"
  disposal_contractor: string | null;
  manifest_number: string | null;    // regulatory tracking number
  disposal_date: string | null;
  regulatory_limit: number | null;   // threshold above which reporting is required
  regulatory_unit: string | null;
  status: "pending" | "manifested" | "disposed" | "reported";
  created_by: string;
  created_at: string;
}

// ── Equipment & Calibration ───────────────────────────────────────────────────

export interface Equipment {
  id: string;
  tenant_id: string;
  site_id: string;
  name: string;
  type: string;                      // "air_monitor", "gas_detector", "pressure_vessel", "ppe"
  serial_number: string | null;
  location: string;
  last_calibration_date: string | null;
  next_calibration_date: string | null;
  last_inspection_date: string | null;
  next_inspection_date: string | null;
  calibration_interval_days: number | null;
  status: EquipmentStatus;
  regulatory_ref: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Risk Register ─────────────────────────────────────────────────────────────

export interface RiskAssessment {
  id: string;
  tenant_id: string;
  site_id: string;
  title: string;
  description: string;
  category: string;                  // "chemical", "physical", "biological", "ergonomic", "fire"
  activity: string;
  hazards: string[];
  existing_controls: string[];
  likelihood_score: number;          // 1-5
  consequence_score: number;         // 1-5
  risk_score: number;                // likelihood × consequence
  risk_level: RiskLevel;
  additional_controls: string[];
  residual_likelihood: number | null;
  residual_consequence: number | null;
  residual_risk_score: number | null;
  residual_risk_level: RiskLevel | null;
  owner_id: string | null;
  review_date: string;
  status: "draft" | "active" | "under_review" | "archived";
  created_at: string;
  updated_at: string;
}

// ── Incidents ─────────────────────────────────────────────────────────────────

export interface Incident {
  id: string;
  tenant_id: string;
  site_id: string;
  title: string;
  description: string;
  incident_type: IncidentType;
  severity: Severity;
  occurred_at: string;
  location: string;
  injured_party: string | null;
  injuries_description: string | null;
  immediate_actions: string | null;
  root_cause: string | null;
  reported_by: string;
  owner_id: string | null;
  status: "reported" | "under_investigation" | "capa_open" | "closed";
  lost_time_days: number | null;
  medical_treatment_required: boolean;
  regulatory_reportable: boolean;
  regulatory_report_date: string | null;
  created_at: string;
  updated_at: string;
}

// ── Compliance Scores (calculated) ───────────────────────────────────────────

export interface ComplianceScore {
  id: string;
  tenant_id: string;
  site_id: string;
  module: string;                    // "chemical", "training", "audits", "waste", "equipment", "capa"
  score: number;                     // raw score
  max_score: number;                 // possible maximum
  percentage: number;                // 0-100
  status: ComplianceStatus;
  calculated_at: string;
  details: Record<string, unknown>;  // breakdown of sub-scores
}

// ── AI Findings ───────────────────────────────────────────────────────────────

export type AiJob =
  | "chemical_hazard_analysis"
  | "compliance_gap_detection"
  | "training_gap_analysis"
  | "incident_root_cause"
  | "risk_score_prediction"
  | "regulatory_change_impact";

export interface AiFinding {
  id: string;
  tenant_id: string;
  site_id: string | null;
  job: AiJob;
  source_type: string;               // "chemical", "legal_requirement", "audit", "incident", "site"
  source_id: string | null;
  model: string;
  prompt_version: string;
  input_summary: string;
  output: AiAnalysisOutput | Record<string, unknown>;
  confidence: number;               // 0-1
  review_status: ReviewStatus;
  human_review_required: boolean;
  created_at: string;
}

/** Structured output contract for the SafetyIQ AI Engine. */
export interface AiAnalysisOutput {
  risk_level: RiskLevel;
  risk_score: number;               // 0-100 normalised
  findings: {
    category: string;
    description: string;
    severity: Severity;
  }[];
  gaps: string[];                   // identified compliance or control gaps
  regulatory_refs: string[];        // relevant regulations surfaced
  recommended_actions: {
    action: string;
    priority: "immediate" | "short_term" | "medium_term" | "long_term";
    rationale: string;
    capa_kind: "corrective" | "preventive";
  }[];
  plain_language_summary: string;
  human_review_required: boolean;
}

// ── Predictability Engine (MACO P-Engine) ────────────────────────────────────
// Five-stage continuous learning cycle equivalent to P-CLSS.

export interface PredictabilityRun {
  id: string;
  tenant_id: string;
  site_id: string;
  stage: "scan" | "detect" | "forecast" | "alert" | "learn";
  summary: string;
  items_scanned: number;
  signals_found: number;
  actions_proposed: number;
  forecast_data: PredictabilityForecast | null;
  created_at: string;
}

export interface PredictabilityForecast {
  compliance_trend: "improving" | "stable" | "declining";
  predicted_compliance_score_30d: number;   // 0-100
  overdue_training_count: number;
  expiring_sds_count: number;
  open_capa_overdue_count: number;
  top_risk_modules: string[];               // modules with lowest scores
  leading_indicators: {
    indicator: string;
    value: number;
    direction: "up" | "down" | "flat";
    significance: "high" | "medium" | "low";
  }[];
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  tenant_id: string | null;
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string;
  reason: string | null;
  detail?: Record<string, unknown>;
  created_at: string;
}

// ── Cross-tenant intelligence (Reliance Internal) ─────────────────────────────
// Patterns detected across tenants that apply to client sectors — NO tenant_id.

export interface RelianceInsight {
  id: string;
  pattern: string;
  origin_sector: string;
  applies_to_sectors: string[];
  confidence: number;
  summary: string;
  regulatory_refs: string[];
  created_at: string;
}
