-- ============================================================
-- Universal-Waste & Recycling Tracking (Haz + Nonhaz)
--
-- Two clearly separated workflows in the Waste Management module:
--   • Hazardous / Universal Waste  (universal_waste_items)
--   • Nonhazardous Recycling       (nonhaz_recycling_records)
--
-- Core rules enforced here (defense-in-depth; server actions enforce them too):
--   1. A documented hazardous-waste determination (waste_determinations) must
--      exist and be linked before any material enters a recycling stream. Both
--      universal_waste_items and nonhaz_recycling_records carry a NOT NULL
--      determination_id FK — the gate cannot be bypassed at the DB level.
--   2. Universal waste items auto-compute a 1-year (365-day) "must ship out by"
--      deadline via a generated column (accumulation_deadline).
--   3. nonhaz_recycling_records auto-compute diversion_rate from weight tickets.
--   4. rejected_loads drives the rejected-load workflow (flag + resolution).
--   5. waste_vendors gains insurance/recycler-authorization expiry columns
--      (permit_expiry already exists) to drive the vendor status badge.
--   6. uw_jurisdiction_rules is a lightweight, global reference table seeded with
--      WI aerosol-cans-as-UW (effective 2025-07-01) and CA state-specific UW
--      categories, read by the jurisdiction engine helper.
--
-- Additive & reversible: only CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT
-- EXISTS. No existing rows are touched. Tables follow the platform's real schema:
-- tenant_id -> public.tenants, site_id -> public.sites, actor -> public.profiles,
-- vendor -> public.waste_vendors. RLS mirrors the safety_cells pattern from
-- 0002_rls.sql: tenant read + write policies via the in_tenant(tenant_id) helper
-- (server actions use the RLS-respecting session client).
-- ============================================================

