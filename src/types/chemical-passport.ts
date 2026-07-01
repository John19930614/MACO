// Shared types for the Smart Chemical Passport label feature.
// Populated from the live chemical_inventory record (see
// src/lib/actions/build-smart-chemical-passport.ts) — no new DB columns.

export interface PpeRequirement {
  code: string;   // e.g. 'NITRILE_GLOVES', 'CHEMICAL_GOGGLES'
  label: string;  // plain-language: 'Nitrile Gloves', 'Chemical Splash Goggles'
}

export type ReviewStatus = "verified" | "pending" | "under_review" | "expired" | null;

export interface ChemicalPassportData {
  id: string;
  chemicalName: string;           // Always shown alongside CAS number — never CAS alone
  productId: string;
  casNumber: string;
  formula: string;
  molecularWeight: string | number;
  ghsPictograms: string[];        // e.g. ['GHS01', 'GHS07']
  hazardStatements: string[];     // e.g. ['H225 – Highly flammable liquid and vapour']
  ppeRequirements: PpeRequirement[];
  storageGuidance: string;        // Plain action-oriented language
  incompatibleWith: string[];     // 'Do Not Mix With / Store Away From' list
  usedFor: string[];              // Renamed from 'task modes'
  emergencyPhone: string;
  emergencyName: string | null;
  emergencyInstructions: string | null;
  aiConfidenceScore: number | null; // 0–100; displayed as colored dot, never raw number
  lastVerifiedAt: string | null;  // ISO date string
  reviewStatus: ReviewStatus;
}
