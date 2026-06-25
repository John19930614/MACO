-- =============================================================================
-- SafetyIQ — live database schema baseline
-- =============================================================================
-- This is a faithful snapshot of the schema applied to the production SafetyIQ
-- Supabase project, assembled from that project's migration history (the 19
-- migrations applied 2026-06-18 → 2026-06-23, in order).
--
-- Purpose: stand up a fresh database that matches production. Run this once on
-- an empty Supabase project's SQL editor (or via the CLI).
--
-- NOTE: the production project is ALREADY migrated — do NOT run this against it.
-- The old `supabase/migrations/000*.sql` files belonged to an earlier product
-- design ("Amaya/ARC") and have been moved to `supabase/_legacy_amaya_migrations/`.
-- They are NOT the schema this app uses.
-- =============================================================================


-- ============================================================
-- 20260618000344  safetyiq_core_tables
-- ============================================================

-- Tenants
create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  sector      text not null default 'general',
  country     text not null default 'US',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Profiles (EHS users)
create table public.profiles (
  id              uuid primary key default gen_random_uuid(),
  display_name    text not null,
  role            text not null default 'viewer',
  tenant_id       uuid references public.tenants(id) on delete cascade,
  default_site_id uuid,
  job_title       text,
  department      text,
  company         text not null default '',
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Sites
create table public.sites (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  name       text not null,
  address    text,
  country    text not null default 'US',
  timezone   text not null default 'America/New_York',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.tenants  enable row level security;
alter table public.profiles enable row level security;
alter table public.sites    enable row level security;


-- ============================================================
-- 20260618000403  safetyiq_ehs_tables_1
-- ============================================================

create table public.capa_records (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  site_id              uuid references public.sites(id),
  title                text not null,
  description          text not null default '',
  kind                 text not null default 'corrective',
  source_type          text not null default 'manual',
  source_id            uuid,
  root_cause           text,
  severity             text not null default 'medium',
  owner_id             uuid references public.profiles(id),
  due_date             date,
  status               text not null default 'open',
  verification_method  text,
  closed_at            timestamptz,
  closure_note         text,
  closed_with_evidence boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.incidents (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  site_id                  uuid references public.sites(id),
  title                    text not null,
  description              text not null default '',
  incident_type            text not null default 'near_miss',
  severity                 text not null default 'low',
  status                   text not null default 'reported',
  occurred_at              timestamptz not null default now(),
  location                 text not null default '',
  injured_party            text,
  injuries_description     text,
  immediate_actions        text,
  root_cause               text,
  reported_by              uuid references public.profiles(id),
  owner_id                 uuid references public.profiles(id),
  lost_time_days           integer,
  medical_treatment_required boolean not null default false,
  regulatory_reportable    boolean not null default false,
  regulatory_report_date   date,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table public.chemical_inventory (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete cascade,
  site_id                   uuid references public.sites(id),
  name                      text not null,
  cas_number                text,
  un_number                 text,
  chemical_formula          text,
  ghs_classes               text[] not null default '{}',
  quantity                  numeric not null default 0,
  unit                      text not null default 'L',
  storage_location          text not null default '',
  sds_url                   text,
  sds_expiry                date,
  hazard_statements         text[] not null default '{}',
  precautionary_statements  text[] not null default '{}',
  is_scheduled              boolean not null default false,
  schedule_ref              text,
  supplier                  text,
  date_received             date,
  status                    text not null default 'active',
  owner_id                  uuid references public.profiles(id),
  created_by                uuid references public.profiles(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  archived_at               timestamptz
);

create table public.audits (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  site_id           uuid references public.sites(id),
  title             text not null,
  type              text not null default 'internal',
  scheduled_date    date not null,
  completed_date    date,
  status            text not null default 'scheduled',
  lead_auditor_id   uuid references public.profiles(id),
  scope             text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.audit_findings (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  audit_id     uuid not null references public.audits(id) on delete cascade,
  title        text not null,
  description  text not null default '',
  category     text not null default 'documentation',
  severity     text not null default 'medium',
  status       text not null default 'open',
  owner_id     uuid references public.profiles(id),
  due_date     date,
  closed_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.capa_records       enable row level security;
alter table public.incidents           enable row level security;
alter table public.chemical_inventory  enable row level security;
alter table public.audits              enable row level security;
alter table public.audit_findings      enable row level security;


-- ============================================================
-- 20260618000422  safetyiq_ehs_tables_2
-- ============================================================

create table public.risk_assessments (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  site_id               uuid references public.sites(id),
  title                 text not null,
  description           text not null default '',
  category              text not null default 'general',
  activity              text not null default '',
  hazards               text[] not null default '{}',
  existing_controls     text[] not null default '{}',
  likelihood_score      integer not null default 3,
  consequence_score     integer not null default 3,
  risk_score            integer not null default 9,
  risk_level            text not null default 'medium',
  additional_controls   text[] not null default '{}',
  residual_likelihood   integer,
  residual_consequence  integer,
  residual_risk_score   integer,
  residual_risk_level   text,
  owner_id              uuid references public.profiles(id),
  review_date           date not null default (now() + interval '1 year'),
  status                text not null default 'active',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.waste_streams (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  site_id             uuid references public.sites(id),
  waste_name          text not null,
  waste_code          text,
  classification      text not null default 'hazardous',
  quantity            numeric not null default 0,
  unit                text not null default 'kg',
  disposal_method     text not null default 'incineration',
  disposal_contractor text,
  manifest_number     text,
  disposal_date       date,
  regulatory_limit    numeric,
  regulatory_unit     text,
  status              text not null default 'pending',
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now()
);

create table public.equipment (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete cascade,
  site_id                   uuid references public.sites(id),
  name                      text not null,
  type                      text not null default 'general',
  serial_number             text,
  location                  text not null default '',
  last_calibration_date     date,
  next_calibration_date     date,
  last_inspection_date      date,
  next_inspection_date      date,
  calibration_interval_days integer,
  status                    text not null default 'operational',
  regulatory_ref            text,
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table public.training_courses (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  title                text not null,
  description          text not null default '',
  course_type          text not null default 'compliance',
  duration_minutes     integer not null default 60,
  pass_score           integer,
  validity_period_days integer,
  required_roles       text[] not null default '{}',
  regulatory_ref       text,
  active               boolean not null default true,
  created_at           timestamptz not null default now()
);

create table public.training_records (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  site_id         uuid references public.sites(id),
  profile_id      uuid not null references public.profiles(id),
  course_id       uuid not null references public.training_courses(id),
  completed_date  date not null default current_date,
  expiry_date     date,
  score           integer,
  passed          boolean not null default true,
  delivery_method text not null default 'online',
  instructor_id   uuid references public.profiles(id),
  notes           text,
  created_at      timestamptz not null default now()
);

alter table public.risk_assessments  enable row level security;
alter table public.waste_streams      enable row level security;
alter table public.equipment          enable row level security;
alter table public.training_courses   enable row level security;
alter table public.training_records   enable row level security;


-- ============================================================
-- 20260618015754  create_legal_requirements_and_documents
-- ============================================================

create table if not exists public.legal_requirements (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null,
  site_id               uuid,
  regulation_ref        text not null default '',
  title                 text not null default '',
  description           text not null default '',
  jurisdiction          text not null default '',
  category              text not null default 'general',
  applicable_sectors    text[] not null default '{}',
  review_frequency_days integer not null default 365,
  next_review_date      date not null default current_date,
  status                text not null default 'not_assessed',
  compliance_notes      text,
  evidence_url          text,
  owner_id              uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists legal_requirements_tenant_idx on public.legal_requirements (tenant_id);

create table if not exists public.documents (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null,
  site_id                  uuid,
  title                    text not null default '',
  category                 text not null default 'sop',
  version                  text not null default '1.0',
  storage_path             text not null default '',
  effective_date           date not null default current_date,
  review_date              date not null default current_date,
  status                   text not null default 'draft',
  owner_id                 uuid,
  acknowledgment_required  boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists documents_tenant_idx on public.documents (tenant_id);


-- ============================================================
-- 20260618021122  create_workspace_tasks
-- ============================================================

create table if not exists public.workspace_tasks (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  profile_id  uuid not null,
  title       text not null default '',
  type        text not null default 'General',
  due_date    date,
  priority    text not null default 'medium',
  status      text not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists workspace_tasks_profile_idx on public.workspace_tasks (profile_id);
create index if not exists workspace_tasks_tenant_idx  on public.workspace_tasks (tenant_id);


-- ============================================================
-- 20260618022050  create_biosafety_tables
-- ============================================================

alter table incidents add column if not exists category text default null;

create table if not exists biosafety_labs (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id),
  lab_code         text not null,
  name             text not null,
  bsl_level        text not null,
  personnel_count  int  not null default 0,
  last_inspection  date,
  next_inspection  date,
  status           text not null default 'compliant',
  open_findings    int  not null default 0,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists biohazard_agents (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id),
  agent_code       text not null,
  agent_name       text not null,
  risk_class       text not null,
  storage_location text not null,
  quantity         text not null,
  status           text not null default 'registered',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);


-- ============================================================
-- 20260618023350  workspace_tasks_completion_evidence
-- ============================================================

alter table workspace_tasks
  add column if not exists assigned_by      uuid references profiles(id),
  add column if not exists completed_by     uuid references profiles(id),
  add column if not exists completed_at     timestamptz,
  add column if not exists completion_notes text;


-- ============================================================
-- 20260619173540  add_crew_and_contractors
-- ============================================================

alter table public.sites
  add column if not exists status            text not null default 'active',
  add column if not exists phase             text,
  add column if not exists safety_lead       text,
  add column if not exists superintendent    text,
  add column if not exists target_completion date,
  add column if not exists safety_score      integer,
  add column if not exists readiness_pct     integer;

create table if not exists public.crew (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  site_id              uuid references public.sites(id) on delete set null,
  name                 text not null,
  trade                text not null default '',
  company              text not null default '',
  osha_card            text not null default 'none',
  certifications       text[] not null default '{}',
  competent_person     boolean not null default false,
  onsite               boolean not null default false,
  hours_today          numeric(4,1),
  authorization_status text not null default 'authorized',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table public.crew enable row level security;
create policy "tenant_isolation" on public.crew
  using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));

create table if not exists public.contractors (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  site_id        uuid references public.sites(id) on delete set null,
  company        text not null,
  trade          text not null default '',
  contact_name   text,
  contact_email  text,
  status         text not null default 'pending',
  risk_score     integer not null default 50,
  worker_count   integer not null default 0,
  onsite         boolean not null default false,
  cert_status    text not null default 'current',
  incident_count integer not null default 0,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.contractors enable row level security;
create policy "tenant_isolation" on public.contractors
  using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));

create table if not exists public.contractor_prequal (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  item          text not null,
  done          boolean not null default false,
  completed_at  timestamptz,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);
alter table public.contractor_prequal enable row level security;
create policy "tenant_isolation" on public.contractor_prequal
  using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));


-- ============================================================
-- 20260619173548  add_permits_and_jsa
-- ============================================================

create table if not exists public.permits (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  site_id          uuid references public.sites(id) on delete set null,
  type             text not null,
  status           text not null default 'pending_approval',
  location         text not null default '',
  issued_to        text not null default '',
  issued_by        text not null default '',
  competent_person text not null default '',
  conditions       text[] not null default '{}',
  issued_at        timestamptz,
  expires_at       timestamptz,
  revoked_at       timestamptz,
  revoked_by       text,
  revoke_reason    text,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.permits enable row level security;
create policy "tenant_isolation" on public.permits
  using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));

create table if not exists public.jsa_templates (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  title            text not null,
  task_description text not null default '',
  category         text not null default 'general',
  ppe_required     text[] not null default '{}',
  regulatory_ref   text,
  status           text not null default 'draft',
  created_by       uuid references public.profiles(id),
  approved_by      uuid references public.profiles(id),
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.jsa_templates enable row level security;
create policy "tenant_isolation" on public.jsa_templates
  using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));

create table if not exists public.jsa_steps (
  id          uuid primary key default gen_random_uuid(),
  jsa_id      uuid not null references public.jsa_templates(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  step_number integer not null,
  task_step   text not null,
  hazard      text not null,
  control     text not null,
  risk_level  text not null default 'medium',
  created_at  timestamptz not null default now()
);
alter table public.jsa_steps enable row level security;
create policy "tenant_isolation" on public.jsa_steps
  using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));


-- ============================================================
-- 20260619173559  add_observations_toolbox_dap
-- ============================================================

create table if not exists public.observations (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  site_id         uuid references public.sites(id) on delete set null,
  type            text not null default 'negative',
  category        text not null default 'general',
  description     text not null default '',
  location        text not null default '',
  severity        text not null default 'low',
  risk_level      text not null default 'low',
  status          text not null default 'open',
  reported_by     uuid references public.profiles(id),
  assigned_to     uuid references public.profiles(id),
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.observations enable row level security;
create policy "tenant_isolation" on public.observations
  using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));

create table if not exists public.toolbox_meetings (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  site_id           uuid references public.sites(id) on delete set null,
  topic_title       text not null,
  topic_description text not null default '',
  presenter         text not null default '',
  date              date not null default current_date,
  attendance_total  integer not null default 0,
  signed_count      integer not null default 0,
  missed_workers    text[] not null default '{}',
  attachments       text[] not null default '{}',
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now()
);
alter table public.toolbox_meetings enable row level security;
create policy "tenant_isolation" on public.toolbox_meetings
  using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));

create table if not exists public.daily_activity_plans (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  site_id            uuid references public.sites(id) on delete set null,
  plan_date          date not null default current_date,
  superintendent_id  uuid references public.profiles(id),
  weather_conditions text,
  status             text not null default 'draft',
  approved_by        uuid references public.profiles(id),
  signed_at          timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.daily_activity_plans enable row level security;
create policy "tenant_isolation" on public.daily_activity_plans
  using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));

