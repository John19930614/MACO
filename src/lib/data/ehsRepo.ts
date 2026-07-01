import "server-only";
import { cache } from "react";
import { getStore } from "./store";
import { MOCK_TENANT_ID, MOCK_SITE_ID, MOCK_TENANTS_ALL } from "./mock";
import { MOCK_MODE } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEffectiveTenantId } from "@/lib/auth/session";
import type {
  Chemical, LegalRequirement, Audit, AuditFinding, CapaAction,
  TrainingCourse, TrainingRecord, Document, WasteStream, Equipment,
  RiskAssessment, Incident, ComplianceScore, AiFinding,
  PredictabilityRun, AuditEntry, RelianceInsight, Profile,
  WorkspaceTask, BiosafetyLab, BiohazardAgent, CapaSourceType,
  DocumentAcknowledgment, OshaCase,
  ErgonomicsWorkstation, ErgonomicsJobTask, ExposureReading,
  WasteVendor, WastePickup, WasteInspection, WasteProfile, SavedReport,
  SdsDocument, WasteReviewFlag, WasteFlagStatus,
} from "@/lib/types";
import type { Severity, CapaStatus, AuditStatus, RiskLevel, TrainingDelivery } from "@/lib/constants";

async function sb() { return createSupabaseServerClient(); }

// ── Tenant / establishment identity (live tenant + onboarding profile) ─────────

export interface EstablishmentInfo {
  name: string;
  industry: string | null;
  siteName: string | null;
  state: string | null;
  country: string | null;
  contactName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

export const getTenantName = cache(async (tenantId = MOCK_TENANT_ID): Promise<string> => {
  if (MOCK_MODE) return MOCK_TENANTS_ALL.find((t) => t.id === tenantId)?.name ?? "Your Company";
  const client = await sb();
  if (!client) return "Your Company";
  const { data } = await client.from("tenants").select("name, onboarding_data").eq("id", tenantId).single();
  const legal = (data?.onboarding_data as Record<string, unknown> | null)?.legalName;
  return (typeof legal === "string" && legal.trim()) ? legal.trim() : (data?.name ?? "Your Company");
});

export const getEstablishment = cache(async (tenantId = MOCK_TENANT_ID): Promise<EstablishmentInfo> => {
  const empty: EstablishmentInfo = {
    name: "Your Company", industry: null, siteName: null, state: null, country: null,
    contactName: null, contactTitle: null, contactEmail: null, contactPhone: null,
  };
  if (MOCK_MODE) return { ...empty, name: MOCK_TENANTS_ALL.find((t) => t.id === tenantId)?.name ?? "Your Company" };
  const client = await sb();
  if (!client) return empty;
  const { data } = await client.from("tenants").select("name, onboarding_data").eq("id", tenantId).single();
  if (!data) return empty;
  const obd = (data.onboarding_data ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    name: str(obd.legalName) ?? data.name ?? "Your Company",
    industry: str(obd.industry),
    siteName: str(obd.siteName),
    state: str(obd.siteState),
    country: str(obd.siteCountry),
    contactName: str(obd.contactName),
    contactTitle: str(obd.contactTitle),
    contactEmail: str(obd.contactEmail),
    contactPhone: str(obd.contactPhone),
  };
});

// Tenant settings bag (onboarding_data.settings) — company config, OSHA
// establishment data, EHS officers, notification toggles, logo, etc.
export const getTenantSettings = cache(async (tenantId = MOCK_TENANT_ID): Promise<Record<string, unknown>> => {
  if (MOCK_MODE) return {};
  const client = await sb();
  if (!client) return {};
  const { data } = await client.from("tenants").select("onboarding_data").eq("id", tenantId).single();
  const obd = (data?.onboarding_data ?? {}) as Record<string, unknown>;
  const settings = obd.settings;
  return settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};
});

// ── CAPA ─────────────────────────────────────────────────────────────────────

