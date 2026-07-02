/**
 * Concentration-based chemical hazard evaluation engine.
 *
 * Evaluates: CAS number, chemical name, concentration %, dilution notes,
 * physical state, quantity, H-statement codes, SDS expiry, and storage location
 * to produce a hazard band + confidence score + plain-English explanation.
 *
 * No AI required — deterministic rules engine. AI layer can optionally augment.
 */

export type HazardBand = "none" | "low" | "medium" | "high" | "critical";
export type PhysicalState = "liquid" | "gas" | "solid" | "unknown";

export interface ConcentrationThreshold {
  casNumber: string;
  commonNames: string[];
  flammablePct?: number;       // % above which flammable hazard activates
  toxicPct?: number;           // % above which toxic hazard activates
  corrosivePct?: number;       // % above which corrosive hazard activates
  carcinogenicPct?: number;    // % above which carcinogen classification applies
  reproductivePct?: number;    // % above which reproductive hazard applies
  safeBelow?: number;          // Below this %, essentially safe (band = none/low)
  notes?: string;
}

// Chemical-specific concentration thresholds (GHS, SDS, OSHA HazCom)
// Concentrations are weight/weight % unless noted.
export const THRESHOLDS: ConcentrationThreshold[] = [
  {
    casNumber: "67-56-1", commonNames: ["methanol", "methyl alcohol", "wood alcohol"],
    flammablePct: 6, toxicPct: 3, safeBelow: 0.1,
    notes: "Methanol is acutely toxic by ingestion; 3%+ triggers toxicity controls.",
  },
  {
    casNumber: "67-64-1", commonNames: ["acetone", "propanone", "dimethyl ketone"],
    flammablePct: 2.5, safeBelow: 0.1,
    notes: "Acetone is flammable above 2.5%; non-toxic at low concentrations.",
  },
  {
    casNumber: "75-09-2", commonNames: ["dichloromethane", "methylene chloride", "dcm"],
    toxicPct: 1, carcinogenicPct: 0.1, safeBelow: 0.001,
    notes: "Probable human carcinogen (IARC 2A); 0.1%+ triggers carcinogen labelling.",
  },
  {
    casNumber: "79-01-6", commonNames: ["trichloroethylene", "tce", "trichloro"],
    carcinogenicPct: 0.1, toxicPct: 1, safeBelow: 0.001,
    notes: "Known human carcinogen (IARC 1); any detectable level requires controls.",
  },
  {
    casNumber: "50-00-0", commonNames: ["formaldehyde", "formalin", "methanal"],
    toxicPct: 0.1, carcinogenicPct: 0.1, safeBelow: 0.05,
    notes: "OSHA PEL 0.75 ppm; carcinogen classification triggers at 0.1%.",
  },
  {
    casNumber: "71-43-2", commonNames: ["benzene"],
    carcinogenicPct: 0.1, toxicPct: 0.5, safeBelow: 0.001,
    notes: "Known human carcinogen; any exposure above 0.1% requires full controls.",
  },
  {
    casNumber: "75-05-8", commonNames: ["acetonitrile", "methyl cyanide"],
    flammablePct: 3, toxicPct: 10, safeBelow: 0.1,
    notes: "Flammable at 3%+ (LEL); cyanide metabolite risk above 10%.",
  },
  {
    casNumber: "7647-01-0", commonNames: ["hydrochloric acid", "hcl", "muriatic acid"],
    corrosivePct: 5, toxicPct: 10, safeBelow: 0.1,
    notes: "Corrosive at 5%+; fuming above 20%.",
  },
  {
    casNumber: "7664-93-9", commonNames: ["sulfuric acid", "h2so4", "battery acid"],
    corrosivePct: 5, safeBelow: 0.1,
    notes: "Corrosive at all concentrations above 0.1%; highly exothermic with water.",
  },
  {
    casNumber: "1310-73-2", commonNames: ["sodium hydroxide", "naoh", "lye", "caustic soda"],
    corrosivePct: 2, safeBelow: 0.05,
    notes: "Corrosive at 2%+; skin and eye burn risk from low concentrations.",
  },
  {
    casNumber: "7722-84-1", commonNames: ["hydrogen peroxide", "h2o2"],
    flammablePct: 8, toxicPct: 5, corrosivePct: 10, safeBelow: 0.1,
    notes: "Oxidizer; >30% solutions are classified as critical hazard.",
  },
  {
    casNumber: "64-17-5", commonNames: ["ethanol", "ethyl alcohol", "grain alcohol", "alcohol"],
    flammablePct: 3.3, safeBelow: 0.5,
    notes: "Flash point 13°C; flammable above LEL of 3.3%.",
  },
  {
    casNumber: "67-63-0", commonNames: ["isopropanol", "isopropyl alcohol", "ipa", "rubbing alcohol", "2-propanol"],
    flammablePct: 2, safeBelow: 0.5,
    notes: "Flash point 12°C; flammable above 2%.",
  },
  {
    casNumber: "108-88-3", commonNames: ["toluene", "methylbenzene", "toluol"],
    flammablePct: 1.1, toxicPct: 10, safeBelow: 0.1,
    notes: "Reproductive hazard (H361); flammable above 1.1%.",
    reproductivePct: 1,
  },
  {
    casNumber: "64-19-7", commonNames: ["acetic acid", "ethanoic acid", "glacial acetic acid"],
    corrosivePct: 25, flammablePct: 5, safeBelow: 1,
    notes: "Corrosive at 25%+; dilute vinegar (<5%) is safe.",
  },
  {
    casNumber: "67-66-3", commonNames: ["chloroform", "trichloromethane"],
    toxicPct: 1, carcinogenicPct: 0.1, safeBelow: 0.01,
    notes: "Possible carcinogen (IARC 2B); liver toxicity above 1%.",
  },
  {
    casNumber: "110-54-3", commonNames: ["n-hexane", "hexane"],
    flammablePct: 1.1, toxicPct: 5, safeBelow: 0.1,
    notes: "Neurotoxic at high concentrations; highly flammable.",
  },
  {
    casNumber: "78-93-3", commonNames: ["methyl ethyl ketone", "mek", "butanone"],
    flammablePct: 1.4, safeBelow: 0.1,
    notes: "Highly flammable; LEL 1.4%.",
  },
  {
    casNumber: "7664-41-7", commonNames: ["ammonia", "ammonium hydroxide"],
    toxicPct: 1, corrosivePct: 10, safeBelow: 0.1,
    notes: "Toxic gas; solutions above 10% are corrosive.",
  },
  {
    casNumber: "1310-58-3", commonNames: ["potassium hydroxide", "koh", "caustic potash"],
    corrosivePct: 2, safeBelow: 0.05,
    notes: "Corrosive at 2%+; similar hazard profile to NaOH.",
  },
];