create table if not exists public.dap_tasks (
  id              uuid primary key default gen_random_uuid(),
  dap_id          uuid not null references public.daily_activity_plans(id) on delete cascade,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  task_name       text not null,
  location        text not null default '',
  crew_size       integer not null default 1,
  risk_level      text not null default 'low',
  jsa_id          uuid references public.jsa_templates(id),
  permit_required boolean not null default false,
  permit_type     text,
  controls        text[] not null default '{}',
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);
alter table public.dap_tasks enable row level security;
create policy "tenant_isolation" on public.dap_tasks
  using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));


-- ============================================================
-- 20260622163435  add_onboarding_to_tenants
-- ============================================================

alter table tenants
  add column if not exists impl_status TEXT not null default 'not_started',
  add column if not exists onboarding_data JSONB default '{}',
  add column if not exists onboarding_completed_at TIMESTAMPTZ;

create policy tenants_select_own
  on tenants for select
  using (id = (select tenant_id from profiles where id = auth.uid()));

create policy tenants_update_own_onboarding
  on tenants for update
  using (id = (select tenant_id from profiles where id = auth.uid()))
  with check (id = (select tenant_id from profiles where id = auth.uid()));


-- ============================================================
-- 20260622165843 / 170016  profiles RLS (own + same-tenant)
-- ============================================================

