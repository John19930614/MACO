// GHS standard H-statement and P-statement texts, pictogram mapping, and signal-word derivation.
// Texts are from UN GHS Rev. 9 (2021). Covers the codes commonly found on SDS documents.

export const H_TEXTS: Record<string, string> = {
  // Explosives
  H200: "Unstable explosive",
  H201: "Explosive; mass explosion hazard",
  H202: "Explosive; severe projection hazard",
  H203: "Explosive; fire, blast or projection hazard",
  H204: "Fire or projection hazard",
  H205: "May mass explode in fire",
  // Flammable gases / aerosols
  H220: "Extremely flammable gas",
  H221: "Flammable gas",
  H222: "Extremely flammable aerosol",
  H223: "Flammable aerosol",
  // Flammable liquids
  H224: "Extremely flammable liquid and vapour",
  H225: "Highly flammable liquid and vapour",
  H226: "Flammable liquid and vapour",
  H227: "Combustible liquid",
  // Flammable solid / self-reactive / organic peroxide
  H228: "Flammable solid",
  H240: "Heating may cause an explosion",
  H241: "Heating may cause a fire or explosion",
  H242: "Heating may cause a fire",
  // Pyrophoric / self-heating / water-reactive
  H250: "Catches fire spontaneously if exposed to air",
  H251: "Self-heating in large quantities; may catch fire",
  H252: "Self-heating in large quantities; may catch fire",
  H260: "In contact with water releases flammable gases which may ignite spontaneously",
  H261: "In contact with water releases flammable gas",
  // Oxidising
  H270: "May cause or intensify fire; oxidiser",
  H271: "May cause fire or explosion; strong oxidiser",
  H272: "May intensify fire; oxidiser",
  // Gases under pressure
  H280: "Contains gas under pressure; may explode if heated",
  H281: "Contains refrigerated gas; may cause cryogenic burns or injury",
  // Corrosive to metals
  H290: "May be corrosive to metals",
  // Acute oral toxicity
  H300: "Fatal if swallowed",
  H301: "Toxic if swallowed",
  H302: "Harmful if swallowed",
  H303: "May be harmful if swallowed",
  // Aspiration hazard
  H304: "May be fatal if swallowed and enters airways",
  // Acute dermal toxicity
  H310: "Fatal in contact with skin",
  H311: "Toxic in contact with skin",
  H312: "Harmful in contact with skin",
  H313: "May be harmful in contact with skin",
  // Skin / eye
  H314: "Causes severe skin burns and eye damage",
  H315: "Causes skin irritation",
  H316: "Causes mild skin irritation",
  H317: "May cause an allergic skin reaction",
  H318: "Causes serious eye damage",
  H319: "Causes serious eye irritation",
  H320: "Causes eye irritation",
  // Acute inhalation toxicity
  H330: "Fatal if inhaled",
  H331: "Toxic if inhaled",
  H332: "Harmful if inhaled",
  H333: "May be harmful if inhaled",
  // Respiratory / skin sensitisation
  H334: "May cause allergy or asthma symptoms or breathing difficulties if inhaled",
  H335: "May cause respiratory irritation",
  H336: "May cause drowsiness or dizziness",
  // Mutagenicity
  H340: "May cause genetic defects",
  H341: "Suspected of causing genetic defects",
  // Carcinogenicity
  H350: "May cause cancer",
  H351: "Suspected of causing cancer",
  // Reproductive toxicity
  H360: "May damage fertility or the unborn child",
  H361: "Suspected of damaging fertility or the unborn child",
  H362: "May cause harm to breast-fed children",
  // STOT — single exposure
  H370: "Causes damage to organs",
  H371: "May cause damage to organs",
  // STOT — repeated exposure
  H372: "Causes damage to organs through prolonged or repeated exposure",
  H373: "May cause damage to organs through prolonged or repeated exposure",
  // Aquatic toxicity
  H400: "Very toxic to aquatic life",
  H401: "Toxic to aquatic life",
  H402: "Harmful to aquatic life",
  H410: "Very toxic to aquatic life with long lasting effects",
  H411: "Toxic to aquatic life with long lasting effects",
  H412: "Harmful to aquatic life with long lasting effects",
  H413: "May cause long lasting harmful effects to aquatic life",
  // Ozone
  H420: "Harms public health and the environment by destroying ozone in the upper atmosphere",
};