-- 1. Hazardous-waste determination gate (required before any recycling stream entry)
create table if not exists public.waste_determinations (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  site_id               uuid references public.sites(id) on delete set null,
  material_description   text not null,
  determination_result   text not null
                          check (determination_result in ('hazardous','universal_waste','nonhazardous','excluded')),
  regulatory_basis       text,
  jurisdiction_state     text,
  document_url           text,
  determined_by          uuid references public.profiles(id),
  determined_at          timestamptz not null default now(),
  status                 text not null default 'approved'
                          check (status in ('draft','approved','superseded')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists idx_waste_determinations_tenant
  on public.waste_determinations (tenant_id, status);

-- 2. Universal Waste tracked items
create table if not exists public.universal_waste_items (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  site_id                  uuid references public.sites(id) on delete set null,
  determination_id         uuid not null references public.waste_determinations(id),
  category                 text not null
                            check (category in ('batteries','lamps','mercury_equipment','aerosol_cans','pesticides','e_waste','used_oil','solvents')),
  handler_class            text not null default 'small_quantity'
                            check (handler_class in ('small_quantity','large_quantity')),
  jurisdiction_state       text not null,
  quantity                 numeric,
  quantity_uom             text,
  quantity_limit           numeric,
  accumulation_start_date  date not null,
  -- 1-year "must ship out by" deadline. date + integer -> date, so this stays a
  -- pure date (no timestamp coercion). Auto-computed; never manually entered.
  accumulation_deadline    date generated always as (accumulation_start_date + 365) stored,
  inspection_frequency_days integer default 7,
  status                   text not null default 'accumulating'
                            check (status in ('accumulating','shipped','rejected','closed')),
  -- Chain-of-custody + retention are written from linked certificate/item data
  -- by the server actions, not accepted as raw manual input per item.
  chain_of_custody         jsonb not null default '[]',
  retention_period_years   integer default 3,
  created_by               uuid references public.profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists idx_uw_items_tenant_status_deadline
  on public.universal_waste_items (tenant_id, status, accumulation_deadline);

-- 3. Nonhazardous recycling records (material, weight tickets, diversion, cost/revenue)
--    Created BEFORE recycling_certificates because certificates FK to this table.
create table if not exists public.nonhaz_recycling_records (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  site_id                  uuid references public.sites(id) on delete set null,
  determination_id         uuid not null references public.waste_determinations(id),
  material_category         text not null,
  contamination_limit_pct   numeric,
  weight_recycled           numeric,
  weight_landfill           numeric,
  weight_uom                text default 'lbs',
  -- Diversion rate: recycled / (recycled + landfill) * 100, rounded to 0.1%.
  -- Auto-computed from weight tickets; NULL until any weight is recorded.
  diversion_rate           numeric generated always as (
    case when (coalesce(weight_recycled,0) + coalesce(weight_landfill,0)) > 0
      then round(100 * coalesce(weight_recycled,0) / (coalesce(weight_recycled,0) + coalesce(weight_landfill,0)), 1)
      else null end
  ) stored,
  cost_avoided             numeric,
  revenue                  numeric,
  vendor_id                uuid references public.waste_vendors(id) on delete set null,
  status                   text not null default 'active'
                            check (status in ('active','rejected','closed')),
  created_by               uuid references public.profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists idx_nonhaz_records_tenant_status
  on public.nonhaz_recycling_records (tenant_id, status);

-- 4. Certificates of recycling / reclamation / destruction
create table if not exists public.recycling_certificates (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete cascade,
  universal_waste_item_id   uuid references public.universal_waste_items(id) on delete cascade,
  nonhaz_recycling_record_id uuid references public.nonhaz_recycling_records(id) on delete cascade,
  certificate_type          text not null
                             check (certificate_type in ('recycling','reclamation','destruction')),
  vendor_id                 uuid references public.waste_vendors(id) on delete set null,
  issued_date               date not null,
  document_url              text not null,
  -- Retention period auto-populated from the certificate + linked item at
  -- creation time (server action), not typed in per certificate.
  retention_period_years    integer default 3,
  status                    text not null default 'active'
                             check (status in ('active','rejected','superseded')),
  created_by                uuid references public.profiles(id),
  created_at                timestamptz not null default now(),
  -- A certificate must attach to exactly one tracked entity (UW item XOR nonhaz record).
  constraint recycling_certificates_one_target
    check (num_nonnulls(universal_waste_item_id, nonhaz_recycling_record_id) = 1)
);
create index if not exists idx_recycling_certificates_tenant
  on public.recycling_certificates (tenant_id, status);

-- 5. Rejected-load workflow tracking (haz or nonhaz)
create table if not exists public.rejected_loads (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete cascade,
  universal_waste_item_id   uuid references public.universal_waste_items(id) on delete cascade,
  nonhaz_recycling_record_id uuid references public.nonhaz_recycling_records(id) on delete cascade,
  rejected_at               timestamptz not null default now(),
  rejected_reason           text not null,
  rejected_by               uuid references public.profiles(id),
  -- Coordinator is flagged in-app until this is filled in and the load resolved.
  resolution_action         text check (resolution_action in ('recertified','disposed','rerouted')),
  resolution_notes          text,
  resolved_at               timestamptz,
  resolved_by               uuid references public.profiles(id),
  created_at                timestamptz not null default now(),
  constraint rejected_loads_one_target
    check (num_nonnulls(universal_waste_item_id, nonhaz_recycling_record_id) = 1)
);
create index if not exists idx_rejected_loads_tenant_open
  on public.rejected_loads (tenant_id, resolved_at);

-- 6. Vendor permit / insurance / recycler-authorization expiry.
--    permit_expiry already exists on waste_vendors; add the two new columns.
alter table public.waste_vendors add column if not exists insurance_expiry date;
alter table public.waste_vendors add column if not exists recycler_authorization_expiry date;

-- 7. Jurisdiction rules engine — GLOBAL reference table (not tenant-scoped).
--    Isolated so the future 50-state expansion is a data-only change.
create table if not exists public.uw_jurisdiction_rules (
  id                        uuid primary key default gen_random_uuid(),
  jurisdiction_state        text not null,
  category                  text not null,
  effective_date            date not null,
  inspection_frequency_days integer,
  notes                     text
);
create unique index if not exists uw_jurisdiction_rules_state_cat_eff
  on public.uw_jurisdiction_rules (jurisdiction_state, category, effective_date);

insert into public.uw_jurisdiction_rules (jurisdiction_state, category, effective_date, inspection_frequency_days, notes)
values
  ('WI', 'aerosol_cans',     '2025-07-01', 7, 'WI treats aerosol cans as universal waste effective 7/1/2025.'),
  ('CA', 'batteries',        '1900-01-01', 7, 'CA state-specific universal waste category.'),
  ('CA', 'lamps',            '1900-01-01', 7, 'CA state-specific universal waste category.'),
  ('CA', 'mercury_equipment','1900-01-01', 7, 'CA state-specific universal waste category.')
on conflict (jurisdiction_state, category, effective_date) do nothing;

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Tenant tables: read + write scoped to in_tenant(tenant_id), matching the
-- safety_cells pattern. Server actions use the session (RLS-respecting) client.
alter table public.waste_determinations     enable row level security;
alter table public.universal_waste_items    enable row level security;
alter table public.nonhaz_recycling_records enable row level security;
alter table public.recycling_certificates   enable row level security;
alter table public.rejected_loads           enable row level security;

drop policy if exists tenant_rw_waste_determinations on public.waste_determinations;
create policy tenant_rw_waste_determinations on public.waste_determinations
  for all using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));

drop policy if exists tenant_rw_universal_waste_items on public.universal_waste_items;
create policy tenant_rw_universal_waste_items on public.universal_waste_items
  for all using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));

drop policy if exists tenant_rw_nonhaz_recycling_records on public.nonhaz_recycling_records;
create policy tenant_rw_nonhaz_recycling_records on public.nonhaz_recycling_records
  for all using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));

drop policy if exists tenant_rw_recycling_certificates on public.recycling_certificates;
create policy tenant_rw_recycling_certificates on public.recycling_certificates
  for all using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));

drop policy if exists tenant_rw_rejected_loads on public.rejected_loads;
create policy tenant_rw_rejected_loads on public.rejected_loads
  for all using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));

-- Jurisdiction rules: global, non-sensitive reference data. Readable by any
-- authenticated tenant; writes happen only via migrations (no write policy).
alter table public.uw_jurisdiction_rules enable row level security;
drop policy if exists read_uw_jurisdiction_rules on public.uw_jurisdiction_rules;
create policy read_uw_jurisdiction_rules on public.uw_jurisdiction_rules
  for select using (true);
