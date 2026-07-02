"use server";

// Document Activity — a unified, read-only view of the Documents & Programs module.
// Groups the tenant's documents into five human-readable buckets (recently created,
// under review, waiting for approval, missing paperwork, ready to download) and
// stamps each with a plain-language status badge.
//
// Follows the established server-action pattern (see exportChemicalSummaries.ts):
//   - "use server", tenant resolved via getEffectiveTenantId() (RLS-/MOCK-safe),
//   - reads through the existing data layer (getDocuments / getProfiles / requiredPrograms),
//   - never mutates a record, returns a structured { success, data?, error? } result.
//
// No DB writes and no schema migration are required — every field is derived from
// data the platform already stores. Pure types + grouping logic live in
// @/lib/documents/activity (a "use server" module may only export async functions).

import { getDocuments, getProfiles, getChemicals, getBiosafetyLabs, getWasteStreams } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { requiredPrograms } from "@/lib/ai/programBuilder";
import { groupDocumentActivity, type GetDocumentActivityResult } from "@/lib/documents/activity";

/**
 * Fetches and groups document activity for the current tenant.
 * Reads through the existing tenant-scoped data layer only (no direct DB writes,
 * no migration). Returns empty sections — never throws — on any failure.
 */
export async function getDocumentActivity(): Promise<GetDocumentActivityResult> {
  try {
    const tenantId = await getEffectiveTenantId();

    const [docs, profiles, chemicals, biosafetyLabs, wasteStreams] = await Promise.all([
      getDocuments(tenantId),
      getProfiles(tenantId),
      getChemicals(tenantId),
      getBiosafetyLabs(tenantId),
      getWasteStreams(tenantId),
    ]);

    const ownerNameById = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

    // Which required programs the tenant is missing (no matching doc by regulation or title).
    const existingRefs = new Set(docs.map((d) => d.regulation_ref).filter(Boolean));
    const existingTitles = new Set(docs.map((d) => d.title));
    const missing = requiredPrograms({ chemicals, biosafetyLabs, wasteStreams })
      .filter((p) => !existingRefs.has(p.regulation) && !existingTitles.has(p.title))
      .map((p) => ({ title: p.title, regulation: p.regulation }));

    const data = groupDocumentActivity(docs, missing, ownerNameById, Date.now());
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error fetching document activity.";
    return { success: false, error: message };
  }
}
