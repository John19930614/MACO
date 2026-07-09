/**
 * SafetyIQ — MACO EHS shared vocabulary. Keep this file as the single source
 * of truth for all taxonomy used across the UI, API, and database seed.
 * Mirrors the Postgres CHECK constraints in supabase/migrations/0001_init.sql.
 */

// ── Severity ─────────────────────────────────────────────────────────────────
export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_META: Record<
  Severity,
  { label: string; color: string; text: string; bg: string }
> = {
  low:      { label: "Low",      color: "#22c55e", text: "text-emerald-700", bg: "bg-emerald-100" },
  medium:   { label: "Medium",   color: "#f59e0b", text: "text-amber-700",   bg: "bg-amber-100"   },
  high:     { label: "High",     color: "#ef4444", text: "text-red-700",     bg: "bg-red-100"     },
  critical: { label: "Critical", color: "#991b1b", text: "text-red-50",      bg: "bg-red-700"     },
};

// ── Risk Level (5×5 matrix) ───────────────────────────────────────────────────
export const RISK_LEVELS = ["negligible", "low", "medium", "high", "extreme"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

// `bgColor` is a plain hex fill for direct inline `style={{ backgroundColor }}`
// use (e.g. the Risk Matrix cells) where a Tailwind class name is not usable.
// Green = low, amber = medium, red = high, dark red = extreme — matching the
// plain-language legend shown across the app.
export const RISK_LEVEL_META: Record<RiskLevel, { label: string; color: string; bg: string; bgColor: string; action: string }> = {
  negligible: { label: "Negligible", color: "#22c55e", bg: "bg-emerald-100", bgColor: "#dcfce7", action: "No action required"                  },
  low:        { label: "Low",        color: "#86efac", bg: "bg-green-100",   bgColor: "#bbf7d0", action: "Monitor and review periodically"      },
  medium:     { label: "Medium",     color: "#f59e0b", bg: "bg-amber-100",   bgColor: "#fde68a", action: "Action required within 30 days"       },
  high:       { label: "High",       color: "#ef4444", bg: "bg-red-100",     bgColor: "#fca5a5", action: "Urgent action required within 7 days" },
  extreme:    { label: "Extreme",    color: "#7f1d1d", bg: "bg-red-900",     bgColor: "#7f1d1d", action: "STOP — immediate action required"     },
};

export function riskLevelFromScore(score: number): RiskLevel {
  if (score <= 2)  return "negligible";
  if (score <= 6)  return "low";
  if (score <= 12) return "medium";
  if (score <= 20) return "high";
  return "extreme";
}

/**
 * Band a 0–100 score into a RiskLevel. The AI engine scores risk on a 0–100
 * scale (not the 1–25 likelihood×consequence matrix), so it needs its own
 * banding. Thresholds mirror riskLevelFromScore scaled ×4, keeping the two
 * scales semantically aligned (e.g. matrix "high" 13–20 ↔ 0–100 "high" 49–80).
 */
export function riskLevelFromScore100(score: number): RiskLevel {
  if (score <= 8)  return "negligible";
  if (score <= 24) return "low";
  if (score <= 48) return "medium";
  if (score <= 80) return "high";
  return "extreme";
}

// ── Compliance Status ─────────────────────────────────────────────────────────
export const COMPLIANCE_STATUSES = [
  "compliant",
  "minor_gap",
  "major_gap",
  "non_compliant",
  "not_assessed",
  "not_applicable",
] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export const COMPLIANCE_STATUS_META: Record<ComplianceStatus, { label: string; tone: string; score: number }> = {
  compliant:       { label: "Compliant",     tone: "bg-emerald-100 text-emerald-700", score: 100 },
  minor_gap:       { label: "Minor gap",     tone: "bg-amber-100 text-amber-700",     score: 75  },
  major_gap:       { label: "Major gap",     tone: "bg-orange-100 text-orange-700",   score: 40  },
  non_compliant:   { label: "Non-compliant", tone: "bg-red-100 text-red-700",         score: 0   },
  not_assessed:    { label: "Not assessed",  tone: "bg-slate-100 text-slate-600",     score: 0   },
  not_applicable:  { label: "N/A",           tone: "bg-slate-100 text-slate-400",     score: -1  },
};

// ── CAPA Status ───────────────────────────────────────────────────────────────
export const CAPA_STATUSES = [
  "open",
  "in_progress",
  "overdue",
  "pending_verification",
  "closed",
  "rejected",
] as const;
export type CapaStatus = (typeof CAPA_STATUSES)[number];

export const CAPA_STATUS_META: Record<CapaStatus, { label: string; tone: string }> = {
  open:                 { label: "Open",                 tone: "bg-blue-100 text-blue-700"   },
  in_progress:          { label: "In progress",          tone: "bg-amber-100 text-amber-700" },
  overdue:              { label: "Overdue",              tone: "bg-red-100 text-red-700"     },
  pending_verification: { label: "Pending verification", tone: "bg-purple-100 text-purple-700" },
  closed:               { label: "Closed",               tone: "bg-emerald-100 text-emerald-700" },
  rejected:             { label: "Rejected",             tone: "bg-slate-100 text-slate-600" },
};

// ── Audit Status ──────────────────────────────────────────────────────────────
export const AUDIT_STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

// ── GHS Hazard Classes ────────────────────────────────────────────────────────
// UN GHS Rev.9 hazard class codes used in chemical inventory.
export const GHS_HAZARD_CLASSES = [
  "H200", "H201", "H202", "H203", "H204",       // Explosives
  "H220", "H221", "H222", "H223",               // Flammable gases/aerosols
  "H224", "H225", "H226", "H228",               // Flammable liquids/solids
  "H240", "H241", "H242",                       // Self-reactive / organic peroxides
  "H250", "H251", "H252",                       // Pyrophoric / self-heating
  "H260", "H261",                               // Substances that emit flammable gas
  "H270", "H271", "H272",                       // Oxidising gases/liquids/solids
  "H280", "H281",                               // Gases under pressure
  "H290",                                       // Corrosive to metals
  "H300", "H301", "H302",                       // Acute oral toxicity
  "H303", "H304",                               // May be harmful / aspiration hazard
  "H310", "H311", "H312",                       // Acute dermal toxicity
  "H313",                                       // May be harmful in contact with skin
  "H314", "H315", "H317",                       // Skin corrosion/irritation
  "H316",                                       // Mild skin irritation
  "H318", "H319",                               // Serious eye damage/irritation
  "H320",                                       // Eye irritation
  "H330", "H331", "H332",                       // Acute inhalation toxicity
  "H333",                                       // May be harmful if inhaled
  "H334", "H335", "H336",                       // Respiratory sensitisation / dizziness
  "H340", "H341",                               // Germ cell mutagenicity
  "H350", "H351",                               // Carcinogenicity
  "H360", "H361",                               // Reproductive toxicity
  "H370", "H371", "H372", "H373",              // STOT
  "H400", "H410", "H411", "H412", "H413",      // Aquatic toxicity
  "H420",                                       // Ozone hazard
] as const;
export type GhsHazardClass = (typeof GHS_HAZARD_CLASSES)[number];

// ── Waste Classification ──────────────────────────────────────────────────────
export const WASTE_CLASSIFICATIONS = [
  "hazardous",
  "non_hazardous",
  "radioactive",
  "clinical",
  "scheduled",
  "recyclable",
  "general",
] as const;
export type WasteClassification = (typeof WASTE_CLASSIFICATIONS)[number];

// ── Waste Profile Lifecycle ───────────────────────────────────────────────────
// draft → ehs_review → approved → active → retired; ehs_review can → rejected.
export const WASTE_PROFILE_STATES = [
  "draft",
  "ehs_review",
  "approved",
  "active",
  "rejected",
  "retired",
] as const;
export type WasteProfileState = (typeof WASTE_PROFILE_STATES)[number];

// ── Equipment Status ──────────────────────────────────────────────────────────
export const EQUIPMENT_STATUSES = [
  "operational",
  "calibration_due",
  "inspection_due",
  "out_of_service",
  "decommissioned",
] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

// ── Incident Types ────────────────────────────────────────────────────────────
export const INCIDENT_TYPES = [
  "near_miss",
  "first_aid",
  "medical_treatment",
  "lost_time_injury",
  "fatality",
  "property_damage",
  "environmental_spill",
  "fire_explosion",
  "chemical_release",
  "regulatory_breach",
] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_TYPE_META: Record<IncidentType, { label: string; severity: string }> = {
  near_miss:           { label: "Near miss",             severity: "low"      },
  first_aid:           { label: "First aid",             severity: "low"      },
  medical_treatment:   { label: "Medical treatment",     severity: "medium"   },
  lost_time_injury:    { label: "Lost time injury",      severity: "high"     },
  fatality:            { label: "Fatality",              severity: "critical" },
  property_damage:     { label: "Property damage",       severity: "medium"   },
  environmental_spill: { label: "Environmental spill",   severity: "high"     },
  fire_explosion:      { label: "Fire / explosion",      severity: "critical" },
  chemical_release:    { label: "Chemical release",      severity: "high"     },
  regulatory_breach:   { label: "Regulatory breach",     severity: "high"     },
};

// ── AI Review Status ──────────────────────────────────────────────────────────
export const REVIEW_STATUSES = ["pending", "accepted", "edited", "rejected", "archived"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// ── Training Delivery Methods ─────────────────────────────────────────────────
export const TRAINING_DELIVERIES = [
  "classroom",
  "online",
  "on_the_job",
  "toolbox_talk",
  "simulation",
  "external",
] as const;
export type TrainingDelivery = (typeof TRAINING_DELIVERIES)[number];

// ── Document Status ───────────────────────────────────────────────────────────
export const DOCUMENT_STATUSES = [
  "draft",
  "active",
  "under_review",
  "superseded",
  "obsolete",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

// ── EHS Roles ─────────────────────────────────────────────────────────────────
// Write-permission tiers mirror Postgres RLS role checks in 0002_rls.sql.
export const ROLES = [
  "viewer",
  "field_officer",
  "contributor",        // alias tier used by permission tests (same level as field_officer)
  "ehs_coordinator",
  "supervisor",         // alias tier: supervisor-level actions (create events/actions)
  "safety_manager",     // alias tier: safety-manager-level actions
  "ehs_manager",
  "admin",
] as const;
export type Role = (typeof ROLES)[number];

export const WRITE_ROLES: readonly Role[] = ["field_officer", "contributor", "ehs_coordinator", "supervisor", "safety_manager", "ehs_manager", "admin"];
export const COORDINATOR_ROLES: readonly Role[] = ["ehs_coordinator", "supervisor", "safety_manager", "ehs_manager", "admin"];
export const MANAGER_ROLES: readonly Role[] = ["safety_manager", "ehs_manager", "admin"];

export const ROLE_META: Record<Role, { label: string; description: string }> = {
  viewer:          { label: "Viewer",          description: "Read-only access to dashboards and reports"            },
  field_officer:   { label: "Field Officer",   description: "Submit incidents, acknowledge docs, complete training" },
  contributor:     { label: "Contributor",     description: "Submit and update records (alias for field_officer)"   },
  ehs_coordinator: { label: "EHS Coordinator", description: "Manage chemical inventory, audits, training records"   },
  supervisor:      { label: "Supervisor",      description: "Create events and actions, supervise field work"       },
  safety_manager:  { label: "Safety Manager",  description: "Full site safety management"                          },
  ehs_manager:     { label: "EHS Manager",     description: "Full site access, CAPA management, compliance scoring"  },
  admin:           { label: "Administrator",   description: "User management and system configuration"              },
};

export const canWrite        = (role: Role): boolean => WRITE_ROLES.includes(role);
export const canCoordinate   = (role: Role): boolean => COORDINATOR_ROLES.includes(role);
export const canManage       = (role: Role): boolean => MANAGER_ROLES.includes(role);

// ── EHS Module categories ─────────────────────────────────────────────────────
// Used in compliance_scores.module and throughout the dashboard.
export const EHS_MODULES = [
  "chemical",
  "legal",
  "audits",
  "capa",
  "training",
  "documents",
  "waste",
  "equipment",
  "risk",
  "incidents",
] as const;
export type EhsModule = (typeof EHS_MODULES)[number];

export const MODULE_META: Record<EhsModule, { label: string; icon: string; description: string }> = {
  chemical:   { label: "Chemical Inventory",     icon: "🧪", description: "GHS-classified chemicals, SDS library, storage compliance"   },
  legal:      { label: "Legal & Regulatory",     icon: "⚖️", description: "Regulatory obligations, compliance status, review schedules"  },
  audits:     { label: "Audits",                 icon: "📋", description: "Internal and external audit schedule, findings, close-out"    },
  capa:       { label: "CAPA",                   icon: "🔧", description: "Corrective and preventive actions, verification, root cause"  },
  training:   { label: "Training",               icon: "🎓", description: "Course catalogue, completion records, expiry tracking"        },
  documents:  { label: "Documents",              icon: "📄", description: "SOP/policy library, version control, acknowledgments"         },
  waste:      { label: "Waste Management",       icon: "♻️", description: "Waste streams, manifests, disposal records, reporting"        },
  equipment:  { label: "Equipment",              icon: "🔬", description: "Monitoring equipment, calibration logs, inspection schedule"  },
  risk:       { label: "Risk Register",          icon: "⚠️", description: "Risk assessments, 5×5 matrix scoring, control adequacy"      },
  incidents:  { label: "Incidents",              icon: "🚨", description: "Near misses, incidents, investigations, LTI rate tracking"    },
};

// ── Arc: Safety Cell statuses ─────────────────────────────────────────────────
export const CELL_STATUSES = ["open", "investigating", "controlled", "closed"] as const;
export type CellStatus = (typeof CELL_STATUSES)[number];

// ── Arc: Control Proof statuses ───────────────────────────────────────────────
export const PROOF_STATUSES = [
  "not_checked",
  "weak_proof",
  "proven",
  "missing",
  "expired",
  "conflicting",
  "not_applicable",
] as const;
export type ProofStatus = (typeof PROOF_STATUSES)[number];

export const PROOF_META: Record<ProofStatus, { label: string; riskType: "control" | "failure" }> = {
  not_checked:    { label: "Not checked",    riskType: "failure" },
  weak_proof:     { label: "Weak proof",     riskType: "control" },
  proven:         { label: "Proven",         riskType: "control" },
  missing:        { label: "Missing",        riskType: "failure" },
  expired:        { label: "Expired",        riskType: "failure" },
  conflicting:    { label: "Conflicting",    riskType: "failure" },
  not_applicable: { label: "Not applicable", riskType: "control" },
};

// ── Arc: Causal Edge types ────────────────────────────────────────────────────
export const EDGE_TYPES = [
  "contributes_to",
  "contributed_to",     // legacy alias kept for test compatibility
  "triggers",
  "amplifies",
  "inhibits",
  "precedes",
  "same_location",
  "same_control_gap",   // Arc causality engine: shared control gap pattern
] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

export const EDGE_META: Record<EdgeType, { label: string; color: string }> = {
  contributes_to:   { label: "Contributes to",   color: "#f97316" },
  contributed_to:   { label: "Contributed to",   color: "#f97316" },
  triggers:         { label: "Triggers",          color: "#ef4444" },
  amplifies:        { label: "Amplifies",         color: "#f59e0b" },
  inhibits:         { label: "Inhibits",          color: "#22c55e" },
  precedes:         { label: "Precedes",          color: "#6366f1" },
  same_location:    { label: "Same location",     color: "#64748b" },
  same_control_gap: { label: "Same control gap",  color: "#a855f7" },
};

// ── Arc: Safety Action statuses ───────────────────────────────────────────────
export const ACTION_STATUSES = ["open", "in_progress", "overdue", "closed"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

// ── Arc: Supervisor roles (can create events / actions, not just write) ────────
export const SUPERVISOR_ROLES: readonly Role[] = ["ehs_coordinator", "supervisor", "safety_manager", "ehs_manager", "admin"];
export const canCreateActions = (role: Role): boolean => SUPERVISOR_ROLES.includes(role);
export const canCreateEvents  = (role: Role): boolean => SUPERVISOR_ROLES.includes(role);

// ── Arc: Event Cell kinds ─────────────────────────────────────────────────────
export const EVENT_KINDS = ["incident", "near_miss", "audit_finding", "claim"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

// ── Arc: Behavior patterns (emergent from cell population) ────────────────────
export const BEHAVIOR_PATTERNS = [
  "production_pressure",
  "weak_closeout",
  "recurring_issue",
] as const;
export type BehaviorPattern = (typeof BEHAVIOR_PATTERNS)[number];

// ── Arc: Risk object types (six-object risk graph) ────────────────────────────
export const RISK_OBJECT_TYPES = [
  "precursor",
  "control",
  "failure",
  "behavior",
  "event",
  "learning",
] as const;
export type RiskObjectType = (typeof RISK_OBJECT_TYPES)[number];

export const RISK_OBJECT_META: Record<RiskObjectType, { label: string; color: string }> = {
  precursor: { label: "Precursor", color: "#f97316" },
  control:   { label: "Control",   color: "#22c55e" },
  failure:   { label: "Failure",   color: "#ef4444" },
  behavior:  { label: "Behavior",  color: "#a855f7" },
  event:     { label: "Event",     color: "#3b82f6" },
  learning:  { label: "Learning",  color: "#14b8a6" },
};

// ── Arc: Hazard genome vocabulary ─────────────────────────────────────────────
export const ENERGY_SOURCES = [
  "electrical",
  "mechanical",
  "thermal",
  "chemical",
  "gravitational",
  "radiation",
  "biological",
  "pressure",
  "kinetic",
] as const;
export type EnergySource = (typeof ENERGY_SOURCES)[number];

export const EXPOSURE_TYPES = [
  "contact",
  "inhalation",
  "ingestion",
  "injection",
  "absorbed",
  "noise",
  "vibration",
  "radiation",
  "struck_by",
  "entanglement",
] as const;
export type ExposureType = (typeof EXPOSURE_TYPES)[number];

export const CONTROL_GAPS = [
  "missing",
  "inadequate",
  "unknown",
  "expired",
  "bypassed",
  "unverified",
  "not_applicable",
] as const;
export type ControlGap = (typeof CONTROL_GAPS)[number];

// ── Predictability Engine stages ──────────────────────────────────────────────
// MACO equivalent of P-CLSS: five-stage continuous learning cycle.
export const PREDICTABILITY_STAGES = [
  "scan",       // gather current state across all modules
  "detect",     // identify weak signals and trends
  "forecast",   // predict 30/60/90-day compliance trajectory
  "alert",      // surface priority actions for human review
  "learn",      // incorporate outcomes to improve predictions
] as const;
export type PredictabilityStage = (typeof PREDICTABILITY_STAGES)[number];

export const STAGE_META: Record<PredictabilityStage, { label: string; description: string }> = {
  scan:     { label: "Scan",     description: "Aggregate current state across all EHS modules"          },
  detect:   { label: "Detect",   description: "Identify trends, near-miss patterns, leading indicators" },
  forecast: { label: "Forecast", description: "Project compliance trajectory and incident probability"  },
  alert:    { label: "Alert",    description: "Prioritise actions for EHS manager review"               },
  learn:    { label: "Learn",    description: "Update prediction weights from actual outcomes"          },
};
