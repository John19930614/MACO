-- Migration: regulatory_reporting_clocks
-- Regulatory Incident-Reporting Clocks (federal OSHA 8hr/24hr + Cal/OSHA + EPA/state)
--
-- Turns the single boolean incidents.regulatory_reportable into a structured,
-- per-jurisdiction countdown-clock model.
--
-- ADAPTED to the real SafetyIQ/MACO schema:
--   * multi-tenant by tenant_id (references public.tenants), NOT org_id
--   * the incident type column is `incidents.incident_type` (text; the live
--     baseline has no CHECK), NOT `investigation_type`; we do NOT drop the
--     deprecated `regulatory_reportable` boolean — it is retained for back-compat
--     and is now mirrored by the structured clock rows below
--   * role gating is enforced in the server-action layer
--     (getIncidentReportingAccess + MANAGER_ROLES) plus RLS tenant isolation via
--     the profiles.role pattern from 20260710020000_young_worker_module.sql. The
--     ticket's investigator/legal/hr roles do not exist (ROLES ⊂ constants.ts);
--     MANAGER_ROLES = safety_manager, ehs_manager, admin (+ platform superadmins,
--     tenant_id IS NULL) may write clocks. Any same-tenant user may read them.
--
-- ⚠ NOT LEGAL ADVICE. The regulatory_reporting_rules seed encodes the deadlines
-- named in the feature request (federal 8hr/24hr, Cal/OSHA 8hr, EPA reportable-
-- quantity) but MUST be reviewed and completed by legal/compliance before this
-- control is relied on. EPA/state timers vary by substance and state and are
-- seeded with an illustrative default.

-- ── regulatory_reporting_rules (platform reference data; service-role writes) ──
create table if not exists public.regulatory_reporting_rules (
  id              uuid primary key default gen_random_uuid(),
  jurisdiction    text not null,   -- 'federal_osha','california_cal_osha','epa_environmental_release'
  event_type      text not null,   -- 'fatality','inpatient_hospitalization','amputation','loss_of_eye','serious_injury_illness_or_death','reportable_quantity_release'
  deadline_hours  integer not null,
  description     text not null,
  source_citation text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (jurisdiction, event_type)
);

-- ── incident_regulatory_clocks (tenant-scoped) ──
create table if not exists public.incident_regulatory_clocks (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  incident_id             uuid not null references public.incidents(id) on delete cascade,
  rule_id                 uuid references public.regulatory_reporting_rules(id),
  jurisdiction            text not null,
  event_type              text not null,
  description             text not null,
  deadline_hours          integer not null,
  status                  text not null default 'running' check (status in (
                            'not_applicable','pending_start','running','escalated_amber',
                            'escalated_red','overdue','reported','closed_no_report_required')),
  started_at              timestamptz not null default now(),
  deadline_at             timestamptz not null,
  reported_at             timestamptz,
  confirmation_number     text,
  confirmation_entered_by uuid references public.profiles(id),
  confirmation_entered_at timestamptz,
  justification_text      text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ── incident_regulatory_clock_events (tenant-scoped audit trail) ──
create table if not exists public.incident_regulatory_clock_events (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  clock_id   uuid not null references public.incident_regulatory_clocks(id) on delete cascade,
  event_type text not null check (event_type in (
               'started','escalated','notified','reported','overridden','closed')),
  actor_id   uuid references public.profiles(id),
  notes      text,
  created_at timestamptz not null default now()
);

-- ── incidents: fast closure-gate flag ──
-- Denormalized: true while any clock for the incident is unresolved. The server
-- action keeps it in sync; updateIncident reads it to block closure.
alter table public.incidents
  add column if not exists has_open_regulatory_clocks boolean not null default false;

comment on column public.incidents.regulatory_reportable is
  'DEPRECATED: superseded by public.incident_regulatory_clocks (per-jurisdiction clock model). Retained for back-compat and legacy reporting.';

-- Defensive: the live baseline stores incident_type as free text with no CHECK,
-- so 'environmental_release' is already accepted. But if a legacy CHECK constraint
-- exists (0001_init.sql), widen it to include the new value. No-op otherwise.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'incidents_incident_type_check') then
    alter table public.incidents drop constraint incidents_incident_type_check;
    alter table public.incidents add constraint incidents_incident_type_check
      check (incident_type in (
        'near_miss','first_aid','medical_treatment','lost_time_injury','fatality',
        'property_damage','environmental_spill','fire_explosion','chemical_release',
        'regulatory_breach','environmental_release'));
  end if;
