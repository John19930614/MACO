-- ============================================================
-- Chemical container capacity — for regulation-correct label sizing.
--
-- EU CLP (Regulation 1272/2008, Annex I §1.2.1) mandates minimum label and
-- pictogram dimensions by the capacity of the CONTAINER being labelled. The
-- chemical_inventory table stored total quantity/unit (inventory on hand) but
-- not the capacity of a single container, so labels could not be sized to
-- regulation. These two additive columns capture that.
--
-- Both are additive (ADD COLUMN IF NOT EXISTS), nullable, and touch no existing
-- data. Existing rows get NULL and fall back to the smallest CLP tier until a
-- value is set. RLS is inherited from the existing chemical_inventory policies.
-- Safe, reversible, zero-downtime.
-- ============================================================

alter table public.chemical_inventory
  add column if not exists container_capacity numeric;

alter table public.chemical_inventory
  add column if not exists container_capacity_unit text;

comment on column public.chemical_inventory.container_capacity is
  'Capacity of a SINGLE container (not total inventory). Drives EU CLP label-size tier.';
comment on column public.chemical_inventory.container_capacity_unit is
  'Unit for container_capacity: mL | L | gal | g | kg. Converted to litres for CLP tiering.';
