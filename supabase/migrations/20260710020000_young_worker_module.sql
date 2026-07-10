-- Migration: young_worker_module
-- Child Labor / Young-Worker Age & Task Gate
--
-- ADAPTED to the real SafetyIQ/MACO schema:
--   * multi-tenant by tenant_id (references public.tenants), NOT org_id
--   * a "young worker" is a public.profiles row (there is no `workers` table),
--     linked via profile_id — NOT worker_id
--   * there is no `user_roles` join table; RLS keys off public.profiles.role
--     (roles that exist: safety_manager, ehs_manager, admin) plus platform
--     superadmins (profiles.tenant_id IS NULL)
--   * there is no `task_assignments` table, so task_assignment_gate_log carries
--     no FK to one (the gate is a standalone evaluator called by future flows)
--
-- ⚠ NOT LEGAL ADVICE. The hazardous_task_rules seed below is ILLUSTRATIVE and
-- MUST be reviewed and completed by legal/compliance for every state and
-- industry before this control is relied on in production.

-- ── school_calendars ───────────────────────────────────────────────────────────
-- Created first because young_workers.school_calendar_id references it.
create table if not exists public.school_calendars (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  state        text not null,
  school_year  text not null,
  school_days  daterange[] not null default '{}',
  created_at   timestamptz not null default now()
);

-- ── young_workers ──────────────────────────────────────────────────────────────
create table if not exists public.young_workers (
  id                              uuid primary key default gen_random_uuid(),
  tenant_id                       uuid not null references public.tenants(id) on delete cascade,
  profile_id                      uuid not null references public.profiles(id) on delete cascade,
  dob                             date not null,
  dob_verified                    boolean not null default false,
  dob_verified_by                 uuid references public.profiles(id),
  dob_verified_at                 timestamptz,
  home_state                      text not null,   -- e.g. 'WI', 'CA'
  work_state                      text not null,
  school_status                   text not null check (school_status in
                                    ('enrolled','not_enrolled','graduated','ged','homeschool')),
  school_calendar_id              uuid references public.school_calendars(id),
  classification                  text not null check (classification in (
                                    'paid_intern','unpaid_intern','student_learner','youth_apprentice',
                                    'job_shadow','volunteer','temp')),
  work_permit_number              text,
  work_permit_issue_date          date,
  work_permit_expiry_date         date,
  work_permit_document_url        text,
  parent_guardian_name            text,
  parent_guardian_relationship    text,
  parent_guardian_authorized_at   timestamptz,
  parent_guardian_signature_url   text,
  ca_permit_to_employ_number      text,
  ca_permit_to_employ_issued_at   date,
  ca_permit_to_work_number        text,
  ca_permit_to_work_issued_at     date,
  active                          boolean not null default true,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  unique(profile_id)
);

-- ── hazardous_task_rules ───────────────────────────────────────────────────────
-- Platform-wide reference data (not tenant-scoped): federal + state overlays.
create table if not exists public.hazardous_task_rules (
  id                       uuid primary key default gen_random_uuid(),
  jurisdiction             text not null,   -- 'FEDERAL','WI','CA', ...
  task_code                text not null,
  task_label               text not null,
  min_age                  integer not null,
  equipment_codes          text[] not null default '{}',
  industry_codes           text[] not null default '{}',
  hazard_type              text,
  location_restriction     text,
  time_of_day_start        time,
  time_of_day_end          time,
  school_day_restricted    boolean not null default false,
  student_learner_exception boolean not null default false,
  requires_supervision     boolean not null default false,
  is_prohibited            boolean not null default true,
  source_citation          text,
  created_at               timestamptz not null default now()
);

-- ── task_assignment_gate_log ───────────────────────────────────────────────────
create table if not exists public.task_assignment_gate_log (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  task_code      text not null default '',
  equipment_code text,
  evaluated_at   timestamptz not null default now(),
  decision       text not null check (decision in ('allowed','blocked','allowed_with_alert')),
  reasons        jsonb not null default '[]',
  rule_ids_matched uuid[] not null default '{}',
  evaluated_by   uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);

-- ── young_worker_alerts ────────────────────────────────────────────────────────
create table if not exists public.young_worker_alerts (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  young_worker_id  uuid not null references public.young_workers(id) on delete cascade,
  alert_type       text not null check (alert_type in (
                     'permit_expiring','permit_expired','hours_violation',
                     'school_attendance_conflict','minor_injury_capa')),
  status           text not null default 'open' check (status in ('open','acknowledged','resolved')),
  details          jsonb not null default '{}',
  triggered_at     timestamptz not null default now(),
  resolved_at      timestamptz,
  resolved_by      uuid references public.profiles(id)
);

