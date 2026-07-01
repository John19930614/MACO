import { describe, test, expect, vi, beforeEach } from "vitest";

// ── Mock the data layer + session (pure ghsData/chemicalRefData stay real) ──────
const mockGetChemicalById = vi.fn();
const mockGetTenantSettings = vi.fn();
const mockGetEffectiveTenantId = vi.fn();

vi.mock("@/lib/data/ehsRepo", () => ({
  getChemicalById: (...a: unknown[]) => mockGetChemicalById(...a),
  getTenantSettings: (...a: unknown[]) => mockGetTenantSettings(...a),
}));
vi.mock("@/lib/auth/session", () => ({
  getEffectiveTenantId: (...a: unknown[]) => mockGetEffectiveTenantId(...a),
}));

import { getChemicalPassportData } from "@/lib/actions/build-smart-chemical-passport";

const MOCK_CHEMICAL = {
  id: "chem-001",
  name: "Acetone",
  label_code: "PROD-001",
  cas_number: "67-64-1",
  chemical_formula: "C3H6O",
  hazard_statements: ["H225", "H319", "H336"],
  recommended_ppe: ["NITRILE_GLOVES", "CHEMICAL_GOGGLES"],
  storage_class: "FLAMMABLE",
  storage_location: "Flammables Cabinet A",
  hazard_band_confidence: 92,
  hazard_band_reviewed_at: "2026-06-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetChemicalById.mockResolvedValue({ ...MOCK_CHEMICAL });
  mockGetTenantSettings.mockResolvedValue({ hqPhone: "1-800-424-9300", emergencyCoord: "CHEMTREC" });
  mockGetEffectiveTenantId.mockResolvedValue("tenant-1");
});

describe("getChemicalPassportData", () => {
  test("returns a correctly shaped ChemicalPassportData object", async () => {
    const r = await getChemicalPassportData("chem-001");
    expect(r.id).toBe("chem-001");
    expect(r.chemicalName).toBe("Acetone");
    expect(r.productId).toBe("PROD-001");
    expect(r.casNumber).toBe("67-64-1");
    expect(r.formula).toBe("C3H6O");
    expect(r.ppeRequirements).toHaveLength(2);
  });

  test("chemicalName and casNumber are both non-empty (never CAS alone)", async () => {
    const r = await getChemicalPassportData("chem-001");
    expect(r.chemicalName.length).toBeGreaterThan(0);
    expect(r.casNumber.length).toBeGreaterThan(0);
  });

  test("GHS pictograms are derived from hazard statements", async () => {
    const r = await getChemicalPassportData("chem-001");
    // H225 (flammable) → GHS02; H319/H336 (irritant) → GHS07
    expect(r.ghsPictograms).toContain("GHS02");
    expect(r.ghsPictograms).toContain("GHS07");
  });

  test("hazard statements are expanded with plain-language text", async () => {
    const r = await getChemicalPassportData("chem-001");
    expect(r.hazardStatements[0]).toMatch(/^H225 – /);
  });

  test("every PPE requirement has a non-empty label", async () => {
    const r = await getChemicalPassportData("chem-001");
    r.ppeRequirements.forEach((p) => {
      expect(typeof p.label).toBe("string");
      expect(p.label.length).toBeGreaterThan(0);
    });
    expect(r.ppeRequirements[0].label).toBe("Nitrile Gloves");
  });

  test("aiConfidenceScore 92 stays 92 (maps to High Confidence)", async () => {
    const r = await getChemicalPassportData("chem-001");
    expect(r.aiConfidenceScore).toBe(92);
    expect((r.aiConfidenceScore ?? 0) >= 80).toBe(true);
  });

  test("0–1 scale confidence is normalized to 0–100", async () => {
    mockGetChemicalById.mockResolvedValueOnce({ ...MOCK_CHEMICAL, hazard_band_confidence: 0.65 });
    const r = await getChemicalPassportData("chem-001");
    expect(r.aiConfidenceScore).toBe(65);
  });

  test("null confidence falls back gracefully", async () => {
    mockGetChemicalById.mockResolvedValueOnce({ ...MOCK_CHEMICAL, hazard_band_confidence: null });
    const r = await getChemicalPassportData("chem-001");
    expect(r.aiConfidenceScore).toBeNull();
  });

  test("missing optional fields fall back to safe defaults", async () => {
    mockGetChemicalById.mockResolvedValueOnce({
      ...MOCK_CHEMICAL, cas_number: null, chemical_formula: null, recommended_ppe: [], hazard_band_reviewed_at: null,
    });
    const r = await getChemicalPassportData("chem-001");
    expect(r.casNumber).toBe("—");
    expect(r.formula).toBe("—");
    expect(r.usedFor).toEqual([]);
    expect(r.reviewStatus).toBe("pending");
  });

  test("emergency contact falls back to 911 when no tenant settings", async () => {
    mockGetTenantSettings.mockResolvedValueOnce({});
    const r = await getChemicalPassportData("chem-001");
    expect(r.emergencyPhone).toBe("911");
    expect(r.emergencyName).toBeNull();
  });

  test("non-existent record throws a plain-English error", async () => {
    mockGetChemicalById.mockResolvedValueOnce(null);
    await expect(getChemicalPassportData("missing")).rejects.toThrow(
      "Chemical record not found or you do not have permission to view it.",
    );
  });
});
