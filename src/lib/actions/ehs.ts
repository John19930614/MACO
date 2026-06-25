"use server";

import { revalidatePath } from "next/cache";
import { getStore, nextId } from "@/lib/data/store";
import { MOCK_TENANT_ID, MOCK_SITE_ID } from "@/lib/data/mock";
import { createSupabaseServerClient, DEMO_SARAH_ID } from "@/lib/supabase/server";
import { getServerTenantId, getServerProfileId } from "@/lib/auth/session";
import { MOCK_MODE, serverSecrets, hasLiveAi } from "@/lib/env";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { PROGRAM_DEFS, generateProgram, type SourceBlock } from "@/lib/ai/programBuilder";
import { KIND_DEFS, extractRows, type RowKind } from "@/lib/ai/extractDocuments";
import { generateStructuredJson } from "@/lib/ai/provider";
import type { Severity, IncidentType, CapaStatus, AuditStatus, DocumentStatus } from "@/lib/constants";
import { COMPLIANCE_STATUS_META, type ComplianceStatus, WASTE_CLASSIFICATIONS } from "@/lib/constants";
import type { CapaSourceType, AuditType, Incident, RiskAssessment, WasteStream, Equipment, LegalRequirement, TrainingRecord, OshaCase, AiFinding, Chemical, AiAnalysisOutput, BiosafetyLab, BiohazardAgent, ErgonomicsWorkstation, ErgonomicsJobTask } from "@/lib/types";
import { analyzeChemical, analyzeComplianceGap, analyzeTraining, buildPredictabilityForecast } from "@/lib/ai/engine";
import {
  getChemicals, getLegalRequirements, getTrainingRecords, getTrainingCourses, getCapaActions,
  getIncidents, getAudits, getRiskAssessments, getEquipment, getWasteStreams,
  getDocuments, getOshaCases, getBiosafetyLabs, getErgonomicsJobTasks, getProfiles,
} from "@/lib/data/ehsRepo";

// ── Session context helper ─────────────────────────────────────────────────────
// Returns the session-aware Supabase client, the user's real tenant_id, site_id,
// and profile_id. All live-mode actions use this so RLS is always respected.

async function getCtx() {
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const tenantId = await getServerTenantId();
  if (!tenantId) return null;
  const profileId = await getServerProfileId();
  const { data: profile } = await client
    .from("profiles")
    .select("default_site_id")
    .eq("id", profileId)
    .single();
  return { client, tenantId, siteId: profile?.default_site_id ?? null, profileId };
}

// ── CAPAs ─────────────────────────────────────────────────────────────────────

export async function addCapa(_prev: unknown, formData: FormData) {
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("capa_records").insert({
        tenant_id: ctx.tenantId,
        site_id: ctx.siteId,
        title: (formData.get("title") as string) || "Untitled CAPA",
        description: (formData.get("description") as string) || "",
        kind: (formData.get("kind") as string) || "corrective",
        source_type: "manual",
        severity: (formData.get("severity") as string) || "medium",
        status: "open",
        due_date: (formData.get("due_date") as string) || null,
        owner_id: null,
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const now = new Date().toISOString();
    store.capaActions.push({
      id: nextId("capa"),
      tenant_id: MOCK_TENANT_ID,
      site_id: MOCK_SITE_ID,
      title: (formData.get("title") as string) || "Untitled CAPA",
      description: (formData.get("description") as string) || "",
      kind: (formData.get("kind") as "corrective" | "preventive") ?? "corrective",
      source_type: "manual" as CapaSourceType,
      source_id: null,
      root_cause: null,
      severity: (formData.get("severity") as Severity) ?? "medium",
      owner_id: null,
      due_date: (formData.get("due_date") as string) || null,
      status: "open",
      verification_method: null,
      closed_at: null,
      closure_note: null,
      closed_with_evidence: false,
      created_at: now,
      updated_at: now,
    });
  }
  revalidatePath("/capa");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateCapa(id: string, formData: FormData) {
  const now = new Date().toISOString();
  const newStatus = (formData.get("status") as CapaStatus) || "open";
  const isClosing = newStatus === "closed";
  const closureNote = (formData.get("closure_note") as string) || null;
  const closedWithEvidence = formData.get("closed_with_evidence") === "true";
  const ownerId = (formData.get("owner_id") as string) || null;

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("capa_records").update({
        title:               (formData.get("title") as string) || "Untitled CAPA",
        description:         (formData.get("description") as string) || "",
        kind:                (formData.get("kind") as string) || "corrective",
        severity:            (formData.get("severity") as string) || "medium",
        status:              newStatus,
        owner_id:            ownerId,
        due_date:            (formData.get("due_date") as string) || null,
        root_cause:          (formData.get("root_cause") as string) || null,
        verification_method: (formData.get("verification_method") as string) || null,
        closure_note:        closureNote,
        closed_with_evidence: closedWithEvidence,
        closed_at:           isClosing ? now : null,
        updated_at:          now,
      }).eq("id", id).eq("tenant_id", ctx.tenantId);
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const idx = store.capaActions.findIndex((c) => c.id === id);
    if (idx !== -1) {
      const existing = store.capaActions[idx];
      store.capaActions[idx] = {
        ...existing,
        title:               (formData.get("title") as string) || existing.title,
        description:         (formData.get("description") as string) || "",
        kind:                (formData.get("kind") as "corrective" | "preventive") ?? existing.kind,
        severity:            (formData.get("severity") as Severity) ?? existing.severity,
        status:              newStatus,
        owner_id:            ownerId,
        due_date:            (formData.get("due_date") as string) || null,
        root_cause:          (formData.get("root_cause") as string) || null,
        verification_method: (formData.get("verification_method") as string) || null,
        closure_note:        closureNote,
        closed_with_evidence: closedWithEvidence,
        closed_at:           isClosing ? now : (existing.closed_at ?? null),
        updated_at:          now,
      };
    }
  }
  revalidatePath("/capa");
  revalidatePath(`/capa/${id}`);
  return { ok: true };
}

// ── Incidents ─────────────────────────────────────────────────────────────────

export async function addIncident(_prev: unknown, formData: FormData) {
  const now = new Date().toISOString();
  const occurredAt = (formData.get("occurred_at") as string) || now.slice(0, 10);

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("incidents").insert({
        tenant_id: ctx.tenantId,
        site_id: ctx.siteId,
        title: (formData.get("title") as string) || "Untitled Incident",
        description: (formData.get("description") as string) || "",
        incident_type: (formData.get("incident_type") as string) || "near_miss",
        severity: (formData.get("severity") as string) || "medium",
        status: "reported",
        occurred_at: new Date(occurredAt).toISOString(),
        location: (formData.get("location") as string) || "Main Site",
        reported_by: ctx.profileId,
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    store.incidents.push({
      id: nextId("inc"),
      tenant_id: MOCK_TENANT_ID,
      site_id: MOCK_SITE_ID,
      title: (formData.get("title") as string) || "Untitled Incident",
      description: (formData.get("description") as string) || "",
      incident_type: (formData.get("incident_type") as IncidentType) ?? "near_miss",
      severity: (formData.get("severity") as Severity) ?? "medium",
      occurred_at: new Date(occurredAt).toISOString(),
      location: (formData.get("location") as string) || "Main Site",
      injured_party: null,
      injuries_description: null,
      immediate_actions: (formData.get("immediate_actions") as string) || null,
      root_cause: null,
      reported_by: "Sarah Chen",
      owner_id: null,
      status: "reported",
      lost_time_days: null,
      medical_treatment_required: false,
      regulatory_reportable: false,
      regulatory_report_date: null,
      created_at: now,
      updated_at: now,
    });
  }
  revalidatePath("/incidents");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateIncident(id: string, formData: FormData) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("incidents").update({
        title:       (formData.get("title") as string) || "Untitled Incident",
        description: (formData.get("description") as string) || "",
        incident_type: (formData.get("incident_type") as string) || "near_miss",
        severity:    (formData.get("severity") as string) || "medium",
        status:      (formData.get("status") as string) || "reported",
        location:    (formData.get("location") as string) || "",
        immediate_actions: (formData.get("immediate_actions") as string) || null,
        root_cause:  (formData.get("root_cause") as string) || null,
        updated_at:  now,
      }).eq("id", id).eq("tenant_id", ctx.tenantId);
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const idx = store.incidents.findIndex((i) => i.id === id);
    if (idx !== -1) {
      store.incidents[idx] = {
        ...store.incidents[idx],
        title:       (formData.get("title") as string) || store.incidents[idx].title,
        description: (formData.get("description") as string) || "",
        incident_type: (formData.get("incident_type") as IncidentType) ?? store.incidents[idx].incident_type,
        severity:    (formData.get("severity") as Severity) ?? store.incidents[idx].severity,
        status:      (formData.get("status") as Incident["status"]) ?? store.incidents[idx].status,
        location:    (formData.get("location") as string) || "",
        immediate_actions: (formData.get("immediate_actions") as string) || null,
        root_cause:  (formData.get("root_cause") as string) || null,
        updated_at:  now,
      };
    }
  }
  revalidatePath("/incidents");
  revalidatePath(`/incidents/${id}`);
  return { ok: true };
}

// ── Chemicals ─────────────────────────────────────────────────────────────────

// Parse free-typed GHS hazard codes ("H225, H319 H350") into a clean H-code array.
// The platform stores H-codes in both ghs_classes and hazard_statements; the
// dashboard/PPE/training logic maps these codes to hazard classes.
function parseHazardCodes(raw: string | null): string[] {
  if (!raw) return [];
  return [...new Set(
    raw.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter((s) => /^H\d{3}/.test(s)),
  )];
}

export async function addChemical(_prev: unknown, formData: FormData) {
  const hazards     = parseHazardCodes(formData.get("hazard_codes") as string);
  const isScheduled = (formData.get("is_scheduled") as string) === "true";
  const scheduleRef = (formData.get("schedule_ref") as string)?.trim() || null;
  const sdsExpiry   = (formData.get("sds_expiry") as string) || null;
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("chemical_inventory").insert({
        tenant_id: ctx.tenantId,
        site_id: ctx.siteId,
        name: (formData.get("name") as string) || "Unnamed Chemical",
        cas_number: (formData.get("cas_number") as string) || null,
        ghs_classes: hazards as Chemical["ghs_classes"],
        hazard_statements: hazards,
        quantity: parseFloat(formData.get("quantity") as string) || 0,
        unit: (formData.get("unit") as string) || "L",
        storage_location: (formData.get("storage_location") as string) || "",
        supplier: (formData.get("supplier") as string) || null,
        sds_expiry: sdsExpiry,
        is_scheduled: isScheduled,
        schedule_ref: scheduleRef,
        created_by: ctx.profileId,
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const now = new Date().toISOString();
    store.chemicals.push({
      id: nextId("chem"),
      tenant_id: MOCK_TENANT_ID,
      site_id: MOCK_SITE_ID,
      name: (formData.get("name") as string) || "Unnamed Chemical",
      cas_number: (formData.get("cas_number") as string) || null,
      un_number: null,
      chemical_formula: null,
      ghs_classes: hazards as Chemical["ghs_classes"],
      quantity: parseFloat(formData.get("quantity") as string) || 0,
      unit: (formData.get("unit") as string) || "L",
      storage_location: (formData.get("storage_location") as string) || "",
      sds_url: null,
      sds_expiry: sdsExpiry,
      hazard_statements: hazards,
      precautionary_statements: [],
      is_scheduled: isScheduled,
      schedule_ref: scheduleRef,
      supplier: (formData.get("supplier") as string) || null,
      date_received: null,
      status: "active" as const,
      owner_id: null,
      created_by: DEMO_SARAH_ID,
      created_at: now,
      updated_at: now,
    });
  }
  revalidatePath("/chemicals");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateChemical(id: string, formData: FormData) {
  const now = new Date().toISOString();
  // Hazard fields are optional on edit — only overwrite when the form supplied them.
  const hasHazards  = formData.has("hazard_codes");
  const hazards     = parseHazardCodes(formData.get("hazard_codes") as string);
  const isScheduled = (formData.get("is_scheduled") as string) === "true";
  const scheduleRef = (formData.get("schedule_ref") as string)?.trim() || null;
  const sdsExpiry   = (formData.get("sds_expiry") as string) || null;
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      await ctx.client.from("chemical_inventory").update({
        name:             (formData.get("name") as string) || "Unnamed Chemical",
        cas_number:       (formData.get("cas_number") as string) || null,
        quantity:         parseFloat(formData.get("quantity") as string) || 0,
        unit:             (formData.get("unit") as string) || "L",
        storage_location: (formData.get("storage_location") as string) || "",
        supplier:         (formData.get("supplier") as string) || null,
        ...(hasHazards ? {
          ghs_classes:       hazards as Chemical["ghs_classes"],
          hazard_statements: hazards,
          is_scheduled:      isScheduled,
          schedule_ref:      scheduleRef,
          sds_expiry:        sdsExpiry,
        } : {}),
        updated_at:       now,
      }).eq("id", id).eq("tenant_id", ctx.tenantId);
    }
  } else {
    const store = getStore();
    const idx = store.chemicals.findIndex((c) => c.id === id);
    if (idx !== -1) {
      store.chemicals[idx] = {
        ...store.chemicals[idx],
        name:             (formData.get("name") as string) || store.chemicals[idx].name,
        cas_number:       (formData.get("cas_number") as string) || null,
        quantity:         parseFloat(formData.get("quantity") as string) || 0,
        unit:             (formData.get("unit") as string) || "L",
        storage_location: (formData.get("storage_location") as string) || "",
        supplier:         (formData.get("supplier") as string) || null,
        ...(hasHazards ? {
          ghs_classes:       hazards as Chemical["ghs_classes"],
          hazard_statements: hazards,
          is_scheduled:      isScheduled,
          schedule_ref:      scheduleRef,
          sds_expiry:        sdsExpiry,
        } : {}),
        updated_at:       now,
      };
    }
  }
  revalidatePath("/chemicals");
  revalidatePath(`/chemicals/${id}`);
  return { ok: true };
}

// ── Audits ────────────────────────────────────────────────────────────────────

export async function addAudit(_prev: unknown, formData: FormData) {
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("audits").insert({
        tenant_id: ctx.tenantId,
        site_id: ctx.siteId,
        title: (formData.get("title") as string) || "Untitled Audit",
        type: (formData.get("type") as string) || "internal",
        scheduled_date: (formData.get("scheduled_date") as string) || new Date().toISOString().slice(0, 10),
        status: "scheduled",
        lead_auditor_id: null,
        scope: (formData.get("scope") as string) || "",
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const now = new Date().toISOString();
    store.audits.push({
      id: nextId("aud"),
      tenant_id: MOCK_TENANT_ID,
      site_id: MOCK_SITE_ID,
      title: (formData.get("title") as string) || "Untitled Audit",
      type: (formData.get("type") as AuditType) ?? "internal",
      scheduled_date: (formData.get("scheduled_date") as string) || now.slice(0, 10),
      completed_date: null,
      status: "scheduled",
      lead_auditor_id: null,
      scope: (formData.get("scope") as string) || "",
      notes: null,
      created_at: now,
      updated_at: now,
    });
  }
  revalidatePath("/audits");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateAudit(id: string, formData: FormData) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("audits").update({
        title:          (formData.get("title") as string) || "Untitled Audit",
        type:           (formData.get("type") as string) || "internal",
        scheduled_date: (formData.get("scheduled_date") as string) || null,
        status:         (formData.get("status") as string) || "scheduled",
        scope:          (formData.get("scope") as string) || null,
        notes:          (formData.get("notes") as string) || null,
        updated_at:     now,
      }).eq("id", id).eq("tenant_id", ctx.tenantId);
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const idx = store.audits.findIndex((a) => a.id === id);
    if (idx !== -1) {
      store.audits[idx] = {
        ...store.audits[idx],
        title:          (formData.get("title") as string) || store.audits[idx].title,
        type:           (formData.get("type") as AuditType) ?? store.audits[idx].type,
        scheduled_date: (formData.get("scheduled_date") as string) || store.audits[idx].scheduled_date,
        status:         (formData.get("status") as AuditStatus) ?? store.audits[idx].status,
        scope:          (formData.get("scope") as string) || null,
        notes:          (formData.get("notes") as string) || null,
        updated_at:     now,
      };
    }
  }
  revalidatePath("/audits");
  revalidatePath(`/audits/${id}`);
  return { ok: true };
}

export async function submitAuditConduct(
  id: string,
  data: {
    conductorName: string;
    conductDate: string;
    score: number | null;
    notes: string;
    itemSummary: string;
  },
) {
  const now = new Date().toISOString();
  const notesJson = JSON.stringify({
    conductedBy: data.conductorName,
    conductedDate: data.conductDate,
    score: data.score,
    overallNotes: data.notes,
    items: JSON.parse(data.itemSummary || "[]"),
    submittedAt: now,
  });

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("audits").update({
        status:         "completed",
        completed_date: data.conductDate || now.slice(0, 10),
        notes:          notesJson,
        updated_at:     now,
      }).eq("id", id).eq("tenant_id", ctx.tenantId);
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const idx = store.audits.findIndex((a) => a.id === id);
    if (idx !== -1) {
      store.audits[idx] = {
        ...store.audits[idx],
        status:         "completed" as AuditStatus,
        completed_date: data.conductDate || now.slice(0, 10),
        notes:          notesJson,
        updated_at:     now,
      };
    }
  }
  revalidatePath("/audits");
  revalidatePath(`/audits/${id}`);
  return { ok: true };
}

