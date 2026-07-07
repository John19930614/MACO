-- ============================================================
-- SDS review due date tracking.
--
-- `chemical_inventory.sds_expiry` already serves as the SDS review due date
-- (see the Chemical.sds_expiry comment in src/lib/types.ts) — this migration
-- does NOT add a duplicate column for it. It adds `sds_uploaded_at`, used to
-- compute the 3-year default whenever a chemical's SDS is (re)linked, and
-- backfills both fields for existing rows.
--
-- Backfill semantics:
--   - sds_uploaded_at := created_at where null, for every row (harmless —
--     just records "we don't have an upload timestamp before this migration").
--   - sds_expiry := (sds_uploaded_at + 3 years)::date, but ONLY where sds_url
--     is already set (i.e. a chemical that genuinely has an SDS document on
--     file) AND sds_expiry is null. Chemicals with no sds_url are left with a
--     null sds_expiry so they keep correctly showing "SDS Missing" (red)
--     after this migration — a blanket backfill would have hidden that risk.
--
-- Additive (ADD COLUMN IF NOT EXISTS), nullable, zero-downtime. RLS inherited
-- from existing chemical_inventory policies.
-- ============================================================

alter table public.chemical_inventory
  add column if not exists sds_uploaded_at timestamptz;

comment on column public.chemical_inventory.sds_uploaded_at is
  'When the current SDS document (sds_url) was linked/uploaded. Used to compute the default 3-year SDS review due date (sds_expiry).';

update public.chemical_inventory
set sds_uploaded_at = created_at
where sds_uploaded_at is null;

update public.chemical_inventory
set sds_expiry = (sds_uploaded_at + interval '3 years')::date
where sds_expiry is null
  and sds_url is not null;

-- Index to support fast filtering/sorting by SDS status on the chemicals table.
create index if not exists idx_chemical_inventory_sds_expiry
  on public.chemical_inventory (sds_expiry);

-- Verification query — run after applying, before promoting to production:
--   select
--     count(*) filter (where sds_url is null) as missing,
--     count(*) filter (where sds_url is not null and sds_expiry < current_date) as overdue,
--     count(*) filter (where sds_url is not null and sds_expiry between current_date and current_date + 90) as due_soon,
--     count(*) as total
--   from public.chemical_inventory;
