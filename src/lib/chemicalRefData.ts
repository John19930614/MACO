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
// hazard codes (which derive signal word + pictograms), precautionary codes,
// PPE, and (where applicable) the Scheduled/Regulated flag + citation.
// Combines the platform GHS/SDS starter library with the Reliance Common Lab
// Chemical Quick Fill Matrix. STARTER DATA ONLY — every record must be verified
// against the current supplier SDS, concentration, and site Chemical Hygiene
// Plan before approval.

export interface CommonChemical {
  name: string;
  commonName: string;
  cas: string;               // "" if not applicable (mixtures/petroleum distillates)
  storageClass: string;      // STORAGE_CLASSES code
  hazardCodes: string[];     // H-codes
  precautionCodes: string[]; // P-codes
  ppe: string[];             // PPE_TYPES codes
  scheduled?: boolean;       // OSHA substance-specific regulated
  scheduleRef?: string;      // regulatory citation when scheduled
}

export const COMMON_CHEMICALS: CommonChemical[] = [
  // ── Solvents & flammables ──────────────────────────────────────────────────
  { name: "Acetone", commonName: "Acetone solvent / propanone", cas: "67-64-1", storageClass: "FLAMMABLE", hazardCodes: ["H225", "H319", "H336"], precautionCodes: ["P210", "P233", "P240", "P305+P351+P338"], ppe: ["SAFETY_GLASSES", "CHEMICAL_GOGGLES", "NITRILE_GLOVES", "LAB_COAT", "VENTILATION"] },
  { name: "Isopropyl Alcohol 70%", commonName: "IPA 70%", cas: "67-63-0", storageClass: "FLAMMABLE", hazardCodes: ["H225", "H319", "H336"], precautionCodes: ["P210", "P233", "P261", "P280"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES", "LAB_COAT"] },
  { name: "Ethanol 70%", commonName: "Ethyl alcohol 70%", cas: "64-17-5", storageClass: "FLAMMABLE", hazardCodes: ["H225", "H319"], precautionCodes: ["P210", "P233", "P280"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES", "LAB_COAT"] },
  { name: "Methanol", commonName: "Methyl alcohol", cas: "67-56-1", storageClass: "FLAMMABLE", hazardCodes: ["H225", "H301", "H311", "H331", "H370"], precautionCodes: ["P210", "P260", "P280", "P301+P310"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "BUTYL_GLOVES", "LAB_COAT", "VENTILATION"] },
  { name: "Acetonitrile", commonName: "ACN / methyl cyanide (HPLC)", cas: "75-05-8", storageClass: "FLAMMABLE", hazardCodes: ["H225", "H302", "H312", "H332", "H319"], precautionCodes: ["P210", "P261", "P280"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "LAB_COAT", "VENTILATION"] },
  { name: "n-Hexane", commonName: "Hexane (extraction solvent)", cas: "110-54-3", storageClass: "FLAMMABLE", hazardCodes: ["H225", "H304", "H315", "H336", "H361", "H373"], precautionCodes: ["P210", "P261", "P273", "P301+P310"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "LAB_COAT", "VENTILATION"] },
  { name: "Heptane", commonName: "n-Heptane", cas: "142-82-5", storageClass: "FLAMMABLE", hazardCodes: ["H225", "H304", "H315", "H336", "H410"], precautionCodes: ["P210", "P261", "P273", "P301+P310"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES", "LAB_COAT", "VENTILATION"] },
  { name: "Toluene", commonName: "Methylbenzene", cas: "108-88-3", storageClass: "FLAMMABLE", hazardCodes: ["H225", "H304", "H315", "H336", "H361", "H373"], precautionCodes: ["P210", "P260", "P280", "P301+P310"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "LAB_COAT", "VENTILATION"] },
  { name: "Xylene", commonName: "Dimethylbenzene", cas: "1330-20-7", storageClass: "FLAMMABLE", hazardCodes: ["H226", "H304", "H315", "H319", "H332"], precautionCodes: ["P210", "P261", "P280"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "LAB_COAT", "VENTILATION"] },
  { name: "Ethyl Acetate", commonName: "Ethyl acetate solvent", cas: "141-78-6", storageClass: "FLAMMABLE", hazardCodes: ["H225", "H319", "H336"], precautionCodes: ["P210", "P233", "P280"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES", "LAB_COAT"] },
  { name: "Mineral Spirits", commonName: "Paint thinner / petroleum distillate", cas: "", storageClass: "FLAMMABLE", hazardCodes: ["H226", "H304", "H336"], precautionCodes: ["P210", "P261", "P301+P310"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES", "VENTILATION"] },
  { name: "Gasoline", commonName: "Unleaded gasoline", cas: "8006-61-9", storageClass: "FLAMMABLE", hazardCodes: ["H224", "H304", "H315", "H336", "H340", "H350", "H411"], precautionCodes: ["P210", "P261", "P280", "P301+P310"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES", "VENTILATION", "FR_CLOTHING"] },
  { name: "Diesel Fuel", commonName: "Diesel", cas: "68334-30-5", storageClass: "COMBUSTIBLE", hazardCodes: ["H226", "H304", "H315", "H351", "H373"], precautionCodes: ["P210", "P261", "P301+P310"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES", "VENTILATION"] },
  { name: "PVC Primer / Solvent Cement", commonName: "PVC solvent cement/primer", cas: "", storageClass: "FLAMMABLE", hazardCodes: ["H225", "H319", "H336", "H351"], precautionCodes: ["P210", "P261", "P280", "P301+P310"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "VENTILATION"] },
  { name: "Aerosol Lubricant", commonName: "General aerosol lubricant", cas: "", storageClass: "AEROSOL", hazardCodes: ["H222", "H229", "H304"], precautionCodes: ["P210", "P251", "P410", "P412"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES", "VENTILATION"] },

  // ── Halogenated / toxic solvents (regulated) ───────────────────────────────
  { name: "Dichloromethane", commonName: "Methylene chloride / DCM", cas: "75-09-2", storageClass: "TOXIC", hazardCodes: ["H315", "H319", "H335", "H351"], precautionCodes: ["P201", "P261", "P280", "P308+P313"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "LAB_COAT", "VENTILATION"], scheduled: true, scheduleRef: "OSHA 29 CFR 1910.1052" },
  { name: "Chloroform", commonName: "Trichloromethane", cas: "67-66-3", storageClass: "TOXIC", hazardCodes: ["H302", "H315", "H351", "H373"], precautionCodes: ["P260", "P280", "P308+P313"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "LAB_COAT", "VENTILATION"] },

  // ── Aldehydes / fixatives (regulated where noted) ──────────────────────────
  { name: "Formaldehyde / Formalin", commonName: "Formalin fixative", cas: "50-00-0", storageClass: "TOXIC", hazardCodes: ["H301", "H311", "H331", "H317", "H350"], precautionCodes: ["P201", "P260", "P280", "P308+P313"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "NEOPRENE_GLOVES", "CHEMICAL_APRON", "VENTILATION"], scheduled: true, scheduleRef: "OSHA 29 CFR 1910.1048" },
  { name: "Glutaraldehyde", commonName: "Glutaraldehyde disinfectant", cas: "111-30-8", storageClass: "TOXIC", hazardCodes: ["H301", "H314", "H317", "H330", "H334"], precautionCodes: ["P260", "P280", "P284", "P303+P361+P353"], ppe: ["CHEMICAL_GOGGLES", "FACE_SHIELD", "NITRILE_GLOVES", "BUTYL_GLOVES", "CHEMICAL_APRON", "VENTILATION"] },

  // ── Acids ──────────────────────────────────────────────────────────────────
  { name: "Hydrochloric Acid", commonName: "Muriatic acid / HCl solution", cas: "7647-01-0", storageClass: "CORROSIVE_ACID", hazardCodes: ["H290", "H314", "H335"], precautionCodes: ["P260", "P280", "P303+P361+P353"], ppe: ["CHEMICAL_GOGGLES", "FACE_SHIELD", "NEOPRENE_GLOVES", "CHEMICAL_APRON", "VENTILATION"] },
  { name: "Sulfuric Acid", commonName: "Battery acid", cas: "7664-93-9", storageClass: "CORROSIVE_ACID", hazardCodes: ["H290", "H314"], precautionCodes: ["P260", "P280", "P301+P330+P331"], ppe: ["CHEMICAL_GOGGLES", "FACE_SHIELD", "NEOPRENE_GLOVES", "CHEMICAL_APRON"] },
  { name: "Nitric Acid", commonName: "Nitric acid (digestion)", cas: "7697-37-2", storageClass: "CORROSIVE_ACID", hazardCodes: ["H272", "H290", "H314"], precautionCodes: ["P220", "P260", "P280"], ppe: ["CHEMICAL_GOGGLES", "FACE_SHIELD", "NEOPRENE_GLOVES", "CHEMICAL_APRON", "VENTILATION"] },
  { name: "Glacial Acetic Acid", commonName: "Glacial acetic acid", cas: "64-19-7", storageClass: "CORROSIVE_ACID", hazardCodes: ["H226", "H314"], precautionCodes: ["P210", "P260", "P280"], ppe: ["CHEMICAL_GOGGLES", "NEOPRENE_GLOVES", "CHEMICAL_APRON", "VENTILATION"] },
  { name: "Phosphoric Acid", commonName: "Phosphoric acid (buffer prep)", cas: "7664-38-2", storageClass: "CORROSIVE_ACID", hazardCodes: ["H314"], precautionCodes: ["P260", "P280", "P305+P351+P338"], ppe: ["CHEMICAL_GOGGLES", "NEOPRENE_GLOVES", "LAB_COAT", "CHEMICAL_APRON"] },

  // ── Bases ──────────────────────────────────────────────────────────────────
  { name: "Sodium Hydroxide Solution", commonName: "Caustic soda / lye", cas: "1310-73-2", storageClass: "CORROSIVE_BASE", hazardCodes: ["H290", "H314"], precautionCodes: ["P260", "P280", "P301+P330+P331"], ppe: ["CHEMICAL_GOGGLES", "FACE_SHIELD", "NEOPRENE_GLOVES", "CHEMICAL_APRON"] },
  { name: "Potassium Hydroxide", commonName: "Caustic potash / KOH", cas: "1310-58-3", storageClass: "CORROSIVE_BASE", hazardCodes: ["H302", "H314", "H290"], precautionCodes: ["P260", "P280", "P303+P361+P353"], ppe: ["CHEMICAL_GOGGLES", "FACE_SHIELD", "NEOPRENE_GLOVES", "CHEMICAL_APRON"] },
  { name: "Ammonium Hydroxide Solution", commonName: "Ammonia cleaner", cas: "1336-21-6", storageClass: "CORROSIVE_BASE", hazardCodes: ["H314", "H335", "H400"], precautionCodes: ["P260", "P273", "P280"], ppe: ["CHEMICAL_GOGGLES", "FACE_SHIELD", "NITRILE_GLOVES", "VENTILATION"] },

  // ── Oxidizers ──────────────────────────────────────────────────────────────
  { name: "Hydrogen Peroxide 3%", commonName: "Hydrogen peroxide solution", cas: "7722-84-1", storageClass: "OXIDIZER", hazardCodes: ["H319"], precautionCodes: ["P264", "P280", "P305+P351+P338"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES"] },
  { name: "Hydrogen Peroxide 30%", commonName: "Hydrogen peroxide reagent", cas: "7722-84-1", storageClass: "OXIDIZER", hazardCodes: ["H272", "H302", "H314", "H332"], precautionCodes: ["P220", "P260", "P280", "P305+P351+P338"], ppe: ["CHEMICAL_GOGGLES", "FACE_SHIELD", "NITRILE_GLOVES", "NEOPRENE_GLOVES", "CHEMICAL_APRON", "VENTILATION"] },
  { name: "Sodium Hypochlorite Solution / Bleach", commonName: "Bleach 5-6%", cas: "7681-52-9", storageClass: "OXIDIZER", hazardCodes: ["H290", "H315", "H319", "H400"], precautionCodes: ["P260", "P273", "P280", "P305+P351+P338"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "VENTILATION"] },
  { name: "Silver Nitrate", commonName: "Silver nitrate stain/reagent", cas: "7761-88-8", storageClass: "OXIDIZER", hazardCodes: ["H272", "H314", "H410"], precautionCodes: ["P220", "P273", "P280"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "LAB_COAT"] },
  { name: "Potassium Permanganate", commonName: "KMnO4 oxidizer reagent", cas: "7722-64-7", storageClass: "OXIDIZER", hazardCodes: ["H272", "H302", "H410"], precautionCodes: ["P220", "P273", "P280"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "LAB_COAT"] },
  { name: "Iodine Solution", commonName: "Iodine stain / disinfectant", cas: "7553-56-2", storageClass: "IRRITANT", hazardCodes: ["H312", "H332", "H315", "H319", "H400"], precautionCodes: ["P261", "P273", "P280"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "LAB_COAT", "VENTILATION"] },

  // ── Toxics / sensitizers / mutagens ────────────────────────────────────────
  { name: "Phenol", commonName: "Carbolic acid", cas: "108-95-2", storageClass: "TOXIC", hazardCodes: ["H301", "H311", "H314", "H331", "H341", "H373"], precautionCodes: ["P260", "P280", "P301+P310"], ppe: ["CHEMICAL_GOGGLES", "FACE_SHIELD", "BUTYL_GLOVES", "NEOPRENE_GLOVES", "CHEMICAL_APRON", "VENTILATION"] },
  { name: "Acrylamide", commonName: "Acrylamide gel monomer", cas: "79-06-1", storageClass: "TOXIC", hazardCodes: ["H301", "H312", "H317", "H340", "H350", "H361", "H372"], precautionCodes: ["P201", "P260", "P280", "P308+P313"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "LAB_COAT", "VENTILATION"] },
  { name: "Ethidium Bromide", commonName: "EtBr DNA stain", cas: "1239-45-8", storageClass: "TOXIC", hazardCodes: ["H302", "H341", "H315", "H319"], precautionCodes: ["P201", "P280", "P308+P313"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "LAB_COAT"] },
  { name: "Beta-Mercaptoethanol", commonName: "2-Mercaptoethanol / BME", cas: "60-24-2", storageClass: "TOXIC", hazardCodes: ["H301", "H310", "H331", "H315", "H319"], precautionCodes: ["P260", "P280", "P301+P310"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "LAB_COAT", "VENTILATION"] },
  { name: "Ethylene Glycol Antifreeze", commonName: "Antifreeze / coolant", cas: "107-21-1", storageClass: "TOXIC", hazardCodes: ["H302", "H373"], precautionCodes: ["P264", "P270", "P301+P312"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES"] },
  { name: "Crystalline Silica, Quartz", commonName: "Silica sand / quartz", cas: "14808-60-7", storageClass: "TOXIC", hazardCodes: ["H350", "H372"], precautionCodes: ["P201", "P260", "P280", "P308+P313"], ppe: ["SAFETY_GLASSES", "RESPIRATOR", "VENTILATION"] },

  // ── Irritants / detergents ─────────────────────────────────────────────────
  { name: "Sodium Dodecyl Sulfate (SDS)", commonName: "SDS / lauryl sulfate detergent", cas: "151-21-3", storageClass: "IRRITANT", hazardCodes: ["H302", "H315", "H318", "H335"], precautionCodes: ["P261", "P280", "P305+P351+P338"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES", "LAB_COAT"] },
  { name: "Epoxy Resin Part A", commonName: "Epoxy resin component", cas: "", storageClass: "IRRITANT", hazardCodes: ["H315", "H317", "H319", "H411"], precautionCodes: ["P261", "P273", "P280", "P302+P352"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "VENTILATION"] },
  { name: "Epoxy Hardener Part B", commonName: "Epoxy hardener component", cas: "", storageClass: "CORROSIVE_BASE", hazardCodes: ["H314", "H317", "H412"], precautionCodes: ["P260", "P280", "P303+P361+P353"], ppe: ["CHEMICAL_GOGGLES", "FACE_SHIELD", "NITRILE_GLOVES", "CHEMICAL_APRON", "VENTILATION"] },
  { name: "Portland Cement", commonName: "Cement powder", cas: "65997-15-1", storageClass: "IRRITANT", hazardCodes: ["H315", "H317", "H318", "H335"], precautionCodes: ["P261", "P280", "P305+P351+P338"], ppe: ["CHEMICAL_GOGGLES", "NITRILE_GLOVES", "RESPIRATOR", "VENTILATION"] },
  { name: "Calcium Chloride", commonName: "Ice melt / desiccant", cas: "10043-52-4", storageClass: "IRRITANT", hazardCodes: ["H319"], precautionCodes: ["P264", "P280", "P305+P351+P338"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES"] },

  // ── General / low-hazard ───────────────────────────────────────────────────
  { name: "DMSO", commonName: "Dimethyl sulfoxide", cas: "67-68-5", storageClass: "GENERAL", hazardCodes: [], precautionCodes: ["P264", "P280"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES", "LAB_COAT"] },
  { name: "Glycerol", commonName: "Glycerin", cas: "56-81-5", storageClass: "GENERAL", hazardCodes: [], precautionCodes: ["P264", "P280"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES", "LAB_COAT"] },
  { name: "Mineral Oil", commonName: "White mineral oil / overlay", cas: "8042-47-5", storageClass: "GENERAL", hazardCodes: [], precautionCodes: ["P264"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES"] },
  { name: "Motor Oil", commonName: "Engine oil", cas: "", storageClass: "COMBUSTIBLE", hazardCodes: [], precautionCodes: [], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES"] },
  { name: "Hydraulic Fluid", commonName: "Hydraulic oil", cas: "", storageClass: "COMBUSTIBLE", hazardCodes: [], precautionCodes: [], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES"] },
  { name: "Sodium Chloride", commonName: "Salt / buffer", cas: "7647-14-5", storageClass: "GENERAL", hazardCodes: [], precautionCodes: [], ppe: ["SAFETY_GLASSES"] },
  { name: "Sodium Bicarbonate", commonName: "Baking soda / buffer", cas: "144-55-8", storageClass: "GENERAL", hazardCodes: [], precautionCodes: ["P264"], ppe: ["SAFETY_GLASSES", "NITRILE_GLOVES"] },
  { name: "Agarose", commonName: "Agarose gel powder", cas: "9012-36-6", storageClass: "GENERAL", hazardCodes: [], precautionCodes: ["P264"], ppe: ["SAFETY_GLASSES"] },

  // ── Compressed gases ───────────────────────────────────────────────────────
  { name: "Propane", commonName: "Propane cylinder", cas: "74-98-6", storageClass: "FLAMMABLE_GAS", hazardCodes: ["H220", "H280"], precautionCodes: ["P210", "P377", "P381", "P403"], ppe: ["SAFETY_GLASSES"] },
  { name: "Oxygen, Compressed", commonName: "Compressed oxygen cylinder", cas: "7782-44-7", storageClass: "OXIDIZER_GAS", hazardCodes: ["H270", "H280"], precautionCodes: ["P220", "P244", "P403"], ppe: ["SAFETY_GLASSES"] },
  { name: "Nitrogen, Compressed", commonName: "Compressed nitrogen cylinder", cas: "7727-37-9", storageClass: "COMPRESSED_GAS", hazardCodes: ["H280"], precautionCodes: ["P403"], ppe: ["SAFETY_GLASSES"] },
  { name: "Carbon Dioxide, Compressed", commonName: "CO2 cylinder", cas: "124-38-9", storageClass: "COMPRESSED_GAS", hazardCodes: ["H280"], precautionCodes: ["P403"], ppe: ["SAFETY_GLASSES"] },
];