create policy profiles_select_own
  on profiles for select to authenticated
  using (id = auth.uid());

create policy profiles_update_own
  on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());


-- ============================================================
-- 20260622181526  create_client_documents_bucket
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-documents', 'client-documents', false, 52428800,
  array[
    'application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png','image/jpeg'
  ]
)
on conflict (id) do nothing;

create policy "client_docs_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'client-documents'
    and (storage.foldername(name))[1] = (select tenant_id::text from public.profiles where id = auth.uid()));

create policy "client_docs_read_own" on storage.objects for select to authenticated
  using (bucket_id = 'client-documents'
    and (storage.foldername(name))[1] = (select tenant_id::text from public.profiles where id = auth.uid()));

create policy "client_docs_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'client-documents'
    and (storage.foldername(name))[1] = (select tenant_id::text from public.profiles where id = auth.uid()));

create policy "client_docs_admin_read" on storage.objects for select to authenticated
  using (bucket_id = 'client-documents'
    and (select tenant_id is null from public.profiles where id = auth.uid()));


-- ============================================================
-- 20260622183417  tenant-scoped RLS + remaining tables
-- ============================================================

-- Helpers: resolve the caller's tenant, and whether they are a Reliance admin.
create or replace function public.auth_tenant_id()
returns uuid language sql stable security definer set search_path = public
as $$ select tenant_id from profiles where id = auth.uid() limit 1; $$;