// ── Risk Assessments ──────────────────────────────────────────────────────────

function riskLevel(score: number): string {
  if (score >= 20) return "extreme";
  if (score >= 15) return "high";
  if (score >= 10) return "medium";
  if (score >= 5)  return "low";
  return "negligible";
}

export async function addRisk(_prev: unknown, formData: FormData) {
  const now = new Date().toISOString();
  const likelihood  = parseInt(formData.get("likelihood_score") as string) || 1;
  const consequence = parseInt(formData.get("consequence_score") as string) || 1;
  const score = likelihood * consequence;
  const level = riskLevel(score);

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("risk_assessments").insert({
        tenant_id: ctx.tenantId,
        site_id:   ctx.siteId,
        title:       (formData.get("title") as string) || "Untitled Risk",
        description: (formData.get("description") as string) || "",
        category:    (formData.get("category") as string) || "physical",
        activity:    (formData.get("activity") as string) || "",
        hazards:     [],
        existing_controls: [],
        likelihood_score:  likelihood,
        consequence_score: consequence,
        risk_score:  score,
        risk_level:  level,
        additional_controls: [],
        review_date: (formData.get("review_date") as string) || now.slice(0, 10),
        status: "active",
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    store.riskAssessments.push({
      id: nextId("risk"),
      tenant_id: MOCK_TENANT_ID,
      site_id:   MOCK_SITE_ID,
      title:       (formData.get("title") as string) || "Untitled Risk",
      description: (formData.get("description") as string) || "",
      category:    (formData.get("category") as string) || "physical",
      activity:    (formData.get("activity") as string) || "",
      hazards:     [],
      existing_controls: [],
      likelihood_score:  likelihood,
      consequence_score: consequence,
      risk_score:  score,
      risk_level:  level as RiskAssessment["risk_level"],
      additional_controls: [],
      residual_likelihood:   null,
      residual_consequence:  null,
      residual_risk_score:   null,
      residual_risk_level:   null,
      owner_id:    null,
      review_date: (formData.get("review_date") as string) || now.slice(0, 10),
      status:      "active",
      created_at:  now,
      updated_at:  now,
    });
  }
  revalidatePath("/risk");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateRisk(id: string, formData: FormData) {
  const now = new Date().toISOString();
  const likelihood  = parseInt(formData.get("likelihood_score") as string) || 1;
  const consequence = parseInt(formData.get("consequence_score") as string) || 1;
  const score = likelihood * consequence;
  const level = riskLevel(score);

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("risk_assessments").update({
        title:       (formData.get("title") as string) || "Untitled Risk",
        description: (formData.get("description") as string) || "",
        category:    (formData.get("category") as string) || "physical",
        activity:    (formData.get("activity") as string) || "",
        likelihood_score:  likelihood,
        consequence_score: consequence,
        risk_score:  score,
        risk_level:  level,
        status:      (formData.get("status") as string) || "active",
        review_date: (formData.get("review_date") as string) || null,
        updated_at:  now,
      }).eq("id", id).eq("tenant_id", ctx.tenantId);
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const idx = store.riskAssessments.findIndex((r) => r.id === id);
    if (idx !== -1) {
      store.riskAssessments[idx] = {
        ...store.riskAssessments[idx],
        title:       (formData.get("title") as string) || store.riskAssessments[idx].title,
        description: (formData.get("description") as string) || "",
        category:    (formData.get("category") as string) || store.riskAssessments[idx].category,
        activity:    (formData.get("activity") as string) || store.riskAssessments[idx].activity,
        likelihood_score:  likelihood,
        consequence_score: consequence,
        risk_score:  score,
        risk_level:  level as RiskAssessment["risk_level"],
        status:      (formData.get("status") as RiskAssessment["status"]) || "active",
        review_date: (formData.get("review_date") as string) || store.riskAssessments[idx].review_date,
        updated_at:  now,
      };
    }
  }
  revalidatePath("/risk");
  revalidatePath(`/risk/${id}`);
  return { ok: true };
}

// ── Waste Streams ─────────────────────────────────────────────────────────────

export async function addWasteStream(_prev: unknown, formData: FormData) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("waste_streams").insert({
        tenant_id:           ctx.tenantId,
        site_id:             ctx.siteId,
        waste_name:          (formData.get("waste_name") as string) || "Unnamed Waste",
        waste_code:          (formData.get("waste_code") as string) || null,
        classification:      (formData.get("classification") as string) || "hazardous",
        quantity:            parseFloat(formData.get("quantity") as string) || 0,
        unit:                (formData.get("unit") as string) || "kg",
        disposal_method:     (formData.get("disposal_method") as string) || "incineration",
        disposal_contractor: (formData.get("disposal_contractor") as string) || null,
        status:              "pending",
        created_by:          ctx.profileId,
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    store.wasteStreams.push({
      id: nextId("ws"),
      tenant_id:           MOCK_TENANT_ID,
      site_id:             MOCK_SITE_ID,
      waste_name:          (formData.get("waste_name") as string) || "Unnamed Waste",
      waste_code:          (formData.get("waste_code") as string) || null,
      classification:      (formData.get("classification") as WasteStream["classification"]) || "hazardous",
      quantity:            parseFloat(formData.get("quantity") as string) || 0,
      unit:                (formData.get("unit") as string) || "kg",
      disposal_method:     (formData.get("disposal_method") as string) || "incineration",
      disposal_contractor: (formData.get("disposal_contractor") as string) || null,
      manifest_number:     null,
      disposal_date:       null,
      regulatory_limit:    null,
      regulatory_unit:     null,
      status:              "pending",
      created_by:          "Sarah Chen",
      created_at:          now,
    });
  }
  revalidatePath("/waste");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateWasteStream(id: string, formData: FormData) {
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("waste_streams").update({
        waste_name:          (formData.get("waste_name") as string) || "Unnamed Waste",
        waste_code:          (formData.get("waste_code") as string) || null,
        classification:      (formData.get("classification") as string) || "hazardous",
        quantity:            parseFloat(formData.get("quantity") as string) || 0,
        unit:                (formData.get("unit") as string) || "kg",
        disposal_method:     (formData.get("disposal_method") as string) || "incineration",
        disposal_contractor: (formData.get("disposal_contractor") as string) || null,
        status:              (formData.get("status") as string) || "pending",
        manifest_number:     (formData.get("manifest_number") as string) || null,
        disposal_date:       (formData.get("disposal_date") as string) || null,
      }).eq("id", id).eq("tenant_id", ctx.tenantId);
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const idx = store.wasteStreams.findIndex((w) => w.id === id);
    if (idx !== -1) {
      store.wasteStreams[idx] = {
        ...store.wasteStreams[idx],
        waste_name:          (formData.get("waste_name") as string) || store.wasteStreams[idx].waste_name,
        waste_code:          (formData.get("waste_code") as string) || null,
        classification:      (formData.get("classification") as WasteStream["classification"]) || "hazardous",
        quantity:            parseFloat(formData.get("quantity") as string) || 0,
        unit:                (formData.get("unit") as string) || "kg",
        disposal_method:     (formData.get("disposal_method") as string) || "incineration",
        disposal_contractor: (formData.get("disposal_contractor") as string) || null,
        status:              (formData.get("status") as WasteStream["status"]) || "pending",
        manifest_number:     (formData.get("manifest_number") as string) || null,
        disposal_date:       (formData.get("disposal_date") as string) || null,
      };
    }
  }
  revalidatePath("/waste");
  revalidatePath(`/waste/${id}`);
  return { ok: true };
}

// ── Equipment ─────────────────────────────────────────────────────────────────

export async function addEquipment(_prev: unknown, formData: FormData) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("equipment").insert({
        tenant_id:                ctx.tenantId,
        site_id:                  ctx.siteId,
        name:                     (formData.get("name") as string) || "Unnamed Equipment",
        type:                     (formData.get("type") as string) || "other",
        serial_number:            (formData.get("serial_number") as string) || null,
        location:                 (formData.get("location") as string) || "",
        next_calibration_date:    (formData.get("next_calibration_date") as string) || null,
        next_inspection_date:     (formData.get("next_inspection_date") as string) || null,
        calibration_interval_days: parseInt(formData.get("calibration_interval_days") as string) || null,
        status: "operational",
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    store.equipment.push({
      id: nextId("eqp"),
      tenant_id:                MOCK_TENANT_ID,
      site_id:                  MOCK_SITE_ID,
      name:                     (formData.get("name") as string) || "Unnamed Equipment",
      type:                     (formData.get("type") as string) || "other",
      serial_number:            (formData.get("serial_number") as string) || null,
      location:                 (formData.get("location") as string) || "",
      last_calibration_date:    null,
      next_calibration_date:    (formData.get("next_calibration_date") as string) || null,
      last_inspection_date:     null,
      next_inspection_date:     (formData.get("next_inspection_date") as string) || null,
      calibration_interval_days: parseInt(formData.get("calibration_interval_days") as string) || null,
      status:                   "operational" as Equipment["status"],
      regulatory_ref:           null,
      notes:                    null,
      created_at:               now,
      updated_at:               now,
    });
  }
  revalidatePath("/monitoring");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateEquipment(id: string, formData: FormData) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("equipment").update({
        name:                     (formData.get("name") as string) || "Unnamed Equipment",
        type:                     (formData.get("type") as string) || "other",
        serial_number:            (formData.get("serial_number") as string) || null,
        location:                 (formData.get("location") as string) || "",
        next_calibration_date:    (formData.get("next_calibration_date") as string) || null,
        next_inspection_date:     (formData.get("next_inspection_date") as string) || null,
        last_calibration_date:    (formData.get("last_calibration_date") as string) || null,
        calibration_interval_days: parseInt(formData.get("calibration_interval_days") as string) || null,
        status:                   (formData.get("status") as string) || "operational",
        notes:                    (formData.get("notes") as string) || null,
        updated_at:               now,
      }).eq("id", id).eq("tenant_id", ctx.tenantId);
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const idx = store.equipment.findIndex((e) => e.id === id);
    if (idx !== -1) {
      store.equipment[idx] = {
        ...store.equipment[idx],
        name:                     (formData.get("name") as string) || store.equipment[idx].name,
        type:                     (formData.get("type") as string) || store.equipment[idx].type,
        serial_number:            (formData.get("serial_number") as string) || null,
        location:                 (formData.get("location") as string) || store.equipment[idx].location,
        next_calibration_date:    (formData.get("next_calibration_date") as string) || null,
        next_inspection_date:     (formData.get("next_inspection_date") as string) || null,
        last_calibration_date:    (formData.get("last_calibration_date") as string) || null,
        calibration_interval_days: parseInt(formData.get("calibration_interval_days") as string) || null,
        status:                   (formData.get("status") as Equipment["status"]) || "operational",
        notes:                    (formData.get("notes") as string) || null,
        updated_at:               now,
      };
    }
  }
  revalidatePath("/monitoring");
  revalidatePath(`/monitoring/${id}`);
  return { ok: true };
}

