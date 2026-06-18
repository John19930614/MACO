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

export const RISK_LEVEL_META: Record<RiskLevel, { label: string; color: string; bg: string; action: string }> = {
  negligible: { label: "Negligible", color: "#22c55e", bg: "bg-emerald-100", action: "No action required"                  },
  low:        { label: "Low",        color: "#86efac", bg: "bg-green-100",   action: "Monitor and review periodically"      },
  medium:     { label: "Medium",     color: "#f59e0b", bg: "bg-amber-100",   action: "Action required within 30 days"       },
  high:       { label: "High",       color: "#ef4444", bg: "bg-red-100",     action: "Urgent action required within 7 days" },
  extreme:    { label: "Extreme",    color: "#7f1d1d", bg: "bg-red-900",     action: "STOP — immediate action required"     },
};

export function riskLevelFromScore(score: number): RiskLevel {
  if (score <= 2)  return "negligible";
  if (score <= 6)  return "low";
  if (score <= 12) return "medium";
  if (score <= 20) return "high";
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
  "H310", "H311", "H312",                       // Acute dermal toxicity
  "H314", "H315", "H317",                       // Skin corrosion/irritation
  "H318", "H319",                               // Serious eye damage/irritation
  "H330", "H331", "H332",                       // Acute inhalation toxicity
  "H334", "H335",                               // Respiratory sensitisation
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
  "ehs_coordinator",
  "ehs_manager",
  "admin",
] as const;
export type Role = (typeof ROLES)[number];

export const WRITE_ROLES: readonly Role[] = ["field_officer", "ehs_coordinator", "ehs_manager", "admin"];
export const COORDINATOR_ROLES: readonly Role[] = ["ehs_coordinator", "ehs_manager", "admin"];
export const MANAGER_ROLES: readonly Role[] = ["ehs_manager", "admin"];

export const ROLE_META: Record<Role, { label: string; description: string }> = {
  viewer:          { label: "Viewer",          description: "Read-only access to dashboards and reports"            },
  field_officer:   { label: "Field Officer",   description: "Submit incidents, acknowledge docs, complete training" },
  ehs_coordinator: { label: "EHS Coordinator", description: "Manage chemical inventory, audits, training records"   },
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