create or replace function public.is_reliance_admin()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select exists (select 1 from profiles where id = auth.uid() and tenant_id is null); $$;

-- Authenticated tenant-scoped policies (admin bypass = is_reliance_admin()).
create policy "tenant_crud" on public.audit_findings for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());
create policy "tenant_crud" on public.audits for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());
create policy "tenant_crud" on public.capa_records for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());
create policy "tenant_crud" on public.chemical_inventory for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());
create policy "tenant_crud" on public.equipment for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());
create policy "tenant_crud" on public.incidents for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());
create policy "tenant_crud" on public.risk_assessments for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());
create policy "tenant_read" on public.training_courses for select to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin());
create policy "tenant_write" on public.training_courses for insert to authenticated
  with check (tenant_id = auth_tenant_id());
create policy "tenant_crud" on public.training_records for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());
create policy "tenant_crud" on public.waste_streams for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());

create policy "tenant_read" on public.profiles for select to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin() or id = auth.uid());
create policy "tenant_read" on public.sites for select to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin());
create policy "tenant_read" on public.tenants for select to authenticated
  using ((id = auth_tenant_id()) or is_reliance_admin());

alter table public.biosafety_labs enable row level security;
create policy "tenant_crud" on public.biosafety_labs for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());
alter table public.biohazard_agents enable row level security;
create policy "tenant_crud" on public.biohazard_agents for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());
alter table public.documents enable row level security;
create policy "tenant_crud" on public.documents for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());
alter table public.legal_requirements enable row level security;
create policy "tenant_crud" on public.legal_requirements for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());
alter table public.workspace_tasks enable row level security;
create policy "tenant_crud" on public.workspace_tasks for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());

