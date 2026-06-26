// Chemical storage-class and PPE reference data — dropdown options for the
// chemical module. Sourced from the GHS/SDS reference library. Codes are stored
// in chemical_inventory.storage_class (single) and .recommended_ppe (array).

export interface StorageClass {
  code: string;
  name: string;
  /** Short segregation hint shown under the dropdown. */
  hint: string;
}

export const STORAGE_CLASSES: StorageClass[] = [
  { code: "GENERAL",         name: "General Chemical Storage", hint: "Non-reactive products with no special incompatibility per SDS." },
  { code: "FLAMMABLE",       name: "Flammable Liquid",         hint: "Approved flammable cabinet; keep from ignition sources, oxidizers." },
  { code: "COMBUSTIBLE",     name: "Combustible Liquid",       hint: "Lower volatility than flammables; separate from oxidizers." },
  { code: "AEROSOL",         name: "Aerosol / Pressurized",    hint: "Protect from heat/sunlight; do not puncture or burn." },
  { code: "FLAMMABLE_GAS",   name: "Flammable Gas",            hint: "Secure cylinders; separate from oxidizers/oxygen." },
  { code: "COMPRESSED_GAS",  name: "Compressed Gas",           hint: "Non-flammable; secure upright, protect valves, ventilate." },
  { code: "OXIDIZER",        name: "Oxidizer",                 hint: "Separate from flammables, combustibles, reducing agents." },
  { code: "OXIDIZER_GAS",    name: "Oxidizing Gas",            hint: "Keep fittings free of oil/grease; separate from flammable gases." },
  { code: "CORROSIVE_ACID",  name: "Corrosive Acid",           hint: "Acid cabinet; separate from bases, cyanides, sulfides, metals." },
  { code: "CORROSIVE_BASE",  name: "Corrosive Base",           hint: "Base cabinet; separate from acids and incompatible metals." },
  { code: "TOXIC",           name: "Toxic / Poison",           hint: "Locked storage; restrict access; ventilate." },
  { code: "IRRITANT",        name: "Irritant / Sensitizer",    hint: "Keep closed and labeled; use required PPE." },
  { code: "WATER_REACTIVE",  name: "Water Reactive",           hint: "Keep dry; separate from aqueous products and humidity." },
  { code: "EXPLOSIVE",       name: "Explosive / Highly Reactive", hint: "Dedicated reactive storage; EHS approval required." },
  { code: "SEPARATE_REVIEW", name: "Separate / Review Required", hint: "Use when SDS or compatibility is uncertain; quarantine." },
];

export interface PpeType {
  code: string;
  name: string;
  category: "eye_face" | "hand" | "body" | "respiratory" | "foot" | "engineering_control";
}

export const PPE_TYPES: PpeType[] = [
  { code: "SAFETY_GLASSES",   name: "Safety Glasses",            category: "eye_face" },
  { code: "CHEMICAL_GOGGLES", name: "Chemical Splash Goggles",   category: "eye_face" },
  { code: "FACE_SHIELD",      name: "Face Shield",               category: "eye_face" },
  { code: "NITRILE_GLOVES",   name: "Nitrile Gloves",            category: "hand" },
  { code: "NEOPRENE_GLOVES",  name: "Neoprene Gloves",           category: "hand" },
  { code: "BUTYL_GLOVES",     name: "Butyl Rubber Gloves",       category: "hand" },
  { code: "CHEMICAL_APRON",   name: "Chemical Apron",            category: "body" },
  { code: "LAB_COAT",         name: "Lab Coat / Chemical Coat",  category: "body" },
  { code: "FR_CLOTHING",      name: "Flame-Resistant Clothing",  category: "body" },
  { code: "RESPIRATOR",       name: "Respirator",                category: "respiratory" },
  { code: "VENTILATION",      name: "Local Exhaust / Ventilation", category: "engineering_control" },
  { code: "STEEL_TOE",        name: "Safety Footwear",           category: "foot" },
];

const STORAGE_CLASS_NAMES = Object.fromEntries(STORAGE_CLASSES.map((s) => [s.code, s.name]));
const PPE_NAMES = Object.fromEntries(PPE_TYPES.map((p) => [p.code, p.name]));

export function getStorageClassName(code: string | null | undefined): string {
  if (!code) return "";
  return STORAGE_CLASS_NAMES[code] ?? code;
}

export function getPpeName(code: string): string {
  return PPE_NAMES[code] ?? code;
}
