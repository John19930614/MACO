-- ============================================================
-- Hazardous-Waste Generator Category + Minimization Program
--
-- Adds RCRA generator-status and waste-minimization compliance to the Waste
-- Management module:
--   1. waste_monthly_tally      — rolling monthly haz-waste totals per site,
--                                 with a server-computed EPA generator category
--                                 (VSQG / SQG / LQG).
--   2. sites.*                  — denormalized current generator category on the
--                                 site row for fast reads.
--   3. waste_minimization_program — baseline / target / owner / due date /
--                                 cost-savings-ROI / approval workflow /
--                                 effectiveness review.
--   4. waste_intensity_metric   — production-normalized waste intensity
--                                 (waste per production unit, generated column).
--   5. waste_hierarchy_record   — eliminate/substitute/reduce/reuse/recycle/
--                                 treat/dispose split, with a generated
--                                 prevented_kg (eliminate+substitute+reduce) so
--                                 prevention is never merged into recycling.
--   6. waste_compliance_action  — action/alert log for generator-category
--                                 change, baseline exceedance, expired material,
--                                 repeat spill, overdue minimization target.
--
-- Additive & reversible: only CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT
-- EXISTS. No existing rows are touched. Follows the platform's real schema:
-- tenant_id -> public.tenants, site_id -> public.sites, actor -> public.profiles.
-- RLS mirrors 20260710010000_universal_waste_recycling_tracking.sql: tenant
-- read + write via the in_tenant(tenant_id) helper (server actions use the
-- RLS-respecting session client for reads and a tenant-checked service-role
-- client for writes).
--
-- NOTE: the manifest minimization-certification piece from the original spec is
-- intentionally deferred — this platform has no waste_manifests table, so that
-- work is tracked separately rather than inventing a manifest sub-module here.
-- ============================================================

