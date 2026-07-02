"use server";

// EHS core-record actions — CAPAs, incidents, chemicals, audits, risk
// assessments, and CAPA creation from incidents/findings/triggers. Split from
// the original monolithic ehs.ts; function bodies are unchanged. Callers keep
// importing from "@/lib/actions/ehs" (the barrel).

import { revalidatePath } from "next/cache";
import { getStore, nextId } from "@/lib/data/store";
import { MOCK_TENANT_ID, MOCK_SITE_ID } from "@/lib/data/mock";
import { DEMO_SARAH_ID } from "@/lib/supabase/server";
import { MOCK_MODE } from "@/lib/env";
import type { Severity, IncidentType, CapaStatus, AuditStatus } from "@/lib/constants";
import { STORAGE_CLASSES, PPE_TYPES } from "@/lib/chemicalRefData";
import type { CapaSourceType, AuditType, Incident, RiskAssessment, Chemical } from "@/lib/types";
import { validateRecordInBackground } from "@/lib/csp/repo";
import { getCtx } from "./ehs-shared";

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
      const med = formData.get("medical_treatment") as string;
      const { data: created, error } = await ctx.client.from("incidents").insert({
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
        injured_party: (formData.get("injured_party") as string) || null,
        injuries_description: (formData.get("injuries_description") as string) || null,
        contractor_or_company: (formData.get("contractor_or_company") as string) || null,
        witnesses: (formData.get("witnesses") as string) || null,
        ...(med ? { medical_treatment_required: med === "medical" } : {}),
      }).select("*").single();
      if (error) return { ok: false, error: error.message };
      // CSP validation agent — validate & log in the background; never blocks the save.
      if (created) await validateRecordInBackground(ctx.client, "incident", created, ctx.siteId);
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
      const med = formData.get("medical_treatment") as string;
      const { data: updated, error } = await ctx.client.from("incidents").update({
        title:       (formData.get("title") as string) || "Untitled Incident",
        description: (formData.get("description") as string) || "",
        incident_type: (formData.get("incident_type") as string) || "near_miss",
        severity:    (formData.get("severity") as string) || "medium",
        status:      (formData.get("status") as string) || "reported",
        location:    (formData.get("location") as string) || "",
        immediate_actions: (formData.get("immediate_actions") as string) || null,
        root_cause:  (formData.get("root_cause") as string) || null,
        injured_party: (formData.get("injured_party") as string) || null,
        injuries_description: (formData.get("injuries_description") as string) || null,
        contractor_or_company: (formData.get("contractor_or_company") as string) || null,
        witnesses: (formData.get("witnesses") as string) || null,
        final_corrective_action: (formData.get("final_corrective_action") as string) || null,
        supervisor_review: (formData.get("supervisor_review") as string) || null,
        safety_review: (formData.get("safety_review") as string) || null,
        recordability_decision: (formData.get("recordability_decision") as string) || null,
        ...(med ? { medical_treatment_required: med === "medical" } : {}),
        updated_at:  now,
      }).eq("id", id).eq("tenant_id", ctx.tenantId).select("*").single();
      if (error) return { ok: false, error: error.message };
      // Re-validate on edit so the audit log reflects the corrected record.
      if (updated) await validateRecordInBackground(ctx.client, "incident", updated, ctx.siteId);
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
const STORAGE_CLASS_CODES = new Set(STORAGE_CLASSES.map((s) => s.code));
const PPE_CODES = new Set(PPE_TYPES.map((p) => p.code));

function parseHazardCodes(raw: string | null): string[] {
  if (!raw) return [];
  return [...new Set(
    raw.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter((s) => /^H\d{3}/.test(s)),
  )];
}

// Parse free-typed/selected P-codes ("P210, P301+P310") into a clean array.
// Splits on commas/semicolons/whitespace but preserves the '+' inside combined
// P-codes (e.g. "P301+P310"). Stored in chemical_inventory.precautionary_statements.
function parsePrecautionCodes(raw: string | null): string[] {
  if (!raw) return [];
  return [...new Set(
    raw.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter((s) => /^P\d{3}/.test(s)),
  )];
}

// Validate the selected storage-class code against the reference list; null if blank/unknown.
function parseStorageClass(raw: string | null): string | null {
  const v = (raw ?? "").trim().toUpperCase();
  return STORAGE_CLASS_CODES.has(v) ? v : null;
}

// Parse selected PPE codes into a clean array of known PPE codes.
function parsePpeCodes(raw: string | null): string[] {
  if (!raw) return [];
  return [...new Set(
    raw.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter((s) => PPE_CODES.has(s)),
  )];
}

// Container-capacity fields (drive EU CLP label sizing). Blank → null so a
// missing value falls back to the smallest CLP tier at print time.
function containerCapFields(formData: FormData): { container_capacity: number | null; container_capacity_unit: string | null } {
  const raw = ((formData.get("container_capacity") as string) ?? "").trim();
  return {
    container_capacity: raw === "" ? null : (parseFloat(raw) || null),
    container_capacity_unit: (formData.get("container_capacity_unit") as string) || null,
  };
}

export async function addChemical(_prev: unknown, formData: FormData) {
  const hazards      = parseHazardCodes(formData.get("hazard_codes") as string);
  const precautions  = parsePrecautionCodes(formData.get("precaution_codes") as string);
  const storageClass = parseStorageClass(formData.get("storage_class") as string);
  const ppe          = parsePpeCodes(formData.get("recommended_ppe") as string);
  const isScheduled  = (formData.get("is_scheduled") as string) === "true";
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
        precautionary_statements: precautions,
        quantity: parseFloat(formData.get("quantity") as string) || 0,
        unit: (formData.get("unit") as string) || "L",
        ...containerCapFields(formData),
        storage_location: (formData.get("storage_location") as string) || "",
        storage_class: storageClass,
        recommended_ppe: ppe,
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
      precautionary_statements: precautions,
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
  const hasPrecautions = formData.has("precaution_codes");
  const precautions = parsePrecautionCodes(formData.get("precaution_codes") as string);
  const hasStorageClass = formData.has("storage_class");
  const storageClass = parseStorageClass(formData.get("storage_class") as string);
  const hasPpe = formData.has("recommended_ppe");
  const ppe = parsePpeCodes(formData.get("recommended_ppe") as string);
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
        ...containerCapFields(formData),
        storage_location: (formData.get("storage_location") as string) || "",
        supplier:         (formData.get("supplier") as string) || null,
        ...(hasHazards ? {
          ghs_classes:       hazards as Chemical["ghs_classes"],
          hazard_statements: hazards,
          is_scheduled:      isScheduled,
          schedule_ref:      scheduleRef,
          sds_expiry:        sdsExpiry,
        } : {}),
        ...(hasPrecautions ? { precautionary_statements: precautions } : {}),
        ...(hasStorageClass ? { storage_class: storageClass } : {}),
        ...(hasPpe ? { recommended_ppe: ppe } : {}),
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
        ...containerCapFields(formData),
        storage_location: (formData.get("storage_location") as string) || "",
        supplier:         (formData.get("supplier") as string) || null,
        ...(hasHazards ? {
          ghs_classes:       hazards as Chemical["ghs_classes"],
          hazard_statements: hazards,
          is_scheduled:      isScheduled,
          schedule_ref:      scheduleRef,
          sds_expiry:        sdsExpiry,
        } : {}),
        ...(hasPrecautions ? { precautionary_statements: precautions } : {}),
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