// ── Legal Requirements ────────────────────────────────────────────────────────

export async function addLegalRequirement(_prev: unknown, formData: FormData) {
  const now = new Date().toISOString();
  const nextReview = (formData.get("next_review_date") as string) || now.slice(0, 10);
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("legal_requirements").insert({
        tenant_id:             ctx.tenantId,
        regulation_ref:        (formData.get("regulation_ref") as string) || "",
        title:                 (formData.get("title") as string) || "Untitled Requirement",
        description:           (formData.get("description") as string) || "",
        jurisdiction:          (formData.get("jurisdiction") as string) || "",
        category:              (formData.get("category") as string) || "general",
        applicable_sectors:    [],
        review_frequency_days: 365,
        next_review_date:      nextReview,
        status:                (formData.get("status") as string) || "not_assessed",
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    store.legalRequirements.push({
      id:                    nextId("leg"),
      tenant_id:             MOCK_TENANT_ID,
      site_id:               null,
      regulation_ref:        (formData.get("regulation_ref") as string) || "",
      title:                 (formData.get("title") as string) || "Untitled Requirement",
      description:           (formData.get("description") as string) || "",
      jurisdiction:          (formData.get("jurisdiction") as string) || "",
      category:              (formData.get("category") as string) || "general",
      applicable_sectors:    [],
      review_frequency_days: 365,
      next_review_date:      nextReview,
      status:                ((formData.get("status") as string) || "not_assessed") as LegalRequirement["status"],
      compliance_notes:      null,
      evidence_url:          null,
      owner_id:              null,
      created_at:            now,
      updated_at:            now,
    });
  }
  revalidatePath("/legal");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateLegalRequirement(id: string, formData: FormData) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("legal_requirements").update({
        regulation_ref:   (formData.get("regulation_ref") as string) || "",
        title:            (formData.get("title") as string) || "Untitled Requirement",
        description:      (formData.get("description") as string) || "",
        jurisdiction:     (formData.get("jurisdiction") as string) || "",
        category:         (formData.get("category") as string) || "general",
        next_review_date: (formData.get("next_review_date") as string) || null,
        status:           (formData.get("status") as string) || "not_assessed",
        compliance_notes: (formData.get("compliance_notes") as string) || null,
        evidence_url:     (formData.get("evidence_url") as string) || null,
        updated_at:       now,
      }).eq("id", id).eq("tenant_id", ctx.tenantId);
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const idx = store.legalRequirements.findIndex((l) => l.id === id);
    if (idx !== -1) {
      store.legalRequirements[idx] = {
        ...store.legalRequirements[idx],
        regulation_ref:   (formData.get("regulation_ref") as string) || store.legalRequirements[idx].regulation_ref,
        title:            (formData.get("title") as string) || store.legalRequirements[idx].title,
        description:      (formData.get("description") as string) || "",
        jurisdiction:     (formData.get("jurisdiction") as string) || store.legalRequirements[idx].jurisdiction,
        category:         (formData.get("category") as string) || store.legalRequirements[idx].category,
        next_review_date: (formData.get("next_review_date") as string) || store.legalRequirements[idx].next_review_date,
        status:           ((formData.get("status") as string) || "not_assessed") as LegalRequirement["status"],
        compliance_notes: (formData.get("compliance_notes") as string) || null,
        evidence_url:     (formData.get("evidence_url") as string) || null,
        updated_at:       now,
      };
    }
  }
  revalidatePath("/legal");
  revalidatePath(`/legal/${id}`);
  return { ok: true };
}

// ── Training Records ──────────────────────────────────────────────────────────

// Compute a cert expiry date = completed_date + the course's validity window.
function computeExpiry(completedDate: string, validityDays: number | null | undefined): string | null {
  if (!validityDays) return null;
  const d = new Date(completedDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + validityDays);
  return d.toISOString().slice(0, 10);
}