-- 1. Monthly hazardous-waste tally per site (drives the generator category)
create table if not exists public.waste_monthly_tally (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete cascade,
  site_id                   uuid not null references public.sites(id) on delete cascade,
  period_year               int  not null,
  period_month              int  not null check (period_month between 1 and 12),
  hazardous_waste_kg        numeric(14,3) not null default 0,
  acute_hazardous_waste_kg  numeric(14,3) not null default 0,
  generator_category        text check (generator_category in ('VSQG','SQG','LQG')),
  prior_generator_category  text check (prior_generator_category in ('VSQG','SQG','LQG')),
  computed_at               timestamptz not null default now(),
  created_by                uuid references public.profiles(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (site_id, period_year, period_month)
);
create index if not exists idx_waste_monthly_tally_site
  on public.waste_monthly_tally (tenant_id, site_id, period_year, period_month desc);

-- 2. Site-level current generator status (denormalized for fast reads)
alter table public.sites
  add column if not exists current_generator_category text
    check (current_generator_category in ('VSQG','SQG','LQG')),
  add column if not exists generator_category_updated_at timestamptz;

-- 3. Waste minimization program
create table if not exists public.waste_minimization_program (
  id                                  uuid primary key default gen_random_uuid(),
  tenant_id                           uuid not null references public.tenants(id) on delete cascade,
  site_id                             uuid references public.sites(id) on delete set null,
  name                                text not null,
  waste_stream                        text,
  baseline_year                       int  not null,
  baseline_quantity_kg                numeric(14,3) not null,
  reduction_target_pct                numeric(6,2)  not null,
  reduction_target_quantity_kg        numeric(14,3),
  owner_id                            uuid references public.profiles(id),
  due_date                            date not null,
  estimated_cost                      numeric(14,2),
  estimated_savings                   numeric(14,2),
  estimated_roi_pct                   numeric(8,2),
  approval_status                     text not null default 'draft'
                                        check (approval_status in ('draft','pending_approval','approved','rejected')),
  approved_by                         uuid references public.profiles(id),
  approved_at                         timestamptz,
  implementation_evidence_url         text,
  effectiveness_review_notes          text,
  effectiveness_review_date           date,
  effectiveness_reduction_achieved_pct numeric(6,2),
  status                              text not null default 'active'
                                        check (status in ('active','overdue','completed','cancelled')),
  created_by                          uuid references public.profiles(id),
  created_at                          timestamptz not null default now(),
  updated_at                          timestamptz not null default now()
);
create index if not exists idx_waste_min_program_site
  on public.waste_minimization_program (tenant_id, site_id, due_date);

-- 4. Waste intensity metrics (production-normalized)
create table if not exists public.waste_intensity_metric (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  site_id              uuid not null references public.sites(id) on delete cascade,
  period_year          int  not null,
  period_month         int  not null check (period_month between 1 and 12),
  production_units     numeric(14,3) not null,
  production_unit_type text not null,
  total_waste_kg       numeric(14,3) not null,
  waste_intensity      numeric(14,6) generated always as (
    case when production_units > 0 then total_waste_kg / production_units else 0 end
  ) stored,
  created_at           timestamptz not null default now(),
  unique (site_id, period_year, period_month)
);
create index if not exists idx_waste_intensity_metric_site
  on public.waste_intensity_metric (tenant_id, site_id, period_year, period_month);

-- 5. Waste hierarchy split reporting
create table if not exists public.waste_hierarchy_record (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  site_id        uuid references public.sites(id) on delete set null,
  period_year    int  not null,
  period_month   int  not null check (period_month between 1 and 12),
  waste_stream   text,
  eliminated_kg  numeric(14,3) not null default 0,
  substituted_kg numeric(14,3) not null default 0,
  reduced_kg     numeric(14,3) not null default 0,
  reused_kg      numeric(14,3) not null default 0,
  recycled_kg    numeric(14,3) not null default 0,
  treated_kg     numeric(14,3) not null default 0,
  landfilled_kg  numeric(14,3) not null default 0,
  -- Prevention (source reduction) is kept strictly separate from recycling so
  -- true waste reduction is never masked by recycling numbers.
  prevented_kg   numeric(14,3) generated always as
                   (eliminated_kg + substituted_kg + reduced_kg) stored,
  created_at     timestamptz not null default now()
);
create index if not exists idx_waste_hierarchy_site_period
  on public.waste_hierarchy_record (tenant_id, site_id, period_year, period_month);

-- 6. Compliance actions/alerts log
create table if not exists public.waste_compliance_action (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  site_id      uuid references public.sites(id) on delete set null,
  action_type  text not null check (action_type in (
                 'generator_category_change',
                 'baseline_exceedance',
                 'expired_material',
                 'repeat_spill',
                 'overdue_minimization_target'
               )),
  reference_id uuid,
  severity     text not null default 'medium'
                 check (severity in ('low','medium','high','critical')),
  details      jsonb,
  status       text not null default 'open'
                 check (status in ('open','acknowledged','resolved')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index if not exists idx_waste_compliance_action_site
  on public.waste_compliance_action (tenant_id, site_id, status, created_at desc);

-- ============================================================
-- RLS — tenant read + write via the in_tenant(tenant_id) helper, matching the
-- pattern established in 20260710010000_universal_waste_recycling_tracking.sql.
-- ============================================================
alter table public.waste_monthly_tally        enable row level security;
alter table public.waste_minimization_program enable row level security;
alter table public.waste_intensity_metric     enable row level security;
alter table public.waste_hierarchy_record     enable row level security;
alter table public.waste_compliance_action    enable row level security;

create policy tenant_rw_waste_monthly_tally on public.waste_monthly_tally
  for all using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));

create policy tenant_rw_waste_minimization_program on public.waste_minimization_program
  for all using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));

create policy tenant_rw_waste_intensity_metric on public.waste_intensity_metric
  for all using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));

create policy tenant_rw_waste_hierarchy_record on public.waste_hierarchy_record
  for all using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));

create policy tenant_rw_waste_compliance_action on public.waste_compliance_action
  for all using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));
