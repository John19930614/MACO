-- ============================================================
-- Chemical container label — distinguishes individual physical
-- containers of the same chemical.
--
-- chemical_inventory has one row per physical container, but rows with the
-- same name/CAS/storage_location were indistinguishable in the UI (compatibility
-- matrix, inventory list) — they just looked like duplicate data. This additive
-- column lets a container be tagged (e.g. "Bottle 1", "Cabinet A-3") so multiple
-- containers of the same chemical are unambiguous.
--
-- Backfill: any existing row that shares (tenant_id, name, cas_number,
-- storage_location) with at least one other row gets an auto-assigned
-- "Container N" label (ordered by created_at, then id) so today's ambiguous
-- rows become distinguishable immediately. Rows that are the only container
-- for their chemical/location are left NULL — no label needed.
--
-- Additive (ADD COLUMN IF NOT EXISTS), nullable, zero-downtime. RLS inherited
-- from existing chemical_inventory policies.
-- ============================================================

alter table public.chemical_inventory
  add column if not exists container_label text;

comment on column public.chemical_inventory.container_label is
  'Human label distinguishing this physical container from others of the same chemical (e.g. "Bottle 1", "Cabinet A-3"). NULL when there is only one container for that chemical/location.';

with grouped as (
  select
    id,
    row_number() over (
      partition by tenant_id, lower(trim(name)), coalesce(cas_number, ''), storage_location
      order by created_at, id
    ) as rn,
    count(*) over (
      partition by tenant_id, lower(trim(name)), coalesce(cas_number, ''), storage_location
    ) as grp_size
  from public.chemical_inventory
)
update public.chemical_inventory ci
set container_label = 'Container ' || grouped.rn
from grouped
where ci.id = grouped.id
  and grouped.grp_size > 1
  and ci.container_label is null;