export async function addTrainingRecord(_prev: unknown, formData: FormData) {
  const now = new Date().toISOString();
  const scoreRaw = formData.get("score") as string;
  const score = scoreRaw ? parseInt(scoreRaw) : null;
  const passed = (formData.get("passed") as string) !== "false";
  const courseId = (formData.get("course_id") as string) || "";
  const completedDate = (formData.get("completed_date") as string) || now.slice(0, 10);
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      // Derive cert expiry from the course's validity period so renewal alerts work.
      let expiry: string | null = null;
      if (courseId) {
        const { data: course } = await ctx.client
          .from("training_courses")
          .select("validity_period_days")
          .eq("id", courseId)
          .single();
        expiry = computeExpiry(completedDate, course?.validity_period_days);
      }
      const { error } = await ctx.client.from("training_records").insert({
        tenant_id:       ctx.tenantId,
        site_id:         ctx.siteId,
        profile_id:      (formData.get("profile_id") as string) || ctx.profileId,
        course_id:       courseId,
        completed_date:  completedDate,
        expiry_date:     expiry,
        delivery_method: (formData.get("delivery_method") as string) || "classroom",
        score,
        passed,
        notes:           (formData.get("notes") as string) || null,
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const course = store.trainingCourses.find((c) => c.id === courseId);
    store.trainingRecords.push({
      id:              nextId("tr"),
      tenant_id:       MOCK_TENANT_ID,
      site_id:         MOCK_SITE_ID,
      profile_id:      (formData.get("profile_id") as string) || "",
      course_id:       courseId,
      completed_date:  completedDate,
      expiry_date:     computeExpiry(completedDate, course?.validity_period_days),
      score,
      passed,
      delivery_method: ((formData.get("delivery_method") as string) || "classroom") as TrainingRecord["delivery_method"],
      instructor_id:   null,
      notes:           (formData.get("notes") as string) || null,
      created_at:      now,
    });
  }
  revalidatePath("/training");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateTrainingRecord(id: string, formData: FormData) {
  const now = new Date().toISOString();
  const scoreRaw = formData.get("score") as string;
  const score = scoreRaw ? parseInt(scoreRaw) : null;
  const passed = (formData.get("passed") as string) !== "false";
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("training_records").update({
        profile_id:      (formData.get("profile_id") as string) || ctx.profileId,
        course_id:       (formData.get("course_id") as string) || "",
        completed_date:  (formData.get("completed_date") as string) || now.slice(0, 10),
        expiry_date:     (formData.get("expiry_date") as string) || null,
        delivery_method: (formData.get("delivery_method") as string) || "classroom",
        score,
        passed,
        notes:           (formData.get("notes") as string) || null,
      }).eq("id", id).eq("tenant_id", ctx.tenantId);
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const idx = store.trainingRecords.findIndex((r) => r.id === id);
    if (idx !== -1) {
      store.trainingRecords[idx] = {
        ...store.trainingRecords[idx],
        profile_id:      (formData.get("profile_id") as string) || store.trainingRecords[idx].profile_id,
        course_id:       (formData.get("course_id") as string) || store.trainingRecords[idx].course_id,
        completed_date:  (formData.get("completed_date") as string) || store.trainingRecords[idx].completed_date,
        expiry_date:     (formData.get("expiry_date") as string) || null,
        delivery_method: ((formData.get("delivery_method") as string) || "classroom") as TrainingRecord["delivery_method"],
        score,
        passed,
        notes:           (formData.get("notes") as string) || null,
      };
    }
  }
  revalidatePath("/training");
  revalidatePath(`/training/${id}`);
  return { ok: true };
}

export async function addTrainingCourse(_prev: unknown, formData: FormData) {
  const now            = new Date().toISOString();
  const title          = (formData.get("title") as string)?.trim() || "Untitled Course";
  const description    = (formData.get("description") as string)?.trim() || "";
  const courseType     = (formData.get("course_type") as string) || "general";
  const durationRaw    = formData.get("duration_minutes") as string;
  const duration       = durationRaw ? parseInt(durationRaw) : 60;
  const validityRaw    = formData.get("validity_period_days") as string;
  const validity       = validityRaw ? parseInt(validityRaw) : null;
  const regulatoryRef  = (formData.get("regulatory_ref") as string)?.trim() || null;

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("training_courses").insert({
        tenant_id:            ctx.tenantId,
        title,
        description,
        course_type:          courseType,
        duration_minutes:     duration,
        pass_score:           80,
        validity_period_days: validity,
        required_roles:       [],
        regulatory_ref:       regulatoryRef,
        active:               true,
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    store.trainingCourses.push({
      id:                   nextId("course"),
      tenant_id:            MOCK_TENANT_ID,
      title,
      description,
      course_type:          courseType,
      duration_minutes:     duration,
      pass_score:           80,
      validity_period_days: validity,
      required_roles:       [],
      regulatory_ref:       regulatoryRef,
      active:               true,
      created_at:           now,
    });
  }
  revalidatePath("/training");
  return { ok: true };
}

// ── Documents ─────────────────────────────────────────────────────────────────

// Parse a JSON-encoded document body (array of {heading, body}) from a form field.
function parseDocContent(raw: string | null): { heading: string; body: string }[] {
  if (!raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
}

export async function addDocument(_prev: unknown, formData: FormData) {
  const now = new Date().toISOString();
  const ackRequired = (formData.get("acknowledgment_required") as string) === "true";
  const content = parseDocContent(formData.get("content") as string);
  const regulationRef = (formData.get("regulation_ref") as string) || null;
  const generated = (formData.get("generated") as string) === "true";
  const sourcePaths = parseDocContent(formData.get("source_doc_paths") as string) as unknown as string[];
  const ownerId = (formData.get("owner_id") as string) || null;
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("documents").insert({
        tenant_id:               ctx.tenantId,
        title:                   (formData.get("title") as string) || "Untitled Document",
        category:                (formData.get("category") as string) || "sop",
        version:                 (formData.get("version") as string) || "1.0",
        storage_path:            "",
        effective_date:          (formData.get("effective_date") as string) || now.slice(0, 10),
        review_date:             (formData.get("review_date") as string) || now.slice(0, 10),
        status:                  (formData.get("status") as string) || "draft",
        acknowledgment_required: ackRequired,
        regulation_ref:          regulationRef,
        content,
        generated,
        source_doc_paths:        Array.isArray(sourcePaths) ? sourcePaths : [],
        owner_id:                ownerId,
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    store.documents.push({
      id:                      nextId("doc"),
      tenant_id:               MOCK_TENANT_ID,
      site_id:                 null,
      title:                   (formData.get("title") as string) || "Untitled Document",
      category:                (formData.get("category") as string) || "sop",
      version:                 (formData.get("version") as string) || "1.0",
      storage_path:            "",
      effective_date:          (formData.get("effective_date") as string) || now.slice(0, 10),
      review_date:             (formData.get("review_date") as string) || now.slice(0, 10),
      status:                  ((formData.get("status") as string) || "draft") as DocumentStatus,
      owner_id:                ownerId,
      acknowledgment_required: ackRequired,
      regulation_ref:          regulationRef,
      content,
      generated,
      source_doc_paths:        Array.isArray(sourcePaths) ? sourcePaths : [],
      created_at:              now,
      updated_at:              now,
    });
  }
  revalidatePath("/documents");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateDocument(id: string, formData: FormData) {
  const now = new Date().toISOString();
  const ackRequired = (formData.get("acknowledgment_required") as string) === "true";
  const hasContent = formData.has("content");
  const content = parseDocContent(formData.get("content") as string);
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("documents").update({
        title:                   (formData.get("title") as string) || "Untitled Document",
        category:                (formData.get("category") as string) || "sop",
        version:                 (formData.get("version") as string) || "1.0",
        effective_date:          (formData.get("effective_date") as string) || null,
        review_date:             (formData.get("review_date") as string) || null,
        status:                  (formData.get("status") as string) || "draft",
        acknowledgment_required: ackRequired,
        ...(hasContent ? { content } : {}),
        updated_at:              now,
      }).eq("id", id).eq("tenant_id", ctx.tenantId);
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const idx = store.documents.findIndex((d) => d.id === id);
    if (idx !== -1) {
      store.documents[idx] = {
        ...store.documents[idx],
        title:                   (formData.get("title") as string) || store.documents[idx].title,
        category:                (formData.get("category") as string) || store.documents[idx].category,
        version:                 (formData.get("version") as string) || store.documents[idx].version,
        effective_date:          (formData.get("effective_date") as string) || store.documents[idx].effective_date,
        review_date:             (formData.get("review_date") as string) || store.documents[idx].review_date,
        status:                  ((formData.get("status") as string) || "draft") as DocumentStatus,
        acknowledgment_required: ackRequired,
        ...(hasContent ? { content } : {}),
        updated_at:              now,
      };
    }
  }
  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return { ok: true };
}

// ── Workspace Tasks ───────────────────────────────────────────────────────────

export async function addWorkspaceTask(_prev: unknown, formData: FormData) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const profileId = (formData.get("profile_id") as string) || ctx.profileId;
      const { error } = await ctx.client.from("workspace_tasks").insert({
        tenant_id:  ctx.tenantId,
        profile_id: profileId,
        title:      (formData.get("title") as string) || "Untitled Task",
        type:       (formData.get("type") as string) || "General",
        due_date:   (formData.get("due_date") as string) || null,
        priority:   (formData.get("priority") as string) || "medium",
        status:     "pending",
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const profileId = (formData.get("profile_id") as string) || DEMO_SARAH_ID;
    const store = getStore();
    store.workspaceTasks.push({
      id:               nextId("task"),
      tenant_id:        MOCK_TENANT_ID,
      profile_id:       profileId,
      title:            (formData.get("title") as string) || "Untitled Task",
      type:             (formData.get("type") as string) || "General",
      due_date:         (formData.get("due_date") as string) || null,
      priority:         ((formData.get("priority") as string) || "medium") as "high" | "medium" | "low",
      status:           "pending",
      assigned_by:      null,
      completed_by:     null,
      completed_at:     null,
      completion_notes: null,
      created_at:       now,
      updated_at:       now,
    });
  }
  revalidatePath("/workspace");
  return { ok: true };
}

export async function completeWorkspaceTask(
  id: string,
  completedBy: string,
  completionNotes: string,
) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("workspace_tasks")
        .update({
          status:           "done",
          completed_by:     completedBy,
          completed_at:     now,
          completion_notes: completionNotes.trim() || null,
          updated_at:       now,
        })
        .eq("id", id)
        .eq("tenant_id", ctx.tenantId);
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const idx = store.workspaceTasks.findIndex((t) => t.id === id);
    if (idx !== -1) {
      store.workspaceTasks[idx] = {
        ...store.workspaceTasks[idx],
        status:           "done",
        completed_by:     completedBy,
        completed_at:     now,
        completion_notes: completionNotes.trim() || null,
        updated_at:       now,
      };
    }
  }
  revalidatePath("/workspace");
  return { ok: true };
}

// ── SDS / Evidence URLs ───────────────────────────────────────────────────────

export async function updateSdsUrl(chemicalId: string, sdsUrl: string, sdsExpiry: string | null) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client
        .from("chemical_inventory")
        .update({ sds_url: sdsUrl.trim() || null, sds_expiry: sdsExpiry || null, updated_at: now })
        .eq("id", chemicalId)
        .eq("tenant_id", ctx.tenantId);
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const idx = store.chemicals.findIndex((c) => c.id === chemicalId);
    if (idx !== -1) {
      store.chemicals[idx] = {
        ...store.chemicals[idx],
        sds_url:    sdsUrl.trim() || null,
        sds_expiry: sdsExpiry || null,
        updated_at: now,
      };
    }
  }
  revalidatePath("/chemicals");
  revalidatePath(`/chemicals/${chemicalId}`);
  return { ok: true };
}

export async function updateLegalEvidence(requirementId: string, evidenceUrl: string) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client
        .from("legal_requirements")
        .update({ evidence_url: evidenceUrl.trim() || null, updated_at: now })
        .eq("id", requirementId)
        .eq("tenant_id", ctx.tenantId);
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const idx = store.legalRequirements.findIndex((l) => l.id === requirementId);
    if (idx !== -1) {
      store.legalRequirements[idx] = {
        ...store.legalRequirements[idx],
        evidence_url: evidenceUrl.trim() || null,
        updated_at:   now,
      };
    }
  }
  revalidatePath("/legal");
  revalidatePath(`/legal/${requirementId}`);
  return { ok: true };
}

// ── CAPA from incident / finding ──────────────────────────────────────────────

