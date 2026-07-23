// Shared TypeScript types for the NFPA 704 domain model.
//
// SCHEMA-MAPPING NOTE (read before editing): the SafetyIQ data model has no
// `buildings` / `storage_areas` / `containers` tables. This feature binds the
// NFPA 704 roll-up hierarchy onto the data that actually exists:
//
//   Building     → `sites` row
//   Storage Area → a `chemical_inventory.storage_location` group within a site
//   Container    → a `chemical_inventory` row (each chemical is a physical container)
//
// The type names below keep the NFPA domain vocabulary (Container / StorageArea /
// Building) because that is the language of the standard and of the posting; the
// mapping above is where those names touch real rows.

export type NfpaCategory = 'health' | 'flammability' | 'instability';

export type NfpaSpecialHazard =
  | 'OX'   // Oxidizer
  | 'W'    // Water reactive (rendered as W with strike-through)
  | 'SA'   // Simple asphyxiant
  | 'COR'  // Corrosive
  | 'BIO'  // Biohazard (non-standard, org convention if used)
  | 'ACID'
  | 'ALK'  // Alkali
  | 'RAD'; // Radioactive (non-standard, org convention if used)

export interface NfpaRating {
  health: number | null;        // 0-4, null = not yet entered
  flammability: number | null;  // 0-4, null = not yet entered
  instability: number | null;   // 0-4, null = not yet entered
  specialHazards: NfpaSpecialHazard[];
  isComplete: boolean; // true only if health/flammability/instability all non-null
}

export interface ContainerNfpa {
  containerId: string;   // chemical_inventory.id
  chemicalName: string;
  storageAreaId: string; // storage_location group key
  rating: NfpaRating;
  source: 'sds' | 'manual' | 'unrated';
}

export interface StorageAreaNfpaRollup {
  storageAreaId: string;
  storageAreaName: string; // user-facing label, formerly "control zone"
  buildingId: string;      // site id
  rating: NfpaRating;
  containerCount: number;
  unratedContainerCount: number;
  // Which container drove each category's max, for traceability.
  worstContainerIds: Partial<Record<NfpaCategory, string>>;
}

export interface BuildingNfpaRollup {
  buildingId: string;   // site id
  buildingName: string; // site name
  rating: NfpaRating;
  storageAreaCount: number;
  unratedContainerCount: number;
  worstStorageAreaIds: Partial<Record<NfpaCategory, string>>;
  generatedAt: string;
}
