/**
 * SafetyIQ — MACO EHS Zod validation schemas.
 * These are the input/output contracts for API routes and the AI engine.
 * Keep in sync with types.ts interfaces and 0001_init.sql CHECK constraints.
 */
import { z } from "zod";
import {
  SEVERITIES,
  COMPLIANCE_STATUSES,
  CAPA_STATUSES,
  AUDIT_STATUSES,
  WASTE_CLASSIFICATIONS,
  EQUIPMENT_STATUSES,
  INCIDENT_TYPES,
  REVIEW_STATUSES,
  TRAINING_DELIVERIES,
  DOCUMENT_STATUSES,
  RISK_LEVELS,
  ROLES,
  CELL_STATUSES,
  PROOF_STATUSES,
  EDGE_TYPES,
} from "./constants";

// ── Chemical Inventory ────────────────────────────────────────────────────────

export const chemicalSchema = z.object({
  site_id: z.string().min(1, "Select a site"),
  name: z.string().min(1, "Chemical name is required"),
  cas_number: z.string().nullable().optional(),
  un_number: z.string().nullable().optional(),
  chemical_formula: z.string().nullable().optional(),
  ghs_classes: z.array(z.string()).default([]),
  quantity: z.number().min(0, "Quantity must be 0 or greater"),
  unit: z.string().min(1, "Unit is required"),
  storage_location: z.string().min(1, "Storage location is required"),
  sds_url: z.string().url().nullable().optional(),
  sds_expiry: z.string().nullable().optional(),
  hazard_statements: z.array(z.string()).default([]),
  precautionary_statements: z.array(z.string()).default([]),
  is_scheduled: z.boolean().default(false),
  schedule_ref: z.string().nullable().optional(),
  supplier: z.string().nullable().optional(),
  date_received: z.string().nullable().optional(),
  status: z.enum(["active", "disposed", "depleted"]).default("active"),
  owner_id: z.string().nullable().optional(),
});

export type ChemicalInput = z.infer<typeof chemicalSchema>;

// ── Legal Requirements ────────────────────────────────────────────────────────

export const legalRequirementSchema = z.object({
  site_id: z.string().nullable().optional(),
  regulation_ref: z.string().min(1, "Regulation reference is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().default(""),
  jurisdiction: z.string().min(1, "Jurisdiction is required"),
  category: z.enum(["chemical","training","emergency","waste","air","water","noise","electrical","fire","general"]),
  applicable_sectors: z.array(z.string()).default([]),
  review_frequency_days: z.number().int().min(1).default(365),
  next_review_date: z.string().min(1, "Next review date is required"),
  status: z.enum(COMPLIANCE_STATUSES).default("not_assessed"),
  compliance_notes: z.string().nullable().optional(),
  evidence_url: z.string().url().nullable().optional(),
  owner_id: z.string().nullable().optional(),
});

export type LegalRequirementInput = z.infer<typeof legalRequirementSchema>;

// ── Audits ────────────────────────────────────────────────────────────────────

export const auditSchema = z.object({
  site_id: z.string().min(1, "Select a site"),
  title: z.string().min(1, "Audit title is required"),
  type: z.enum(["internal","external","regulatory","supplier","system","process"]),
  scheduled_date: z.string().min(1, "Scheduled date is required"),
  completed_date: z.string().nullable().optional(),
  status: z.enum(AUDIT_STATUSES).default("scheduled"),
  lead_auditor_id: z.string().nullable().optional(),
  scope: z.string().default(""),
  notes: z.string().nullable().optional(),
});

export type AuditInput = z.infer<typeof auditSchema>;

export const auditFindingSchema = z.object({
  audit_id: z.string().min(1, "Audit ID is required"),
  site_id: z.string().min(1, "Select a site"),
  title: z.string().min(1, "Finding title is required"),
  description: z.string().default(""),
  category: z.enum(["procedure","training","equipment","chemical","waste","documentation","emergency","general"]),
  severity: z.enum(SEVERITIES),
  owner_id: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  capa_required: z.boolean().default(true),
});

export type AuditFindingInput = z.infer<typeof auditFindingSchema>;

// ── CAPA ──────────────────────────────────────────────────────────────────────

export const capaSchema = z.object({
  site_id: z.string().min(1, "Select a site"),
  title: z.string().min(1, "CAPA title is required"),
  description: z.string().default(""),
  kind: z.enum(["corrective", "preventive"]).default("corrective"),
  source_type: z.enum(["audit_finding","incident","legal_requirement","risk_assessment","ai_finding","manual"]).default("manual"),
  source_id: z.string().nullable().optional(),
  root_cause: z.string().nullable().optional(),
  severity: z.enum(SEVERITIES).default("medium"),
  owner_id: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  verification_method: z.string().nullable().optional(),
});

export type CapaInput = z.infer<typeof capaSchema>;

export const capaUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(CAPA_STATUSES),
  closure_note: z.string().nullable().optional(),
  closed_with_evidence: z.boolean().optional(),
});

