"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordReviewDecision, validateRecordInBackground, backfillValidations } from "@/lib/csp/repo";
import type { CspRecordType } from "@/lib/csp/types";

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