export async function addCapaFromIncident(incidentId: string, formData: FormData) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error: insertError } = await ctx.client.from("capa_records").insert({
        tenant_id:   ctx.tenantId,
        site_id:     ctx.siteId,
        title:       (formData.get("title") as string) || "Untitled CAPA",
        description: (formData.get("description") as string) || "",
        kind:        (formData.get("kind") as string) || "corrective",
        source_type: "incident",
        source_id:   incidentId,
        severity:    (formData.get("severity") as string) || "medium",
        status:      "open",
        due_date:    (formData.get("due_date") as string) || null,
        owner_id:    null,
      });
      if (insertError) return { ok: false, error: insertError.message };
      const { error: updateError } = await ctx.client.from("incidents")
        .update({ status: "capa_open", updated_at: now })
        .eq("id", incidentId)
        .eq("tenant_id", ctx.tenantId);
      if (updateError) return { ok: false, error: updateError.message };
    }
  } else {
    const store = getStore();
    store.capaActions.push({
      id: nextId("capa"),
      tenant_id:   MOCK_TENANT_ID,
      site_id:     MOCK_SITE_ID,
      title:       (formData.get("title") as string) || "Untitled CAPA",
      description: (formData.get("description") as string) || "",
      kind:        (formData.get("kind") as "corrective" | "preventive") ?? "corrective",
      source_type: "incident" as CapaSourceType,
      source_id:   incidentId,
      root_cause:  null,
      severity:    (formData.get("severity") as Severity) ?? "medium",
      owner_id:    null,
      due_date:    (formData.get("due_date") as string) || null,
      status:      "open",
      verification_method: null,
      closed_at:   null,
      closure_note: null,
      closed_with_evidence: false,
      created_at:  now,
      updated_at:  now,
    });
    const idx = store.incidents.findIndex((i) => i.id === incidentId);
    if (idx !== -1) {
      store.incidents[idx] = { ...store.incidents[idx], status: "capa_open", updated_at: now };
    }
  }
  revalidatePath("/capa");
  revalidatePath("/incidents");
  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addCapaFromFinding(findingTitle: string, findingDescription: string, formData: FormData) {
  const now = new Date().toISOString();
  const title       = (formData.get("title") as string) || findingTitle || "Untitled CAPA";
  const description = (formData.get("description") as string) || findingDescription || "";
  const severity    = (formData.get("severity") as Severity) ?? "medium";
  const root_cause  = (formData.get("root_cause") as string) || null;
  const source_id   = (formData.get("source_id") as string) || null;
  const verification_method = (formData.get("verification_method") as string) || null;
  const due_date    = (formData.get("due_date") as string) || null;

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("capa_records").insert({
        tenant_id:   ctx.tenantId,
        site_id:     ctx.siteId,
        title, description, kind: "corrective",
        source_type: "audit_finding",
        source_id, severity, root_cause, status: "open",
        due_date, owner_id: null, verification_method,
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    store.capaActions.push({
      id: nextId("capa"),
      tenant_id:   MOCK_TENANT_ID,
      site_id:     MOCK_SITE_ID,
      title, description,
      kind:        "corrective",
      source_type: "audit_finding" as CapaSourceType,
      source_id,
      root_cause,
      severity,
      owner_id:    null,
      due_date,
      status:      "open",
      verification_method,
      closed_at:   null,
      closure_note: null,
      closed_with_evidence: false,
      created_at:  now,
      updated_at:  now,
    });
  }
  revalidatePath("/capa");
  revalidatePath("/audits");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ── Document Acknowledgment ───────────────────────────────────────────────────

export async function acknowledgeDocument(documentId: string, profileId: string) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("document_acknowledgments").insert({
        tenant_id:       ctx.tenantId,
        document_id:     documentId,
        profile_id:      profileId || ctx.profileId,
        acknowledged_at: now,
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    store.documentAcknowledgments.push({
      id:              nextId("dack"),
      tenant_id:       MOCK_TENANT_ID,
      document_id:     documentId,
      profile_id:      profileId,
      acknowledged_at: now,
      created_at:      now,
    });
  }
  revalidatePath("/workspace");
  return { ok: true };
}

// ── Biosafety ─────────────────────────────────────────────────────────────────

export async function createBiosafetyLab(_prev: unknown, formData: FormData) {
  const now       = new Date().toISOString();
  const name      = (formData.get("name") as string)?.trim() || "Unnamed Lab";
  const bslLevel  = (formData.get("bsl_level") as string) || "BSL-1";
  const personnel = parseInt(formData.get("personnel_count") as string) || 0;
  const nextInsp  = (formData.get("next_inspection") as string) || null;

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { count } = await ctx.client
        .from("biosafety_labs")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", ctx.tenantId);
      const labCode = `LAB-${String((count ?? 0) + 1).padStart(3, "0")}`;
      const { error } = await ctx.client.from("biosafety_labs").insert({
        tenant_id: ctx.tenantId, lab_code: labCode, name, bsl_level: bslLevel,
        personnel_count: personnel, next_inspection: nextInsp, status: "compliant", open_findings: 0,
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const labNum = store.biosafetyLabs.length + 1;
    store.biosafetyLabs.push({
      id: nextId("lab"), tenant_id: MOCK_TENANT_ID,
      lab_code: `LAB-${String(labNum).padStart(3, "0")}`,
      name, bsl_level: bslLevel, personnel_count: personnel,
      last_inspection: null, next_inspection: nextInsp,
      status: "compliant", open_findings: 0, notes: null,
      created_at: now, updated_at: now,
    });
  }
  revalidatePath("/biosafety");
  return { ok: true };
}

export async function createBiohazardAgent(_prev: unknown, formData: FormData) {
  const now        = new Date().toISOString();
  const agentName  = (formData.get("agent_name") as string)?.trim() || "Unnamed Agent";
  const riskClass  = (formData.get("risk_class") as string) || "Risk Group 1";
  const storageLoc = (formData.get("storage_location") as string)?.trim() || "To be assigned";
  const quantity   = (formData.get("quantity") as string)?.trim() || "0 units";

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { count } = await ctx.client
        .from("biohazard_agents")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", ctx.tenantId);
      const agentCode = `AGT-${String((count ?? 0) + 1).padStart(3, "0")}`;
      const { error } = await ctx.client.from("biohazard_agents").insert({
        tenant_id: ctx.tenantId, agent_code: agentCode, agent_name: agentName,
        risk_class: riskClass, storage_location: storageLoc, quantity, status: "registered",
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const agentNum = store.biohazardAgents.length + 1;
    store.biohazardAgents.push({
      id: nextId("agent"), tenant_id: MOCK_TENANT_ID,
      agent_code: `AGT-${String(agentNum).padStart(3, "0")}`,
      agent_name: agentName, risk_class: riskClass,
      storage_location: storageLoc, quantity, status: "registered",
      notes: null, created_at: now, updated_at: now,
    });
  }
  revalidatePath("/biosafety");
  return { ok: true };
}

// ── OSHA Recordkeeping ────────────────────────────────────────────────────────

export async function addOshaCaseToStore(_prev: unknown, fd: FormData) {
  const raw = fd.get("case");
  if (!raw) return { ok: false, error: "Missing case data" };
  let c: OshaCase;
  try {
    c = JSON.parse(raw as string) as OshaCase;
  } catch {
    return { ok: false, error: "Invalid case data" };
  }

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    // Use the authenticated tenant_id (never the client-supplied one); let the
    // DB generate id + created_at. capa_id is omitted — new cases have no linked
    // CAPA yet and client ids may not be valid UUIDs.
    const { error } = await ctx.client.from("osha_cases").insert({
      tenant_id:              ctx.tenantId,
      case_no:                c.caseNo,
      employee:               c.employee,
      job_title:              c.jobTitle ?? "",
      date:                   c.date,
      location:               c.location ?? "",
      description:            c.description ?? "",
      classification:         c.classification,
      injury_type:            c.injuryType,
      days_away:              c.daysAway ?? 0,
      days_restricted:        c.daysRestricted ?? 0,
      is_privacy:             c.isPrivacy ?? false,
      is_severe_injury:       c.isSevereInjury ?? false,
      how_occurred:           c.howOccurred ?? "",
      equipment:              c.equipment ?? "",
      physician:              c.physician ?? "",
      med_facility:           c.medFacility ?? "",
      treatment_er:           c.treatmentER ?? false,
      treatment_hospitalized: c.treatmentHospitalized ?? false,
    });
    if (error) return { ok: false, error: error.message };
  } else {
    getStore().oshaStore.push(c);
  }
  revalidatePath("/osha");
  return { ok: true };
}

// ── P-Engine predictability scan ──────────────────────────────────────────────
// Reads the tenant's live EHS data, computes per-module compliance scores,
// generates AI findings (via the engine — heuristic when no AI key), builds a
// predictability forecast, and persists everything. Replaces the old cosmetic
// "Run Scan" button so the AI/compliance layer is real for live tenants.

function clampPct(n: number): number { return Math.max(0, Math.min(100, Math.round(n))); }
function pctStatus(p: number): ComplianceStatus {
  return p >= 80 ? "compliant" : p >= 65 ? "minor_gap" : "major_gap";
}

export async function runPredictabilityScan() {
  if (MOCK_MODE) { revalidatePath("/ai"); revalidatePath("/dashboard"); return { ok: true, mock: true }; }

  const ctx = await getCtx();
  if (!ctx) return { ok: false, error: "Session expired — please reload." };
  const { tenantId, siteId } = ctx;
  const now = new Date();

  const [chemicals, legal, records, capas, incidents, audits, risks, equipment, waste, documents, oshaCases, bioLabs, ergoTasks, courses, profiles] =
    await Promise.all([
      getChemicals(tenantId), getLegalRequirements(tenantId), getTrainingRecords(tenantId),
      getCapaActions(tenantId), getIncidents(tenantId), getAudits(tenantId),
      getRiskAssessments(tenantId), getEquipment(tenantId), getWasteStreams(tenantId),
      getDocuments(tenantId), getOshaCases(tenantId), getBiosafetyLabs(tenantId), getErgonomicsJobTasks(tenantId),
      getTrainingCourses(tenantId), getProfiles(tenantId),
    ]);

  // ── Per-module compliance scores (derived from real data) ──
  const sdsOk = chemicals.filter((c) => c.sds_expiry && new Date(c.sds_expiry) > now).length;
  const chemPct = chemicals.length ? clampPct((100 * sdsOk) / chemicals.length) : 100;

  const assessed = legal.filter((l) => l.status !== "not_applicable");
  const legalPct = assessed.length
    ? clampPct(assessed.reduce((s, l) => s + (COMPLIANCE_STATUS_META[l.status]?.score ?? 0), 0) / assessed.length)
    : 50;

  const passedRecs = records.filter((r) => r.passed);
  const currentRecs = passedRecs.filter((r) => !r.expiry_date || new Date(r.expiry_date) > now);
  const expiredCerts = passedRecs.length - currentRecs.length;
  const trainingPct = passedRecs.length ? clampPct((100 * currentRecs.length) / passedRecs.length) : 50;

  const capaClosed = capas.filter((c) => c.status === "closed").length;
  const capaInProg = capas.filter((c) => c.status === "in_progress").length;
  const capaOverdue = capas.filter((c) => c.status === "overdue" || ((c.status === "open" || c.status === "in_progress") && c.due_date != null && new Date(c.due_date) < now)).length;
  const capaPct = capas.length ? clampPct((100 * (capaClosed + 0.5 * capaInProg)) / capas.length - capaOverdue * 5) : 100;

  const auditScores = audits
    .filter((a) => a.status === "completed")
    .map((a) => { try { return JSON.parse(a.notes ?? "{}").score as number; } catch { return null; } })
    .filter((n): n is number => typeof n === "number");
  const auditPct = audits.length ? (auditScores.length ? clampPct(auditScores.reduce((s, n) => s + n, 0) / auditScores.length) : 50) : 100;

  const openHighInc = incidents.filter((i) => (i.severity === "high" || i.severity === "critical") && i.status !== "closed").length;
  const incPct = clampPct(100 - openHighInc * 15 - oshaCases.length * 5);

  const overdueReviews = risks.filter((r) => r.review_date && new Date(r.review_date) < now).length;
  const extremeRisks = risks.filter((r) => r.risk_level === "extreme" || r.risk_level === "high").length;
  const riskPct = risks.length ? clampPct(100 - overdueReviews * 10 - extremeRisks * 5) : 100;

  const wastePct = waste.length ? 75 : 100;

  const equipOverdue = equipment.filter((e) =>
    (e.next_calibration_date && new Date(e.next_calibration_date) < now) ||
    (e.next_inspection_date && new Date(e.next_inspection_date) < now)).length;
  const equipPct = equipment.length ? clampPct((100 * (equipment.length - equipOverdue)) / equipment.length) : 100;

  const docPct = documents.length ? clampPct(50 + documents.length * 3) : 40;
  const bioPct = bioLabs.length ? 70 : 100;
  const oshaPct = oshaCases.length ? clampPct(100 - oshaCases.length * 8) : 100;
  const ergoPct = ergoTasks.length ? 75 : 100;

  const moduleScores: Record<string, number> = {
    chemical: chemPct, legal: legalPct, training: trainingPct, capa: capaPct,
    audits: auditPct, incidents: incPct, risk: riskPct, waste: wastePct,
    equipment: equipPct, documents: docPct, biosafety: bioPct,
    osha: oshaPct, ergonomics: ergoPct,
  };

  const scoreRows = Object.entries(moduleScores).map(([module, pct]) => ({
    tenant_id: tenantId, site_id: siteId, module, score: pct, max_score: 100,
    percentage: pct, status: pctStatus(pct), calculated_at: now.toISOString(),
    details: { source: "p-engine-scan" },
  }));

  // ── AI findings: worst-offender chemicals + legal requirements ──
  const topChems = [...chemicals]
    .sort((a, b) =>
      (b.ghs_classes.length + (b.is_scheduled ? 5 : 0)) - (a.ghs_classes.length + (a.is_scheduled ? 5 : 0)))
    .slice(0, 4);
  const worstLegal = legal
    .filter((l) => l.status === "non_compliant" || l.status === "major_gap" || l.status === "minor_gap")
    .slice(0, 3);

  const findings: AiFinding[] = [];
  for (const c of topChems) {
    if (c.ghs_classes.length === 0 && !c.is_scheduled) continue;
    try { findings.push(await analyzeChemical(c)); } catch { /* skip */ }
  }
  for (const l of worstLegal) {
    try { findings.push(await analyzeComplianceGap(l)); } catch { /* skip */ }
  }
  // Training gap analysis — one tenant-level finding over role-based coverage.
  if (courses.length > 0 && profiles.length > 0) {
    try {
      findings.push(await analyzeTraining({ tenant_id: tenantId, site_id: siteId, courses, records, profiles, now: now.getTime() }));
    } catch { /* skip */ }
  }

  const actionsProposed = findings.reduce((s, f) => s + ((f.output as AiAnalysisOutput)?.recommended_actions?.length ?? 0), 0);

  const forecast = buildPredictabilityForecast({
    complianceScores: moduleScores,
    overdueCapaCount: capaOverdue,
    overdueTrainingCount: expiredCerts,
    expiringSdsCount: chemicals.filter((c) => c.sds_expiry && new Date(c.sds_expiry) <= now).length,
    openIncidentCount: incidents.filter((i) => i.status !== "closed").length,
  });

  const itemsScanned = chemicals.length + legal.length + records.length + capas.length +
    incidents.length + audits.length + risks.length + equipment.length + waste.length +
    documents.length + oshaCases.length + bioLabs.length;

  // ── Persist: recompute scores, refresh pending findings, log the run ──
  await ctx.client.from("compliance_scores").delete().eq("tenant_id", tenantId);
  if (scoreRows.length) {
    const { error } = await ctx.client.from("compliance_scores").insert(scoreRows);
    if (error) return { ok: false, error: error.message };
  }

  // Keep human-reviewed findings; replace the pending (machine-proposed) set.
  await ctx.client.from("ehs_ai_findings").delete().eq("tenant_id", tenantId).eq("review_status", "pending");
  if (findings.length) {
    const { error } = await ctx.client.from("ehs_ai_findings").insert(findings.map((f) => ({
      tenant_id: tenantId, site_id: siteId, cell_id: null, job: f.job,
      source_type: f.source_type, source_id: f.source_id, model: f.model,
      prompt_version: f.prompt_version, input_summary: f.input_summary, output: f.output,
      confidence: f.confidence, review_status: "pending", human_review_required: f.human_review_required,
    })));
    if (error) return { ok: false, error: error.message };
  }

  const { error: runError } = await ctx.client.from("predictability_runs").insert({
    tenant_id: tenantId, site_id: siteId, stage: "forecast",
    summary: `P-Engine scanned ${itemsScanned} EHS records across ${scoreRows.length} modules. Compliance trend: ${forecast.compliance_trend}; 30-day projection ${forecast.predicted_compliance_score_30d}%. Top risk modules: ${forecast.top_risk_modules.join(", ")}. ${findings.length} findings raised, ${actionsProposed} actions proposed.`,
    items_scanned: itemsScanned, signals_found: findings.length, actions_proposed: actionsProposed,
    forecast_data: forecast,
  });
  if (runError) return { ok: false, error: runError.message };

  revalidatePath("/ai");
  revalidatePath("/dashboard");
  return { ok: true, scanned: itemsScanned, findings: findings.length, modules: scoreRows.length };
}

// ── AI Program Builder ────────────────────────────────────────────────────────
// Reads the company's uploaded manuals/SOPs + live data and authors a required
// EHS program/SOP as a real, editable document (draft), linked to the regulation
// it satisfies. Surfaces wherever the platform references that document.
export async function buildProgramFromDocs(programKey: string) {
  if (MOCK_MODE) return { ok: false as const, error: "Program builder runs in live mode only." };
  const ctx = await getCtx();
  if (!ctx) return { ok: false as const, error: "Session expired — please reload." };
  const def = PROGRAM_DEFS.find((d) => d.key === programKey);
  if (!def) return { ok: false as const, error: "Unknown program." };
  const { tenantId, client } = ctx;

  // Company / site / EHS lead context
  const { data: tenantRow } = await client.from("tenants").select("name").eq("id", tenantId).single();
  const company = (tenantRow?.name as string) || "Your Company";
  const { data: siteRow } = await client.from("sites").select("name, address").eq("tenant_id", tenantId).limit(1).maybeSingle();
  const site = siteRow?.name ? (siteRow.address ? `${siteRow.name}, ${siteRow.address}` : (siteRow.name as string)) : "Main Site";
  const { data: profs } = await client.from("profiles").select("display_name, job_title, role").eq("tenant_id", tenantId);
  const lead = (profs ?? []).find((p) => p.role === "ehs_manager") ?? (profs ?? [])[0];
  const cho = lead ? `${lead.display_name}${lead.job_title ? `, ${lead.job_title}` : ""}` : "EHS Manager";

  const [chemicals, biosafetyLabs, wasteStreams] = await Promise.all([
    getChemicals(tenantId), getBiosafetyLabs(tenantId), getWasteStreams(tenantId),
  ]);
  void biosafetyLabs; void wasteStreams; // included in ctx for future program types

  // Best-effort: pull the company's uploaded safety manuals + SOPs to ground the AI.
  const sources: SourceBlock[] = [];
  const sourcePaths: string[] = [];
  const { serviceRoleKey } = serverSecrets();
  if (serviceRoleKey) {
    const svc = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, { auth: { persistSession: false } });
    for (const cat of ["safety_manual", "sop"]) {
      const { data: list } = await svc.storage.from("client-documents").list(`${tenantId}/${cat}`);
      for (const f of (list ?? []).slice(0, 3)) {
        const p = `${tenantId}/${cat}/${f.name}`;
        try {
          const { data: blob } = await svc.storage.from("client-documents").download(p);
          if (!blob) continue;
          if (f.name.toLowerCase().endsWith(".pdf")) {
            sources.push({ name: f.name, base64: Buffer.from(await blob.arrayBuffer()).toString("base64"), mimeType: "application/pdf" });
          } else {
            sources.push({ name: f.name, text: await blob.text() });
          }
          sourcePaths.push(p);
        } catch { /* skip unreadable file */ }
      }
    }
  }

  const sections = await generateProgram(def, { company, site, cho }, chemicals, sources);

  const today = new Date().toISOString().slice(0, 10);
  const review = new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 10);
  const { error } = await client.from("documents").insert({
    tenant_id: tenantId, title: def.title, category: def.category, version: "1.0",
    storage_path: "", effective_date: today, review_date: review, status: "draft",
    acknowledgment_required: true, regulation_ref: def.regulation,
    content: sections, generated: true, source_doc_paths: sourcePaths, owner_id: ctx.profileId,
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/documents");
  revalidatePath("/legal");
  return { ok: true as const, title: def.title, sections: sections.length, grounded: sourcePaths.length };
}

// ── Ongoing Document Import → staging review queue ─────────────────────────────
// Extracts rows from uploaded files into a staging queue (NOT live tables).
// Each row is dedup-checked against existing records; a human accepts/rejects.

interface StagedRow {
  id: string; row_kind: string; candidate: Record<string, unknown>; label: string;
  source_name: string | null; status: string; dedup_of: string | null; dedup_note: string | null; created_at: string;
}

export async function getStagedRows(): Promise<StagedRow[]> {
  if (MOCK_MODE) return [];
  const ctx = await getCtx();
  if (!ctx) return [];
  const { data } = await ctx.client
    .from("document_staged_rows")
    .select("id, row_kind, candidate, label, source_name, status, dedup_of, dedup_note, created_at")
    .eq("tenant_id", ctx.tenantId).eq("status", "staged")
    .order("created_at", { ascending: false });
  return (data as StagedRow[] | null) ?? [];
}

export async function stageDocumentImport(kind: RowKind, files: { name: string; path: string }[]) {
  if (MOCK_MODE) return { ok: false as const, error: "Import runs in live mode only." };
  const ctx = await getCtx();
  if (!ctx) return { ok: false as const, error: "Session expired — please reload." };
  const def = KIND_DEFS[kind];
  if (!def) return { ok: false as const, error: "Unknown document type." };
  const { serviceRoleKey } = serverSecrets();
  if (!serviceRoleKey) return { ok: false as const, error: "Import needs the service-role key configured." };
  const svc = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, { auth: { persistSession: false } });

  // SECURITY: service-role download bypasses Storage RLS — reject any path that
  // isn't under the caller's own tenant prefix.
  if (files.some((f) => !f?.path || !f.path.startsWith(`${ctx.tenantId}/`))) {
    return { ok: false as const, error: "Invalid file path." };
  }

  // Existing live records → dedup keys
  const existing = kind === "chemical" ? await getChemicals(ctx.tenantId)
    : kind === "waste" ? await getWasteStreams(ctx.tenantId)
    : kind === "legal" ? await getLegalRequirements(ctx.tenantId)
    : kind === "training" ? await getTrainingCourses(ctx.tenantId)
    : kind === "incident" ? await getIncidents(ctx.tenantId)
    : await getEquipment(ctx.tenantId);
  const existingKeys = new Map(existing.map((e) => [def.dedupKey(e as unknown as Record<string, unknown>), e.id]));

  const staged: Record<string, unknown>[] = [];
  let emptyFiles = 0;
  for (const f of files) {
    let source: SourceBlock | null = null;
    try {
      const { data: blob } = await svc.storage.from("client-documents").download(f.path);
      if (blob) {
        if (f.name.toLowerCase().endsWith(".pdf")) source = { name: f.name, base64: Buffer.from(await blob.arrayBuffer()).toString("base64"), mimeType: "application/pdf" };
        else source = { name: f.name, text: await blob.text() };
      }
    } catch { /* unreadable */ }
    if (!source) { emptyFiles++; continue; }
    const rows = await extractRows(kind, [source]);
    if (rows.length === 0) { emptyFiles++; continue; }
    for (const r of rows) {
      const dup = existingKeys.get(def.dedupKey(r)) ?? null;
      staged.push({
        tenant_id: ctx.tenantId, site_id: ctx.siteId, row_kind: kind, candidate: r, label: def.label(r),
        source_name: f.name, source_path: f.path, status: "staged",
        dedup_of: dup, dedup_note: dup ? "Matches an existing record — review before accepting" : null,
      });
    }
  }
  if (staged.length === 0) {
    return { ok: true as const, staged: 0, dupes: 0, note: emptyFiles > 0 ? "No rows extracted — files had no readable content." : "No rows found." };
  }
  const { error } = await ctx.client.from("document_staged_rows").insert(staged);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/documents/import");
  return { ok: true as const, staged: staged.length, dupes: staged.filter((s) => s.dedup_of).length };
}

export async function approveStagedRow(id: string, editedJson?: string) {
  if (MOCK_MODE) return { ok: false as const, error: "Live mode only." };
  const ctx = await getCtx();
  if (!ctx) return { ok: false as const, error: "Session expired — please reload." };
  const { data: row } = await ctx.client.from("document_staged_rows").select("*").eq("id", id).eq("tenant_id", ctx.tenantId).single();
  if (!row) return { ok: false as const, error: "Row not found." };
  if (row.status !== "staged") return { ok: false as const, error: "Already reviewed." };
  const def = KIND_DEFS[row.row_kind as RowKind];
  if (!def) return { ok: false as const, error: "Unknown document type." };
  // Use the user's inline edits if provided; persist them on the staged row too.
  let candidate = row.candidate as Record<string, unknown>;
  if (editedJson) {
    try {
      const edited = JSON.parse(editedJson);
      if (edited && typeof edited === "object") {
        candidate = edited as Record<string, unknown>;
        await ctx.client.from("document_staged_rows").update({ candidate, label: def.label(candidate) }).eq("id", id).eq("tenant_id", ctx.tenantId);
      }
    } catch { /* ignore bad edits, use original */ }
  }
  const live = def.toLive(candidate, { tenantId: ctx.tenantId, siteId: ctx.siteId, createdBy: ctx.profileId });
  const { error } = await ctx.client.from(def.table).insert(live);
  if (error) return { ok: false as const, error: error.message };
  await ctx.client.from("document_staged_rows").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", id).eq("tenant_id", ctx.tenantId);
  revalidatePath("/documents/import");
  revalidatePath("/chemicals"); revalidatePath("/waste"); revalidatePath("/legal"); revalidatePath("/dashboard");
  return { ok: true as const };
}

// ── Exposure Readings (industrial hygiene monitoring) ─────────────────────────

export async function addExposureReading(_prev: unknown, formData: FormData) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("exposure_readings").insert({
        tenant_id:    ctx.tenantId,
        site_id:      ctx.siteId,
        chemical:     (formData.get("chemical") as string) || "",
        reading_type: (formData.get("reading_type") as string) || "TWA",
        value:        Number(formData.get("value")) || 0,
        unit:         (formData.get("unit") as string) || "ppm",
        location:     (formData.get("location") as string) || "",
        reading_date: (formData.get("reading_date") as string) || now.slice(0, 10),
        monitor:      (formData.get("monitor") as string) || "",
        created_by:   ctx.profileId,
      });
      if (error) return { ok: false, error: error.message };
    }
  }
  // Mock mode: no in-memory exposure store — accept and revalidate.
  revalidatePath("/monitoring");
  return { ok: true };
}

