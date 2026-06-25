"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  recordReviewDecision, validateRecordInBackground, backfillValidations,
  setGuardrail, addQualification, setQualificationStatus, setMemoryActive, deleteMemory,
} from "@/lib/csp/repo";
import { runStandup } from "@/lib/csp/standup";
import type { CspRecordType, CspQualKind } from "@/lib/csp/types";

/**
 * Record a credentialed human review decision (the superadmin sign-off surface).
 * RLS enforces tenant/admin scoping; this action shapes the form and revalidates.
 */
export async function submitCspReviewDecision(_prev: unknown, formData: FormData) {
  const runId = String(formData.get("run_id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  const reviewerName = String(formData.get("reviewer_name") || "").trim();
  const decision = String(formData.get("decision") || "") as
    "approved" | "approved_with_changes" | "rejected" | "escalated";
  const decisionSummary = String(formData.get("decision_summary") || "").trim();

  if (!runId || !tenantId) return { ok: false, error: "Missing run reference." };
  if (!reviewerName) return { ok: false, error: "Reviewer name is required for sign-off." };
  if (!decisionSummary) return { ok: false, error: "A decision summary is required." };
  if (!["approved", "approved_with_changes", "rejected", "escalated"].includes(decision)) {
    return { ok: false, error: "Select a decision." };
  }

  const res = await recordReviewDecision({
    runId,
    queueId: (formData.get("queue_id") as string) || null,
    tenantId,
    reviewerName,
    reviewerCredentials: String(formData.get("reviewer_credentials") || "").trim(),
    decision,
    decisionSummary,
    reviewerNotes: String(formData.get("reviewer_notes") || "").trim(),
    signatureText: `${reviewerName} — ${new Date().toISOString()}`,
  });
  if (!res.ok) return res;

  revalidatePath("/sa/validation");
  return { ok: true };
}

/**
 * Re-run validation on a run's source record WITH the AI narrative enabled.
 * Fetches the live module row by (source_type, source_id) and persists a fresh
 * run. Used from the panel when a reviewer wants the model's read.
 */
export async function rerunCspValidation(runId: string) {
  const client = await createSupabaseServerClient();
  if (!client) return { ok: false, error: "Session expired — please reload." };

  const { data: run } = await client
    .from("csp_validation_runs")
    .select("source_type, source_id, site_id")
    .eq("id", runId)
    .maybeSingle();
  if (!run?.source_id) return { ok: false, error: "Source record not found." };

  const table = run.source_type === "incident" ? "incidents"
    : run.source_type === "audit_finding" ? "audit_findings" : null;
  if (!table) return { ok: false, error: `Unsupported record type: ${run.source_type}` };

  const { data: row } = await client.from(table).select("*").eq("id", run.source_id).maybeSingle();
  if (!row) return { ok: false, error: "Source record no longer exists." };

  const newId = await validateRecordInBackground(
    client, run.source_type as CspRecordType, row as Record<string, unknown>, run.site_id, { enrich: true },
  );
  revalidatePath("/sa/validation");
  return newId ? { ok: true } : { ok: false, error: "Validation failed to persist." };
}

/** Validate every existing incident that doesn't yet have a run (one-time backfill). */
export async function backfillCspValidations() {
  const res = await backfillValidations({ enrich: false, limit: 200 });
  revalidatePath("/sa/validation");
  return { ok: true, ...res };
}

// ── Agent Profile: guardrails / qualifications / memory ───────────────────────

export async function toggleGuardrail(key: string, enabled: boolean) {
  const res = await setGuardrail(key, { enabled });
  revalidatePath("/sa/validation");
  return res;
}

export async function updateGuardrailThreshold(key: string, threshold: number) {
  const res = await setGuardrail(key, { threshold });
  revalidatePath("/sa/validation");
  return res;
}

export async function grantQualification(_prev: unknown, formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  const kind = String(formData.get("kind") || "certification") as CspQualKind;
  if (!title) return { ok: false, error: "Title is required." };
  const scope = formData.getAll("scope").map((s) => String(s) as CspRecordType);
  const res = await addQualification({
    kind,
    title,
    description: String(formData.get("description") || "").trim() || undefined,
    scopeRecordTypes: scope,
    grantsAutonomy: formData.get("grants_autonomy") === "on",
    grantedBy: String(formData.get("granted_by") || "Reliance Admin").trim() || "Reliance Admin",
  });
  revalidatePath("/sa/validation");
  return res;
}

export async function revokeQualification(id: string) {
  const res = await setQualificationStatus(id, "revoked");
  revalidatePath("/sa/validation");
  return res;
}

export async function reinstateQualification(id: string) {
  const res = await setQualificationStatus(id, "active");
  revalidatePath("/sa/validation");
  return res;
}

export async function toggleMemoryLesson(id: string, active: boolean) {
  const res = await setMemoryActive(id, active);
  revalidatePath("/sa/validation");
  return res;
}

export async function removeMemoryLesson(id: string) {
  const res = await deleteMemory(id);
  revalidatePath("/sa/validation");
  return res;
}

// ── Daily agent standup (GUS × EHS Validation Agent) ──────────────────────────

export async function conveneAgentStandup() {
  const client = await createSupabaseServerClient();
  if (!client) return { ok: false, error: "Session expired — please reload." };
  const meeting = await runStandup(client, { now: Date.now(), generatedBy: "superadmin", enrich: true });
  revalidatePath("/sa/standup");
  return meeting
    ? { ok: true, gaps: meeting.gaps_found.length, actions: meeting.action_items.length }
    : { ok: false, error: "Standup did not generate — superadmin rights and the meetings table are required." };
}
