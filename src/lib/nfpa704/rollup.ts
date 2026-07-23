// Pure, unit-testable NFPA 704 roll-up logic. Worst-case-per-category
// aggregation, no volume dilution. Flags incomplete data explicitly rather
// than defaulting to 0. No IO here so it runs in the node test env and on the
// server unchanged.

import type {
  ContainerNfpa,
  NfpaRating,
  StorageAreaNfpaRollup,
  BuildingNfpaRollup,
  NfpaCategory,
} from './types';

// TODO: SME-VERIFIED? — Aggregation rule assumed: for each of Health/Flammability/
// Instability, the rolled-up rating = MAX value present among ALL rated containers
// in scope (storage area, or across storage areas for the building). This is the
// standard NFPA 704 posting philosophy (worst credible hazard drives the posted
// number) — it is intentionally NOT a volume-weighted average and NOT a simple
// "take the single highest container's full rating" (a container that is high in
// Health but low in Flammability should not force the whole area's Flammability up).
// This must be confirmed by an EHS/fire-safety SME before the nfpa704_beta flag is
// enabled in any environment used for real postings.

function maxOrNull(values: Array<number | null>): number | null {
  const rated = values.filter((v): v is number => v !== null);
  if (rated.length === 0) return null;
  return Math.max(...rated);
}

function unionSpecialHazards(ratings: NfpaRating[]): NfpaRating['specialHazards'] {
  const set = new Set<string>();
  ratings.forEach((r) => r.specialHazards.forEach((h) => set.add(h)));
  return Array.from(set) as NfpaRating['specialHazards'];
}

function isComplete(
  rating: Pick<NfpaRating, 'health' | 'flammability' | 'instability'>,
): boolean {
  return (
    rating.health !== null &&
    rating.flammability !== null &&
    rating.instability !== null
  );
}

export function rollupStorageArea(
  storageAreaId: string,
  storageAreaName: string,
  buildingId: string,
  containers: ContainerNfpa[],
): StorageAreaNfpaRollup {
  const inArea = containers.filter((c) => c.storageAreaId === storageAreaId);
  const ratings = inArea.map((c) => c.rating);

  const health = maxOrNull(ratings.map((r) => r.health));
  const flammability = maxOrNull(ratings.map((r) => r.flammability));
  const instability = maxOrNull(ratings.map((r) => r.instability));
  const specialHazards = unionSpecialHazards(ratings);

  const worstContainerIds: Partial<Record<NfpaCategory, string>> = {};
  (['health', 'flammability', 'instability'] as NfpaCategory[]).forEach((cat) => {
    const max = { health, flammability, instability }[cat];
    if (max === null) return;
    const found = inArea.find((c) => c.rating[cat] === max);
    if (found) worstContainerIds[cat] = found.containerId;
  });

  const rating: NfpaRating = {
    health,
    flammability,
    instability,
    specialHazards,
    isComplete: isComplete({ health, flammability, instability }),
  };

  return {
    storageAreaId,
    storageAreaName,
    buildingId,
    rating,
    containerCount: inArea.length,
    unratedContainerCount: inArea.filter(
      (c) => c.source === 'unrated' || !isComplete(c.rating),
    ).length,
    worstContainerIds,
  };
}

export function rollupBuilding(
  buildingId: string,
  buildingName: string,
  storageAreas: StorageAreaNfpaRollup[],
): BuildingNfpaRollup {
  const inBuilding = storageAreas.filter((a) => a.buildingId === buildingId);
  const ratings = inBuilding.map((a) => a.rating);

  const health = maxOrNull(ratings.map((r) => r.health));
  const flammability = maxOrNull(ratings.map((r) => r.flammability));
  const instability = maxOrNull(ratings.map((r) => r.instability));
  const specialHazards = unionSpecialHazards(ratings);

  const worstStorageAreaIds: Partial<Record<NfpaCategory, string>> = {};
  (['health', 'flammability', 'instability'] as NfpaCategory[]).forEach((cat) => {
    const max = { health, flammability, instability }[cat];
    if (max === null) return;
    const found = inBuilding.find((a) => a.rating[cat] === max);
    if (found) worstStorageAreaIds[cat] = found.storageAreaId;
  });

  return {
    buildingId,
    buildingName,
    rating: {
      health,
      flammability,
      instability,
      specialHazards,
      isComplete: isComplete({ health, flammability, instability }),
    },
    storageAreaCount: inBuilding.length,
    unratedContainerCount: inBuilding.reduce(
      (sum, a) => sum + a.unratedContainerCount,
      0,
    ),
    worstStorageAreaIds,
    generatedAt: new Date().toISOString(),
  };
}
