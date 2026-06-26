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

// ── Common chemical starter library ──────────────────────────────────────────
// Picking one of these on the Add form auto-fills name, CAS, storage class,
// hazard codes (which in turn derive signal word + pictograms), and PPE.
// Sourced from the platform's GHS/SDS starter library. STARTER DATA ONLY —
// every record must be verified against the current supplier SDS before approval.

export interface CommonChemical {
  name: string;
  commonName: string;
  cas: string;              // "" if not applicable (mixtures/petroleum distillates)
  storageClass: string;     // STORAGE_CLASSES code
  hazardCodes: string[];    // H-codes
  ppe: string[];            // PPE_TYPES codes
}

export const COMMON_CHEMICALS: CommonChemical[] = [
  { name: "Acetone", commonName: "Acetone solvent", cas: "67-64-1", storageClass: "FLAMMABLE", hazardCodes: ["H225", "H319", "H336"], ppe: ["SAFETY_GLASSES", "CHEMICAL_GOGGLES", "NITRILE_GLOVES", "VENTILATION"] },
  { name: "Isopropyl Alcohol 70%", commonName: "IPA 70%", cas: "67-63-0", storageClass: "FLAMMABLE", hazardCodes: ["H225", "H319", "H336"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES", "VENTILATION"] },
  { name: "Ethanol 70%", commonName: "Ethyl alcohol 70%", cas: "64-17-5", storageClass: "FLAMMABLE", hazardCodes: ["H225", "H319"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES", "VENTILATION"] },
  { name: "Mineral Spirits", commonName: "Paint thinner / petroleum distillate", cas: "", storageClass: "FLAMMABLE", hazardCodes: ["H226", "H304", "H336"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES", "VENTILATION"] },
  { name: "Gasoline", commonName: "Unleaded gasoline", cas: "8006-61-9", storageClass: "FLAMMABLE", hazardCodes: ["H224", "H304", "H315", "H336", "H340", "H350", "H411"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES", "VENTILATION", "FR_CLOTHING"] },
  { name: "Diesel Fuel", commonName: "Diesel", cas: "68334-30-5", storageClass: "COMBUSTIBLE", hazardCodes: ["H226", "H304", "H315", "H351", "H373"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES", "VENTILATION"] },
  { name: "Sodium Hypochlorite Solution / Bleach", commonName: "Bleach 5-6%", cas: "7681-52-9", storageClass: "OXIDIZER", hazardCodes: ["H290", "H315", "H319", "H400"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "VENTILATION"] },
  { name: "Ammonium Hydroxide Solution", commonName: "Ammonia cleaner", cas: "1336-21-6", storageClass: "CORROSIVE_BASE", hazardCodes: ["H314", "H335", "H400"], ppe: ["CHEMICAL_GOGGLES", "FACE_SHIELD", "NITRILE_GLOVES", "VENTILATION"] },
  { name: "Hydrochloric Acid", commonName: "Muriatic acid / HCl solution", cas: "7647-01-0", storageClass: "CORROSIVE_ACID", hazardCodes: ["H290", "H314", "H335"], ppe: ["CHEMICAL_GOGGLES", "FACE_SHIELD", "NEOPRENE_GLOVES", "CHEMICAL_APRON", "VENTILATION"] },
  { name: "Sulfuric Acid", commonName: "Battery acid", cas: "7664-93-9", storageClass: "CORROSIVE_ACID", hazardCodes: ["H290", "H314"], ppe: ["CHEMICAL_GOGGLES", "FACE_SHIELD", "NEOPRENE_GLOVES", "CHEMICAL_APRON"] },
  { name: "Sodium Hydroxide Solution", commonName: "Caustic soda / lye", cas: "1310-73-2", storageClass: "CORROSIVE_BASE", hazardCodes: ["H290", "H314"], ppe: ["CHEMICAL_GOGGLES", "FACE_SHIELD", "NEOPRENE_GLOVES", "CHEMICAL_APRON"] },
  { name: "Hydrogen Peroxide 3%", commonName: "Hydrogen peroxide solution", cas: "7722-84-1", storageClass: "OXIDIZER", hazardCodes: ["H319"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES"] },
  { name: "Methanol", commonName: "Methyl alcohol", cas: "67-56-1", storageClass: "FLAMMABLE", hazardCodes: ["H225", "H301", "H311", "H331", "H370"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "VENTILATION", "RESPIRATOR"] },
  { name: "Propane", commonName: "Propane cylinder", cas: "74-98-6", storageClass: "FLAMMABLE_GAS", hazardCodes: ["H220", "H280"], ppe: ["SAFETY_GLASSES"] },
  { name: "Oxygen, Compressed", commonName: "Compressed oxygen cylinder", cas: "7782-44-7", storageClass: "OXIDIZER_GAS", hazardCodes: ["H270", "H280"], ppe: ["SAFETY_GLASSES"] },
  { name: "Nitrogen, Compressed", commonName: "Compressed nitrogen cylinder", cas: "7727-37-9", storageClass: "COMPRESSED_GAS", hazardCodes: ["H280"], ppe: ["SAFETY_GLASSES"] },
  { name: "Carbon Dioxide, Compressed", commonName: "CO2 cylinder", cas: "124-38-9", storageClass: "COMPRESSED_GAS", hazardCodes: ["H280"], ppe: ["SAFETY_GLASSES"] },
  { name: "Ethylene Glycol Antifreeze", commonName: "Antifreeze / coolant", cas: "107-21-1", storageClass: "TOXIC", hazardCodes: ["H302", "H373"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES"] },
  { name: "Motor Oil", commonName: "Engine oil", cas: "", storageClass: "COMBUSTIBLE", hazardCodes: [], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES"] },
  { name: "Hydraulic Fluid", commonName: "Hydraulic oil", cas: "", storageClass: "COMBUSTIBLE", hazardCodes: [], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES"] },
  { name: "Epoxy Resin Part A", commonName: "Epoxy resin component", cas: "", storageClass: "IRRITANT", hazardCodes: ["H315", "H317", "H319", "H411"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "VENTILATION"] },
  { name: "Epoxy Hardener Part B", commonName: "Epoxy hardener component", cas: "", storageClass: "CORROSIVE_BASE", hazardCodes: ["H314", "H317", "H412"], ppe: ["CHEMICAL_GOGGLES", "FACE_SHIELD", "NITRILE_GLOVES", "CHEMICAL_APRON", "VENTILATION"] },
  { name: "Portland Cement", commonName: "Cement powder", cas: "65997-15-1", storageClass: "IRRITANT", hazardCodes: ["H315", "H317", "H318", "H335"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "RESPIRATOR", "VENTILATION"] },
  { name: "Crystalline Silica, Quartz", commonName: "Silica sand / quartz", cas: "14808-60-7", storageClass: "TOXIC", hazardCodes: ["H350", "H372"], ppe: ["SAFETY_GLASSES", "RESPIRATOR", "VENTILATION"] },
  { name: "Calcium Chloride", commonName: "Ice melt / desiccant", cas: "10043-52-4", storageClass: "IRRITANT", hazardCodes: ["H319"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES"] },
  { name: "PVC Primer / Solvent Cement", commonName: "PVC solvent cement/primer", cas: "", storageClass: "FLAMMABLE", hazardCodes: ["H225", "H319", "H336", "H351"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "VENTILATION"] },
  { name: "Aerosol Lubricant", commonName: "General aerosol lubricant", cas: "", storageClass: "AEROSOL", hazardCodes: ["H222", "H229", "H304"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES", "VENTILATION"] },
  { name: "Sodium Chloride", commonName: "Salt", cas: "7647-14-5", storageClass: "GENERAL", hazardCodes: [], ppe: ["SAFETY_GLASSES"] },
];
