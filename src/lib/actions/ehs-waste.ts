"use server";

// EHS waste actions — waste streams, vendors, pickups, inspections, and the
// waste-profile characterization pipeline including AI drafting and the guided
// wizard. Split from the original monolithic ehs.ts; function bodies are
// unchanged. Callers keep importing from "@/lib/actions/ehs" (the barrel).

import { revalidatePath } from "next/cache";
import { getStore, nextId } from "@/lib/data/store";
import { MOCK_TENANT_ID, MOCK_SITE_ID } from "@/lib/data/mock";
import { MOCK_MODE, hasLiveAi } from "@/lib/env";
import { WASTE_CLASSIFICATIONS } from "@/lib/constants";
import type { WasteStream, WasteProfileConstituent, WasteProfileAiSuggestions } from "@/lib/types";
import { rulesDraft } from "@/lib/waste/profileDraft";
import { generateStructuredJson } from "@/lib/ai/provider";
import { getCtx } from "./ehs-shared";

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

// ── Guided waste-profile wizard (inventory → composition → AI draft → approval) ─

// Drafts a characterization from the SELECTED inventory chemicals + guided
// answers. Always returns a usable draft: a deterministic rules-based one when
// no AI key is configured (or the AI call fails), upgraded to a model draft
// when AI is available. The result is advisory — the profile still goes through
// mandatory human approval.
export async function draftWasteProfileFromChemicals(input: {
  constituents: WasteProfileConstituent[];
  answers: Record<string, string>;
}): Promise<{ ok: true; draft: WasteProfileAiSuggestions } | { ok: false; error: string }> {
  const constituents = Array.isArray(input?.constituents) ? input.constituents : [];
  if (constituents.length === 0) return { ok: false, error: "Select at least one chemical first." };
  const answers = input?.answers ?? {};

  // Deterministic baseline (also the fallback).
  const baseline = rulesDraft(constituents, answers);

  if (MOCK_MODE || !hasLiveAi()) {
    return { ok: true, draft: baseline };
  }

  try {
    const constituentLines = constituents
      .map(
        (c) =>
          `- ${c.name} (CAS ${c.cas_number ?? "n/a"}) — ${c.percentage}% — GHS: ${(c.ghs_classes ?? []).join(", ") || "none"} — H-codes: ${(c.hazard_statements ?? []).join(", ") || "none"}`,
      )
      .join("\n");
    const answerLines = Object.entries(answers)
      .filter(([, v]) => v)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");

    const result = await generateStructuredJson({
      system:
        "You are an EHS hazardous-waste characterization assistant. Given the constituent chemicals of a waste mixture (with CAS numbers, weight percentages, GHS classes and H-codes) and the generator's guided answers, draft a RCRA waste profile. Be conservative: only assign an EPA waste code (D/F/K/P/U) when the data clearly supports it, otherwise return an empty string. Map GHS hazards to characteristic codes (ignitable D001, corrosive D002, reactive D003) where applicable. Keep text concise and factual. This is advisory; a human reviewer approves it.",
      user: `Constituents:\n${constituentLines}\n\nGuided answers:\n${answerLines || "(none)"}\n\nA rules-based first pass suggested: classification=${baseline.classification}, waste_code=${baseline.waste_code || "(none)"}. Refine or confirm.`,
      schema: {
        name: "waste_profile_draft",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            classification:      { type: "string", enum: [...WASTE_CLASSIFICATIONS] },
            waste_code:          { type: "string", description: "EPA waste code(s) or empty string" },
            physical_state:      { type: "string", enum: ["solid", "liquid", "sludge", "gas"] },
            process_description: { type: "string" },
            hazard_summary:      { type: "string" },
            rationale:           { type: "string", description: "Why these codes/classification were chosen" },
          },
          required: ["classification", "waste_code", "physical_state", "process_description", "hazard_summary", "rationale"],
        },
      },
      maxTokens: 900,
      tier: "deep",
    });
    const d = result.data as Omit<WasteProfileAiSuggestions, "codes_considered" | "generated_by">;
    return {
      ok: true,
      draft: {
        ...d,
        codes_considered: baseline.codes_considered,
        generated_by: "ai",
      },
    };
  } catch {
    // Honest degradation: fall back to the deterministic draft rather than fail.
    return { ok: true, draft: baseline };
  }
}

// Persists a wizard-built profile and submits it straight into EHS review —
// "mandatory human approval before anything is finalized". Stores the chemical
// composition, the guided answers, and the AI suggestions alongside the
// reviewed fields.
export async function submitWasteProfileFromWizard(input: {
  name: string;
  waste_stream_id?: string | null;
  waste_code?: string | null;
  classification: string;
  physical_state?: string | null;
  process_description?: string | null;
  hazard_summary?: string | null;
  composition: WasteProfileConstituent[];
  questionnaire: Record<string, string>;
  ai_suggestions: WasteProfileAiSuggestions | null;
}): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  if (MOCK_MODE) return { ok: true, id: null };
  const ctx = await getCtx();
  if (!ctx) return { ok: false, error: "Session expired — please reload." };

  const name = input?.name?.trim();
  if (!name) return { ok: false, error: "Profile name is required." };
  const composition = Array.isArray(input?.composition) ? input.composition : [];
  if (composition.length === 0) return { ok: false, error: "Add at least one chemical to the profile." };

  const nowIso = new Date().toISOString();
  const { data, error } = await ctx.client
    .from("waste_profiles")
    .insert({
      tenant_id:           ctx.tenantId,
      site_id:             ctx.siteId,
      waste_stream_id:     input.waste_stream_id || null,
      name,
      waste_code:          input.waste_code || null,
      classification:      input.classification || "hazardous",
      physical_state:      input.physical_state || null,
      process_description: input.process_description || null,
      hazard_summary:      input.hazard_summary || null,
      composition,
      questionnaire:       input.questionnaire ?? {},
      ai_suggestions:      input.ai_suggestions ?? null,
      state:               "ehs_review",   // submitted for mandatory human approval
      submitted_by:        ctx.profileId,
      submitted_at:        nowIso,
      created_by:          ctx.profileId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/waste");
  return { ok: true, id: (data?.id as string) ?? null };
}


