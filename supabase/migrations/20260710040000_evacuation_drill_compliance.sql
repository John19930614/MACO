-- ============================================================
-- Evacuation Drill Compliance Calendar
--
-- Extends the Emergency / EAP module with a per-site drill-compliance program:
--   1. facility_profiles            — one per site: AHJ, occupancy class, shifts,
--                                     high-hazard / hazmat flags, generator
--                                     category, alarm & suppression systems.
--   2. drill_frequency_requirements — per site + event type: the legally required
--                                     frequency + its legal source (e.g. an IFC
--                                     citation), the company's own (possibly
--                                     stricter) frequency, and a per-shift flag.
--   3. drill_calendar_events        — generated scheduled / due / overdue /
--                                     escalated drill occurrences, one per event
--                                     type (and per shift when per_shift).
--   4. drill_records                — what actually happened at a drill: timing,
--                                     participants, contractors/visitors, alarm
--                                     method, evac/assembly/accountability times,
--                                     blocked routes, equipment performance,
--                                     wardens, observers, problems, evidence,
--                                     corrective actions, plan-revision &
--                                     retraining dates, result, EAP-review flag.
--   5. drill_wardens                — warden assignment per site + shift.
--   6. drill_compliance_action      — action / alert log (overdue drill, missing
--                                     warden, roster/accountability mismatch),
--                                     mirroring waste_compliance_action.
--   7. eap_review_flag              — review-required flag wired after a failed
--                                     drill or a real emergency (the EAP module
--                                     itself is untouched — this only raises a
--                                     flag/task against it).
--
-- Additive & reversible: only CREATE TABLE IF NOT EXISTS. No existing rows are
-- touched. Follows the platform's real schema: tenant_id -> public.tenants,
-- site_id -> public.sites, actor/profile -> public.profiles, CAPA ->
-- public.capa_records. RLS mirrors
-- 20260710030000_hazardous_waste_generator_category_and_minimization.sql:
-- tenant read + write via the in_tenant(tenant_id) helper.
--
-- NOTE: "facility" in the source spec maps to a site here — this platform's unit
-- of physical location is public.sites (there is no facilities/org_id table), so
-- every profile is keyed one-to-one to a site and scoped by tenant_id.
-- ============================================================

-- 1. Facility (site) profile — one row per site.
create table if not exists public.facility_profiles (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  site_id                     uuid not null references public.sites(id) on delete cascade,
  ahj                         text,
  occupancy_classification    text,
  shifts                      jsonb not null default '[]'::jsonb,   -- [{ id, name }]
  high_hazard_ops             boolean not null default false,
  hazmat_inventory            jsonb not null default '[]'::jsonb,   -- [{ material, quantity }]
  generator_category          text,
  alarm_suppression_systems   jsonb not null default '[]'::jsonb,   -- [ "sprinkler", "voice-evac", ... ]
  notes                       text,
  created_by                  uuid references public.profiles(id),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (site_id)
);
create index if not exists idx_facility_profiles_tenant
  on public.facility_profiles (tenant_id, site_id);

-- 2. Drill frequency requirements — per site + event type.
create table if not exists public.drill_frequency_requirements (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  site_id                     uuid not null references public.sites(id) on delete cascade,
  event_type                  text not null check (event_type in (
                                'fire','chemical_release','shelter_in_place','severe_weather',
                                'active_threat','medical','spill','rcra_contingency',
                                'confined_space_rescue','accountability','comms_test',
                                'tabletop','business_continuity')),
  required_frequency          text not null,   -- monthly / quarterly / semiannual / annual / biennial ...
  legal_source                text not null,   -- e.g. 'IFC 2021 §405.2', 'OSHA 1910.38', company policy
  company_required_frequency  text,            -- optional, may be stricter than code
  per_shift                   boolean not null default false,
  active                      boolean not null default true,
  created_by                  uuid references public.profiles(id),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (site_id, event_type)
);
create index if not exists idx_drill_freq_req_site
  on public.drill_frequency_requirements (tenant_id, site_id, event_type);