// H-statement code → hazard type mapping
const H_CODE_HAZARDS: { pattern: RegExp; type: string; label: string; physicalHazard?: boolean }[] = [
  { pattern: /^H2(0[0-9]|1[0-9]|20|21|22|23|24|25|26)/, type: "flammable",    label: "Flammable",    physicalHazard: true },
  { pattern: /^H2(27|28|29)/,                             type: "combustible",  label: "Combustible",  physicalHazard: true },
  { pattern: /^H2(70|71|72)/,                             type: "oxidizing",    label: "Oxidizing",    physicalHazard: true },
  { pattern: /^H2(90)/,                                   type: "waterReactive",label: "Water-reactive", physicalHazard: true },
  { pattern: /^H2(00|01|02|03|04|05|06|07|08|09)/,        type: "explosive",    label: "Explosive",    physicalHazard: true },
  { pattern: /^H(300|301|310|311|330|331)/,               type: "acuteToxic",   label: "Acutely toxic" },
  { pattern: /^H(302|312|332)/,                           type: "harmful",      label: "Harmful" },
  { pattern: /^H314/,                                     type: "corrosive",    label: "Corrosive" },
  { pattern: /^H(315|317|318|319)/,                       type: "irritant",     label: "Irritant/Sensitizer" },
  { pattern: /^H(334|335)/,                               type: "respiratoryHazard", label: "Respiratory hazard" },
  { pattern: /^H(340|341)/,                               type: "mutagen",      label: "Mutagen" },
  { pattern: /^H(350|351)/,                               type: "carcinogen",   label: "Carcinogen" },
  { pattern: /^H(360|361)/,                               type: "reproductive", label: "Reproductive hazard" },
  { pattern: /^H(370|371|372|373)/,                       type: "organToxin",   label: "Organ toxin" },
  { pattern: /^H(400|410|411|412|413)/,                   type: "environmental",label: "Environmental hazard" },
];