export const P_TEXTS: Record<string, string> = {
  // General
  P101: "If medical advice is needed, have product container or label at hand",
  P102: "Keep out of reach of children",
  P103: "Read label before use",
  // Prevention
  P201: "Obtain special instructions before use",
  P202: "Do not handle until all safety precautions have been read and understood",
  P210: "Keep away from heat, hot surfaces, sparks, open flames and other ignition sources. No smoking",
  P211: "Do not spray on an open flame or other ignition source",
  P220: "Keep away from clothing and other combustible materials",
  P221: "Take precautionary measures against mixing with combustibles",
  P222: "Do not allow contact with air",
  P223: "Keep away from any possible contact with water",
  P230: "Keep wetted",
  P231: "Handle under inert gas",
  P232: "Protect from moisture",
  P233: "Keep container tightly closed",
  P234: "Keep only in original packaging",
  P235: "Keep cool",
  P240: "Ground and bond container and receiving equipment",
  P241: "Use explosion-proof electrical equipment",
  P242: "Use only non-sparking tools",
  P243: "Take precautionary measures against static discharge",
  P244: "Keep reduction valves free from grease and oil",
  P250: "Do not subject to grinding, shock, or friction",
  P251: "Do not pierce or burn, even after use",
  P260: "Do not breathe dust, fume, gas, mist, vapours, or spray",
  P261: "Avoid breathing dust, fume, gas, mist, vapours, or spray",
  P262: "Do not get in eyes, on skin, or on clothing",
  P263: "Avoid contact during pregnancy and while nursing",
  P264: "Wash thoroughly after handling",
  P270: "Do not eat, drink or smoke when using this product",
  P271: "Use only outdoors or in a well-ventilated area",
  P272: "Contaminated work clothing must not be allowed out of the workplace",
  P273: "Avoid release to the environment",
  P280: "Wear protective gloves, protective clothing, eye protection, and face protection",
  P281: "Use personal protective equipment as required",
  P282: "Wear cold insulating gloves and either face shield or eye protection",
  P283: "Wear fire resistant or flame retardant clothing",
  P284: "Wear respiratory protection",
  P285: "In case of inadequate ventilation wear respiratory protection",
  // Response
  P301: "IF SWALLOWED: call a POISON CENTER or doctor",
  P302: "IF ON SKIN: wash with plenty of water",
  P303: "IF ON SKIN (or hair): take off immediately all contaminated clothing. Rinse skin with water or shower",
  P304: "IF INHALED: remove person to fresh air and keep comfortable for breathing",
  P305: "IF IN EYES: rinse cautiously with water for several minutes",
  P310: "Immediately call a POISON CENTER or doctor",
  P311: "Call a POISON CENTER or doctor",
  P312: "Call a POISON CENTER or doctor if you feel unwell",
  P313: "Get medical advice/attention",
  P314: "Get medical advice/attention if you feel unwell",
  P315: "Get immediate medical advice/attention",
  P320: "Specific treatment is urgent — see supplemental first-aid instructions",
  P321: "Specific treatment — see supplemental first-aid instructions",
  P330: "Rinse mouth",
  P331: "Do NOT induce vomiting",
  P332: "If skin irritation occurs: get medical advice/attention",
  P333: "If skin irritation or rash occurs: get medical advice/attention",
  P334: "Immerse in cool water or wrap in wet bandages",
  P335: "Brush off loose particles from skin",
  P336: "Thaw frosted parts with lukewarm water. Do not rub affected area",
  P337: "If eye irritation persists: get medical advice/attention",
  P338: "Remove contact lenses, if present and easy to do. Continue rinsing",
  P340: "Remove person to fresh air and keep comfortable for breathing",
  P341: "If breathing is difficult, remove victim to fresh air and keep comfortable for breathing",
  P342: "If experiencing respiratory symptoms: call a POISON CENTER or doctor",
  P350: "Gently wash with plenty of soap and water",
  P351: "Rinse cautiously with water for several minutes",
  P352: "Wash with plenty of water",
  P353: "Rinse skin with water or shower",
  P360: "Rinse immediately contaminated clothing and skin with plenty of water before removing clothes",
  P361: "Take off immediately all contaminated clothing",
  P362: "Take off contaminated clothing and wash before reuse",
  P363: "Wash contaminated clothing before reuse",
  P370: "In case of fire: use appropriate media for extinction",
  P371: "In case of major fire and large quantities: evacuate area",
  P372: "Explosion risk",
  P373: "DO NOT fight fire when fire reaches explosives",
  P374: "Fight fire with normal precautions from a reasonable distance",
  P375: "Fight fire remotely due to the risk of explosion",
  P376: "Stop leak if safe to do so",
  P377: "Leaking gas fire: do not extinguish unless leak can be stopped safely",
  P378: "Use appropriate media to extinguish",
  P380: "Evacuate area",
  P381: "In case of leakage, eliminate all ignition sources",
  P390: "Absorb spillage to prevent material damage",
  P391: "Collect spillage",
  // Storage
  P401: "Store in accordance with applicable regulations",
  P402: "Store in a dry place",
  P403: "Store in a well-ventilated place",
  P404: "Store in a closed container",
  P405: "Store locked up",
  P406: "Store in corrosive-resistant container with a resistant inner liner",
  P407: "Maintain air gap between stacks or pallets",
  P410: "Protect from sunlight",
  P411: "Store at temperatures not exceeding 40°C/104°F",
  P412: "Do not expose to temperatures exceeding 50°C/122°F",
  P420: "Store away from other materials",
  // Disposal
  P501: "Dispose of contents and container in accordance with local regulations",
  P502: "Refer to manufacturer or supplier for information on recovery or recycling",
  // Common combined P-codes
  "P301+P310":       "IF SWALLOWED: Immediately call a POISON CENTER or doctor",
  "P301+P312":       "IF SWALLOWED: Call a POISON CENTER or doctor if you feel unwell",
  "P301+P330+P331":  "IF SWALLOWED: Rinse mouth. Do NOT induce vomiting",
  "P302+P352":       "IF ON SKIN: Wash with plenty of water",
  "P303+P361+P353":  "IF ON SKIN (or hair): Take off immediately all contaminated clothing. Rinse skin with water or shower",
  "P304+P340":       "IF INHALED: Remove person to fresh air and keep comfortable for breathing",
  "P304+P341":       "IF INHALED: If breathing is difficult, remove victim to fresh air and keep comfortable for breathing",
  "P305+P351+P338":  "IF IN EYES: Rinse cautiously with water for several minutes. Remove contact lenses if present and easy to do. Continue rinsing",
  "P308+P311":       "IF exposed or concerned: Call a POISON CENTER or doctor",
  "P308+P313":       "IF exposed or concerned: Get medical advice/attention",
  "P332+P313":       "If skin irritation occurs: Get medical advice/attention",
  "P333+P313":       "If skin irritation or rash occurs: Get medical advice/attention",
  "P337+P313":       "If eye irritation persists: Get medical advice/attention",
  "P342+P311":       "If experiencing respiratory symptoms: Call a POISON CENTER or doctor",
  "P361+P364":       "Take off immediately all contaminated clothing and wash before reuse",
  "P370+P376":       "In case of fire: Stop leak if safe to do so",
  "P370+P378":       "In case of fire: Use appropriate media for extinction",
  "P403+P233":       "Store in a well-ventilated place. Keep container tightly closed",
  "P403+P235":       "Store in a well-ventilated place. Keep cool",
};

