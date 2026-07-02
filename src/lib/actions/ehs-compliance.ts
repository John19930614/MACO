"use server";

// EHS compliance & program actions — equipment, legal requirements, training,
// documents, workspace tasks, SDS/evidence URLs, acknowledgments, biosafety,
// OSHA recordkeeping, exposure readings, ergonomics, settings, and saved
// reports. Split from the original monolithic ehs.ts; function bodies are
// unchanged. Callers keep importing from "@/lib/actions/ehs" (the barrel).

import { revalidatePath } from "next/cache";
import { getStore, nextId } from "@/lib/data/store";
import { MOCK_TENANT_ID, MOCK_SITE_ID } from "@/lib/data/mock";
import { DEMO_SARAH_ID } from "@/lib/supabase/server";
import { MOCK_MODE } from "@/lib/env";
import type { DocumentStatus } from "@/lib/constants";
import type { Equipment, LegalRequirement, TrainingRecord, OshaCase, BiosafetyLab, BiohazardAgent, ErgonomicsWorkstation, ErgonomicsJobTask } from "@/lib/types";
import { getCtx } from "./ehs-shared";

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