end $$;

-- ── indexes ──
create index if not exists incident_reg_clocks_incident_idx
  on public.incident_regulatory_clocks(incident_id);
create index if not exists incident_reg_clocks_tenant_status_idx
  on public.incident_regulatory_clocks(tenant_id, status);
create index if not exists incident_reg_clocks_deadline_idx
  on public.incident_regulatory_clocks(deadline_at)
  where status in ('running','escalated_amber','escalated_red');
create index if not exists incident_reg_clock_events_clock_idx
  on public.incident_regulatory_clock_events(clock_id, created_at desc);

-- ── RLS ──
alter table public.regulatory_reporting_rules       enable row level security;
alter table public.incident_regulatory_clocks       enable row level security;
alter table public.incident_regulatory_clock_events enable row level security;

-- Rules are non-PII reference data: any authenticated user may read (the engine
-- needs them); writes are service-role/superadmin only (no write policy → the
-- service-role client bypasses RLS).
create policy regulatory_reporting_rules_read on public.regulatory_reporting_rules
  for select using (auth.role() = 'authenticated');

-- Clocks: same-tenant managers (+ platform superadmins) may read/write.
-- auth.uid() = profiles.id in this app.
create policy incident_reg_clocks_manager_rw on public.incident_regulatory_clocks
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.tenant_id is null or (p.tenant_id = incident_regulatory_clocks.tenant_id
             and p.role in ('safety_manager','ehs_manager','admin')))
    )
  );

-- Any same-tenant user may READ clocks so investigators/viewers see the Reporting
-- Status panel (writes still governed by the manager policy above).
create policy incident_reg_clocks_tenant_read on public.incident_regulatory_clocks
  for select using (public.in_tenant(tenant_id));

create policy incident_reg_clock_events_tenant_read on public.incident_regulatory_clock_events
  for select using (public.in_tenant(tenant_id));

create policy incident_reg_clock_events_manager_write on public.incident_regulatory_clock_events
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.tenant_id is null or (p.tenant_id = incident_regulatory_clock_events.tenant_id
             and p.role in ('safety_manager','ehs_manager','admin')))
    )
  );

-- ── seed: federal / California / EPA reporting rules (ILLUSTRATIVE — legal review required) ──
insert into public.regulatory_reporting_rules
  (jurisdiction, event_type, deadline_hours, description, source_citation)
values
  ('federal_osha','fatality',8,'Report the fatality to OSHA','29 CFR 1904.39 — fatality: within 8 hours'),
  ('federal_osha','inpatient_hospitalization',24,'Report the in-patient hospitalization to OSHA','29 CFR 1904.39 — within 24 hours'),
  ('federal_osha','amputation',24,'Report the amputation to OSHA','29 CFR 1904.39 — within 24 hours'),
  ('federal_osha','loss_of_eye',24,'Report the loss of an eye to OSHA','29 CFR 1904.39 — within 24 hours'),
  ('california_cal_osha','serious_injury_illness_or_death',8,'Report to Cal/OSHA — immediately, no later than 8 hours','8 CCR 342 / Labor Code 6409.1(b)'),
  ('epa_environmental_release','reportable_quantity_release',24,'Report the reportable-quantity release to EPA / state (verify substance-specific timing)','CERCLA 103 / EPCRA 304 — immediate NRC notification; illustrative 24h default')
on conflict (jurisdiction, event_type) do nothing;