create table if not exists public.osha_cases (
  id                     uuid        primary key default gen_random_uuid(),
  tenant_id              uuid        not null references public.tenants(id),
  case_no                text        not null,
  employee               text        not null,
  job_title              text        not null default '',
  date                   date        not null,
  location               text        not null default '',
  description            text        not null default '',
  classification         text        not null,
  injury_type            text        not null default '',
  days_away              integer     not null default 0,
  days_restricted        integer     not null default 0,
  is_privacy             boolean     not null default false,
  is_severe_injury       boolean     not null default false,
  how_occurred           text        not null default '',
  equipment              text        not null default '',
  physician              text        not null default '',
  med_facility           text        not null default '',
  treatment_er           boolean     not null default false,
  treatment_hospitalized boolean     not null default false,
  capa_id                uuid        references public.capa_records(id),
  created_at             timestamptz not null default now()
);
alter table public.osha_cases enable row level security;
create policy "tenant_crud" on public.osha_cases for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());

create table if not exists public.ergonomics_workstations (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        uuid        not null references public.tenants(id),
  workstation_code text        not null,
  name             text        not null,
  department       text        not null default '',
  worker_count     integer     not null default 0,
  last_assessment  date,
  next_assessment  date,
  risk_level       text        not null default 'low',
  status           text        not null default 'active',
  open_findings    integer     not null default 0,
  primary_hazards  text[]      not null default '{}',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.ergonomics_workstations enable row level security;
create policy "tenant_crud" on public.ergonomics_workstations for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());

