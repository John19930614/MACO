-- Concentration-based chemical hazard classification
-- ==================================================
-- ADDITIVE ONLY. Adds the columns the concentration-hazard engine reads and
-- writes back onto the live, flat public.chemical_inventory table. Every column
-- is ADD COLUMN IF NOT EXISTS with a safe default — no existing column is
-- altered or dropped, and no row is modified beyond receiving column defaults.
-- RLS is already enabled on chemical_inventory with tenant insert/select/update
-- policies; nothing here touches security.
--
-- These columns power:
--   * the per-dilution hazard analysis (concentration_pct, physical_state,
--     flash_point_c, expiration_date)
--   * the finalized classification stored back on the chemical
--     (hazard_band, hazard_band_confidence, hazard_band_reviewed_at,
--      hazard_band_reason)
--   * the Priority Actions "pending uncertain-classification review" queue
--     (hazard_review_status)

alter table public.chemical_inventory
  add column if not exists concentration_pct        numeric,
  add column if not exists physical_state           text,
  add column if not exists flash_point_c            numeric,
  add column if not exists expiration_date          date,
  add column if not exists hazard_band              text,
  add column if not exists hazard_band_confidence   integer,
  add column if not exists hazard_band_reviewed_at  timestamptz,
  add column if not exists hazard_band_reason       text,
  add column if not exists hazard_review_status     text;

comment on column public.chemical_inventory.concentration_pct is
  'Weight/weight % of the active substance used for the most recent concentration-based hazard analysis.';
comment on column public.chemical_inventory.physical_state is
  'liquid | gas | solid | unknown — form used in the hazard analysis.';
comment on column public.chemical_inventory.flash_point_c is
  'Flash point in degrees Celsius (SDS section 9). Drives GHS flammable/combustible classification.';
comment on column public.chemical_inventory.expiration_date is
  'Chemical (not SDS) expiry. Past this date the substance may degrade or destabilise; the engine escalates and forces review.';
comment on column public.chemical_inventory.hazard_band is
  'Finalized concentration-aware hazard band: none | low | medium | high | critical.';
comment on column public.chemical_inventory.hazard_band_confidence is
  'AI/engine confidence 0-100 for the finalized band.';
comment on column public.chemical_inventory.hazard_band_reviewed_at is
  'When the classification was reviewed and finalized.';
comment on column public.chemical_inventory.hazard_band_reason is
  'RequireAReason: the structured reason captured when the reviewer accepted or overrode the suggested classification.';
comment on column public.chemical_inventory.hazard_review_status is
  'pending | approved | overridden. Uncertain classifications sit as pending (surfaced in Priority Actions) until a reviewer finalizes them.';

-- Speeds up the dashboard "chemicals pending uncertain-classification review" query.
create index if not exists chemical_inventory_hazard_review_status_idx
  on public.chemical_inventory (tenant_id, hazard_review_status);