// ── Biosafety edits ───────────────────────────────────────────────────────────
// Update the same columns createBiosafetyLab/createBiohazardAgent set, EXCEPT
// the *_code identifiers (those are assigned once on creation).

export async function updateBiosafetyLab(id: string, formData: FormData) {
  const now       = new Date().toISOString();
  const name      = (formData.get("name") as string)?.trim() || "Unnamed Lab";
  const bslLevel  = (formData.get("bsl_level") as string) || "BSL-1";
  const personnel = parseInt(formData.get("personnel_count") as string) || 0;
  const nextInsp  = (formData.get("next_inspection") as string) || null;
  const status    = (formData.get("status") as string) || "compliant";
  const openFindingsRaw = formData.get("open_findings") as string;

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("biosafety_labs").update({
        name, bsl_level: bslLevel, personnel_count: personnel,
        next_inspection: nextInsp, status,
        ...(openFindingsRaw != null ? { open_findings: parseInt(openFindingsRaw) || 0 } : {}),
        updated_at: now,
      }).eq("id", id).eq("tenant_id", ctx.tenantId);
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const idx = store.biosafetyLabs.findIndex((l) => l.id === id);
    if (idx !== -1) {
      store.biosafetyLabs[idx] = {
        ...store.biosafetyLabs[idx],
        name, bsl_level: bslLevel, personnel_count: personnel,
        next_inspection: nextInsp,
        status: status as BiosafetyLab["status"],
        ...(openFindingsRaw != null ? { open_findings: parseInt(openFindingsRaw) || 0 } : {}),
        updated_at: now,
      };
    }
  }
  revalidatePath("/biosafety");
  return { ok: true };
}