-- 3. Generated drill calendar occurrences.
create table if not exists public.drill_calendar_events (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  site_id                     uuid not null references public.sites(id) on delete cascade,
  event_type                  text not null,
  shift_id                    text,            -- null = all shifts
  shift_name                  text,
  scheduled_date              date not null,
  due_date                    date not null,
  effective_frequency         text,            -- the frequency actually used (stricter of code/company)
  status                      text not null default 'scheduled'
                                check (status in ('scheduled','completed','overdue','escalated')),
  generated_at                timestamptz not null default now(),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists idx_drill_cal_site
  on public.drill_calendar_events (tenant_id, site_id, event_type, due_date);
create index if not exists idx_drill_cal_status
  on public.drill_calendar_events (tenant_id, status, due_date);

-- 4. Drill records.
create table if not exists public.drill_records (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  site_id                     uuid not null references public.sites(id) on delete cascade,
  calendar_event_id           uuid references public.drill_calendar_events(id) on delete set null,
  event_type                  text not null,
  drill_date                  date not null,
  start_time                  text,
  end_time                    text,
  participants                jsonb not null default '[]'::jsonb,
  contractors_visitors_present jsonb not null default '[]'::jsonb,
  alarm_method                text,
  evacuation_time_seconds     integer check (evacuation_time_seconds is null or evacuation_time_seconds >= 0),
  assembly_time_seconds       integer check (assembly_time_seconds is null or assembly_time_seconds >= 0),
  accountability_time_seconds integer check (accountability_time_seconds is null or accountability_time_seconds >= 0),
  blocked_routes              jsonb not null default '[]'::jsonb,
  equipment_performance       jsonb not null default '[]'::jsonb,   -- [{ item, status }]
  wardens                     jsonb not null default '[]'::jsonb,
  observers                   jsonb not null default '[]'::jsonb,
  problems_noted              text,
  evidence_urls               jsonb not null default '[]'::jsonb,
  corrective_actions          jsonb not null default '[]'::jsonb,   -- [{ description, owner, dueDate }]
  plan_revision_date          date,
  retraining_date             date,
  result                      text not null default 'incomplete'
                                check (result in ('passed','failed','incomplete')),
  real_emergency_triggered    boolean not null default false,
  eap_review_required         boolean not null default false,
  capa_id                     uuid references public.capa_records(id) on delete set null,
  created_by                  uuid references public.profiles(id),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists idx_drill_records_site
  on public.drill_records (tenant_id, site_id, event_type, drill_date);

-- 5. Warden assignment per site + shift.
create table if not exists public.drill_wardens (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  site_id                     uuid not null references public.sites(id) on delete cascade,
  shift_id                    text,            -- null = all shifts
  profile_id                  uuid not null references public.profiles(id) on delete cascade,
  role                        text not null default 'warden',   -- warden / floor_warden / chief / ...
  active                      boolean not null default true,
  created_by                  uuid references public.profiles(id),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (site_id, shift_id, profile_id, role)
);
create index if not exists idx_drill_wardens_site
  on public.drill_wardens (tenant_id, site_id, active);

-- 6. Action / alert log (overdue drill, missing warden, roster mismatch).
create table if not exists public.drill_compliance_action (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  site_id                     uuid not null references public.sites(id) on delete cascade,
  action_type                 text not null check (action_type in (
                                'overdue_drill','missing_warden','roster_accountability_mismatch',
                                'failed_drill','eap_review_required')),
  severity                    text not null default 'medium'
                                check (severity in ('low','medium','high','critical')),
  details                     jsonb not null default '{}'::jsonb,
  reference_id                uuid,            -- drill_calendar_events.id or drill_records.id
  resolved                    boolean not null default false,
  resolved_at                 timestamptz,
  created_at                  timestamptz not null default now()
);
create index if not exists idx_drill_action_site
  on public.drill_compliance_action (tenant_id, site_id, resolved, created_at desc);

-- 7. EAP review flag (raised after a failed drill or a real emergency).
--    Wires a review flag/task against the EAP — it does not modify the EAP module.
create table if not exists public.eap_review_flag (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  site_id                     uuid not null references public.sites(id) on delete cascade,
  reason                      text not null check (reason in ('failed_drill','real_emergency')),
  source_drill_id             uuid references public.drill_records(id) on delete set null,
  status                      text not null default 'pending'
                                check (status in ('pending','in_review','completed')),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists idx_eap_review_flag_site
  on public.eap_review_flag (tenant_id, site_id, status);

-- ── RLS — tenant read + write via the in_tenant(tenant_id) helper ─────────────
alter table public.facility_profiles            enable row level security;
alter table public.drill_frequency_requirements enable row level security;
alter table public.drill_calendar_events        enable row level security;
alter table public.drill_records                enable row level security;
alter table public.drill_wardens                enable row level security;
alter table public.drill_compliance_action      enable row level security;
alter table public.eap_review_flag              enable row level security;

create policy tenant_rw_facility_profiles on public.facility_profiles
  for all using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));

create policy tenant_rw_drill_frequency_requirements on public.drill_frequency_requirements
  for all using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));

create policy tenant_rw_drill_calendar_events on public.drill_calendar_events
  for all using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));

create policy tenant_rw_drill_records on public.drill_records
  for all using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));

create policy tenant_rw_drill_wardens on public.drill_wardens
  for all using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));

create policy tenant_rw_drill_compliance_action on public.drill_compliance_action
  for all using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));

create policy tenant_rw_eap_review_flag on public.eap_review_flag
  for all using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));