// H-code to GHS pictogram code(s)
const H_TO_PICTOGRAM: Record<string, string[]> = {
  // GHS01 - Explosive
  H200: ["GHS01"], H201: ["GHS01"], H202: ["GHS01"], H203: ["GHS01"],
  H204: ["GHS01"], H205: ["GHS01"], H240: ["GHS01"], H241: ["GHS01"],
  // GHS02 - Flammable
  H220: ["GHS02"], H221: ["GHS02"], H222: ["GHS02"], H223: ["GHS02"],
  H224: ["GHS02"], H225: ["GHS02"], H226: ["GHS02"], H227: ["GHS02"],
  H228: ["GHS02"], H242: ["GHS02"], H250: ["GHS02"], H251: ["GHS02"],
  H252: ["GHS02"], H260: ["GHS02"], H261: ["GHS02"],
  // GHS03 - Oxidizing
  H270: ["GHS03"], H271: ["GHS03"], H272: ["GHS03"],
  // GHS04 - Gas under pressure
  H280: ["GHS04"], H281: ["GHS04"],
  // GHS05 - Corrosive
  H290: ["GHS05"], H314: ["GHS05"], H318: ["GHS05"],
  // GHS06 - Toxic (skull & crossbones)
  H300: ["GHS06"], H301: ["GHS06"],
  H310: ["GHS06"], H311: ["GHS06"],
  H330: ["GHS06"], H331: ["GHS06"],
  H340: ["GHS06", "GHS08"],
  H350: ["GHS06", "GHS08"],
  H370: ["GHS06", "GHS08"],
  // GHS07 - Irritant / Harmful (exclamation)
  H302: ["GHS07"], H303: ["GHS07"],
  H312: ["GHS07"], H313: ["GHS07"],
  H315: ["GHS07"], H316: ["GHS07"],
  H317: ["GHS07"], H319: ["GHS07"],
  H320: ["GHS07"], H332: ["GHS07"],
  H333: ["GHS07"], H335: ["GHS07"],
  H336: ["GHS07"],
  // GHS08 - Health hazard
  H304: ["GHS08"],
  H334: ["GHS08"],
  H341: ["GHS08"], H351: ["GHS08"],
  H360: ["GHS08"], H361: ["GHS08"],
  H362: ["GHS08"], H371: ["GHS08"],
  H372: ["GHS08"], H373: ["GHS08"],
  // GHS09 - Environmental
  H400: ["GHS09"], H401: ["GHS09"], H402: ["GHS09"],
  H410: ["GHS09"], H411: ["GHS09"], H412: ["GHS09"],
  H413: ["GHS09"], H420: ["GHS09"],
};

