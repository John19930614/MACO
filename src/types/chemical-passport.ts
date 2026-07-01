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
  smartLabelId: string;           // e.g. 'SCP-CR1906-250521'
  casNumber: string;
  formula: string;
  molecularWeight: string | number;
  signalWord: "Danger" | "Warning" | null; // derived from hazard statements
  ghsPictograms: string[];        // e.g. ['GHS01', 'GHS07']
  hazardStatements: string[];     // e.g. ['H225 – Highly flammable liquid and vapour']
  ppeRequirements: PpeRequirement[];
  storageGuidance: string;        // Plain action-oriented language
  compatibleWith: string[];       // 'Compatible With' list
  incompatibleWith: string[];     // 'Do Not Mix With / Store Away From' list
  usedFor: string[];              // Renamed from 'task modes'
  emergencyPhone: string;
  emergencyName: string | null;
  emergencyInstructions: string | null;
  aiConfidenceScore: number | null; // 0–100; shown as a confidence ring
  lastVerifiedAt: string | null;  // ISO date string
  reviewStatus: ReviewStatus;
  containerCapacity: number | null;      // single-container capacity (for CLP print size)
  containerCapacityUnit: string | null;  // mL | L | gal | g | kg
}
