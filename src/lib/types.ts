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
  WasteProfileState,
  EquipmentStatus,
  RiskLevel,
  GhsHazardClass,
  DocumentStatus,
  CellStatus,
  ProofStatus,
  EdgeType,
  ActionStatus,
  BehaviorPattern,
} from "./constants";

// Re-export Arc status types so components can import from @/lib/types
export type { ActionStatus, CellStatus, ProofStatus, EdgeType };

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
  job_title?: string | null;
  department?: string | null;
  active: boolean;
}

// ── Platform Admin (Reliance superadmin / SA console) ─────────────────────────
// Backed by the platform tables (RLS = is_reliance_admin() only). A superadmin is
// a Profile with tenant_id IS NULL.

export interface Subscription {
  id: string;
  tenant_id: string;
  plan: string;
  status: string;
  mrr: number;
  seats: number;
  started_at: string | null;
  renews_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicket {
  id: string;
  tenant_id: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  requester: string | null;
  assignee: string | null;
  created_at: string;
  updated_at: string;
}

export interface Guardrail {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  threshold: number | null;
  notes: string | null;
  updated_at: string;
}

export interface GlobalLegalItem {
  id: string;
  regulation_ref: string;
  title: string;
  jurisdiction: string;
  category: string;
  description: string | null;
  applies_to: string[];
  created_at: string;
}

export interface ImportJob {
  id: string;
  tenant_id: string;
  kind: string;
  filename: string;
  row_count: number;
  status: string;
  created_at: string;
}

export interface SaTemplate {
  id: string;
  name: string;
  category: string;
  format: string;
  version: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  sector: string;
  country: string;
  impl_status: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
}

export interface TenantDetail {
  tenant: TenantSummary;
  profiles: Profile[];
  subscription: Subscription | null;
  counts: Record<string, number>;
}

export interface Site {
  id: string;
  tenant_id: string;
  name: string;
  address?: string | null;
  country?: string;
  state?: string | null;
  sector?: string;
  vertical?: string;              // GUS per-vertical AI engine key
  headcount?: number | null;
  metadata?: Record<string, unknown>;
  center?: [number, number];      // [lng, lat] for map initialisation
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
  container_capacity?: number | null;      // capacity of ONE container (for CLP label sizing)
  container_capacity_unit?: string | null; // mL | L | gal | g | kg
  storage_location: string;
  storage_class?: string | null;     // GHS storage-class code (see STORAGE_CLASSES)
  recommended_ppe?: string[];        // PPE codes (see PPE_TYPES)
  sds_url: string | null;            // Safety Data Sheet link
  sds_expiry: string | null;         // SDS review date
  // Concentration-based hazard fields
  concentration_pct?: number | null;
  physical_state?: "liquid" | "gas" | "solid" | "unknown" | null;
  flash_point_c?: number | null;
  expiration_date?: string | null;
  hazard_band?: "none" | "low" | "medium" | "high" | "critical" | null;
  hazard_band_confidence?: number | null;
  hazard_band_reviewed_at?: string | null;
  hazard_band_reason?: string | null;
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
  label_code?: string | null;
  updated_at: string;
}

// ── SDS Upload & GHS AI Extraction ────────────────────────────────────────────

/** Structured GHS data Claude extracts from an uploaded SDS PDF. */
export interface SdsExtracted {
  product_name: string;
  chemical_name: string;
  cas_number: string;
  manufacturer: string;
  supplier_name: string;
  supplier_phone: string;
  emergency_phone: string;
  sds_revision_date: string;         // YYYY-MM-DD or ""
  signal_word: string;               // "Danger" | "Warning" | ""
  ghs_pictogram_codes: string[];     // ["GHS02", "GHS05", ...]
  hazard_statements: string[];       // ["H225", "H319", ...]
  hazard_statement_texts: string[];  // full text, same order
  precautionary_statements: string[];
  precautionary_statement_texts: string[];
  hazard_classes: string[];
  recommended_ppe: string[];
  storage_requirements: string[];
  disposal_guidance: string;
  is_mixture: boolean;
  physical_state: string;            // "solid" | "liquid" | "gas" | ""
  flash_point: string;
  recommended_use: string;
  confidence_score: number;          // 0–100
}

export interface SdsDocument {
  id: string;
  tenant_id: string;
  file_name: string;
  file_path: string;
  file_url: string | null;
  manufacturer: string | null;
  product_identifier: string | null;
  sds_revision_date: string | null;
  uploaded_by: string | null;
  ai_extraction_status: "pending" | "processing" | "completed" | "failed";
  ai_extraction_json: SdsExtracted | null;
  ai_confidence_score: number | null;
  approval_status: "draft" | "ai_extracted" | "in_review" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  chemical_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Chemical waste review flags (GHS build 2) ─────────────────────────────────

export type WasteFlagStatus =
  | "open" | "under_review" | "not_applicable" | "confirmed" | "closed";

export interface WasteReviewFlag {
  id: string;
  tenant_id: string;
  site_id: string | null;
  chemical_id: string;
  chemical_name: string | null;       // joined from chemical_inventory
  trigger_source: string;             // GHS class, pictogram, H-code, manual
  trigger_value: string;
  potential_waste_concern: string;
  suggested_review_area: string | null;
  status: WasteFlagStatus;
  reviewer_notes: string | null;
  final_determination: string | null;
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
  site_id: string;                   // denormalized from audit — always set
  title: string;
  description: string;
  category: string;                  // "procedure", "training", "equipment", "chemical", "waste"
  severity: Severity;
  status: "open" | "in_progress" | "closed" | "accepted_risk";
  owner_id: string | null;
  due_date: string | null;
  closed_at: string | null;
  capa_required: boolean;            // whether a CAPA is required for this finding
  capa_id: string | null;            // linked CAPA action id
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

export interface DocSection {
  heading: string;
  body: string;
}

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
  regulation_ref: string | null;
  content?: DocSection[];            // structured program/SOP body (empty for file-only docs)
  generated?: boolean;               // authored by the AI Program Builder
  source_doc_paths?: string[];       // source manuals/SOPs the AI used (traceability)
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

export interface ErgonomicsWorkstation {
  id: string;
  tenant_id: string;
  workstation_code: string;
  name: string;
  department: string;
  worker_count: number;
  last_assessment: string | null;
  next_assessment: string | null;
  risk_level: "low" | "medium" | "high" | "critical";
  status: "compliant" | "needs_improvement" | "non_compliant" | "assessment_due";
  open_findings: number;
  primary_hazards: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ErgonomicsJobTask {
  id: string;
  tenant_id: string;
  task_code: string;
  task_title: string;
  department: string;
  hazard_type: "repetitive_motion" | "awkward_posture" | "forceful_exertion" | "vibration" | "contact_stress" | "static_posture";
  risk_score: number;  // 1–25
  controls: string[];
  status: "controlled" | "review_required" | "controls_pending";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExposureReading {
  id: string;
  tenant_id: string;
  site_id: string;
  chemical: string;
  reading_type: string;              // e.g. "TWA", "STEL", "Ceiling"
  value: number;
  unit: string;                      // e.g. "ppm", "mg/m³"
  location: string;
  reading_date: string;
  monitor: string;                   // person/instrument that took the reading
  created_at: string;
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
  status: "pending" | "pending_pickup" | "accumulating" | "manifested" | "disposed" | "reported";
  created_by: string;
  created_at: string;
}

// ── Waste Vendors / Pickups / Inspections ─────────────────────────────────────

export interface WasteVendor {
  id: string;
  tenant_id: string;
  name: string;
  epa_id: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  services: string[];
  permit_expiry: string | null;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WastePickup {
  id: string;
  tenant_id: string;
  site_id: string | null;
  vendor_id: string | null;
  waste_stream_id: string | null;
  manifest_number: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  quantity: number | null;
  unit: string | null;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WasteInspection {
  id: string;
  tenant_id: string;
  site_id: string | null;
  area: string | null;
  inspection_date: string | null;
  inspector: string | null;
  passed: boolean | null;
  findings: string | null;
  next_due: string | null;
  created_by: string | null;
  created_at: string;
}

// One chemical pulled from inventory into a waste profile, with its weight
// percentage and the GHS data carried over at selection time. This is the only
// point where chemical inventory and waste management connect.
export interface WasteProfileConstituent {
  chemical_id: string;
  name: string;
  cas_number: string | null;
  percentage: number;              // weight %
  ghs_classes: string[];
  hazard_statements: string[];     // H-codes carried from inventory
  physical_state?: string | null;
}

// AI- or rules-drafted characterization suggestions. Advisory only — a human
// EHS reviewer must approve the profile before it can be activated.
export interface WasteProfileAiSuggestions {
  classification: string;
  waste_code: string;
  physical_state: string;
  process_description: string;
  hazard_summary: string;
  rationale: string;
  codes_considered?: string[];
  generated_by: "ai" | "rules";
}

export interface WasteProfile {
  id: string;
  tenant_id: string;
  site_id: string | null;
  waste_stream_id: string | null;
  name: string;
  waste_code: string | null;
  classification: string;
  physical_state: string | null;
  process_description: string | null;
  hazard_summary: string | null;
  state: WasteProfileState;
  version: string;
  reviewer_id: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  reject_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Guided-wizard fields (jsonb columns added 2026-06-30). Optional so older
  // rows and pre-migration reads remain valid.
  composition?: WasteProfileConstituent[];
  questionnaire?: Record<string, string> | null;
  ai_suggestions?: WasteProfileAiSuggestions | null;
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
  // CSP validator evidence fields (so incident records arrive complete).
  contractor_or_company?: string | null;
  witnesses?: string | null;
  final_corrective_action?: string | null;
  supervisor_review?: string | null;
  safety_review?: string | null;
  recordability_decision?: string | null;
  created_at: string;
  updated_at: string;
}

// ── OSHA Recordkeeping ────────────────────────────────────────────────────────

export type OshaClassification = "days_away" | "restricted" | "other_recordable" | "fatality";
export type OshaInjuryType     = "injury" | "skin_disorder" | "respiratory" | "poisoning" | "hearing_loss" | "other_illness";

export interface OshaCase {
  id: string;
  tenant_id: string;
  caseNo: string;
  employee: string;
  jobTitle: string;
  date: string;
  location: string;
  description: string;
  classification: OshaClassification;
  injuryType: OshaInjuryType;
  daysAway: number;
  daysRestricted: number;
  isPrivacy: boolean;
  isSevereInjury: boolean;
  howOccurred: string;
  equipment: string;
  physician: string;
  medFacility: string;
  treatmentER: boolean;
  treatmentHospitalized: boolean;
  capaId?: string;
  created_at: string;
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

// ── Saved Reports ─────────────────────────────────────────────────────────────

export interface SavedReport {
  id: string;
  tenant_id: string;
  name: string;
  report_type: string;
  generated_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── AI Findings ───────────────────────────────────────────────────────────────

export type AiJob =
  | "chemical_hazard_analysis"
  | "compliance_gap_detection"
  | "training_gap_analysis"
  | "incident_root_cause"
  | "risk_score_prediction"
  | "regulatory_change_impact"
  | "analyze_cell";              // Arc per-cell risk analysis job

export interface AiFinding {
  id: string;
  tenant_id: string;
  site_id?: string | null;
  cell_id: string | null;   // null for module-level findings; set for Arc cell findings
  job: AiJob;
  source_type?: string;              // "chemical", "legal_requirement", "audit", "incident", "site"
  source_id?: string | null;
  model: string;
  prompt_version: string;
  input_summary: string;
  output: AiAnalysisOutput | CausalityOutput | Record<string, unknown>;
  confidence: number;               // 0-1
  review_status: ReviewStatus;
  rejection_reason?: string | null;
  human_review_required: boolean;
  created_at: string;
}

/**
 * Structured output for the Arc Causality Engine (per-cell analysis).
 * Matches the safetyiq_causality_analysis JSON schema in prompt.ts.
 */
export interface CausalityOutput {
  risk_score: number;
  hazard_genome: HazardGenome;
  missing_data: string[];
  causal_factors: string[];
  suggested_edges: Array<{
    target_cell_id: string;
    type: string;
    confidence: number;
    rationale: string;
  }>;
  prevention: Array<{
    action: string;
    counterfactual: string;
    rationale: string;
  }>;
  plain_language_summary: string;
  human_review_required: boolean;
}

/** Structured output contract for the SafetyIQ EHS AI Engine (chemical / compliance analyses). */
/**
 * Output of the AI-output grounding gateway — a server-side validation pass over
 * what the model (or heuristic) produced, BEFORE it is trusted. Stored on the
 * finding's `output` jsonb so reviewers see why something was flagged.
 */
export interface GroundingIssue {
  check: string;                    // e.g. "cas_hallucination", "reg_ref_unrecognized"
  status: "warn" | "fail";
  message: string;
}

export interface AiGatewayReview {
  status: "pass" | "warn" | "fail"; // worst of the issues; pass when none
  issues: GroundingIssue[];
}

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
  gateway?: AiGatewayReview;        // grounding-gateway review, attached server-side
  input_hash?: string;              // hash of the analysis inputs, for cache reuse
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
  [key: string]: unknown;    // allows `ri as Record<string, unknown>` assertions in tests
  id: string;
  pattern: string;
  origin_sector: string;
  applies_to_sectors: string[];
  confidence: number;
  summary: string;
  regulatory_refs: string[];
  created_at: string;
}

// ── Arc — Adaptive Risk Continuum domain types ────────────────────────────────

/** Structured hazard taxonomy carried on every Safety Cell. */
export interface HazardGenome {
  energySource: string;
  exposureType: string;
  trigger: string;
  controlGap: string;
  environment?: string;  // optional contextual detail (LLM extraction enrichment)
}

/** Six-object ARC cell classification (Reliance Risk Intelligence Framework). */
export type CellType = "precursor" | "control" | "failure" | "behavior" | "event" | "learning";

/** A geo-tagged, pre-cursor hazard observation (the core ARC data atom). */
export interface SafetyCell {
  id: string;
  tenant_id: string;
  site_id: string;
  location_id: string;
  title: string;
  description: string;
  task: string;
  crew?: string | null;
  company?: string | null;
  permit_ref?: string | null;
  hazard_genome: HazardGenome;
  severity: Severity;
  likelihood: number;         // 1–5 likelihood score
  risk_score: number;         // derived 0–100
  status: CellStatus;
  cell_type?: CellType | null;
  owner_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Evidence that a control is (or isn't) in place for a Safety Cell. */
export interface ControlProof {
  id: string;
  tenant_id: string;
  cell_id: string;
  control: string;            // short description of the required safeguard
  status: ProofStatus;
  verifier_id: string | null;
  verified_at: string | null;
  evidence_summary: string | null;
  evidence_id?: string | null; // FK to an evidence file (optional attachment)
  expires_at: string | null;
  created_at?: string;
  required?: boolean;         // optional — marks mandatory vs. advisory controls
}

/** File or note attached to a Safety Cell as evidence. */
export interface EvidenceFile {
  id: string;
  tenant_id: string;
  cell_id: string;
  kind: "photo" | "video" | "document" | "note";
  name: string;
  storage_path: string;
  summary: string | null;
  uploaded_by: string;
  created_at: string;
}

/** AI-proposed or human-confirmed causal link between two Safety Cells. */
export interface CausalEdge {
  id: string;
  tenant_id: string;
  source_cell_id: string;
  target_cell_id: string;
  type: EdgeType;
  confidence: number;         // 0–1
  rationale: string;
  review_status: ReviewStatus;
  ai_generated: boolean;
  created_at: string;
}

/** A preventive or corrective action linked to a Safety Cell. */
export interface SafetyAction {
  id: string;
  tenant_id: string;
  cell_id: string;
  title: string;
  kind: "corrective" | "preventive";
  owner_id: string | null;
  due_date: string | null;
  status: ActionStatus;
  closed_with_proof: boolean;
  closure_note: string | null;
  created_at: string;
}

/** A named physical location within a site (floor, zone, area). */
export interface SafetyLocation {
  id: string;
  tenant_id: string;
  site_id: string;
  label: string;
  description: string | null;
  floor: string | null;
  zone: string | null;
  kind?: string;              // optional sub-type (e.g. "indoor", "outdoor", "process")
  lat?: number;               // optional GPS latitude for map pin
  lng?: number;               // optional GPS longitude for map pin
}

/** A captured expert experience record (EXP protocol). */
export interface ExpCapture {
  id: string;
  tenant_id: string;
  site_id: string;
  source: "interview" | "ai_interview" | "walk_floor" | "incident_debrief" | "manual";
  subject: string;
  summary: string;
  hazard_memory: Record<string, unknown> | null;
  embedded: boolean;
  created_at: string;
}

/** A periodic Human Signal Layer reading for one dimension at a site. */
export interface HslReading {
  id: string;
  tenant_id: string;
  site_id: string;
  dimension: string;          // matches HSL_DIMENSIONS keys
  value: number;              // 0–100
  recorded_at: string;
  created_at: string;
}

/** A completed P-CLSS (anticipate/hunt/forecast/preempt/evolve) engine run. */
export interface PclssRun {
  id: string;
  tenant_id: string;
  site_id: string;
  stage: "anticipate" | "hunt" | "forecast" | "preempt" | "evolve";
  summary: string;
  cells_scanned?: number;     // number of open cells examined during this run
  signals_found: number;
  actions_proposed: number;
  created_at: string;
}

/** Cross-tenant VELA pattern — visible to all tenants (no tenant_id). */
export interface VelaInsight {
  id: string;
  pattern: string;
  origin_sector: string;
  applies_to: string[];
  confidence: number;
  summary: string;
  regulatory_refs: string[];
  created_at: string;
}

/** A collaboration comment on a Safety Cell. */
export interface Comment {
  id: string;
  tenant_id: string;
  cell_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

/** An outcome event (incident, near-miss, etc.) linked to a Safety Cell. */
export interface EventCell {
  id: string;
  tenant_id: string;
  site_id: string;
  cell_id: string | null;     // the precursor safety cell, if known
  kind: "incident" | "near_miss" | "audit_finding" | "claim";
  title: string;
  description: string;
  severity: Severity;
  occurred_at: string;
  created_at: string;
}

/** A recurring behavior pattern detected across a cell population. */
export interface BehaviorCell {
  id: string;
  tenant_id: string;
  site_id: string;
  pattern: BehaviorPattern;
  title: string;
  description: string;
  cell_ids: string[];         // member safety cells that form this pattern
  occurrences: number;
  created_at: string;
}

/** A Safety Cell bundled with all related objects for the detail view. */
export interface CellBundle {
  cell: SafetyCell;
  location: SafetyLocation;
  site: Site;
  proofs: ControlProof[];
  evidence: EvidenceFile[];
  findings: AiFinding[];
  actions: SafetyAction[];
}

/** An AI Gateway rejection logged to the exception queue. */
export interface GatewayReject {
  id: string;
  tenant_id: string;
  kind: "safety_cell" | "event_cell";
  summary: string;
  category: string;
  reason: string;
  status: "blocked" | "resolved";
  payload: Record<string, unknown>;
  actor_id: string;
  created_at: string;
}

/** A gateway-validated record waiting for human review before entering the live DB. */
export interface StagedRecord {
  id: string;
  tenant_id: string;
  kind: "safety_cell" | "event_cell";
  title: string;
  submitted_by: string;
  submitted_at: string;
  payload: SafetyCell | EventCell;
  evidence?: Array<{ kind: EvidenceFile["kind"]; name: string; summary?: string }>;
}

/** A HazardGenome key used for cross-cell similarity and forecast scoring. */
export type HazardGenomeKey = keyof HazardGenome;
