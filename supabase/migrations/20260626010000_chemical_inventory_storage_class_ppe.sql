-- =====================================================================================
-- Tier 2 chemical module: structured storage class + recommended PPE
-- =====================================================================================
-- Adds two columns to the live, flat public.chemical_inventory table so the chemical
-- Add/Edit forms can persist a single GHS storage-class code and a list of PPE codes.
-- Additive and idempotent — no existing data is touched. Dropdown option labels live
-- as TypeScript constants in src/lib/chemicalRefData.ts (STORAGE_CLASSES / PPE_TYPES).
-- =====================================================================================

alter table public.chemical_inventory
  add column if not exists storage_class   text,
  add column if not exists recommended_ppe text[] not null default '{}';

comment on column public.chemical_inventory.storage_class
  is 'GHS storage-class code (see STORAGE_CLASSES in src/lib/chemicalRefData.ts)';
comment on column public.chemical_inventory.recommended_ppe
  is 'Array of PPE codes (see PPE_TYPES in src/lib/chemicalRefData.ts)';
