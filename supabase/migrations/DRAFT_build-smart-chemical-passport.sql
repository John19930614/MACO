-- ============================================================
-- DRAFT — NOT APPLIED, AND NOT REQUIRED for the current feature.
-- Smart Chemical Passport — OPTIONAL future columns on chemical_inventory.
-- ============================================================
--
-- The shipped Smart Chemical Passport needs NO schema change. It derives every
-- label field from columns that ALREADY exist on public.chemical_inventory:
--
--   productId        ← label_code
--   formula          ← chemical_formula
--   ghsPictograms    ← derived from hazard_statements (H-codes)
--   hazardStatements ← hazard_statements
--   ppeRequirements  ← recommended_ppe
--   storageGuidance  ← storage_class + storage_location
--   incompatibleWith ← derived from storage_class
--   aiConfidenceScore← hazard_band_confidence
--   lastVerifiedAt   ← hazard_band_reviewed_at
--   emergency contact← tenant onboarding_data.settings (hqPhone / emergencyCoord)
--
-- The columns below are OPTIONAL enhancements ONLY — apply them later if the
-- team wants to capture these per-chemical instead of deriving them. All are
-- additive (ADD COLUMN IF NOT EXISTS); none modify or drop existing columns.
-- RLS is inherited from the existing chemical_inventory policies. Requires
-- human approval before applying to any environment.

-- Per-chemical molecular weight (currently shown as "—")
-- alter table public.chemical_inventory add column if not exists molecular_weight numeric;

-- Per-chemical "What this chemical is used for" tags (currently omitted)
-- alter table public.chemical_inventory add column if not exists used_for text[];

-- Per-chemical emergency contact overrides (currently taken from tenant settings)
-- alter table public.chemical_inventory add column if not exists emergency_phone text;
-- alter table public.chemical_inventory add column if not exists emergency_name text;
-- alter table public.chemical_inventory add column if not exists emergency_instructions text;

-- Explicit incompatibility list (currently derived from storage_class)
-- alter table public.chemical_inventory add column if not exists incompatible_with text[];

-- No new tables. No RLS changes. No destructive operations.
