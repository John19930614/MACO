"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { MOCK_MODE } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getYoungWorkerAccess } from "@/lib/young-worker/access";

// NOTE (adapted): the platform has no `workers` table — a young worker is a
// profiles row — and it is tenant-scoped (tenant_id), not org_id. Auth is a
// server-side role check (getYoungWorkerAccess) that mirrors the table's RLS;
// there is no `requireRole` helper in this repo.

const YoungWorkerSchema = z.object({
  profileId: z.string().uuid(),
  dob: z.string().min(1), // ISO date
  homeState: z.string().length(2),
  workState: z.string().length(2),
  schoolStatus: z.enum(["enrolled", "not_enrolled", "graduated", "ged", "homeschool"]),
  schoolCalendarId: z.string().uuid().optional().nullable(),
  classification: z.enum([
    "paid_intern",
    "unpaid_intern",
    "student_learner",
    "youth_apprentice",
    "job_shadow",
    "volunteer",
    "temp",
  ]),
  workPermitNumber: z.string().optional().nullable(),
  workPermitIssueDate: z.string().optional().nullable(),
  workPermitExpiryDate: z.string().optional().nullable(),
  workPermitDocumentUrl: z.string().url().optional().nullable().or(z.literal("")),
  parentGuardianName: z.string().optional().nullable(),
  parentGuardianRelationship: z.string().optional().nullable(),
  parentGuardianSignatureUrl: z.string().url().optional().nullable().or(z.literal("")),
  caPermitToEmployNumber: z.string().optional().nullable(),
  caPermitToEmployIssuedAt: z.string().optional().nullable(),
  caPermitToWorkNumber: z.string().optional().nullable(),
  caPermitToWorkIssuedAt: z.string().optional().nullable(),
});

export type UpsertResult =
  | { ok: true; data?: unknown }
  | { ok: false; error: string; issues?: unknown };

// Empty strings from FormData → null; keeps optional date/text columns clean.
const nn = (v: unknown) => (v === "" || v === undefined ? null : (v as string | null));

export async function upsertYoungWorkerProfile(input: unknown): Promise<UpsertResult> {
  const parsed = YoungWorkerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      issues: parsed.error.flatten(),
    };
  }

  const access = await getYoungWorkerAccess();
  if (!access.authorized || !access.tenantId) {
    return {
      ok: false,
      error: "You don't have permission to manage young-worker profiles.",
    };
  }

  const d = parsed.data;
  const now = new Date().toISOString();

  // Mock/demo mode has no database — acknowledge the save so the UI flow works.
  if (MOCK_MODE) {
    return { ok: true, data: { ...d, tenant_id: access.tenantId, updated_at: now } };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Session expired — please reload." };

  const { data, error } = await supabase
    .from("young_workers")
    .upsert(
      {
        tenant_id: access.tenantId,
        profile_id: d.profileId,
        dob: d.dob,
        dob_verified: true,
        dob_verified_by: access.profileId,
        dob_verified_at: now,
        home_state: d.homeState,
        work_state: d.workState,
        school_status: d.schoolStatus,
        school_calendar_id: d.schoolCalendarId ?? null,
        classification: d.classification,
        work_permit_number: nn(d.workPermitNumber),
        work_permit_issue_date: nn(d.workPermitIssueDate),
        work_permit_expiry_date: nn(d.workPermitExpiryDate),
        work_permit_document_url: nn(d.workPermitDocumentUrl),
        parent_guardian_name: nn(d.parentGuardianName),
        parent_guardian_relationship: nn(d.parentGuardianRelationship),
        parent_guardian_authorized_at: d.parentGuardianName ? now : null,
        parent_guardian_signature_url: nn(d.parentGuardianSignatureUrl),
        ca_permit_to_employ_number: nn(d.caPermitToEmployNumber),
        ca_permit_to_employ_issued_at: nn(d.caPermitToEmployIssuedAt),
        ca_permit_to_work_number: nn(d.caPermitToWorkNumber),
        ca_permit_to_work_issued_at: nn(d.caPermitToWorkIssuedAt),
        updated_at: now,
      },
      { onConflict: "profile_id" },
    )
    .select()
    .single();

  if (error) {
    return { ok: false, error: "We couldn't save this profile. Please try again." };
  }

  revalidatePath("/team/young-workers");
  return { ok: true, data };
}
