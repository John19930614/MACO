"use server";

import { getChemicalById, getTenantSettings } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { derivePictograms, getHText, deriveSignalWord } from "@/lib/ghsData";
import { getPpeName, getStorageClassName } from "@/lib/chemicalRefData";
import { computeMolecularWeight } from "@/lib/chemicals/molecularWeight";
import type { ChemicalPassportData } from "@/types/chemical-passport";

// Generic, honest "compatible with" guidance (real compatibility must come from
// the SDS). Kept short so the label reads cleanly.
const COMPATIBLE_BASE = [
  "Same-class waste containers",
  "Secondary containment / spill trays",
  "Materials listed as compatible in SDS Section 7",
];

function smartLabelId(productId: string, isoDate: string | null): string {
  const d = isoDate ? new Date(isoDate) : new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const pid = (productId || "CHEM").replace(/[^A-Za-z0-9]/g, "").slice(0, 12) || "CHEM";
  return `SCP-${pid}-${yy}${mm}${dd}`;
}

// Storage-class → common incompatibilities (plain-language, for the
// "Do Not Mix With / Store Away From" section). Derived from the chemical's
// existing storage_class; falls back to an SDS pointer when unknown.
const INCOMPATIBLES: Record<string, string[]> = {
  FLAMMABLE:      ["Oxidizers", "Ignition sources, heat and sparks", "Strong acids"],
  COMBUSTIBLE:    ["Oxidizers", "Ignition sources and heat"],
  FLAMMABLE_GAS:  ["Oxidizers", "Ignition sources", "Compressed oxygen"],
  AEROSOL:        ["Heat and ignition sources", "Oxidizers"],
  OXIDIZER:       ["Flammable and combustible materials", "Organic materials", "Reducing agents"],
  OXIDIZER_GAS:   ["Flammable gases", "Combustible materials", "Reducing agents"],
  CORROSIVE_ACID: ["Bases and caustics", "Reactive metals", "Oxidizers", "Cyanides and sulfides"],
  CORROSIVE_BASE: ["Acids", "Reactive metals (aluminum, zinc)"],
  TOXIC:          ["Acids (may release toxic gas)", "Food and consumables"],
  WATER_REACTIVE: ["Water and aqueous solutions", "Acids"],
  COMPRESSED_GAS: ["Incompatible gases", "Heat sources"],
  EXPLOSIVE:      ["Shock, friction and heat", "Oxidizers", "Reducing agents"],
};

function deriveIncompatibles(storageClass: string | null): string[] {
  if (storageClass && INCOMPATIBLES[storageClass]) return INCOMPATIBLES[storageClass];
  return ["Consult SDS Section 10 (Stability and Reactivity) for incompatible materials"];
}

function buildStorageGuidance(storageClass: string | null, location: string | null): string {
  const cls = getStorageClassName(storageClass);
  const parts: string[] = [];
  if (cls) parts.push(`Store as ${cls}`);
  if (location) parts.push(`in ${location}`);
  if (parts.length === 0) return "Follow standard storage procedures. Consult the SDS for specific requirements.";
  return parts.join(" ") + ". Keep containers closed and away from incompatible materials.";
}

// hazard_band_confidence may be stored 0–1 or 0–100. Normalize to 0–100.
function normalizeConfidence(raw: number | null): number | null {
  if (raw === null || raw === undefined || Number.isNaN(raw)) return null;
  const n = raw <= 1 ? raw * 100 : raw;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Builds the Smart Chemical Passport payload for a chemical, entirely from the
 * existing chemical_inventory record + tenant settings. Reuses getChemicalById
 * (tenant-scoped / RLS-respecting). Throws a plain-English error if the record
 * is not found or the caller can't access it.
 */
export async function getChemicalPassportData(id: string): Promise<ChemicalPassportData> {
  const chemical = await getChemicalById(id);
  if (!chemical) {
    throw new Error(
      "Chemical record not found or you do not have permission to view it. Please check the record and try again.",
    );
  }

  // Emergency contact comes from company settings (same source as the Waste module).
  const tenantId = await getEffectiveTenantId();
  const settings = await getTenantSettings(tenantId);
  const emergencyPhone = typeof settings.hqPhone === "string" && settings.hqPhone ? settings.hqPhone : "911";
  const emergencyName = typeof settings.emergencyCoord === "string" && settings.emergencyCoord ? settings.emergencyCoord : null;

  const hazardStatements = (chemical.hazard_statements ?? []).map((code) => {
    const text = getHText(code);
    return text ? `${code} – ${text}` : code;
  });

  const ppeRequirements = (chemical.recommended_ppe ?? []).map((code) => ({
    code,
    label: getPpeName(code),
  }));

  const productId = chemical.label_code || chemical.id.slice(0, 8).toUpperCase();
  const mw = computeMolecularWeight(chemical.chemical_formula);

  return {
    id: chemical.id,
    chemicalName: chemical.name || "Unknown Chemical",
    productId,
    smartLabelId: smartLabelId(productId, chemical.hazard_band_reviewed_at ?? null),
    casNumber: chemical.cas_number || "—",
    formula: chemical.chemical_formula || "—",
    molecularWeight: mw !== null ? mw : "—",
    signalWord: deriveSignalWord(chemical.hazard_statements ?? []),
    ghsPictograms: derivePictograms(chemical.hazard_statements ?? []),
    hazardStatements,
    ppeRequirements,
    storageGuidance: buildStorageGuidance(chemical.storage_class ?? null, chemical.storage_location ?? null),
    compatibleWith: COMPATIBLE_BASE,
    incompatibleWith: deriveIncompatibles(chemical.storage_class ?? null),
    usedFor: [], // not captured on the chemical record
    emergencyPhone,
    emergencyName,
    emergencyInstructions: emergencyName ? "Call the emergency contact immediately for any spill, exposure, or fire." : null,
    aiConfidenceScore: normalizeConfidence(chemical.hazard_band_confidence ?? null),
    lastVerifiedAt: chemical.hazard_band_reviewed_at ?? null,
    reviewStatus: chemical.hazard_band_reviewed_at ? "verified" : "pending",
  };
}