export interface HazardFactor {
  name: string;
  description: string;
  severity: "info" | "warning" | "danger" | "critical";
}

export interface HazardAnalysisResult {
  band: HazardBand;
  confidence: number;                // 0-100
  requiresReview: boolean;           // confidence < 70 or band >= high
  hazardTypes: string[];             // e.g. ["Flammable", "Acutely toxic"]
  factors: HazardFactor[];           // what drove this result
  plainEnglishSummary: string;       // 2-3 sentence plain English
  thresholdMatched: boolean;         // whether a CAS-specific threshold was found
  sdsExpired: boolean;
  sdsWarning: string | null;
}

function bandScore(b: HazardBand): number {
  return { none: 0, low: 1, medium: 2, high: 3, critical: 4 }[b];
}
function scoreToband(s: number): HazardBand {
  if (s <= 0) return "none";
  if (s <= 1) return "low";
  if (s <= 2) return "medium";
  if (s <= 3) return "high";
  return "critical";
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Common naming aliases → canonical chemical name. Lab staff, SDS authors and
 * suppliers rarely use the same name for the same substance ("IPA", "rubbing
 * alcohol" and "2-propanol" are all isopropyl alcohol). We normalise the entered
 * name through this map before threshold matching so a dilution of "IPA" is
 * classified against the isopropyl-alcohol thresholds rather than falling through
 * to "insufficient data".
 *
 * Keys are already name-normalized (lowercase, alphanumerics + single spaces).
 */
export const NAME_ALIASES: Record<string, string> = {
  "ipa": "isopropyl alcohol",
  "iso propanol": "isopropyl alcohol",
  "isopropanol": "isopropyl alcohol",
  "2 propanol": "isopropyl alcohol",
  "rubbing alcohol": "isopropyl alcohol",
  "dcm": "dichloromethane",
  "methylene chloride": "dichloromethane",
  "tce": "trichloroethylene",
  "mek": "methyl ethyl ketone",
  "butanone": "methyl ethyl ketone",
  "meoh": "methanol",
  "methyl alcohol": "methanol",
  "wood alcohol": "methanol",
  "etoh": "ethanol",
  "ethyl alcohol": "ethanol",
  "grain alcohol": "ethanol",
  "naoh": "sodium hydroxide",
  "lye": "sodium hydroxide",
  "caustic soda": "sodium hydroxide",
  "koh": "potassium hydroxide",
  "caustic potash": "potassium hydroxide",
  "hcl": "hydrochloric acid",
  "muriatic acid": "hydrochloric acid",
  "h2so4": "sulfuric acid",
  "battery acid": "sulfuric acid",
  "h2o2": "hydrogen peroxide",
  "acetic acid glacial": "acetic acid",
  "glacial acetic acid": "acetic acid",
  "toluol": "toluene",
  "methylbenzene": "toluene",
  "hexane": "n-hexane",
  "ammonium hydroxide": "ammonia",
};

/** Normalise a chemical name and resolve any known alias to its canonical name. */
export function resolveChemicalName(raw: string): string {
  const norm = normalizeName(raw);
  return NAME_ALIASES[norm] ?? norm;
}

export function analyzeConcentrationHazard(opts: {
  casNumber: string | null;
  chemicalName: string;
  hStatements: string[];
  concentrationPct: number;        // 0-100
  physicalState: PhysicalState;
  quantityKg: number | null;       // estimated quantity in kg
  storageLocation: string;
  sdsExpiry: string | null;
  flashPointC?: number | null;     // flash point in °C (SDS section 9)
  expirationDate?: string | null;  // chemical (not SDS) expiry
  dilutionNotes?: string;
}): HazardAnalysisResult {
  const { casNumber, chemicalName, hStatements, concentrationPct, physicalState, quantityKg, storageLocation, sdsExpiry, flashPointC, expirationDate, dilutionNotes } = opts;

  const factors: HazardFactor[] = [];
  let maxBandScore = 0;
  let thresholdMatched = false;
  const hazardTypes: string[] = [];

  // ── 1. CAS number / name threshold lookup ─────────────────────────────────
  // Resolve common aliases (IPA → isopropyl alcohol, DCM → dichloromethane, …)
  // to a canonical name before matching so dilutions entered under a shorthand
  // name are still classified against the correct chemical thresholds.
  const nameNorm = resolveChemicalName(chemicalName);
  const threshold = THRESHOLDS.find((t) => {
    if (casNumber && t.casNumber === casNumber.trim()) return true;
    return t.commonNames.some((n) => {
      const cn = resolveChemicalName(n);
      return cn === nameNorm || nameNorm.includes(cn) || cn.includes(nameNorm);
    });
  });

  if (threshold) {
    thresholdMatched = true;

    if (threshold.safeBelow !== undefined && concentrationPct <= threshold.safeBelow) {
      factors.push({
        name: "Below safe-dilution threshold",
        description: `At ${concentrationPct}%, this chemical is below the ${threshold.safeBelow}% threshold — hazard is significantly reduced.`,
        severity: "info",
      });
      maxBandScore = Math.max(maxBandScore, 0);
    } else {
      if (threshold.carcinogenicPct !== undefined && concentrationPct >= threshold.carcinogenicPct) {
        factors.push({
          name: "Carcinogen classification triggered",
          description: `At ${concentrationPct}%, this is at or above the ${threshold.carcinogenicPct}% threshold where carcinogen labelling applies under GHS/OSHA HazCom.`,
          severity: "critical",
        });
        maxBandScore = Math.max(maxBandScore, 4);
        if (!hazardTypes.includes("Carcinogen")) hazardTypes.push("Carcinogen");
      }
      if (threshold.reproductivePct !== undefined && concentrationPct >= threshold.reproductivePct) {
        factors.push({
          name: "Reproductive hazard threshold triggered",
          description: `At ${concentrationPct}%, reproductive toxicity controls apply (GHS H361/H360).`,
          severity: "critical",
        });
        maxBandScore = Math.max(maxBandScore, 4);
        if (!hazardTypes.includes("Reproductive hazard")) hazardTypes.push("Reproductive hazard");
      }
      if (threshold.toxicPct !== undefined && concentrationPct >= threshold.toxicPct) {
        factors.push({
          name: "Acute toxicity threshold reached",
          description: `At ${concentrationPct}%, this concentration triggers acute toxicity classification.`,
          severity: "danger",
        });
        maxBandScore = Math.max(maxBandScore, 3);
        if (!hazardTypes.includes("Acutely toxic")) hazardTypes.push("Acutely toxic");
      }
      if (threshold.corrosivePct !== undefined && concentrationPct >= threshold.corrosivePct) {
        factors.push({
          name: "Corrosive at this concentration",
          description: `At ${concentrationPct}%, this chemical is classified as corrosive. Direct skin or eye contact can cause severe burns.`,
          severity: "danger",
        });
        maxBandScore = Math.max(maxBandScore, 3);
        if (!hazardTypes.includes("Corrosive")) hazardTypes.push("Corrosive");
      }
      if (threshold.flammablePct !== undefined && concentrationPct >= threshold.flammablePct) {
        factors.push({
          name: "Flammable at this concentration",
          description: `At ${concentrationPct}%, the vapour concentration can exceed the lower explosive limit (LEL of ~${threshold.flammablePct}%). Ignition sources must be controlled.`,
          severity: "danger",
        });
        maxBandScore = Math.max(maxBandScore, 3);
        if (!hazardTypes.includes("Flammable")) hazardTypes.push("Flammable");
      }
      if (threshold.notes) {
        factors.push({ name: "Chemical-specific note", description: threshold.notes, severity: "info" });
      }
    }
  }

  // ── 2. H-statement analysis ────────────────────────────────────────────────
  for (const hCode of hStatements) {
    for (const { pattern, type, label } of H_CODE_HAZARDS) {
      if (pattern.test(hCode)) {
        if (!hazardTypes.includes(label)) {
          hazardTypes.push(label);
          // H-codes drive a base hazard, concentration modulates it
          let baseBand = 2; // medium by default
          if (type === "explosive" || type === "carcinogen" || type === "acuteToxic") baseBand = 3;
          if (type === "mutagen" || type === "reproductive") baseBand = 4;
          // Dilute solutions reduce the H-code hazard
          const concentrationModifier = concentrationPct >= 50 ? 1 : concentrationPct >= 10 ? 0 : concentrationPct >= 1 ? -1 : -2;
          const adjusted = Math.max(0, Math.min(4, baseBand + concentrationModifier));
          if (adjusted > maxBandScore) {
            maxBandScore = adjusted;
            factors.push({
              name: `H-code: ${label}`,
              description: `${hCode} — this chemical carries a ${label.toLowerCase()} hazard. At ${concentrationPct}% concentration, the hazard band is ${scoreToband(adjusted)}.`,
              severity: adjusted >= 3 ? "danger" : adjusted >= 2 ? "warning" : "info",
            });
          }
        }
        break;
      }
    }
  }

  // ── 3. Physical state modifiers ───────────────────────────────────────────
  if (physicalState === "gas") {
    factors.push({
      name: "Gas or vapour form",
      description: "Gases and vapours present inhalation and ignition risks that are not present in liquid or solid form — even at low concentrations.",
      severity: "warning",
    });
    maxBandScore = Math.max(maxBandScore, 2);
  }

  // ── 4. Quantity risk ──────────────────────────────────────────────────────
  if (quantityKg !== null && quantityKg > 100 && maxBandScore >= 2) {
    factors.push({
      name: "Large quantity in storage",
      description: `${quantityKg} kg is a significant quantity — increases spill risk and regulatory threshold requirements (e.g. OSHA PSM, EPA RMP).`,
      severity: "warning",
    });
    maxBandScore = Math.min(4, maxBandScore + 1);
  }

  // ── 4b. Flash point (GHS flammability of the substance itself) ────────────
  // Only meaningful for liquids/near-pure material. A low flash point means the
  // liquid gives off ignitable vapour at or near room temperature. Dilute
  // aqueous solutions (<10%) largely suppress this, so we damp the effect there.
  if (flashPointC !== null && flashPointC !== undefined && physicalState !== "solid") {
    const dilutedAway = concentrationPct < 10;
    if (flashPointC < 23) {
      factors.push({
        name: "Highly flammable — low flash point",
        description: `Flash point ${flashPointC}°C is below 23°C (GHS flammable liquid Cat. 1/2). This liquid releases ignitable vapour at normal room temperature.${dilutedAway ? " At <10% concentration the flammability is substantially reduced, but ignition sources should still be controlled." : " Keep away from all ignition sources and store in a flammables cabinet."}`,
        severity: dilutedAway ? "warning" : "danger",
      });
      maxBandScore = Math.max(maxBandScore, dilutedAway ? 2 : 3);
      if (!hazardTypes.includes("Flammable")) hazardTypes.push("Flammable");
    } else if (flashPointC <= 60) {
      factors.push({
        name: "Flammable — moderate flash point",
        description: `Flash point ${flashPointC}°C (GHS flammable liquid Cat. 3). Flammable when heated; control ignition sources during heating or transfer.`,
        severity: "warning",
      });
      maxBandScore = Math.max(maxBandScore, 2);
      if (!hazardTypes.includes("Flammable")) hazardTypes.push("Flammable");
    } else if (flashPointC <= 93) {
      factors.push({
        name: "Combustible — elevated flash point",
        description: `Flash point ${flashPointC}°C (GHS combustible liquid Cat. 4). Lower fire risk, but still combustible if strongly heated.`,
        severity: "info",
      });
      maxBandScore = Math.max(maxBandScore, 1);
    }
  }

  // ── 4c. Storage location suitability ──────────────────────────────────────
  // Storage only matters once there is a real flammable/critical hazard. Flag
  // when a flammable material is not recorded in an appropriate cabinet.
  if ((hazardTypes.includes("Flammable") || maxBandScore >= 3)) {
    const loc = storageLocation.toLowerCase();
    const inControlledStore = /cabinet|flammable|ventilat|fume|store|bund/.test(loc);
    if (!inControlledStore) {
      factors.push({
        name: "Check storage suitability",
        description: storageLocation
          ? `Stored at "${storageLocation}". A material with this hazard profile should be kept in a suitable ventilated / flammables cabinet — confirm the storage location meets that requirement.`
          : "No storage location on file — confirm this material is kept in a suitable ventilated / flammables cabinet.",
        severity: "warning",
      });
    }
  }

  // ── 4d. Chemical expiration ───────────────────────────────────────────────
  // A chemical past its expiry can degrade, concentrate, or (for peroxide-formers
  // and oxidizers) become unstable. Escalate and force review.
  let chemicalExpired = false;
  if (expirationDate) {
    const expD = new Date(expirationDate);
    const now = new Date();
    if (!isNaN(expD.getTime())) {
      if (expD < now) {
        chemicalExpired = true;
        factors.push({
          name: "Chemical is past its expiration date",
          description: `Expired ${expD.toLocaleDateString()} — the material may have degraded or destabilised. Do not use until re-verified or disposed of; expired oxidizers and peroxide-formers can become hazardous.`,
          severity: "danger",
        });
        maxBandScore = Math.min(4, maxBandScore + 1);
      } else if (expD.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) {
        factors.push({
          name: "Chemical expiring soon",
          description: `Expires ${expD.toLocaleDateString()} (within 30 days). Plan use or disposal.`,
          severity: "warning",
        });
      }
    }
  }

  // ── 5. SDS expiry check ───────────────────────────────────────────────────
  let sdsExpired = false;
  let sdsWarning: string | null = null;
  if (!sdsExpiry) {
    sdsWarning = "No SDS expiry date on file — SDS currency cannot be confirmed. Hazard data may be outdated.";
    factors.push({ name: "SDS expiry unknown", description: sdsWarning, severity: "warning" });
  } else {
    const expDate = new Date(sdsExpiry);
    const now = new Date();
    if (expDate < now) {
      sdsExpired = true;
      sdsWarning = `SDS expired ${expDate.toLocaleDateString()} — hazard data may no longer reflect current formulation or regulatory requirements.`;
      factors.push({ name: "SDS is expired", description: sdsWarning, severity: "danger" });
      maxBandScore = Math.min(4, maxBandScore + 1);
    } else if (expDate.getTime() - now.getTime() < 90 * 24 * 60 * 60 * 1000) {
      sdsWarning = `SDS expires ${expDate.toLocaleDateString()} (within 90 days).`;
      factors.push({ name: "SDS expiring soon", description: sdsWarning, severity: "warning" });
    }
  }

  // ── 6. No hazard info found ────────────────────────────────────────────────
  if (factors.length === 0 || (hStatements.length === 0 && !threshold)) {
    factors.push({
      name: "Insufficient data",
      description: "No H-statements on file and no CAS-specific thresholds found. Classification cannot be determined with confidence.",
      severity: "warning",
    });
    maxBandScore = Math.max(maxBandScore, 1);
  }

  const band = scoreToband(maxBandScore);

  // ── 7. Confidence scoring ─────────────────────────────────────────────────
  let confidence = 50;
  if (thresholdMatched) confidence += 25;
  if (hStatements.length > 0) confidence += 15;
  if (sdsExpiry && !sdsExpired) confidence += 10;
  if (flashPointC !== null && flashPointC !== undefined) confidence += 5;
  confidence = Math.min(100, confidence);
  if (sdsExpired) confidence = Math.max(30, confidence - 20);
  if (chemicalExpired) confidence = Math.max(30, confidence - 15);
  if (!thresholdMatched && hStatements.length === 0) confidence = 20;

  // ── 8. Plain-English summary ──────────────────────────────────────────────
  let plainEnglishSummary = "";
  if (band === "none" || band === "low") {
    plainEnglishSummary = `At ${concentrationPct}%, this chemical poses a low hazard risk. ${thresholdMatched ? `It is below the concentration threshold where significant hazards apply.` : "No significant hazard triggers were found at this concentration."} Standard safe-handling practices are sufficient.`;
  } else if (band === "medium") {
    plainEnglishSummary = `At ${concentrationPct}%, this chemical presents a moderate hazard. ${hazardTypes.slice(0, 2).join(" and ")} risks apply. Use appropriate PPE and ensure adequate ventilation.`;
  } else if (band === "high") {
    plainEnglishSummary = `At ${concentrationPct}%, this chemical is classified as high hazard — ${hazardTypes.slice(0, 2).join(" and ")} risks are active. Engineering controls, full PPE, and SDS review are required before handling.`;
  } else {
    plainEnglishSummary = `At ${concentrationPct}%, this chemical is critically hazardous — ${hazardTypes.slice(0, 2).join(" and ")}. This concentration triggers regulatory controls. Do not handle without a formal risk assessment, buddy system, and emergency response plan in place.`;
  }

  if (dilutionNotes) {
    plainEnglishSummary += ` Dilution note: ${dilutionNotes}`;
  }

  const requiresReview = confidence < 70 || band === "high" || band === "critical" || sdsExpired || chemicalExpired;

  return {
    band,
    confidence,
    requiresReview,
    hazardTypes,
    factors,
    plainEnglishSummary,
    thresholdMatched,
    sdsExpired,
    sdsWarning,
  };
}