create table if not exists public.ergonomics_job_tasks (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null references public.tenants(id),
  task_code   text        not null,
  task_title  text        not null,
  department  text        not null default '',
  hazard_type text        not null default 'repetitive_motion',
  risk_score  integer     not null default 0,
  controls    text[]      not null default '{}',
  status      text        not null default 'active',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.ergonomics_job_tasks enable row level security;
create policy "tenant_crud" on public.ergonomics_job_tasks for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());

create table if not exists public.compliance_scores (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.tenants(id),
  site_id       uuid        references public.sites(id),
  module        text        not null,
  score         numeric     not null default 0,
  max_score     numeric     not null default 100,
  percentage    numeric     not null default 0,
  status        text        not null default 'compliant',
  calculated_at timestamptz not null default now(),
  details       jsonb       not null default '{}'
);
alter table public.compliance_scores enable row level security;
create policy "tenant_crud" on public.compliance_scores for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());

create table if not exists public.ehs_ai_findings (
  id                    uuid        primary key default gen_random_uuid(),
  tenant_id             uuid        not null references public.tenants(id),
  site_id               uuid        references public.sites(id),
  cell_id               text,
  job                   text        not null,
  source_type           text,
  source_id             text,
  model                 text        not null default '',
  prompt_version        text        not null default '',
  input_summary         text        not null default '',
  output                jsonb       not null default '{}',
  confidence            numeric     not null default 0,
  review_status         text        not null default 'pending',
  human_review_required boolean     not null default false,
  created_at            timestamptz not null default now()
);
alter table public.ehs_ai_findings enable row level security;
create policy "tenant_crud" on public.ehs_ai_findings for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());

-- AI call telemetry: durable per-call latency/token/cost record so in-app
-- observability survives serverless cold starts (was an in-memory ring buffer
-- that reset on every cold start). Operational data, not tenant business data.
create table if not exists public.ai_telemetry (
  id            uuid        primary key default gen_random_uuid(),
  at            timestamptz not null default now(),
  provider      text        not null default '',
  model         text        not null default '',
  ms            integer     not null default 0,
  input_tokens  integer     not null default 0,
  output_tokens integer     not null default 0,
  ok            boolean     not null default true,
  tenant_id     uuid        references public.tenants(id) on delete set null
);
alter table public.ai_telemetry enable row level security;
-- Reads: platform operators only. Writes: any authenticated session may append
-- its own AI-call log row.
create policy "ai_telemetry_admin_read" on public.ai_telemetry
  for select to authenticated using (is_reliance_admin());
create policy "ai_telemetry_insert" on public.ai_telemetry
  for insert to authenticated with check (true);
create index if not exists ai_telemetry_at_idx on public.ai_telemetry (at desc);

create table if not exists public.document_acknowledgments (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null references public.tenants(id),
  document_id     uuid        not null references public.documents(id),
  profile_id      uuid        not null references public.profiles(id),
  acknowledged_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
alter table public.document_acknowledgments enable row level security;
create policy "tenant_crud" on public.document_acknowledgments for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());

create table if not exists public.predictability_runs (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        uuid        not null references public.tenants(id),
  site_id          uuid        references public.sites(id),
  stage            text        not null default 'scan',
  summary          text        not null default '',
  items_scanned    integer     not null default 0,
  signals_found    integer     not null default 0,
  actions_proposed integer     not null default 0,
  forecast_data    jsonb,
  created_at       timestamptz not null default now()
);
alter table public.predictability_runs enable row level security;
create policy "tenant_crud" on public.predictability_runs for all to authenticated
  using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) with check (tenant_id = auth_tenant_id());


-- ============================================================
-- 20260623130626  harden_tenant_isolation_reliance_admin
-- ============================================================
-- In production this migration introduced is_reliance_admin() and rewrote the
-- tenant policies to use it. In this consolidated baseline that hardening is
-- already folded into the policy and function definitions above, so there is
-- nothing more to do here.
