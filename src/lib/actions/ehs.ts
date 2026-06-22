"use server";

import { revalidatePath } from "next/cache";
import { getStore, nextId } from "@/lib/data/store";
import { MOCK_TENANT_ID, MOCK_SITE_ID } from "@/lib/data/mock";
import { createServerSupabase, DEMO_TENANT_ID, DEMO_SITE_ID, DEMO_SARAH_ID } from "@/lib/supabase/server";
import { MOCK_MODE } from "@/lib/env";
import type { Severity, IncidentType, CapaStatus, AuditStatus, DocumentStatus } from "@/lib/constants";
import type { CapaSourceType, AuditType, Incident, RiskAssessment, WasteStream, Equipment, LegalRequirement, TrainingRecord } from "@/lib/types";

export async function addCapa(_prev: unknown, formData: FormData) {
  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("capa_records").insert({
        tenant_id: DEMO_TENANT_ID,
        site_id: DEMO_SITE_ID,
        title: (formData.get("title") as string) || "Untitled CAPA",
        description: (formData.get("description") as string) || "",
        kind: (formData.get("kind") as string) || "corrective",
        source_type: "manual",
        severity: (formData.get("severity") as string) || "medium",
        status: "open",
        due_date: (formData.get("due_date") as string) || null,
        owner_id: null,
      });
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

export async function addIncident(_prev: unknown, formData: FormData) {
  const now = new Date().toISOString();
  const occurredAt = (formData.get("occurred_at") as string) || now.slice(0, 10);

  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("incidents").insert({
        tenant_id: DEMO_TENANT_ID,
        site_id: DEMO_SITE_ID,
        title: (formData.get("title") as string) || "Untitled Incident",
        description: (formData.get("description") as string) || "",
        incident_type: (formData.get("incident_type") as string) || "near_miss",
        severity: (formData.get("severity") as string) || "medium",
        status: "reported",
        occurred_at: new Date(occurredAt).toISOString(),
        location: (formData.get("location") as string) || "Main Site",
        reported_by: DEMO_SARAH_ID,
      });
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

export async function addChemical(_prev: unknown, formData: FormData) {
  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("chemical_inventory").insert({
        tenant_id: DEMO_TENANT_ID,
        site_id: DEMO_SITE_ID,
        name: (formData.get("name") as string) || "Unnamed Chemical",
        cas_number: (formData.get("cas_number") as string) || null,
        ghs_classes: [],
        quantity: parseFloat(formData.get("quantity") as string) || 0,
        unit: (formData.get("unit") as string) || "L",
        storage_location: (formData.get("storage_location") as string) || "",
        is_scheduled: false,
      });
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
      ghs_classes: [],
      quantity: parseFloat(formData.get("quantity") as string) || 0,
      unit: (formData.get("unit") as string) || "L",
      storage_location: (formData.get("storage_location") as string) || "",
      sds_url: null,
      sds_expiry: null,
      hazard_statements: [],
      precautionary_statements: [],
      is_scheduled: false,
      schedule_ref: null,
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

export async function updateIncident(id: string, formData: FormData) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("incidents").update({
        title:       (formData.get("title") as string) || "Untitled Incident",
        description: (formData.get("description") as string) || "",
        incident_type: (formData.get("incident_type") as string) || "near_miss",
        severity:    (formData.get("severity") as string) || "medium",
        status:      (formData.get("status") as string) || "reported",
        location:    (formData.get("location") as string) || "",
        immediate_actions: (formData.get("immediate_actions") as string) || null,
        root_cause:  (formData.get("root_cause") as string) || null,
        updated_at:  now,
      }).eq("id", id).eq("tenant_id", DEMO_TENANT_ID);
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

export async function updateCapa(id: string, formData: FormData) {
  const now = new Date().toISOString();
  const newStatus = (formData.get("status") as CapaStatus) || "open";
  const isClosing = newStatus === "closed";
  const closureNote = (formData.get("closure_note") as string) || null;
  const closedWithEvidence = formData.get("closed_with_evidence") === "true";
  const ownerId = (formData.get("owner_id") as string) || null;

  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("capa_records").update({
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
      }).eq("id", id).eq("tenant_id", DEMO_TENANT_ID);
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

export async function updateAudit(id: string, formData: FormData) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("audits").update({
        title:          (formData.get("title") as string) || "Untitled Audit",
        type:           (formData.get("type") as string) || "internal",
        scheduled_date: (formData.get("scheduled_date") as string) || null,
        status:         (formData.get("status") as string) || "scheduled",
        scope:          (formData.get("scope") as string) || null,
        notes:          (formData.get("notes") as string) || null,
        updated_at:     now,
      }).eq("id", id).eq("tenant_id", DEMO_TENANT_ID);
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
    itemSummary: string; // JSON string
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
    const client = createServerSupabase();
    if (client) {
      await client.from("audits").update({
        status:         "completed",
        completed_date: data.conductDate || now.slice(0, 10),
        notes:          notesJson,
        updated_at:     now,
      }).eq("id", id).eq("tenant_id", DEMO_TENANT_ID);
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

export async function updateChemical(id: string, formData: FormData) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("chemical_inventory").update({
        name:             (formData.get("name") as string) || "Unnamed Chemical",
        cas_number:       (formData.get("cas_number") as string) || null,
        quantity:         parseFloat(formData.get("quantity") as string) || 0,
        unit:             (formData.get("unit") as string) || "L",
        storage_location: (formData.get("storage_location") as string) || "",
        supplier:         (formData.get("supplier") as string) || null,
        updated_at:       now,
      }).eq("id", id).eq("tenant_id", DEMO_TENANT_ID);
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
        updated_at:       now,
      };
    }
  }
  revalidatePath("/chemicals");
  revalidatePath(`/chemicals/${id}`);
  return { ok: true };
}

export async function addAudit(_prev: unknown, formData: FormData) {
  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("audits").insert({
        tenant_id: DEMO_TENANT_ID,
        site_id: DEMO_SITE_ID,
        title: (formData.get("title") as string) || "Untitled Audit",
        type: (formData.get("type") as string) || "internal",
        scheduled_date: (formData.get("scheduled_date") as string) || new Date().toISOString().slice(0, 10),
        status: "scheduled",
        lead_auditor_id: null,
        scope: (formData.get("scope") as string) || "",
      });
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
    const client = createServerSupabase();
    if (client) {
      await client.from("risk_assessments").insert({
        tenant_id: DEMO_TENANT_ID,
        site_id:   DEMO_SITE_ID,
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
    const client = createServerSupabase();
    if (client) {
      await client.from("risk_assessments").update({
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
      }).eq("id", id).eq("tenant_id", DEMO_TENANT_ID);
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
    const client = createServerSupabase();
    if (client) {
      await client.from("waste_streams").insert({
        tenant_id:          DEMO_TENANT_ID,
        site_id:            DEMO_SITE_ID,
        waste_name:         (formData.get("waste_name") as string) || "Unnamed Waste",
        waste_code:         (formData.get("waste_code") as string) || null,
        classification:     (formData.get("classification") as string) || "hazardous",
        quantity:           parseFloat(formData.get("quantity") as string) || 0,
        unit:               (formData.get("unit") as string) || "kg",
        disposal_method:    (formData.get("disposal_method") as string) || "incineration",
        disposal_contractor:(formData.get("disposal_contractor") as string) || null,
        status:             "pending",
        created_by:         DEMO_SARAH_ID,
      });
    }
  } else {
    const store = getStore();
    store.wasteStreams.push({
      id: nextId("ws"),
      tenant_id:          MOCK_TENANT_ID,
      site_id:            MOCK_SITE_ID,
      waste_name:         (formData.get("waste_name") as string) || "Unnamed Waste",
      waste_code:         (formData.get("waste_code") as string) || null,
      classification:     (formData.get("classification") as WasteStream["classification"]) || "hazardous",
      quantity:           parseFloat(formData.get("quantity") as string) || 0,
      unit:               (formData.get("unit") as string) || "kg",
      disposal_method:    (formData.get("disposal_method") as string) || "incineration",
      disposal_contractor:(formData.get("disposal_contractor") as string) || null,
      manifest_number:    null,
      disposal_date:      null,
      regulatory_limit:   null,
      regulatory_unit:    null,
      status:             "pending",
      created_by:         "Sarah Chen",
      created_at:         now,
    });
  }
  revalidatePath("/waste");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateWasteStream(id: string, formData: FormData) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("waste_streams").update({
        waste_name:         (formData.get("waste_name") as string) || "Unnamed Waste",
        waste_code:         (formData.get("waste_code") as string) || null,
        classification:     (formData.get("classification") as string) || "hazardous",
        quantity:           parseFloat(formData.get("quantity") as string) || 0,
        unit:               (formData.get("unit") as string) || "kg",
        disposal_method:    (formData.get("disposal_method") as string) || "incineration",
        disposal_contractor:(formData.get("disposal_contractor") as string) || null,
        status:             (formData.get("status") as string) || "pending",
        manifest_number:    (formData.get("manifest_number") as string) || null,
        disposal_date:      (formData.get("disposal_date") as string) || null,
      }).eq("id", id).eq("tenant_id", DEMO_TENANT_ID);
    }
  } else {
    const store = getStore();
    const idx = store.wasteStreams.findIndex((w) => w.id === id);
    if (idx !== -1) {
      store.wasteStreams[idx] = {
        ...store.wasteStreams[idx],
        waste_name:         (formData.get("waste_name") as string) || store.wasteStreams[idx].waste_name,
        waste_code:         (formData.get("waste_code") as string) || null,
        classification:     (formData.get("classification") as WasteStream["classification"]) || "hazardous",
        quantity:           parseFloat(formData.get("quantity") as string) || 0,
        unit:               (formData.get("unit") as string) || "kg",
        disposal_method:    (formData.get("disposal_method") as string) || "incineration",
        disposal_contractor:(formData.get("disposal_contractor") as string) || null,
        status:             (formData.get("status") as WasteStream["status"]) || "pending",
        manifest_number:    (formData.get("manifest_number") as string) || null,
        disposal_date:      (formData.get("disposal_date") as string) || null,
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
    const client = createServerSupabase();
    if (client) {
      await client.from("equipment").insert({
        tenant_id:              DEMO_TENANT_ID,
        site_id:                DEMO_SITE_ID,
        name:                   (formData.get("name") as string) || "Unnamed Equipment",
        type:                   (formData.get("type") as string) || "other",
        serial_number:          (formData.get("serial_number") as string) || null,
        location:               (formData.get("location") as string) || "",
        next_calibration_date:  (formData.get("next_calibration_date") as string) || null,
        next_inspection_date:   (formData.get("next_inspection_date") as string) || null,
        calibration_interval_days: parseInt(formData.get("calibration_interval_days") as string) || null,
        status: "operational",
      });
    }
  } else {
    const store = getStore();
    store.equipment.push({
      id: nextId("eqp"),
      tenant_id:               MOCK_TENANT_ID,
      site_id:                 MOCK_SITE_ID,
      name:                    (formData.get("name") as string) || "Unnamed Equipment",
      type:                    (formData.get("type") as string) || "other",
      serial_number:           (formData.get("serial_number") as string) || null,
      location:                (formData.get("location") as string) || "",
      last_calibration_date:   null,
      next_calibration_date:   (formData.get("next_calibration_date") as string) || null,
      last_inspection_date:    null,
      next_inspection_date:    (formData.get("next_inspection_date") as string) || null,
      calibration_interval_days: parseInt(formData.get("calibration_interval_days") as string) || null,
      status:                  "operational" as Equipment["status"],
      regulatory_ref:          null,
      notes:                   null,
      created_at:              now,
      updated_at:              now,
    });
  }
  revalidatePath("/monitoring");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateEquipment(id: string, formData: FormData) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("equipment").update({
        name:                   (formData.get("name") as string) || "Unnamed Equipment",
        type:                   (formData.get("type") as string) || "other",
        serial_number:          (formData.get("serial_number") as string) || null,
        location:               (formData.get("location") as string) || "",
        next_calibration_date:  (formData.get("next_calibration_date") as string) || null,
        next_inspection_date:   (formData.get("next_inspection_date") as string) || null,
        last_calibration_date:  (formData.get("last_calibration_date") as string) || null,
        calibration_interval_days: parseInt(formData.get("calibration_interval_days") as string) || null,
        status:                 (formData.get("status") as string) || "operational",
        notes:                  (formData.get("notes") as string) || null,
        updated_at:             now,
      }).eq("id", id).eq("tenant_id", DEMO_TENANT_ID);
    }
  } else {
    const store = getStore();
    const idx = store.equipment.findIndex((e) => e.id === id);
    if (idx !== -1) {
      store.equipment[idx] = {
        ...store.equipment[idx],
        name:                   (formData.get("name") as string) || store.equipment[idx].name,
        type:                   (formData.get("type") as string) || store.equipment[idx].type,
        serial_number:          (formData.get("serial_number") as string) || null,
        location:               (formData.get("location") as string) || store.equipment[idx].location,
        next_calibration_date:  (formData.get("next_calibration_date") as string) || null,
        next_inspection_date:   (formData.get("next_inspection_date") as string) || null,
        last_calibration_date:  (formData.get("last_calibration_date") as string) || null,
        calibration_interval_days: parseInt(formData.get("calibration_interval_days") as string) || null,
        status:                 (formData.get("status") as Equipment["status"]) || "operational",
        notes:                  (formData.get("notes") as string) || null,
        updated_at:             now,
      };
    }
  }
  revalidatePath("/monitoring");
  revalidatePath(`/monitoring/${id}`);
  return { ok: true };
}

// ── Legal Requirements (v2) ───────────────────────────────────────────────────

export async function addLegalRequirement(_prev: unknown, formData: FormData) {
  const now = new Date().toISOString();
  const nextReview = (formData.get("next_review_date") as string) || now.slice(0, 10);
  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("legal_requirements").insert({
        tenant_id:            DEMO_TENANT_ID,
        regulation_ref:       (formData.get("regulation_ref") as string) || "",
        title:                (formData.get("title") as string) || "Untitled Requirement",
        description:          (formData.get("description") as string) || "",
        jurisdiction:         (formData.get("jurisdiction") as string) || "",
        category:             (formData.get("category") as string) || "general",
        applicable_sectors:   [],
        review_frequency_days: 365,
        next_review_date:     nextReview,
        status:               (formData.get("status") as string) || "not_assessed",
      });
    }
  } else {
    const store = getStore();
    store.legalRequirements.push({
      id:                   nextId("leg"),
      tenant_id:            MOCK_TENANT_ID,
      site_id:              null,
      regulation_ref:       (formData.get("regulation_ref") as string) || "",
      title:                (formData.get("title") as string) || "Untitled Requirement",
      description:          (formData.get("description") as string) || "",
      jurisdiction:         (formData.get("jurisdiction") as string) || "",
      category:             (formData.get("category") as string) || "general",
      applicable_sectors:   [],
      review_frequency_days: 365,
      next_review_date:     nextReview,
      status:               ((formData.get("status") as string) || "not_assessed") as LegalRequirement["status"],
      compliance_notes:     null,
      evidence_url:         null,
      owner_id:             null,
      created_at:           now,
      updated_at:           now,
    });
  }
  revalidatePath("/legal");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateLegalRequirement(id: string, formData: FormData) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("legal_requirements").update({
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
      }).eq("id", id).eq("tenant_id", DEMO_TENANT_ID);
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

export async function addTrainingRecord(_prev: unknown, formData: FormData) {
  const now = new Date().toISOString();
  const scoreRaw = formData.get("score") as string;
  const score = scoreRaw ? parseInt(scoreRaw) : null;
  const passed = (formData.get("passed") as string) !== "false";
  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("training_records").insert({
        tenant_id:       DEMO_TENANT_ID,
        site_id:         DEMO_SITE_ID,
        profile_id:      (formData.get("profile_id") as string) || DEMO_SARAH_ID,
        course_id:       (formData.get("course_id") as string) || "",
        completed_date:  (formData.get("completed_date") as string) || now.slice(0, 10),
        delivery_method: (formData.get("delivery_method") as string) || "classroom",
        score:           score,
        passed:          passed,
        notes:           (formData.get("notes") as string) || null,
      });
    }
  } else {
    const store = getStore();
    store.trainingRecords.push({
      id:              nextId("tr"),
      tenant_id:       MOCK_TENANT_ID,
      site_id:         MOCK_SITE_ID,
      profile_id:      (formData.get("profile_id") as string) || "",
      course_id:       (formData.get("course_id") as string) || "",
      completed_date:  (formData.get("completed_date") as string) || now.slice(0, 10),
      expiry_date:     null,
      score:           score,
      passed:          passed,
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
    const client = createServerSupabase();
    if (client) {
      await client.from("training_records").update({
        profile_id:      (formData.get("profile_id") as string) || DEMO_SARAH_ID,
        course_id:       (formData.get("course_id") as string) || "",
        completed_date:  (formData.get("completed_date") as string) || now.slice(0, 10),
        expiry_date:     (formData.get("expiry_date") as string) || null,
        delivery_method: (formData.get("delivery_method") as string) || "classroom",
        score:           score,
        passed:          passed,
        notes:           (formData.get("notes") as string) || null,
      }).eq("id", id).eq("tenant_id", DEMO_TENANT_ID);
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
        score:           score,
        passed:          passed,
        notes:           (formData.get("notes") as string) || null,
      };
    }
  }
  revalidatePath("/training");
  revalidatePath(`/training/${id}`);
  return { ok: true };
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function addDocument(_prev: unknown, formData: FormData) {
  const now = new Date().toISOString();
  const ackRequired = (formData.get("acknowledgment_required") as string) === "true";
  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("documents").insert({
        tenant_id:                DEMO_TENANT_ID,
        title:                    (formData.get("title") as string) || "Untitled Document",
        category:                 (formData.get("category") as string) || "sop",
        version:                  (formData.get("version") as string) || "1.0",
        storage_path:             "",
        effective_date:           (formData.get("effective_date") as string) || now.slice(0, 10),
        review_date:              (formData.get("review_date") as string) || now.slice(0, 10),
        status:                   (formData.get("status") as string) || "draft",
        acknowledgment_required:  ackRequired,
      });
    }
  } else {
    const store = getStore();
    store.documents.push({
      id:                       nextId("doc"),
      tenant_id:                MOCK_TENANT_ID,
      site_id:                  null,
      title:                    (formData.get("title") as string) || "Untitled Document",
      category:                 (formData.get("category") as string) || "sop",
      version:                  (formData.get("version") as string) || "1.0",
      storage_path:             "",
      effective_date:           (formData.get("effective_date") as string) || now.slice(0, 10),
      review_date:              (formData.get("review_date") as string) || now.slice(0, 10),
      status:                   ((formData.get("status") as string) || "draft") as DocumentStatus,
      owner_id:                 null,
      acknowledgment_required:  ackRequired,
      created_at:               now,
      updated_at:               now,
    });
  }
  revalidatePath("/documents");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateDocument(id: string, formData: FormData) {
  const now = new Date().toISOString();
  const ackRequired = (formData.get("acknowledgment_required") as string) === "true";
  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("documents").update({
        title:                    (formData.get("title") as string) || "Untitled Document",
        category:                 (formData.get("category") as string) || "sop",
        version:                  (formData.get("version") as string) || "1.0",
        effective_date:           (formData.get("effective_date") as string) || null,
        review_date:              (formData.get("review_date") as string) || null,
        status:                   (formData.get("status") as string) || "draft",
        acknowledgment_required:  ackRequired,
        updated_at:               now,
      }).eq("id", id).eq("tenant_id", DEMO_TENANT_ID);
    }
  } else {
    const store = getStore();
    const idx = store.documents.findIndex((d) => d.id === id);
    if (idx !== -1) {
      store.documents[idx] = {
        ...store.documents[idx],
        title:                    (formData.get("title") as string) || store.documents[idx].title,
        category:                 (formData.get("category") as string) || store.documents[idx].category,
        version:                  (formData.get("version") as string) || store.documents[idx].version,
        effective_date:           (formData.get("effective_date") as string) || store.documents[idx].effective_date,
        review_date:              (formData.get("review_date") as string) || store.documents[idx].review_date,
        status:                   ((formData.get("status") as string) || "draft") as DocumentStatus,
        acknowledgment_required:  ackRequired,
        updated_at:               now,
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
  const profileId = (formData.get("profile_id") as string) || DEMO_SARAH_ID;
  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("workspace_tasks").insert({
        tenant_id:  DEMO_TENANT_ID,
        profile_id: profileId,
        title:      (formData.get("title") as string) || "Untitled Task",
        type:       (formData.get("type") as string) || "General",
        due_date:   (formData.get("due_date") as string) || null,
        priority:   (formData.get("priority") as string) || "medium",
        status:     "pending",
      });
    }
  } else {
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
    const client = createServerSupabase();
    if (client) {
      await client.from("workspace_tasks")
        .update({
          status:           "done",
          completed_by:     completedBy,
          completed_at:     now,
          completion_notes: completionNotes.trim() || null,
          updated_at:       now,
        })
        .eq("id", id)
        .eq("tenant_id", DEMO_TENANT_ID);
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

export async function updateSdsUrl(chemicalId: string, sdsUrl: string, sdsExpiry: string | null) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client
        .from("chemical_inventory")
        .update({ sds_url: sdsUrl.trim() || null, sds_expiry: sdsExpiry || null, updated_at: now })
        .eq("id", chemicalId)
        .eq("tenant_id", DEMO_TENANT_ID);
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
    const client = createServerSupabase();
    if (client) {
      await client
        .from("legal_requirements")
        .update({ evidence_url: evidenceUrl.trim() || null, updated_at: now })
        .eq("id", requirementId)
        .eq("tenant_id", DEMO_TENANT_ID);
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

export async function addCapaFromIncident(incidentId: string, formData: FormData) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("capa_records").insert({
        tenant_id:   DEMO_TENANT_ID,
        site_id:     DEMO_SITE_ID,
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
      await client.from("incidents")
        .update({ status: "capa_open", updated_at: now })
        .eq("id", incidentId)
        .eq("tenant_id", DEMO_TENANT_ID);
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
    const client = createServerSupabase();
    if (client) {
      await client.from("capa_records").insert({
        tenant_id:   DEMO_TENANT_ID,
        site_id:     DEMO_SITE_ID,
        title, description, kind: "corrective",
        source_type: "audit_finding",
        source_id, severity, root_cause, status: "open",
        due_date, owner_id: null, verification_method,
      });
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

export async function acknowledgeDocument(documentId: string, profileId: string) {
  const now = new Date().toISOString();
  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("document_acknowledgments").insert({
        tenant_id:       DEMO_TENANT_ID,
        document_id:     documentId,
        profile_id:      profileId,
        acknowledged_at: now,
      });
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

export async function createBiosafetyLab(_prev: unknown, formData: FormData) {
  const now       = new Date().toISOString();
  const name      = (formData.get("name") as string)?.trim() || "Unnamed Lab";
  const bslLevel  = (formData.get("bsl_level") as string) || "BSL-1";
  const personnel = parseInt(formData.get("personnel_count") as string) || 0;
  const nextInsp  = (formData.get("next_inspection") as string) || null;

  if (!MOCK_MODE) {
    const client = createServerSupabase();
    if (client) {
      await client.from("biosafety_labs").insert({
        tenant_id: DEMO_TENANT_ID, name, bsl_level: bslLevel,
        personnel_count: personnel, next_inspection: nextInsp, status: "compliant", open_findings: 0,
      });
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
    const client = createServerSupabase();
    if (client) {
      await client.from("biohazard_agents").insert({
        tenant_id: DEMO_TENANT_ID, agent_name: agentName,
        risk_class: riskClass, storage_location: storageLoc, quantity, status: "registered",
      });
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
  if (!MOCK_MODE) return { ok: false };
  const raw = fd.get("case");
  if (!raw) return { ok: false };
  const c = JSON.parse(raw as string);
  getStore().oshaStore.push(c);
  revalidatePath("/osha");
  return { ok: true };
}