-- ── link an incident to a young worker (incidents.injured_party is free text) ──
alter table public.incidents
  add column if not exists young_worker_id uuid references public.young_workers(id) on delete set null;

-- ── indexes ────────────────────────────────────────────────────────────────────
create index if not exists young_workers_tenant_idx        on public.young_workers(tenant_id);
create index if not exists young_workers_permit_expiry_idx on public.young_workers(work_permit_expiry_date);
create index if not exists gate_log_profile_idx            on public.task_assignment_gate_log(profile_id, evaluated_at desc);
create index if not exists young_worker_alerts_open_idx    on public.young_worker_alerts(tenant_id, status);
create index if not exists hazardous_task_rules_lookup_idx on public.hazardous_task_rules(task_code, jurisdiction);

-- ── RLS ────────────────────────────────────────────────────────────────────────
alter table public.young_workers            enable row level security;
alter table public.school_calendars         enable row level security;
alter table public.hazardous_task_rules     enable row level security;
alter table public.task_assignment_gate_log enable row level security;
alter table public.young_worker_alerts      enable row level security;

-- Profiles (managers) of the same tenant, or platform superadmins (tenant_id IS
-- NULL), may read/write young-worker PII. auth.uid() = profiles.id in this app.
create policy young_workers_manager_rw on public.young_workers
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.tenant_id is null or (p.tenant_id = young_workers.tenant_id
             and p.role in ('safety_manager','ehs_manager','admin')))
    )
  );

create policy school_calendars_manager_rw on public.school_calendars
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.tenant_id is null or (p.tenant_id = school_calendars.tenant_id
             and p.role in ('safety_manager','ehs_manager','admin')))
    )
  );

-- Hazardous-task rules are non-PII reference data — any authenticated user may
-- read them (the gate needs them); writes are service-role only (no write policy).
create policy hazardous_task_rules_read on public.hazardous_task_rules
  for select using (auth.role() = 'authenticated');

-- Supervisors additionally may READ gate decisions (but not the underlying PII,
-- which lives on young_workers and stays manager-only above).
create policy gate_log_read on public.task_assignment_gate_log
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.tenant_id is null or (p.tenant_id = task_assignment_gate_log.tenant_id
             and p.role in ('supervisor','safety_manager','ehs_manager','admin')))
    )
  );

create policy young_worker_alerts_manager_rw on public.young_worker_alerts
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.tenant_id is null or (p.tenant_id = young_worker_alerts.tenant_id
             and p.role in ('safety_manager','ehs_manager','admin')))
    )
  );

-- ── seed: federal baseline hazardous occupations (ILLUSTRATIVE — legal review required) ──
-- student_learner_exception reflects 29 CFR 570.50: student-learner/apprentice
-- exemptions exist for some HOs (e.g. roofing HO 16, excavation HO 17) but NOT
-- others (forklift/power-driven hoisting HO 7, wrecking/demolition HO 15).
insert into public.hazardous_task_rules
  (jurisdiction, task_code, task_label, min_age, equipment_codes,
   student_learner_exception, requires_supervision, is_prohibited, source_citation)
values
  ('FEDERAL','ROOFING',    'Roofing work and work on or near a roof', 18, '{roofing_equipment}', true,  true,  true, 'FLSA HO 16 / 29 CFR 570.67'),
  ('FEDERAL','DEMOLITION', 'Wrecking, demolition, and shipbreaking',  18, '{}',                   false, false, true, 'FLSA HO 15 / 29 CFR 570.66'),
  ('FEDERAL','TRENCHING',  'Excavation / trenching operations',       18, '{trench_box,excavator}', true, true,  true, 'FLSA HO 17 / 29 CFR 570.68'),
  ('FEDERAL','FORKLIFT',   'Operating power-driven hoisting apparatus (forklift)', 18, '{forklift}', false, false, true, 'FLSA HO 7 / 29 CFR 570.58'),
  ('FEDERAL','SKID_STEER', 'Operating skid-steer / power-driven earth-moving equipment', 18, '{skid_steer}', false, false, true, 'FLSA HO 7 / 29 CFR 570.58')
on conflict do nothing;