// ── Training ──────────────────────────────────────────────────────────────────

export const trainingCourseSchema = z.object({
  title: z.string().min(1, "Course title is required"),
  description: z.string().default(""),
  course_type: z.enum(["induction","chemical","emergency","equipment","compliance","manual_handling","fire","environmental","general"]),
  duration_minutes: z.number().int().min(1).default(60),
  pass_score: z.number().int().min(0).max(100).nullable().optional(),
  validity_period_days: z.number().int().min(1).nullable().optional(),
  required_roles: z.array(z.enum(ROLES)).default([]),
  regulatory_ref: z.string().nullable().optional(),
  active: z.boolean().default(true),
});

export const trainingRecordSchema = z.object({
  site_id: z.string().min(1, "Select a site"),
  profile_id: z.string().min(1, "Select a staff member"),
  course_id: z.string().min(1, "Select a course"),
  completed_date: z.string().min(1, "Completion date is required"),
  expiry_date: z.string().nullable().optional(),
  score: z.number().int().min(0).max(100).nullable().optional(),
  passed: z.boolean().default(true),
  delivery_method: z.enum(TRAINING_DELIVERIES).default("classroom"),
  instructor_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ── Documents ─────────────────────────────────────────────────────────────────

export const documentSchema = z.object({
  site_id: z.string().nullable().optional(),
  title: z.string().min(1, "Document title is required"),
  category: z.enum(["sop","policy","procedure","form","permit","msds","emergency","other"]),
  version: z.string().min(1).default("1.0"),
  storage_path: z.string().min(1, "Storage path is required"),
  effective_date: z.string().min(1, "Effective date is required"),
  review_date: z.string().min(1, "Review date is required"),
  status: z.enum(DOCUMENT_STATUSES).default("draft"),
  owner_id: z.string().nullable().optional(),
  acknowledgment_required: z.boolean().default(false),
});

// ── Waste Streams ─────────────────────────────────────────────────────────────

export const wasteStreamSchema = z.object({
  site_id: z.string().min(1, "Select a site"),
  waste_name: z.string().min(1, "Waste name is required"),
  waste_code: z.string().nullable().optional(),
  classification: z.enum(WASTE_CLASSIFICATIONS),
  quantity: z.number().min(0),
  unit: z.string().min(1),
  disposal_method: z.string().min(1),
  disposal_contractor: z.string().nullable().optional(),
  manifest_number: z.string().nullable().optional(),
  disposal_date: z.string().nullable().optional(),
  regulatory_limit: z.number().nullable().optional(),
  regulatory_unit: z.string().nullable().optional(),
});

// ── Equipment ─────────────────────────────────────────────────────────────────

export const equipmentSchema = z.object({
  site_id: z.string().min(1, "Select a site"),
  name: z.string().min(1, "Equipment name is required"),
  type: z.string().min(1, "Equipment type is required"),
  serial_number: z.string().nullable().optional(),
  location: z.string().default(""),
  last_calibration_date: z.string().nullable().optional(),
  next_calibration_date: z.string().nullable().optional(),
  last_inspection_date: z.string().nullable().optional(),
  next_inspection_date: z.string().nullable().optional(),
  calibration_interval_days: z.number().int().nullable().optional(),
  status: z.enum(EQUIPMENT_STATUSES).default("operational"),
  regulatory_ref: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ── Risk Assessments ──────────────────────────────────────────────────────────

export const riskAssessmentSchema = z.object({
  site_id: z.string().min(1, "Select a site"),
  title: z.string().min(1, "Title is required"),
  description: z.string().default(""),
  category: z.enum(["chemical","physical","biological","ergonomic","fire","electrical","environmental","psychosocial","general"]),
  activity: z.string().min(1, "Activity description is required"),
  hazards: z.array(z.string()).default([]),
  existing_controls: z.array(z.string()).default([]),
  likelihood_score: z.number().int().min(1).max(5),
  consequence_score: z.number().int().min(1).max(5),
  additional_controls: z.array(z.string()).default([]),
  residual_likelihood: z.number().int().min(1).max(5).nullable().optional(),
  residual_consequence: z.number().int().min(1).max(5).nullable().optional(),
  owner_id: z.string().nullable().optional(),
  review_date: z.string().min(1, "Review date is required"),
});

// ── Incidents ─────────────────────────────────────────────────────────────────

export const incidentSchema = z.object({
  site_id: z.string().min(1, "Select a site"),
  title: z.string().min(1, "Incident title is required"),
  description: z.string().min(1, "Description is required"),
  incident_type: z.enum(INCIDENT_TYPES),
  severity: z.enum(SEVERITIES),
  occurred_at: z.string().min(1, "Date/time of incident is required"),
  location: z.string().min(1, "Location is required"),
  injured_party: z.string().nullable().optional(),
  injuries_description: z.string().nullable().optional(),
  immediate_actions: z.string().nullable().optional(),
  medical_treatment_required: z.boolean().default(false),
  regulatory_reportable: z.boolean().default(false),
});

export type IncidentInput = z.infer<typeof incidentSchema>;

// ── AI Review ─────────────────────────────────────────────────────────────────

export const aiReviewSchema = z.object({
  id: z.string().min(1),
  review_status: z.enum(REVIEW_STATUSES),
  reason: z.string().optional(),
});

/**
 * Structured output contract for the SafetyIQ AI Engine — validated before
 * any analysis result reaches the database or UI so a malformed or hallucinated
 * payload is rejected and the heuristic fallback triggers instead.
 */
export const aiAnalysisOutputSchema = z.object({
  risk_level: z.enum(RISK_LEVELS),
  risk_score: z.number().min(0).max(100).catch(50),
  findings: z.array(z.object({
    category: z.string().min(1),
    description: z.string().min(1),
    severity: z.enum(SEVERITIES),
  })).default([]),
  gaps: z.array(z.string()).default([]),
  regulatory_refs: z.array(z.string()).default([]),
  recommended_actions: z.array(z.object({
    action: z.string().min(1),
    priority: z.enum(["immediate", "short_term", "medium_term", "long_term"]),
    rationale: z.string().min(1),
    capa_kind: z.enum(["corrective", "preventive"]),
  })).default([]),
  plain_language_summary: z.string().min(1),
  human_review_required: z.boolean(),
});

export type AiAnalysisOutputValidated = z.infer<typeof aiAnalysisOutputSchema>;

/**
 * Zod schema for the Arc Causality Engine output (per-cell analysis).
 * Validated before the result is ever stored — a malformed payload triggers
 * the heuristic fallback. Numbers are coerced/clamped for model tolerance.
 */
export const aiCellAnalysisOutputSchema = z.object({
  risk_score: z.number().min(0).max(100).catch(50),
  hazard_genome: z.object({
    energySource: z.string().min(1),
    exposureType: z.string().min(1),
    trigger: z.string().min(1),
    controlGap: z.string().min(1),
    environment: z.string().default(""),
  }),
  missing_data: z.array(z.string()).default([]),
  causal_factors: z.array(z.string()).default([]),
  suggested_edges: z.array(z.object({
    target_cell_id: z.string().min(1),
    type: z.enum(EDGE_TYPES),
    confidence: z.number().min(0).max(1).catch(0.5),
    rationale: z.string().min(1),
  })).default([]),
  prevention: z.array(z.object({
    action: z.string().min(1),
    counterfactual: z.string().min(1),
    rationale: z.string().default(""),
  })).default([]),
  plain_language_summary: z.string().min(1),
  human_review_required: z.boolean(),
});

export type AiCellAnalysisOutputValidated = z.infer<typeof aiCellAnalysisOutputSchema>;

// ── Arc — Safety Cells ────────────────────────────────────────────────────────

export const hazardGenomeSchema = z.object({
  energySource: z.string().min(1, "Energy source is required"),
  exposureType: z.string().min(1, "Exposure type is required"),
  trigger: z.string().min(1, "Trigger is required"),
  controlGap: z.string().min(1, "Control gap is required"),
});

export const safetyCellSchema = z.object({
  site_id: z.string().min(1, "Select a site"),
  location_id: z.string().min(1, "Select a location"),
  title: z.string().min(1, "Title is required"),
  description: z.string().default(""),
  task: z.string().min(1, "Task is required"),
  crew: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  permit_ref: z.string().nullable().optional(),
  hazard_genome: hazardGenomeSchema,
  severity: z.enum(SEVERITIES),
  likelihood: z.number().int().min(1).max(5),
  status: z.enum(CELL_STATUSES).default("open"),
  owner_id: z.string().nullable().optional(),
});

export type SafetyCellInput = z.infer<typeof safetyCellSchema>;

export const eventInputSchema = z.object({
  site_id: z.string().min(1, "Select a site"),
  cell_id: z.string().nullable().optional(),
  kind: z.enum(["incident", "near_miss", "audit_finding", "claim"]),
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().optional(),
  severity: z.enum(SEVERITIES),
  occurred_at: z.string().optional(),
});

export type EventInput = z.infer<typeof eventInputSchema>;

export const analyzeCellSchema = z.object({
  cell_id: z.string().min(1, "Cell ID is required"),
});

export const evidenceSchema = z.object({
  cell_id: z.string().min(1),
  kind: z.enum(["photo", "video", "document", "note"]),
  name: z.string().min(1, "File name is required"),
  summary: z.string().optional(),
});

export const causalEdgeSchema = z.object({
  source_cell_id: z.string().min(1, "Source cell is required"),
  target_cell_id: z.string().min(1, "Target cell is required"),
  type: z.enum(EDGE_TYPES),
  confidence: z.number().min(0).max(1).default(0.8),
  rationale: z.string().default(""),
});

export const proofUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(PROOF_STATUSES),
  evidence_summary: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  reason: z.string().optional(),
});

export const actionSchema = z.object({
  cell_id: z.string().min(1, "Cell ID is required"),
  title: z.string().min(1, "Title is required"),
  kind: z.enum(["corrective", "preventive"]),
  owner_id: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
});

// Alias so existing API routes using `eventSchema` continue to compile.
export const eventSchema = eventInputSchema;

// Edge review / PATCH — accept, reject, or edit a causal edge.
export const edgeReviewSchema = z.object({
  id: z.string().min(1, "Edge ID is required"),
  review_status: z.enum(REVIEW_STATUSES),
  type: z.enum(EDGE_TYPES).optional(),
  rationale: z.string().optional(),
  reason: z.string().optional(),
});

// Structured output from the EXP LLM extractor — validated before use.
export const extractedCellSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  task: z.string().default(""),
  severity: z.enum(SEVERITIES),
  likelihood: z.number().int().min(1).max(5).default(3),
  hazard_genome: z.object({
    energySource: z.string().default("unknown"),
    exposureType: z.string().default("contact"),
    trigger: z.string().default(""),
    controlGap: z.string().default("unknown"),
    environment: z.string().optional(),
  }),
  confidence: z.number().min(0).max(1).default(0.7),
  signals: z.array(z.string()).default([]),
});