export async function updateBiohazardAgent(id: string, formData: FormData) {
  const now        = new Date().toISOString();
  const agentName  = (formData.get("agent_name") as string)?.trim() || "Unnamed Agent";
  const riskClass  = (formData.get("risk_class") as string) || "Risk Group 1";
  const storageLoc = (formData.get("storage_location") as string)?.trim() || "To be assigned";
  const quantity   = (formData.get("quantity") as string)?.trim() || "0 units";
  const status     = (formData.get("status") as string) || "registered";

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { error } = await ctx.client.from("biohazard_agents").update({
        agent_name: agentName, risk_class: riskClass,
        storage_location: storageLoc, quantity, status,
        updated_at: now,
      }).eq("id", id).eq("tenant_id", ctx.tenantId);
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const idx = store.biohazardAgents.findIndex((a) => a.id === id);
    if (idx !== -1) {
      store.biohazardAgents[idx] = {
        ...store.biohazardAgents[idx],
        agent_name: agentName, risk_class: riskClass,
        storage_location: storageLoc, quantity,
        status: status as BiohazardAgent["status"],
        updated_at: now,
      };
    }
  }
  revalidatePath("/biosafety");
  return { ok: true };
}

// ── Ergonomics ────────────────────────────────────────────────────────────────

export async function addErgonomicsWorkstation(_prev: unknown, formData: FormData) {
  const now         = new Date().toISOString();
  const name        = (formData.get("name") as string)?.trim() || "Unnamed Workstation";
  const department  = (formData.get("department") as string)?.trim() || "";
  const workerCount = parseInt(formData.get("worker_count") as string) || 0;
  const nextAssess  = (formData.get("next_assessment") as string) || null;
  const riskLevel   = (formData.get("risk_level") as string) || "low";
  const status      = (formData.get("status") as string) || "assessment_due";
  const primaryHazards = (formData.get("primary_hazards") as string)?.split(/[,;]+/).map((h) => h.trim()).filter(Boolean) ?? [];

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { count } = await ctx.client
        .from("ergonomics_workstations")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", ctx.tenantId);
      const code = `WS-${String((count ?? 0) + 1).padStart(3, "0")}`;
      const { error } = await ctx.client.from("ergonomics_workstations").insert({
        tenant_id: ctx.tenantId, workstation_code: code, name, department,
        worker_count: workerCount, next_assessment: nextAssess,
        risk_level: riskLevel, status, primary_hazards: primaryHazards, open_findings: 0,
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const num = store.ergonomicsWorkstations.length + 1;
    store.ergonomicsWorkstations.push({
      id: nextId("ws"), tenant_id: MOCK_TENANT_ID,
      workstation_code: `WS-${String(num).padStart(3, "0")}`,
      name, department, worker_count: workerCount,
      last_assessment: null, next_assessment: nextAssess,
      risk_level: riskLevel as ErgonomicsWorkstation["risk_level"],
      status: status as ErgonomicsWorkstation["status"],
      open_findings: 0, primary_hazards: primaryHazards, notes: null,
      created_at: now, updated_at: now,
    });
  }
  revalidatePath("/ergonomics");
  return { ok: true };
}

export async function addErgonomicsJobTask(_prev: unknown, formData: FormData) {
  const now        = new Date().toISOString();
  const taskTitle  = (formData.get("task_title") as string)?.trim() || "Unnamed Task";
  const department = (formData.get("department") as string)?.trim() || "";
  const hazardType = (formData.get("hazard_type") as string) || "repetitive_motion";
  const riskScore  = parseInt(formData.get("risk_score") as string) || 0;
  const status     = (formData.get("status") as string) || "review_required";
  const controls   = (formData.get("controls") as string)?.split(/[,;]+/).map((c) => c.trim()).filter(Boolean) ?? [];

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { count } = await ctx.client
        .from("ergonomics_job_tasks")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", ctx.tenantId);
      const code = `JT-${String((count ?? 0) + 1).padStart(3, "0")}`;
      const { error } = await ctx.client.from("ergonomics_job_tasks").insert({
        tenant_id: ctx.tenantId, task_code: code, task_title: taskTitle, department,
        hazard_type: hazardType, risk_score: riskScore, controls, status,
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const num = store.ergonomicsJobTasks.length + 1;
    store.ergonomicsJobTasks.push({
      id: nextId("jt"), tenant_id: MOCK_TENANT_ID,
      task_code: `JT-${String(num).padStart(3, "0")}`,
      task_title: taskTitle, department,
      hazard_type: hazardType as ErgonomicsJobTask["hazard_type"],
      risk_score: riskScore, controls,
      status: status as ErgonomicsJobTask["status"],
      notes: null, created_at: now, updated_at: now,
    });
  }
  revalidatePath("/ergonomics");
  return { ok: true };
}

// Persist a screening result as an ergonomics_job_task row (risk-score driven).
export async function saveErgonomicScreening(_prev: unknown, formData: FormData) {
  const now        = new Date().toISOString();
  const taskTitle  = (formData.get("task_title") as string)?.trim()
    || (formData.get("title") as string)?.trim() || "Ergonomic Screening";
  const department = (formData.get("department") as string)?.trim() || "";
  const hazardType = (formData.get("hazard_type") as string) || "repetitive_motion";
  const riskScore  = parseInt(formData.get("risk_score") as string) || 0;
  // Derive a control status from the screening risk score.
  const status = riskScore >= 15 ? "controls_pending" : riskScore >= 8 ? "review_required" : "controlled";
  const controls   = (formData.get("controls") as string)?.split(/[,;]+/).map((c) => c.trim()).filter(Boolean) ?? [];
  const notes      = (formData.get("notes") as string)?.trim() || null;

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { count } = await ctx.client
        .from("ergonomics_job_tasks")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", ctx.tenantId);
      const code = `JT-${String((count ?? 0) + 1).padStart(3, "0")}`;
      const { error } = await ctx.client.from("ergonomics_job_tasks").insert({
        tenant_id: ctx.tenantId, task_code: code, task_title: taskTitle, department,
        hazard_type: hazardType, risk_score: riskScore, controls, status, notes,
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const store = getStore();
    const num = store.ergonomicsJobTasks.length + 1;
    store.ergonomicsJobTasks.push({
      id: nextId("jt"), tenant_id: MOCK_TENANT_ID,
      task_code: `JT-${String(num).padStart(3, "0")}`,
      task_title: taskTitle, department,
      hazard_type: hazardType as ErgonomicsJobTask["hazard_type"],
      risk_score: riskScore, controls,
      status: status as ErgonomicsJobTask["status"],
      notes, created_at: now, updated_at: now,
    });
  }
  revalidatePath("/ergonomics");
  return { ok: true };
}

// ── Settings ──────────────────────────────────────────────────────────────────
// Merge a settings object into the tenant's onboarding_data jsonb.

export async function saveSettings(_prev: unknown, formData: FormData) {
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    if (ctx) {
      const { data: tenantRow, error: readError } = await ctx.client
        .from("tenants").select("onboarding_data").eq("id", ctx.tenantId).single();
      if (readError) return { ok: false, error: readError.message };

      const onboarding = ((tenantRow?.onboarding_data ?? {}) as Record<string, unknown>);
      const existingSettings = (onboarding.settings ?? {}) as Record<string, unknown>;

      // Notification toggles arrive as a JSON object in the "notifs" field.
      let notifs: Record<string, unknown> = {};
      const notifsRaw = formData.get("notifs") as string | null;
      if (notifsRaw) {
        try { const v = JSON.parse(notifsRaw); if (v && typeof v === "object") notifs = v as Record<string, unknown>; }
        catch { /* ignore malformed toggles */ }
      }

      // Any remaining string form fields become config values on settings.
      const config: Record<string, string> = {};
      for (const [key, value] of formData.entries()) {
        if (key === "notifs") continue;
        if (typeof value === "string") config[key] = value;
      }

      const mergedSettings = { ...existingSettings, ...config, notifications: notifs };
      const onboardingPatch: Record<string, unknown> = { ...onboarding, settings: mergedSettings };

      // Mirror identity fields onto the canonical onboarding_data keys that
      // getTenantName()/getEstablishment() read, so edits show across the app
      // (not just on the settings page).
      const IDENTITY: Record<string, string> = {
        companyName: "legalName",
        industry: "industry",
        primarySite: "siteName",
        primaryContact: "contactName",
        hqPhone: "contactPhone",
        contactEmail: "contactEmail",
      };
      for (const [field, canon] of Object.entries(IDENTITY)) {
        const v = (config[field] ?? "").trim();
        if (v) onboardingPatch[canon] = v;
      }

      const updatePayload: Record<string, unknown> = { onboarding_data: onboardingPatch };
      const newName = (config.companyName ?? "").trim();
      if (newName) updatePayload.name = newName; // first-class tenants.name column

      const { error } = await ctx.client
        .from("tenants")
        .update(updatePayload)
        .eq("id", ctx.tenantId);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/", "layout");
    }
  }
  // Mock mode: settings are not persisted in the in-memory store.
  revalidatePath("/settings");
  return { ok: true };
}

// ── Triggered CAPA actions (bulk create) ──────────────────────────────────────
// formData.actions = JSON array of { title, description, kind, severity, due_date }.

export async function createTriggeredCapaActions(_prev: unknown, formData: FormData) {
  let actions: Array<{ title?: string; description?: string; kind?: string; severity?: string; due_date?: string }> = [];
  try {
    const parsed = JSON.parse((formData.get("actions") as string) || "[]");
    if (Array.isArray(parsed)) actions = parsed;
  } catch {
    return { ok: false, created: 0, error: "Invalid actions payload." };
  }
  if (actions.length === 0) return { ok: true, created: 0 };

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, created: 0, error: "Session expired — please reload." };
    if (ctx) {
      const rows = actions.map((a) => ({
        tenant_id:   ctx.tenantId,
        site_id:     ctx.siteId,
        title:       a.title || "Untitled CAPA",
        description: a.description || "",
        kind:        a.kind || "corrective",
        source_type: "manual",
        severity:    a.severity || "medium",
        status:      "open",
        due_date:    a.due_date || null,
        owner_id:    null,
      }));
      const { error } = await ctx.client.from("capa_records").insert(rows);
      if (error) return { ok: false, created: 0, error: error.message };
    }
  } else {
    const store = getStore();
    const now = new Date().toISOString();
    for (const a of actions) {
      store.capaActions.push({
        id: nextId("capa"),
        tenant_id:   MOCK_TENANT_ID,
        site_id:     MOCK_SITE_ID,
        title:       a.title || "Untitled CAPA",
        description: a.description || "",
        kind:        (a.kind as "corrective" | "preventive") ?? "corrective",
        source_type: "manual" as CapaSourceType,
        source_id:   null,
        root_cause:  null,
        severity:    (a.severity as Severity) ?? "medium",
        owner_id:    null,
        due_date:    a.due_date || null,
        status:      "open",
        verification_method: null,
        closed_at:   null,
        closure_note: null,
        closed_with_evidence: false,
        created_at:  now,
        updated_at:  now,
      });
    }
  }
  revalidatePath("/capa");
  return { ok: true, created: actions.length };
}

