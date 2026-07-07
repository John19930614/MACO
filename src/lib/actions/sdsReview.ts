"use server";

// Sets or resets a chemical's SDS review due date — used by the "Upload New
// SDS" / reset-clock quick action on flagged Chemicals table rows, and by
// manual overrides from the chemical edit form (e.g. a hazard class that
// requires annual review instead of the 3-year default).
//
// Gating follows the same model as every other chemical mutation in this app
// (getCtx() / tenant-scoped RLS client in live mode) — there is no granular
// role system here (profiles.role is a free-text display string like "EHS
// Coordinator", not an enum), so this intentionally does not invent one.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/data/store";
import { MOCK_MODE } from "@/lib/env";
import { computeDefaultReviewDueDate } from "@/lib/sds/sdsStatus";
import { getCtx } from "./ehs-shared";

const inputSchema = z.object({
  chemicalId: z.string().uuid(),
  // If omitted on a new-upload reset, defaults to 3 years from today.
  reviewDueDate: z.string().date().optional(),
  markAsNewUpload: z.boolean().default(false),
});

export type SetSdsReviewDateInput = z.infer<typeof inputSchema>;
export type SetSdsReviewDateResult = { ok: true } | { ok: false; error: string };

export async function setSdsReviewDate(input: SetSdsReviewDateInput): Promise<SetSdsReviewDateResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the highlighted fields." };
  }

  const { chemicalId, reviewDueDate, markAsNewUpload } = parsed.data;
  const now = new Date();

  let sdsExpiry: string;
  if (markAsNewUpload) {
    sdsExpiry = reviewDueDate ?? computeDefaultReviewDueDate(now);
  } else if (reviewDueDate) {
    sdsExpiry = reviewDueDate;
  } else {
    return { ok: false, error: "Please provide a review due date or mark as new upload." };
  }

  if (!MOCK_MODE) {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: "Session expired — please reload." };
    const updates: Record<string, unknown> = { sds_expiry: sdsExpiry, updated_at: now.toISOString() };
    if (markAsNewUpload) updates.sds_uploaded_at = now.toISOString();
    const { error } = await ctx.client
      .from("chemical_inventory")
      .update(updates)
      .eq("id", chemicalId)
      .eq("tenant_id", ctx.tenantId);
    if (error) return { ok: false, error: "Something went wrong saving the SDS review date. Please try again." };
  } else {
    const store = getStore();
    const idx = store.chemicals.findIndex((c) => c.id === chemicalId);
    if (idx === -1) return { ok: false, error: "Chemical not found." };
    store.chemicals[idx] = { ...store.chemicals[idx], sds_expiry: sdsExpiry, updated_at: now.toISOString() };
  }

  revalidatePath("/chemicals");
  revalidatePath("/dashboard");
  return { ok: true };
}