// H-codes that trigger DANGER signal word (GHS category 1/2 typically)
const DANGER_H = new Set([
  "H200","H201","H202","H203","H204","H205",
  "H220","H222","H224","H225",
  "H240","H241","H250","H251","H260",
  "H270","H271",
  "H290",
  "H300","H301","H310","H311","H314","H318",
  "H330","H331","H334",
  "H340","H350","H360",
  "H370",
  "H400","H410",
]);

// H-codes that trigger WARNING signal word
const WARNING_H = new Set([
  "H221","H223","H226","H227","H228",
  "H242","H252","H261","H272",
  "H280","H281",
  "H302","H303","H304",
  "H312","H313","H315","H316","H317","H319","H320",
  "H332","H333","H335","H336",
  "H341","H351","H361","H362","H371","H373",
  "H401","H402","H411","H412","H413","H420",
]);

export function deriveSignalWord(hazardStatements: string[]): "Danger" | "Warning" | null {
  const codes = hazardStatements.map((h) => h.replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase());
  if (codes.some((c) => DANGER_H.has(c))) return "Danger";
  if (codes.some((c) => WARNING_H.has(c))) return "Warning";
  return null;
}

export function derivePictograms(hazardStatements: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of hazardStatements) {
    const code = raw.replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase();
    for (const pic of H_TO_PICTOGRAM[code] ?? []) seen.add(pic);
  }
  return Array.from(seen).sort();
}

export function getHText(code: string): string {
  return H_TEXTS[code.trim().toUpperCase()] ?? "";
}

export function getPText(code: string): string {
  return P_TEXTS[code.trim()] ?? "";
}

// GHS pictogram code → human-readable name (OSHA HCS / GHS Annex). GHS09 is the
// environmental pictogram, which is supplemental (not mandatory) under OSHA HazCom.
export const PICTOGRAM_NAMES: Record<string, string> = {
  GHS01: "Exploding Bomb",
  GHS02: "Flame",
  GHS03: "Flame Over Circle",
  GHS04: "Gas Cylinder",
  GHS05: "Corrosion",
  GHS06: "Skull & Crossbones",
  GHS07: "Exclamation Mark",
  GHS08: "Health Hazard",
  GHS09: "Environment",
};

export function getPictogramName(code: string): string {
  return PICTOGRAM_NAMES[code.trim().toUpperCase()] ?? code;
}