export async function rejectStagedRow(id: string) {
  if (MOCK_MODE) return { ok: false as const, error: "Live mode only." };
  const ctx = await getCtx();
  if (!ctx) return { ok: false as const, error: "Session expired — please reload." };
  await ctx.client.from("document_staged_rows").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", id).eq("tenant_id", ctx.tenantId);
  revalidatePath("/documents/import");
  return { ok: true as const };
}

// ── Waste Vendors / Pickups / Inspections ─────────────────────────────────────

// Split a comma-separated "services" form field into a clean text[].
function parseServices(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function addWasteVendor(_prev: unknown, formData: FormData) {
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    const { error } = await ctx.client.from("waste_vendors").insert({
      tenant_id:    ctx.tenantId,
      name:         (formData.get("name") as string) || "Unnamed Vendor",
      epa_id:       (formData.get("epa_id") as string) || null,
      contact_name: (formData.get("contact_name") as string) || null,
      phone:        (formData.get("phone") as string) || null,
      email:        (formData.get("email") as string) || null,
      services:     parseServices(formData.get("services") as string),
      permit_expiry: (formData.get("permit_expiry") as string) || null,
      status:       (formData.get("status") as string) || "active",
      notes:        (formData.get("notes") as string) || null,
      created_by:   ctx.profileId,
    });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/waste");
  return { ok: true };
}

export async function updateWasteVendor(id: string, formData: FormData) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    const { error } = await ctx.client.from("waste_vendors").update({
      name:         (formData.get("name") as string) || "Unnamed Vendor",
      epa_id:       (formData.get("epa_id") as string) || null,
      contact_name: (formData.get("contact_name") as string) || null,
      phone:        (formData.get("phone") as string) || null,
      email:        (formData.get("email") as string) || null,
      services:     parseServices(formData.get("services") as string),
      permit_expiry: (formData.get("permit_expiry") as string) || null,
      status:       (formData.get("status") as string) || "active",
      notes:        (formData.get("notes") as string) || null,
      updated_at:   now,
    }).eq("id", id).eq("tenant_id", ctx.tenantId);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/waste");
  return { ok: true };
}

export async function scheduleWastePickup(_prev: unknown, formData: FormData) {
  const quantityRaw = formData.get("quantity") as string;
  const quantity = quantityRaw ? Number(quantityRaw) : null;
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    const { error } = await ctx.client.from("waste_pickups").insert({
      tenant_id:       ctx.tenantId,
      site_id:         ctx.siteId,
      vendor_id:       (formData.get("vendor_id") as string) || null,
      waste_stream_id: (formData.get("waste_stream_id") as string) || null,
      manifest_number: (formData.get("manifest_number") as string) || null,
      scheduled_date:  (formData.get("scheduled_date") as string) || null,
      quantity,
      unit:            (formData.get("unit") as string) || "kg",
      status:          (formData.get("status") as string) || "requested",
      notes:           (formData.get("notes") as string) || null,
      created_by:      ctx.profileId,
    });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/waste");
  return { ok: true };
}

export async function updateWastePickup(id: string, formData: FormData) {
  const now = new Date().toISOString();
  const quantityRaw = formData.get("quantity") as string;
  const quantity = quantityRaw ? Number(quantityRaw) : null;
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    const { error } = await ctx.client.from("waste_pickups").update({
      status:          (formData.get("status") as string) || "requested",
      completed_date:  (formData.get("completed_date") as string) || null,
      manifest_number: (formData.get("manifest_number") as string) || null,
      scheduled_date:  (formData.get("scheduled_date") as string) || null,
      quantity,
      unit:            (formData.get("unit") as string) || "kg",
      notes:           (formData.get("notes") as string) || null,
      updated_at:      now,
    }).eq("id", id).eq("tenant_id", ctx.tenantId);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/waste");
  return { ok: true };
}

export async function logWasteInspection(_prev: unknown, formData: FormData) {
  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    const { error } = await ctx.client.from("waste_inspections").insert({
      tenant_id:       ctx.tenantId,
      site_id:         ctx.siteId,
      area:            (formData.get("area") as string) || null,
      inspection_date: (formData.get("inspection_date") as string) || null,
      inspector:       (formData.get("inspector") as string) || null,
      passed:          (formData.get("passed") as string) === "true",
      findings:        (formData.get("findings") as string) || null,
      next_due:        (formData.get("next_due") as string) || null,
      created_by:      ctx.profileId,
    });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/waste");
  return { ok: true };
}


// ── Waste Profiles (characterization + approval pipeline) ─────────────────────

export interface WasteProfileDraft {
  name: string;
  waste_code: string;
  classification: string;
  physical_state: string;
  process_description: string;
  hazard_summary: string;
}

// Real LLM-assisted draft of a waste characterization profile. Uses the same
// provider abstraction as the Predictability Engine. Degrades honestly: returns
// ok:false with a clear message when no AI key is configured (no fake output).
export async function draftWasteProfile(input: { description: string }) {
  if (MOCK_MODE) return { ok: false as const, error: "AI drafting runs in live mode only." };
  const ctx = await getCtx();
  if (!ctx) return { ok: false as const, error: "Session expired — please reload." };
  if (!hasLiveAi()) return { ok: false as const, error: "AI drafting is not configured — no AI API key is set. Fill the form manually." };
  const description = input.description?.trim();
  if (!description) return { ok: false as const, error: "Describe the waste stream first." };

  try {
    const result = await generateStructuredJson({
      system:
        "You are an EHS hazardous-waste characterization assistant. Given a plain-language description of a waste stream, draft a RCRA waste profile. Be conservative and accurate. Only assign an EPA waste code (e.g. D001, F003) when the description clearly supports it; otherwise return an empty string for waste_code. Keep descriptions concise and factual.",
      user: `Draft a hazardous waste profile for this waste stream:\n\n${description}`,
      schema: {
        name: "waste_profile_draft",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            name:                { type: "string", description: "Short profile name" },
            waste_code:          { type: "string", description: "EPA waste code or empty string" },
            classification:      { type: "string", enum: [...WASTE_CLASSIFICATIONS] },
            physical_state:      { type: "string", enum: ["solid", "liquid", "sludge", "gas"] },
            process_description: { type: "string", description: "Source process generating the waste" },
            hazard_summary:      { type: "string", description: "Key hazards, constituents, handling notes" },
          },
          required: ["name", "waste_code", "classification", "physical_state", "process_description", "hazard_summary"],
        },
      },
      maxTokens: 700,
    });
    return { ok: true as const, draft: result.data as WasteProfileDraft };
  } catch {
    return { ok: false as const, error: "AI drafting failed — please fill the form manually." };
  }
}

export async function createWasteProfile(_prev: unknown, formData: FormData) {
  if (MOCK_MODE) return { ok: true as const };
  const ctx = await getCtx();
  if (!ctx) return { ok: false as const, error: "Session expired — please reload." };
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { ok: false as const, error: "Profile name is required." };
  const { error } = await ctx.client.from("waste_profiles").insert({
    tenant_id:           ctx.tenantId,
    site_id:             ctx.siteId,
    waste_stream_id:     (formData.get("waste_stream_id") as string) || null,
    name,
    waste_code:          (formData.get("waste_code") as string) || null,
    classification:      (formData.get("classification") as string) || "hazardous",
    physical_state:      (formData.get("physical_state") as string) || null,
    process_description: (formData.get("process_description") as string) || null,
    hazard_summary:      (formData.get("hazard_summary") as string) || null,
    state:               "draft",
    created_by:          ctx.profileId,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/waste");
  return { ok: true as const };
}

type ProfileAction = "submit" | "approve" | "reject" | "activate" | "retire" | "revise";

// Server-validated state machine: draft → ehs_review → approved → active → retired;
// ehs_review can → rejected; rejected can → draft (revise).
export async function transitionWasteProfile(id: string, action: ProfileAction, reason?: string) {
  if (MOCK_MODE) return { ok: true as const };
  const ctx = await getCtx();
  if (!ctx) return { ok: false as const, error: "Session expired — please reload." };

  const { data: current, error: readErr } = await ctx.client
    .from("waste_profiles")
    .select("state")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (readErr || !current) return { ok: false as const, error: "Profile not found." };

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: nowIso };

  switch (action) {
    case "submit":
      if (current.state !== "draft") return { ok: false as const, error: "Only draft profiles can be submitted." };
      patch.state = "ehs_review";
      patch.submitted_by = ctx.profileId;
      patch.submitted_at = nowIso;
      patch.reject_reason = null;
      break;
    case "approve":
      if (current.state !== "ehs_review") return { ok: false as const, error: "Only profiles in review can be approved." };
      patch.state = "approved";
      patch.reviewer_id = ctx.profileId;
      patch.approved_at = nowIso;
      break;
    case "reject":
      if (current.state !== "ehs_review") return { ok: false as const, error: "Only profiles in review can be rejected." };
      patch.state = "rejected";
      patch.reviewer_id = ctx.profileId;
      patch.reject_reason = reason?.trim() || "No reason provided.";
      break;
    case "activate":
      if (current.state !== "approved") return { ok: false as const, error: "Only approved profiles can be activated." };
      patch.state = "active";
      break;
    case "retire":
      if (current.state !== "active" && current.state !== "approved")
        return { ok: false as const, error: "Only approved or active profiles can be retired." };
      patch.state = "retired";
      break;
    case "revise":
      if (current.state !== "rejected") return { ok: false as const, error: "Only rejected profiles can be revised." };
      patch.state = "draft";
      patch.reject_reason = null;
      patch.submitted_at = null;
      break;
    default:
      return { ok: false as const, error: "Unknown action." };
  }

  const { error } = await ctx.client
    .from("waste_profiles")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/waste");
  return { ok: true as const };
}


// ── Saved Reports ─────────────────────────────────────────────────────────────

export async function saveReport(input: {
  name: string;
  report_type: string;
  metadata?: Record<string, unknown>;
}) {
  if (MOCK_MODE) return { ok: true as const };
  const ctx = await getCtx();
  if (!ctx) return { ok: false as const, error: "Not authorized." };
  const { error } = await ctx.client.from("saved_reports").insert({
    tenant_id: ctx.tenantId,
    name: input.name,
    report_type: input.report_type,
    metadata: input.metadata ?? {},
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/reports");
  return { ok: true as const };
}

export async function deleteReport(id: string) {
  if (MOCK_MODE) return { ok: true as const };
  const ctx = await getCtx();
  if (!ctx) return { ok: false as const, error: "Not authorized." };
  const { error } = await ctx.client
    .from("saved_reports")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/reports");
  return { ok: true as const };
}