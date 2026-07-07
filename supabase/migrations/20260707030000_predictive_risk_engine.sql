-- ============================================================
-- Predictive Risk Engine (Phase 1 — data foundation + scoring).
-- Renamed from DRAFT_predictive_risk_engine.sql on 2026-07-07 as part of the
-- go-live gate (docs/predictive-risk-engine.md). STAGING/PREVIEW ONLY until all
-- 6 checklist items are signed off — do NOT apply to production directly. The
-- production apply happens only after both sign-offs are recorded in
-- public.predictive_risk_go_live.
-- Phase 1 ONLY: no AI Gateway wiring, no auto-escalation, no retraining loop.
--
-- RLS policy names below (grep targets for the manual RLS verification step):
--   tenant_read_site_risk_scores        (select on site_risk_scores, in_tenant)
--   admin_manage_leading_indicators     (all on leading_indicators)
--   admin_manage_risk_score_bands       (all on risk_score_bands)
--   authenticated_read_leading_indicators / authenticated_read_risk_score_bands
-- leading_indicators + risk_score_bands are platform-wide reference data by
-- design (admin/ehs_manager editable, all-authenticated readable) — intentionally
-- NOT tenant-scoped. Only site_risk_scores carries per-tenant rows.
-- ============================================================
--
-- This schema deliberately reuses tenant_id/site_id — the platform's actual
-- multi-tenancy columns (see public.tenants, public.sites, and in_tenant() in
-- 0002_rls.sql) — rather than an "organizations" model. There is no
-- organizations or user_organizations table in this codebase.
--
-- Source data for indicators (already live, no new tables needed for these):
--   overdue_inspection  -> public.audits            (status in scheduled/in_progress AND scheduled_date < today)
--   expired_sds         -> public.chemical_inventory (sds_expiry < today, see 20260707010000_sds_review_due_date.sql)
--   missing_training    -> public.training_records   (expiry_date < today, or required course with no record)
--   open_incident       -> public.incidents          (incident_type <> 'near_miss', status <> 'closed', occurred_at within window)
--   open_near_miss      -> public.incidents          (incident_type = 'near_miss', status <> 'closed', occurred_at within window)

create table if not exists public.leading_indicators (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null, -- 'overdue_inspection' | 'expired_sds' | 'missing_training' | 'open_incident' | 'open_near_miss'
  label       text not null,
  description text,
  weight      numeric not null default 1.0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.risk_score_bands (
  id          uuid primary key default gen_random_uuid(),
  band_key    text unique not null, -- 'green' | 'amber' | 'orange' | 'red'
  label       text not null,
  min_score   numeric not null,
  max_score   numeric not null,
  color_hex   text not null,
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now()
);

create table if not exists public.site_risk_scores (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  site_id              uuid not null references public.sites(id) on delete cascade,
  score_date           date not null default current_date,
  raw_score            numeric not null,
  band_key             text not null references public.risk_score_bands(band_key),
  explanation_text     text not null,
  indicator_breakdown  jsonb not null default '{}'::jsonb, -- { "overdue_inspection": {count, weight, contribution}, ... }
  created_at           timestamptz not null default now(),
  unique (site_id, score_date)
);

create index if not exists idx_site_risk_scores_site_date
  on public.site_risk_scores (site_id, score_date desc);

alter table public.leading_indicators enable row level security;
alter table public.risk_score_bands   enable row level security;
alter table public.site_risk_scores   enable row level security;

-- Tenant isolation follows the existing in_tenant(tenant_id) convention used
-- across every other tenant-scoped table (see 0002_rls.sql). leading_indicators
-- and risk_score_bands are platform-wide reference data (not tenant-scoped),
-- editable only by admins so EHS leads can tune weights/thresholds without a
-- code change.
create policy tenant_read_site_risk_scores on public.site_risk_scores
  for select using (public.in_tenant(tenant_id));

-- Writes only happen via the service-role server action (recalculateSiteRiskScores),
-- which bypasses RLS and enforces tenant ownership itself — see assertTenantOwnership
-- in src/lib/auth/session.ts. No direct client-side insert/update policy is defined.

create policy admin_manage_leading_indicators on public.leading_indicators
  for all using (auth.jwt() ->> 'role' in ('admin', 'ehs_manager'))
  with check (auth.jwt() ->> 'role' in ('admin', 'ehs_manager'));

create policy admin_manage_risk_score_bands on public.risk_score_bands
  for all using (auth.jwt() ->> 'role' in ('admin', 'ehs_manager'))
  with check (auth.jwt() ->> 'role' in ('admin', 'ehs_manager'));

-- All authenticated users can read the reference tables (needed to render the
-- band legend / indicator labels on the dashboard).
create policy authenticated_read_leading_indicators on public.leading_indicators
  for select using (auth.role() = 'authenticated');

create policy authenticated_read_risk_score_bands on public.risk_score_bands
  for select using (auth.role() = 'authenticated');

-- Seed default indicators. Weights are PLACEHOLDERS — must be reviewed and
-- tuned by an EHS lead against real site history before go-live.
-- SEED VALUES: reviewed and approved by <EHS manager name> on <date> for pilot tenant <tenant_id>
-- (Fill in at checklist item 1. Until filled, treat these weights as unreviewed.)
insert into public.leading_indicators (key, label, description, weight) values
  ('overdue_inspection', 'Overdue Inspections',        'Scheduled audit/inspection past its scheduled date and not completed', 2.0),
  ('expired_sds',        'Expired SDS',                'Chemical Safety Data Sheet review date has passed',                    1.5),
  ('missing_training',   'Missing/Overdue Training',   'Required employee safety training not completed or expired',          1.5),
  ('open_incident',      'Recent Incidents',           'Non-near-miss incidents logged in the last 90 days, not yet closed',  2.5),
  ('open_near_miss',     'Recent Near-Misses',         'Near-miss incidents logged in the last 90 days, not yet closed',      1.0)
on conflict (key) do nothing;

-- Seed default bands. Cutoffs are PLACEHOLDERS — require sign-off from an
-- actual EHS/safety manager, not just a statistical default.
-- SEED VALUES: reviewed and approved by <EHS manager name> on <date> for pilot tenant <tenant_id>
-- (Fill in at checklist item 1. Until filled, treat these cutoffs as unreviewed.)
insert into public.risk_score_bands (band_key, label, min_score, max_score, color_hex) values
  ('green',  'Low Risk',  0,   2.99, '#2E7D32'),
  ('amber',  'Watch',     3,   5.99, '#F9A825'),
  ('orange', 'Elevated',  6,   8.49, '#EF6C00'),
  ('red',    'Act Now',   8.5, 999,  '#C62828')
on conflict (band_key) do nothing;

-- No changes to any existing table. No destructive operations. No trigger
-- wiring an AI Gateway call or alert/escalation on insert/update — Phase 1 is
-- display-only, by design.
