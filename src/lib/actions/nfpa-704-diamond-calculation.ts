"use server";

import { z } from "zod";
import { getServerTenantId } from "@/lib/auth/session";
import { resolveCallerRole } from "@/lib/auth/resolve-role";
import { canManage } from "@/lib/constants";
import { getSites } from "@/lib/data/repo";
import { getChemicals } from "@/lib/data/ehsRepo";
import { rollupStorageArea, rollupBuilding } from "@/lib/nfpa704/rollup";
import { deriveRatingFromHCodes } from "@/lib/nfpa704/deriveRating";
import { NFPA704_BETA_ENABLED } from "@/lib/nfpa704/flag";
import type { ContainerNfpa } from "@/lib/nfpa704/types";

// NOTE (adapted from the ticket): the SafetyIQ schema has no `buildings`,
// `storage_areas`, or `containers` tables and no `createServerActionClient` /
// `requireAdmin` helpers. The NFPA hierarchy is mapped onto real data:
//   Building     = a `sites` row (buildingId === site id)
//   Storage Area = a `chemical_inventory.storage_location` group within the site
//   Container    = a `chemical_inventory` row
// Ratings are derived from each chemical's GHS H-statements (no stored NFPA
// columns exist). Access is a server-side manager/admin role check that mirrors
// the tenant RLS on chemical_inventory — there is no requireAdmin() in this repo.

const inputSchema = z.object({
  // Named buildingId to match the domain vocabulary and the route segment; the
  // value is a `sites.id`. Not constrained to .uuid() — live site ids are UUIDs
  // but the mock/demo dataset uses slugs like "s-biostar-main-001". The lookup
  // is tenant-scoped, so an unknown id simply resolves to "Building not found".
  buildingId: z.string().min(1),
});

const UNASSIGNED = "__unassigned__";

export async function getBuildingNfpaPosting(input: unknown) {
  const { buildingId } = inputSchema.parse(input);

  if (!NFPA704_BETA_ENABLED) {
    throw new Error(
      "NFPA 704 Ratings is turned off (nfpa704_beta). It stays off until an EHS / fire-safety expert signs off.",
    );
  }

  // Admin/manager-gated per design constraints (no requireAdmin() exists here).
  const role = await resolveCallerRole();
  if (!role || !canManage(role)) {
    throw new Error("You do not have permission to view NFPA 704 postings.");
  }

  const tenantId = await getServerTenantId();
  if (!tenantId) {
    throw new Error("No authenticated tenant found for this session.");
  }

  const site = (await getSites()).find(
    (s) => s.id === buildingId && s.tenant_id === tenantId,
  );
  if (!site) {
    throw new Error("Building not found. Please check the highlighted fields.");
  }

  const chemicals = (await getChemicals(tenantId)).filter(
    (c) => c.site_id === buildingId,
  );

  // Each chemical is a container; its storage_location is its storage area.
  const containers: ContainerNfpa[] = chemicals.map((c) => {
    const hCodes = c.hazard_statements ?? [];
    const rating = deriveRatingFromHCodes(hCodes);
    const areaKey = (c.storage_location || "").trim() || UNASSIGNED;
    return {
      containerId: c.id,
      chemicalName: c.name,
      storageAreaId: areaKey,
      rating,
      // Derived from the stored GHS/SDS classification when hazard data exists,
      // otherwise explicitly unrated (drives the "Rating not yet entered" flag).
      source: rating.isComplete ? "sds" : "unrated",
    };
  });

  // Distinct storage areas actually present in this building, preserving a
  // stable, readable label (the raw storage_location text).
  const areaLabels = new Map<string, string>();
  chemicals.forEach((c) => {
    const key = (c.storage_location || "").trim() || UNASSIGNED;
    if (!areaLabels.has(key)) {
      areaLabels.set(key, key === UNASSIGNED ? "Unassigned storage location" : key);
    }
  });

  const storageAreaRollups = Array.from(areaLabels.entries()).map(([key, label]) =>
    rollupStorageArea(key, label, buildingId, containers),
  );

  const buildingRollup = rollupBuilding(buildingId, site.name, storageAreaRollups);

  return { building: buildingRollup, storageAreas: storageAreaRollups };
}