export const getCapaActions = cache(async (tenantId = MOCK_TENANT_ID): Promise<CapaAction[]> => {
  if (MOCK_MODE) return getStore().capaActions.filter((c) => c.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("capa_records")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? MOCK_SITE_ID,
    title: r.title,
    description: r.description,
    kind: r.kind as "corrective" | "preventive",
    source_type: (r.source_type ?? "manual") as CapaSourceType,
    source_id: r.source_id ?? null,
    root_cause: r.root_cause ?? null,
    severity: (r.severity ?? "medium") as Severity,
    owner_id: r.owner_id ?? null,
    due_date: r.due_date ?? null,
    status: (r.status ?? "open") as CapaStatus,
    verification_method: r.verification_method ?? null,
    closed_at: r.closed_at ?? null,
    closure_note: r.closure_note ?? null,
    closed_with_evidence: r.closed_with_evidence ?? false,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

// ── Incidents ─────────────────────────────────────────────────────────────────

export const getIncidents = cache(async (tenantId = MOCK_TENANT_ID): Promise<Incident[]> => {
  if (MOCK_MODE) return getStore().incidents.filter((i) => i.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("incidents")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? MOCK_SITE_ID,
    title: r.title,
    description: r.description,
    incident_type: r.incident_type as Incident["incident_type"],
    severity: r.severity as Severity,
    status: r.status as Incident["status"],
    occurred_at: r.occurred_at,
    location: r.location,
    injured_party: r.injured_party ?? null,
    injuries_description: r.injuries_description ?? null,
    immediate_actions: r.immediate_actions ?? null,
    root_cause: r.root_cause ?? null,
    reported_by: r.reported_by ?? "",
    owner_id: r.owner_id ?? null,
    lost_time_days: r.lost_time_days ?? null,
    medical_treatment_required: r.medical_treatment_required ?? false,
    regulatory_reportable: r.regulatory_reportable ?? false,
    regulatory_report_date: r.regulatory_report_date ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

// ── Chemicals ────────────────────────────────────────────────────────────────

export const getChemicals = cache(async (tenantId = MOCK_TENANT_ID): Promise<Chemical[]> => {
  if (MOCK_MODE) return getStore().chemicals.filter((c) => c.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("chemical_inventory")
    .select("*")
    .eq("tenant_id", tenantId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? MOCK_SITE_ID,
    name: r.name,
    cas_number: r.cas_number ?? null,
    un_number: r.un_number ?? null,
    chemical_formula: r.chemical_formula ?? null,
    ghs_classes: r.ghs_classes ?? [],
    quantity: Number(r.quantity) || 0,
    unit: r.unit ?? "L",
    container_capacity: r.container_capacity ?? null,
    container_capacity_unit: r.container_capacity_unit ?? null,
    storage_location: r.storage_location ?? "",
    sds_url: r.sds_url ?? null,
    sds_expiry: r.sds_expiry ?? null,
    hazard_statements: r.hazard_statements ?? [],
    precautionary_statements: r.precautionary_statements ?? [],
    is_scheduled: r.is_scheduled ?? false,
    schedule_ref: r.schedule_ref ?? null,
    supplier: r.supplier ?? null,
    date_received: r.date_received ?? null,
    status: (r.status ?? "active") as Chemical["status"],
    owner_id: r.owner_id ?? null,
    created_by: r.created_by ?? "",
    created_at: r.created_at,
    updated_at: r.updated_at,
    storage_class: r.storage_class ?? null,
    recommended_ppe: r.recommended_ppe ?? [],
    // Concentration hazard fields
    concentration_pct: r.concentration_pct ?? null,
    physical_state: (r.physical_state ?? null) as Chemical["physical_state"],
    flash_point_c: r.flash_point_c ?? null,
    expiration_date: r.expiration_date ?? null,
    hazard_band: (r.hazard_band ?? null) as Chemical["hazard_band"],
    hazard_band_confidence: r.hazard_band_confidence ?? null,
    hazard_band_reviewed_at: r.hazard_band_reviewed_at ?? null,
    hazard_band_reason: r.hazard_band_reason ?? null,
    label_code: r.label_code ?? null,
  }));
});

// ── SDS Documents ─────────────────────────────────────────────────────────────

export async function getSdsDocuments(tenantId: string): Promise<SdsDocument[]> {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("sds_documents")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as SdsDocument[];
}

// ── Chemical waste review flags (GHS build 2) ─────────────────────────────────
// Resilient: returns [] in mock mode and on any error (e.g. before the
// chemical_waste_review_flags migration is applied).
export async function getWasteReviewFlags(tenantId: string): Promise<WasteReviewFlag[]> {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("chemical_waste_review_flags")
    .select("*, chemical:chemical_inventory(name)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? null,
    chemical_id: r.chemical_id,
    chemical_name: r.chemical?.name ?? null,
    trigger_source: r.trigger_source,
    trigger_value: r.trigger_value,
    potential_waste_concern: r.potential_waste_concern,
    suggested_review_area: r.suggested_review_area ?? null,
    status: r.status as WasteFlagStatus,
    reviewer_notes: r.reviewer_notes ?? null,
    final_determination: r.final_determination ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

// ── Audits ────────────────────────────────────────────────────────────────────

export const getAudits = cache(async (tenantId = MOCK_TENANT_ID): Promise<Audit[]> => {
  if (MOCK_MODE) return getStore().audits.filter((a) => a.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("audits")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? MOCK_SITE_ID,
    title: r.title,
    type: r.type as Audit["type"],
    scheduled_date: r.scheduled_date,
    completed_date: r.completed_date ?? null,
    status: (r.status ?? "scheduled") as AuditStatus,
    lead_auditor_id: r.lead_auditor_id ?? null,
    scope: r.scope ?? null,
    notes: r.notes ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

// ── Audit Findings ─────────────────────────────────────────────────────────────

export const getAuditFindings = cache(async (tenantId = MOCK_TENANT_ID): Promise<AuditFinding[]> => {
  if (MOCK_MODE) return getStore().auditFindings.filter((f) => f.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("audit_findings")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    audit_id: r.audit_id,
    site_id: r.site_id ?? "",
    title: r.title,
    description: r.description,
    category: r.category,
    severity: r.severity as Severity,
    status: r.status as AuditFinding["status"],
    owner_id: r.owner_id ?? null,
    due_date: r.due_date ?? null,
    closed_at: r.closed_at ?? null,
    capa_required: r.capa_required ?? false,
    capa_id: r.capa_id ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

// ── Risk Assessments ──────────────────────────────────────────────────────────

export const getRiskAssessments = cache(async (tenantId = MOCK_TENANT_ID): Promise<RiskAssessment[]> => {
  if (MOCK_MODE) return getStore().riskAssessments.filter((r) => r.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("risk_assessments")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? MOCK_SITE_ID,
    title: r.title,
    description: r.description,
    category: r.category,
    activity: r.activity,
    hazards: r.hazards ?? [],
    existing_controls: r.existing_controls ?? [],
    likelihood_score: r.likelihood_score,
    consequence_score: r.consequence_score,
    risk_score: r.risk_score,
    risk_level: r.risk_level as RiskLevel,
    additional_controls: r.additional_controls ?? [],
    residual_likelihood: r.residual_likelihood ?? null,
    residual_consequence: r.residual_consequence ?? null,
    residual_risk_score: r.residual_risk_score ?? null,
    residual_risk_level: (r.residual_risk_level ?? null) as RiskLevel | null,
    owner_id: r.owner_id ?? null,
    review_date: r.review_date,
    status: r.status as RiskAssessment["status"],
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

// ── Waste Streams ─────────────────────────────────────────────────────────────

export const getWasteStreams = cache(async (tenantId = MOCK_TENANT_ID): Promise<WasteStream[]> => {
  if (MOCK_MODE) return getStore().wasteStreams.filter((w) => w.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("waste_streams")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? MOCK_SITE_ID,
    waste_name: r.waste_name,
    waste_code: r.waste_code ?? null,
    classification: r.classification as WasteStream["classification"],
    quantity: Number(r.quantity) || 0,
    unit: r.unit,
    disposal_method: r.disposal_method,
    disposal_contractor: r.disposal_contractor ?? null,
    manifest_number: r.manifest_number ?? null,
    disposal_date: r.disposal_date ?? null,
    regulatory_limit: r.regulatory_limit ?? null,
    regulatory_unit: r.regulatory_unit ?? null,
    status: r.status as WasteStream["status"],
    created_by: r.created_by ?? "",
    created_at: r.created_at,
  }));
});

// ── Waste Vendors ─────────────────────────────────────────────────────────────

export const getWasteVendors = cache(async (tenantId = MOCK_TENANT_ID): Promise<WasteVendor[]> => {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("waste_vendors")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    name: r.name,
    epa_id: r.epa_id ?? null,
    contact_name: r.contact_name ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
    services: r.services ?? [],
    permit_expiry: r.permit_expiry ?? null,
    status: r.status ?? "active",
    notes: r.notes ?? null,
    created_by: r.created_by ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

// ── Waste Pickups ─────────────────────────────────────────────────────────────

export const getWastePickups = cache(async (tenantId = MOCK_TENANT_ID): Promise<WastePickup[]> => {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("waste_pickups")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("scheduled_date", { ascending: false, nullsFirst: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? null,
    vendor_id: r.vendor_id ?? null,
    waste_stream_id: r.waste_stream_id ?? null,
    manifest_number: r.manifest_number ?? null,
    scheduled_date: r.scheduled_date ?? null,
    completed_date: r.completed_date ?? null,
    quantity: r.quantity === null || r.quantity === undefined ? null : Number(r.quantity),
    unit: r.unit ?? null,
    status: r.status ?? "requested",
    notes: r.notes ?? null,
    created_by: r.created_by ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

// ── Waste Inspections ─────────────────────────────────────────────────────────

export const getWasteInspections = cache(async (tenantId = MOCK_TENANT_ID): Promise<WasteInspection[]> => {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("waste_inspections")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("inspection_date", { ascending: false, nullsFirst: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? null,
    area: r.area ?? null,
    inspection_date: r.inspection_date ?? null,
    inspector: r.inspector ?? null,
    passed: r.passed ?? null,
    findings: r.findings ?? null,
    next_due: r.next_due ?? null,
    created_by: r.created_by ?? null,
    created_at: r.created_at,
  }));
});

export const getWasteProfiles = cache(async (tenantId = MOCK_TENANT_ID): Promise<WasteProfile[]> => {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("waste_profiles")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? null,
    waste_stream_id: r.waste_stream_id ?? null,
    name: r.name,
    waste_code: r.waste_code ?? null,
    classification: r.classification,
    physical_state: r.physical_state ?? null,
    process_description: r.process_description ?? null,
    hazard_summary: r.hazard_summary ?? null,
    state: r.state as WasteProfile["state"],
    version: r.version,
    reviewer_id: r.reviewer_id ?? null,
    submitted_by: r.submitted_by ?? null,
    submitted_at: r.submitted_at ?? null,
    approved_at: r.approved_at ?? null,
    reject_reason: r.reject_reason ?? null,
    created_by: r.created_by ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    // Guided-wizard fields (jsonb). Absent before the migration is applied → safe defaults.
    composition: Array.isArray(r.composition) ? (r.composition as WasteProfile["composition"]) : [],
    questionnaire: (r.questionnaire as Record<string, string> | null) ?? null,
    ai_suggestions: (r.ai_suggestions as WasteProfile["ai_suggestions"]) ?? null,
  }));
});

// ── Equipment ─────────────────────────────────────────────────────────────────

export const getEquipment = cache(async (tenantId = MOCK_TENANT_ID): Promise<Equipment[]> => {
  if (MOCK_MODE) return getStore().equipment.filter((e) => e.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("equipment")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? MOCK_SITE_ID,
    name: r.name,
    type: r.type,
    serial_number: r.serial_number ?? null,
    location: r.location,
    last_calibration_date: r.last_calibration_date ?? null,
    next_calibration_date: r.next_calibration_date ?? null,
    last_inspection_date: r.last_inspection_date ?? null,
    next_inspection_date: r.next_inspection_date ?? null,
    calibration_interval_days: r.calibration_interval_days ?? null,
    status: r.status as Equipment["status"],
    regulatory_ref: r.regulatory_ref ?? null,
    notes: r.notes ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

// ── Training Courses ──────────────────────────────────────────────────────────

export const getTrainingCourses = cache(async (tenantId = MOCK_TENANT_ID): Promise<TrainingCourse[]> => {
  if (MOCK_MODE) return getStore().trainingCourses.filter((c) => c.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("training_courses")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    title: r.title,
    description: r.description ?? "",
    course_type: r.course_type,
    duration_minutes: r.duration_minutes,
    pass_score: r.pass_score ?? null,
    validity_period_days: r.validity_period_days ?? null,
    required_roles: r.required_roles ?? [],
    regulatory_ref: r.regulatory_ref ?? null,
    active: r.active ?? true,
    created_at: r.created_at,
  }));
});

// ── Training Records ──────────────────────────────────────────────────────────

export const getTrainingRecords = cache(async (tenantId = MOCK_TENANT_ID): Promise<TrainingRecord[]> => {
  if (MOCK_MODE) return getStore().trainingRecords.filter((r) => r.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("training_records")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? MOCK_SITE_ID,
    profile_id: r.profile_id,
    course_id: r.course_id,
    completed_date: r.completed_date,
    expiry_date: r.expiry_date ?? null,
    score: r.score ?? null,
    passed: r.passed ?? true,
    delivery_method: r.delivery_method as TrainingDelivery,
    instructor_id: r.instructor_id ?? null,
    notes: r.notes ?? null,
    created_at: r.created_at,
  }));
});

// ── Mock-only getters ─────────────────────────────────────────────────────────

export const getLegalRequirements = cache(async (tenantId = MOCK_TENANT_ID): Promise<LegalRequirement[]> => {
  if (MOCK_MODE) return getStore().legalRequirements.filter((l) => l.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("legal_requirements")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? null,
    regulation_ref: r.regulation_ref,
    title: r.title,
    description: r.description ?? "",
    jurisdiction: r.jurisdiction,
    category: r.category,
    applicable_sectors: r.applicable_sectors ?? [],
    review_frequency_days: r.review_frequency_days ?? 365,
    next_review_date: r.next_review_date,
    status: r.status as LegalRequirement["status"],
    compliance_notes: r.compliance_notes ?? null,
    evidence_url: r.evidence_url ?? null,
    owner_id: r.owner_id ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

export const getDocuments = cache(async (tenantId = MOCK_TENANT_ID): Promise<Document[]> => {
  if (MOCK_MODE) return getStore().documents.filter((d) => d.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("documents")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? null,
    title: r.title,
    category: r.category,
    version: r.version,
    storage_path: r.storage_path ?? "",
    effective_date: r.effective_date,
    review_date: r.review_date,
    status: r.status as Document["status"],
    owner_id: r.owner_id ?? null,
    acknowledgment_required: r.acknowledgment_required ?? false,
    regulation_ref: r.regulation_ref ?? null,
    content: Array.isArray(r.content) ? r.content : [],
    generated: r.generated ?? false,
    source_doc_paths: r.source_doc_paths ?? [],
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

export const getComplianceScores = cache(async (tenantId = MOCK_TENANT_ID): Promise<ComplianceScore[]> => {
  if (MOCK_MODE) return getStore().complianceScores.filter((s) => s.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("compliance_scores")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("calculated_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? "",
    module: r.module,
    score: Number(r.score),
    max_score: Number(r.max_score),
    percentage: Number(r.percentage),
    status: r.status as ComplianceScore["status"],
    calculated_at: r.calculated_at,
    details: (r.details ?? {}) as Record<string, unknown>,
  }));
});

export const getSavedReports = cache(async (tenantId = MOCK_TENANT_ID): Promise<SavedReport[]> => {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("saved_reports")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    name: r.name,
    report_type: r.report_type,
    generated_at: r.generated_at,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    created_at: r.created_at,
  }));
});

export const getAiFindings = cache(async (tenantId = MOCK_TENANT_ID): Promise<AiFinding[]> => {
  if (MOCK_MODE) return getStore().aiFindings.filter((f) => f.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("ehs_ai_findings")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? null,
    cell_id: r.cell_id ?? null,
    job: r.job as AiFinding["job"],
    source_type: r.source_type ?? undefined,
    source_id: r.source_id ?? null,
    model: r.model,
    prompt_version: r.prompt_version,
    input_summary: r.input_summary,
    output: r.output as AiFinding["output"],
    confidence: Number(r.confidence),
    review_status: r.review_status as AiFinding["review_status"],
    human_review_required: r.human_review_required ?? false,
    created_at: r.created_at,
  }));
});

export const getPredictabilityRuns = cache(async (tenantId = MOCK_TENANT_ID): Promise<PredictabilityRun[]> => {
  if (MOCK_MODE) return getStore().predictabilityRuns.filter((r) => r.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("predictability_runs")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? "",
    stage: r.stage as PredictabilityRun["stage"],
    summary: r.summary,
    items_scanned: r.items_scanned,
    signals_found: r.signals_found,
    actions_proposed: r.actions_proposed,
    forecast_data: (r.forecast_data ?? null) as PredictabilityRun["forecast_data"],
    created_at: r.created_at,
  }));
});

export const getAuditLog = cache(async (tenantId = MOCK_TENANT_ID): Promise<AuditEntry[]> => {
  return getStore().auditLog.filter((e) => e.tenant_id === tenantId);
});

export const getProfiles = cache(async (tenantId = MOCK_TENANT_ID): Promise<Profile[]> => {
  if (MOCK_MODE) {
    return getStore().profiles.filter(
      (p) => p.tenant_id === tenantId || p.tenant_id === null,
    );
  }
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("tenant_id", tenantId);
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    display_name: r.display_name,
    role: r.role as Profile["role"],
    default_site_id: r.default_site_id ?? null,
    job_title: r.job_title ?? null,
    department: r.department ?? null,
    active: r.active ?? true,
  }));
});

export const getRelianceInsights = cache(async (): Promise<RelianceInsight[]> => {
  return getStore().relianceInsights;
});

export const getWorkspaceTasks = cache(async (profileId: string, tenantId = MOCK_TENANT_ID): Promise<WorkspaceTask[]> => {
  if (MOCK_MODE) return getStore().workspaceTasks.filter((t) => t.profile_id === profileId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("workspace_tasks")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("profile_id", profileId)
    .order("due_date", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    profile_id: r.profile_id,
    title: r.title,
    type: r.type,
    due_date: r.due_date ?? null,
    priority: r.priority as WorkspaceTask["priority"],
    status: r.status as WorkspaceTask["status"],
    assigned_by: r.assigned_by ?? null,
    completed_by: r.completed_by ?? null,
    completed_at: r.completed_at ?? null,
    completion_notes: r.completion_notes ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

export const getDocumentAcknowledgments = cache(async (profileId: string, tenantId = MOCK_TENANT_ID): Promise<DocumentAcknowledgment[]> => {
  if (MOCK_MODE) return getStore().documentAcknowledgments.filter((a) => a.profile_id === profileId && a.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("document_acknowledgments")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("profile_id", profileId);
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id as string,
    tenant_id: r.tenant_id as string,
    document_id: r.document_id as string,
    profile_id: r.profile_id as string,
    acknowledged_at: r.acknowledged_at as string,
    created_at: r.created_at as string,
  }));
});

export async function currentUser(): Promise<Profile> {
  const sarah = getStore().profiles.find((p) => p.id === "p-sarah-chen-001");
  if (!sarah) throw new Error("Mock user not found");
  return sarah;
}

// ── Derived helpers ───────────────────────────────────────────────────────────

export async function overallComplianceScore(tenantId = MOCK_TENANT_ID): Promise<number> {
  const scores = await getComplianceScores(tenantId);
  if (scores.length === 0) return 0;
  const avg = scores.reduce((s, c) => s + c.percentage, 0) / scores.length;
  return Math.round(avg);
}

export async function latestPredictabilityRun(tenantId = MOCK_TENANT_ID): Promise<PredictabilityRun | null> {
  const runs = await getPredictabilityRuns(tenantId);
  if (runs.length === 0) return null;
  return [...runs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];
}

// ── By-ID lookups ─────────────────────────────────────────────────────────────
// These reuse the cached list functions, so they don't double-fetch within a render.

export async function getRiskById(id: string): Promise<RiskAssessment | null> {
  const all = await getRiskAssessments(await getEffectiveTenantId());
  return all.find((r) => r.id === id) ?? null;
}

export async function getWasteStreamById(id: string): Promise<WasteStream | null> {
  const all = await getWasteStreams(await getEffectiveTenantId());
  return all.find((w) => w.id === id) ?? null;
}

export async function getEquipmentById(id: string): Promise<Equipment | null> {
  const all = await getEquipment(await getEffectiveTenantId());
  return all.find((e) => e.id === id) ?? null;
}

export async function getIncidentById(id: string): Promise<Incident | null> {
  const all = await getIncidents(await getEffectiveTenantId());
  return all.find((i) => i.id === id) ?? null;
}

export async function getCapaById(id: string): Promise<CapaAction | null> {
  const all = await getCapaActions(await getEffectiveTenantId());
  return all.find((c) => c.id === id) ?? null;
}

export async function getAuditById(id: string): Promise<Audit | null> {
  const all = await getAudits(await getEffectiveTenantId());
  return all.find((a) => a.id === id) ?? null;
}

export async function getChemicalById(id: string): Promise<Chemical | null> {
  const all = await getChemicals(await getEffectiveTenantId());
  return all.find((c) => c.id === id) ?? null;
}

export async function getLegalById(id: string): Promise<LegalRequirement | null> {
  const all = await getLegalRequirements(await getEffectiveTenantId());
  return all.find((l) => l.id === id) ?? null;
}

export async function getTrainingRecordById(id: string): Promise<TrainingRecord | null> {
  const all = await getTrainingRecords(await getEffectiveTenantId());
  return all.find((r) => r.id === id) ?? null;
}

export async function getDocumentById(id: string): Promise<Document | null> {
  const all = await getDocuments(await getEffectiveTenantId());
  return all.find((d) => d.id === id) ?? null;
}

export async function getWorkstationById(id: string): Promise<ErgonomicsWorkstation | null> {
  const all = await getErgonomicsWorkstations(await getEffectiveTenantId());
  return all.find((w) => w.id === id) ?? null;
}

export async function getJobTaskById(id: string): Promise<ErgonomicsJobTask | null> {
  const all = await getErgonomicsJobTasks(await getEffectiveTenantId());
  return all.find((t) => t.id === id) ?? null;
}

export async function getBiosafetyLabById(id: string): Promise<BiosafetyLab | null> {
  const all = await getBiosafetyLabs(await getEffectiveTenantId());
  return all.find((l) => l.id === id) ?? null;
}

export async function getBiohazardAgentById(id: string): Promise<BiohazardAgent | null> {
  const all = await getBiohazardAgents(await getEffectiveTenantId());
  return all.find((a) => a.id === id) ?? null;
}

// ── Biosafety Labs ────────────────────────────────────────────────────────────

export const getBiosafetyLabs = cache(async (tenantId = MOCK_TENANT_ID): Promise<BiosafetyLab[]> => {
  if (MOCK_MODE) return getStore().biosafetyLabs;
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("biosafety_labs")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("lab_code", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    lab_code: r.lab_code,
    name: r.name,
    bsl_level: r.bsl_level,
    personnel_count: r.personnel_count,
    last_inspection: r.last_inspection ?? null,
    next_inspection: r.next_inspection ?? null,
    status: r.status as BiosafetyLab["status"],
    open_findings: r.open_findings,
    notes: r.notes ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

// ── Biohazard Agents ──────────────────────────────────────────────────────────

export const getBiohazardAgents = cache(async (tenantId = MOCK_TENANT_ID): Promise<BiohazardAgent[]> => {
  if (MOCK_MODE) return getStore().biohazardAgents;
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("biohazard_agents")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("agent_code", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    agent_code: r.agent_code,
    agent_name: r.agent_name,
    risk_class: r.risk_class,
    storage_location: r.storage_location,
    quantity: r.quantity,
    status: r.status as BiohazardAgent["status"],
    notes: r.notes ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

// ── Biosafety Incidents ───────────────────────────────────────────────────────

export const getBiosafetyIncidents = cache(async (tenantId = MOCK_TENANT_ID): Promise<Incident[]> => {
  if (MOCK_MODE) {
    // Return lab/bio-related incidents (chemical splashes, near-misses) as biosafety events
    return getStore().incidents.filter((i) =>
      i.incident_type === "near_miss" ||
      i.location?.toLowerCase().includes("lab") ||
      i.title?.toLowerCase().includes("spill") ||
      i.title?.toLowerCase().includes("exposure")
    );
  }
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("incidents")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("category", "biosafety")
    .order("occurred_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? MOCK_SITE_ID,
    title: r.title,
    description: r.description,
    incident_type: r.incident_type as Incident["incident_type"],
    severity: r.severity as Severity,
    status: r.status as Incident["status"],
    occurred_at: r.occurred_at,
    location: r.location,
    injured_party: r.injured_party ?? null,
    injuries_description: r.injuries_description ?? null,
    immediate_actions: r.immediate_actions ?? null,
    root_cause: r.root_cause ?? null,
    reported_by: r.reported_by ?? "",
    owner_id: r.owner_id ?? null,
    lost_time_days: r.lost_time_days ?? null,
    medical_treatment_required: r.medical_treatment_required ?? false,
    regulatory_reportable: r.regulatory_reportable ?? false,
    regulatory_report_date: r.regulatory_report_date ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

// ── Ergonomics ────────────────────────────────────────────────────────────────

export const getErgonomicsWorkstations = cache(async (tenantId = MOCK_TENANT_ID): Promise<ErgonomicsWorkstation[]> => {
  if (MOCK_MODE) return getStore().ergonomicsWorkstations.filter((w) => w.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("ergonomics_workstations")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("workstation_code", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    workstation_code: r.workstation_code,
    name: r.name,
    department: r.department,
    worker_count: r.worker_count,
    last_assessment: r.last_assessment ?? null,
    next_assessment: r.next_assessment ?? null,
    risk_level: r.risk_level as ErgonomicsWorkstation["risk_level"],
    status: r.status as ErgonomicsWorkstation["status"],
    open_findings: r.open_findings,
    primary_hazards: r.primary_hazards ?? [],
    notes: r.notes ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

export const getErgonomicsJobTasks = cache(async (tenantId = MOCK_TENANT_ID): Promise<ErgonomicsJobTask[]> => {
  if (MOCK_MODE) return getStore().ergonomicsJobTasks.filter((t) => t.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("ergonomics_job_tasks")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("task_code", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    task_code: r.task_code,
    task_title: r.task_title,
    department: r.department,
    hazard_type: r.hazard_type as ErgonomicsJobTask["hazard_type"],
    risk_score: r.risk_score,
    controls: r.controls ?? [],
    status: r.status as ErgonomicsJobTask["status"],
    notes: r.notes ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

export const getErgonomicsIncidents = cache(async (tenantId = MOCK_TENANT_ID): Promise<Incident[]> => {
  if (MOCK_MODE) {
    return getStore().incidents.filter((i) =>
      i.title?.toLowerCase().includes("strain") ||
      i.title?.toLowerCase().includes("sprain") ||
      i.title?.toLowerCase().includes("ergon") ||
      i.description?.toLowerCase().includes("repetitive") ||
      i.description?.toLowerCase().includes("manual handling")
    );
  }
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("incidents")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("category", "ergonomic")
    .order("occurred_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? MOCK_SITE_ID,
    title: r.title,
    description: r.description,
    incident_type: r.incident_type as Incident["incident_type"],
    severity: r.severity as Incident["severity"],
    status: r.status as Incident["status"],
    occurred_at: r.occurred_at,
    location: r.location,
    injured_party: r.injured_party ?? null,
    injuries_description: r.injuries_description ?? null,
    immediate_actions: r.immediate_actions ?? null,
    root_cause: r.root_cause ?? null,
    reported_by: r.reported_by,
    owner_id: r.owner_id ?? null,
    lost_time_days: r.lost_time_days ?? null,
    medical_treatment_required: r.medical_treatment_required ?? false,
    regulatory_reportable: r.regulatory_reportable ?? false,
    regulatory_report_date: r.regulatory_report_date ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

// ── Exposure Readings (industrial hygiene monitoring) ─────────────────────────

export const getExposureReadings = cache(async (tenantId = MOCK_TENANT_ID): Promise<ExposureReading[]> => {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("exposure_readings")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("reading_date", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    site_id: r.site_id ?? MOCK_SITE_ID,
    chemical: r.chemical ?? "",
    reading_type: r.reading_type ?? "TWA",
    value: Number(r.value) || 0,
    unit: r.unit ?? "ppm",
    location: r.location ?? "",
    reading_date: r.reading_date,
    monitor: r.monitor ?? "",
    created_at: r.created_at,
  }));
});

// ── OSHA Recordkeeping ────────────────────────────────────────────────────────

export const getOshaCases = cache(async (tenantId = MOCK_TENANT_ID): Promise<OshaCase[]> => {
  if (MOCK_MODE) return getStore().oshaStore.filter((c) => c.tenant_id === tenantId);
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("osha_cases")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("date", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id, tenant_id: r.tenant_id, caseNo: r.case_no, employee: r.employee,
    jobTitle: r.job_title, date: r.date, location: r.location, description: r.description,
    classification: r.classification as OshaCase["classification"],
    injuryType: r.injury_type as OshaCase["injuryType"],
    daysAway: r.days_away ?? 0, daysRestricted: r.days_restricted ?? 0,
    isPrivacy: r.is_privacy ?? false, isSevereInjury: r.is_severe_injury ?? false,
    howOccurred: r.how_occurred ?? "", equipment: r.equipment ?? "",
    physician: r.physician ?? "", medFacility: r.med_facility ?? "",
    treatmentER: r.treatment_er ?? false, treatmentHospitalized: r.treatment_hospitalized ?? false,
    capaId: r.capa_id ?? undefined, created_at: r.created_at,
  }));
});

// ── Re-exports ────────────────────────────────────────────────────────────────

export type {
  Chemical, LegalRequirement, Audit, AuditFinding, CapaAction,
  TrainingCourse, TrainingRecord, Document, WasteStream, Equipment,
  RiskAssessment, Incident, ComplianceScore, AiFinding,
  PredictabilityRun, AuditEntry, RelianceInsight, Profile,
};
