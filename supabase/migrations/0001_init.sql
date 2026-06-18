-- ════════════════════════════════════════════════════════════════════════
-- SafetyIQ — MACO EHS core data model.
-- Multi-tenant EHS platform: chemical inventory, legal compliance, audits,
-- CAPA, training, documents, waste, equipment, risk register, incidents.
-- All tenant-scoped tables carry tenant_id; RLS isolation in 0002_rls.sql.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";   -- gen_random_uuid()
-- create extension if not exists vector;     -- enable for pgvector similarity (Phase 2)

-- ── updated_at helper ──────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- Core: tenancy, profiles, sites
-- ════════════════════════════════════════════════════════════════════════

create table if not exists tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  sector     text not null default 'general',
  country    text not null default 'AU',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Profiles linked to Supabase auth.users.
-- tenant_id IS NULL = Reliance global operator (sees all client tenants).
create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text not null default 'New user',
  role            text not null default 'viewer'
                    check (role in ('viewer','field_officer','ehs_coordinator','ehs_manager','admin')),
  tenant_id       uuid references tenants(id),
  default_site_id uuid,
  job_title       text,
  department      text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists sites (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  name       text not null,
  address    text,
  country    text not null default 'AU',
  state      text,
  sector     text not null default 'general',
  headcount  int,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
-- Chemical Inventory
-- ════════════════════════════════════════════════════════════════════════

create table if not exists chemicals (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references tenants(id) on delete cascade,
  site_id                  uuid not null references sites(id) on delete cascade,
  name                     text not null,
  cas_number               text,                             -- CAS Registry Number
  un_number                text,                             -- UN transport number
  chemical_formula         text,
  ghs_classes              text[] not null default '{}',     -- H-statement class codes
  quantity                 numeric not null default 0,
  unit                     text not null default 'kg',
  storage_location         text not null default '',
  sds_url                  text,                             -- Safety Data Sheet URL
  sds_expiry               date,
  hazard_statements        text[] not null default '{}',     -- H200-H420
  precautionary_statements text[] not null default '{}',     -- P200-P501
  is_scheduled             boolean not null default false,
  schedule_ref             text,
  supplier                 text,
  date_received            date,
  status                   text not null default 'active'
                             check (status in ('active','disposed','depleted')),
  owner_id                 uuid references profiles(id),
  created_by               uuid not null references profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create trigger trg_chemicals_updated before update on chemicals
  for each row execute function set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- Legal & Regulatory Compliance
-- ════════════════════════════════════════════════════════════════════════

create table if not exists legal_requirements (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  site_id               uuid references sites(id) on delete cascade, -- null = all sites
  regulation_ref        text not null,                      -- e.g. "OSHA 1910.119"
  title                 text not null,
  description           text not null default '',
  jurisdiction          text not null default '',
  category              text not null default 'general'
                          check (category in ('chemical','training','emergency','waste','air','water','noise','electrical','fire','general')),
  applicable_sectors    text[] not null default '{}',
  review_frequency_days int not null default 365,
  next_review_date      date not null,
  status                text not null default 'not_assessed'
                          check (status in ('compliant','minor_gap','major_gap','non_compliant','not_assessed','not_applicable')),
  compliance_notes      text,
  evidence_url          text,
  owner_id              uuid references profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger trg_legal_updated before update on legal_requirements
  for each row execute function set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- Audits & Findings
-- ════════════════════════════════════════════════════════════════════════

create table if not exists audits (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  site_id          uuid not null references sites(id) on delete cascade,
  title            text not null,
  type             text not null default 'internal'
                     check (type in ('internal','external','regulatory','supplier','system','process')),
  scheduled_date   date not null,
  completed_date   date,
  status           text not null default 'scheduled'
                     check (status in ('scheduled','in_progress','completed','cancelled')),
  lead_auditor_id  uuid references profiles(id),
  scope            text not null default '',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger trg_audits_updated before update on audits
  for each row execute function set_updated_at();

create table if not exists audit_findings (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  audit_id     uuid not null references audits(id) on delete cascade,
  site_id      uuid not null references sites(id) on delete cascade,
  title        text not null,
  description  text not null default '',
  category     text not null default 'general'
                 check (category in ('procedure','training','equipment','chemical','waste','documentation','emergency','general')),
  severity     text not null default 'medium'
                 check (severity in ('low','medium','high','critical')),
  status       text not null default 'open'
                 check (status in ('open','in_progress','closed','accepted_risk')),
  owner_id     uuid references profiles(id),
  due_date     date,
  capa_required boolean not null default true,
  capa_id      uuid,                              -- FK set after CAPA is created
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_findings_updated before update on audit_findings
  for each row execute function set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- CAPA — Corrective & Preventive Actions
-- ════════════════════════════════════════════════════════════════════════

create table if not exists capa_actions (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  site_id              uuid not null references sites(id) on delete cascade,
  title                text not null,
  description          text not null default '',
  kind                 text not null default 'corrective'
                         check (kind in ('corrective','preventive')),
  source_type          text not null default 'manual'
                         check (source_type in ('audit_finding','incident','legal_requirement','risk_assessment','ai_finding','manual')),
  source_id            uuid,                              -- FK to originating record
  root_cause           text,
  severity             text not null default 'medium'
                         check (severity in ('low','medium','high','critical')),
  owner_id             uuid references profiles(id),
  due_date             date,
  status               text not null default 'open'
                         check (status in ('open','in_progress','overdue','pending_verification','closed','rejected')),
  verification_method  text,
  closed_at            timestamptz,
  closure_note         text,
  closed_with_evidence boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger trg_capa_updated before update on capa_actions
  for each row execute function set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- Training
-- ════════════════════════════════════════════════════════════════════════

create table if not exists training_courses (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  title                text not null,
  description          text not null default '',
  course_type          text not null default 'general'
                         check (course_type in ('induction','chemical','emergency','equipment','compliance','manual_handling','fire','environmental','general')),
  duration_minutes     int not null default 60,
  pass_score           int,                              -- % required; null = no assessment
  validity_period_days int,                              -- null = no expiry
  required_roles       text[] not null default '{}',
  regulatory_ref       text,
  active               boolean not null default true,
  created_at           timestamptz not null default now()
);

create table if not exists training_records (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  site_id         uuid not null references sites(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  course_id       uuid not null references training_courses(id) on delete cascade,
  completed_date  date not null,
  expiry_date     date,
  score           int,
  passed          boolean not null default true,
  delivery_method text not null default 'classroom'
                    check (delivery_method in ('classroom','online','on_the_job','toolbox_talk','simulation','external')),
  instructor_id   uuid references profiles(id),
  notes           text,
  created_at      timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
-- Documents
-- ════════════════════════════════════════════════════════════════════════

create table if not exists documents (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references tenants(id) on delete cascade,
  site_id                 uuid references sites(id) on delete cascade,   -- null = all sites
  title                   text not null,
  category                text not null default 'procedure'
                            check (category in ('sop','policy','procedure','form','permit','msds','emergency','other')),
  version                 text not null default '1.0',
  storage_path            text not null,                                 -- Supabase Storage path
  effective_date          date not null,
  review_date             date not null,
  status                  text not null default 'draft'
                            check (status in ('draft','active','under_review','superseded','obsolete')),
  owner_id                uuid references profiles(id),
  acknowledgment_required boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger trg_documents_updated before update on documents
  for each row execute function set_updated_at();

create table if not exists document_acknowledgments (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  document_id      uuid not null references documents(id) on delete cascade,
  profile_id       uuid not null references profiles(id) on delete cascade,
  acknowledged_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  unique (document_id, profile_id)
);

-- ════════════════════════════════════════════════════════════════════════
-- Waste Management
-- ════════════════════════════════════════════════════════════════════════

create table if not exists waste_streams (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  waste_name          text not null,
  waste_code          text,                              -- e.g. "D001" EPA code
  classification      text not null default 'general'
                        check (classification in ('hazardous','non_hazardous','radioactive','clinical','scheduled','recyclable','general')),
  quantity            numeric not null default 0,
  unit                text not null default 'kg',
  disposal_method     text not null default 'landfill',
  disposal_contractor text,
  manifest_number     text,
  disposal_date       date,
  regulatory_limit    numeric,
  regulatory_unit     text,
  status              text not null default 'pending'
                        check (status in ('pending','manifested','disposed','reported')),
  created_by          uuid not null references profiles(id),
  created_at          timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
-- Equipment & Calibration
-- ════════════════════════════════════════════════════════════════════════

create table if not exists equipment (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references tenants(id) on delete cascade,
  site_id                  uuid not null references sites(id) on delete cascade,
  name                     text not null,
  type                     text not null default 'general',
  serial_number            text,
  location                 text not null default '',
  last_calibration_date    date,
  next_calibration_date    date,
  last_inspection_date     date,
  next_inspection_date     date,
  calibration_interval_days int,
  status                   text not null default 'operational'
                             check (status in ('operational','calibration_due','inspection_due','out_of_service','decommissioned')),
  regulatory_ref           text,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create trigger trg_equipment_updated before update on equipment
  for each row execute function set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- Risk Register
-- ════════════════════════════════════════════════════════════════════════

create table if not exists risk_assessments (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references tenants(id) on delete cascade,
  site_id                 uuid not null references sites(id) on delete cascade,
  title                   text not null,
  description             text not null default '',
  category                text not null default 'general'
                            check (category in ('chemical','physical','biological','ergonomic','fire','electrical','environmental','psychosocial','general')),
  activity                text not null default '',
  hazards                 text[] not null default '{}',
  existing_controls       text[] not null default '{}',
  likelihood_score        int not null default 3 check (likelihood_score between 1 and 5),
  consequence_score       int not null default 3 check (consequence_score between 1 and 5),
  risk_score              int not null default 9,           -- likelihood × consequence
  risk_level              text not null default 'medium'
                            check (risk_level in ('negligible','low','medium','high','extreme')),
  additional_controls     text[] not null default '{}',
  residual_likelihood     int check (residual_likelihood between 1 and 5),
  residual_consequence    int check (residual_consequence between 1 and 5),
  residual_risk_score     int,
  residual_risk_level     text
                            check (residual_risk_level in ('negligible','low','medium','high','extreme')),
  owner_id                uuid references profiles(id),
  review_date             date not null,
  status                  text not null default 'draft'
                            check (status in ('draft','active','under_review','archived')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger trg_risk_updated before update on risk_assessments
  for each row execute function set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- Incidents
-- ════════════════════════════════════════════════════════════════════════

create table if not exists incidents (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references tenants(id) on delete cascade,
  site_id                   uuid not null references sites(id) on delete cascade,
  title                     text not null,
  description               text not null default '',
  incident_type             text not null default 'near_miss'
                              check (incident_type in ('near_miss','first_aid','medical_treatment','lost_time_injury','fatality','property_damage','environmental_spill','fire_explosion','chemical_release','regulatory_breach')),
  severity                  text not null default 'medium'
                              check (severity in ('low','medium','high','critical')),
  occurred_at               timestamptz not null,
  location                  text not null default '',
  injured_party             text,
  injuries_description      text,
  immediate_actions         text,
  root_cause                text,
  reported_by               uuid not null references profiles(id),
  owner_id                  uuid references profiles(id),
  status                    text not null default 'reported'
                              check (status in ('reported','under_investigation','capa_open','closed')),
  lost_time_days            int,
  medical_treatment_required boolean not null default false,
  regulatory_reportable     boolean not null default false,
  regulatory_report_date    date,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create trigger trg_incidents_updated before update on incidents
  for each row execute function set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- Compliance Scores (calculated by the P-Engine)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists compliance_scores (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  site_id        uuid not null references sites(id) on delete cascade,
  module         text not null
                   check (module in ('chemical','legal','audits','capa','training','documents','waste','equipment','risk','incidents')),
  score          numeric not null default 0,
  max_score      numeric not null default 100,
  percentage     numeric not null default 0 check (percentage between 0 and 100),
  status         text not null default 'not_assessed'
                   check (status in ('compliant','minor_gap','major_gap','non_compliant','not_assessed','not_applicable')),
  calculated_at  timestamptz not null default now(),
  details        jsonb not null default '{}'::jsonb,
  unique (tenant_id, site_id, module)
);

-- ════════════════════════════════════════════════════════════════════════
-- AI Findings (stored separately — reviewed before actioning)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists ai_findings (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  site_id               uuid references sites(id) on delete cascade,
  job                   text not null
                          check (job in ('chemical_hazard_analysis','compliance_gap_detection','training_gap_analysis','incident_root_cause','risk_score_prediction','regulatory_change_impact')),
  source_type           text not null default '',
  source_id             uuid,
  model                 text not null,
  prompt_version        text not null,
  input_summary         text not null default '',
  output                jsonb not null default '{}'::jsonb,
  confidence            real not null default 0,
  review_status         text not null default 'pending'
                          check (review_status in ('pending','accepted','edited','rejected','archived')),
  human_review_required boolean not null default false,
  created_at            timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
-- Predictability Engine run log (equivalent of P-CLSS pclss_runs)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists predictability_runs (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  site_id          uuid not null references sites(id) on delete cascade,
  stage            text not null
                     check (stage in ('scan','detect','forecast','alert','learn')),
  summary          text not null default '',
  items_scanned    int not null default 0,
  signals_found    int not null default 0,
  actions_proposed int not null default 0,
  forecast_data    jsonb,
  created_at       timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
-- Audit log (immutable trail of sensitive changes)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references tenants(id),
  actor_id   uuid references profiles(id),
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  reason     text,
  detail     jsonb,
  created_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
-- Reliance cross-tenant intelligence (NO tenant_id — global patterns)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists reliance_insights (
  id                    uuid primary key default gen_random_uuid(),
  pattern               text not null,
  origin_sector         text not null,
  applies_to_sectors    text[] not null default '{}',
  confidence            real not null default 0,
  summary               text not null default '',
  regulatory_refs       text[] not null default '{}',
  created_at            timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
-- Indexes
-- ════════════════════════════════════════════════════════════════════════

-- Tenant scoping
create index if not exists idx_profiles_tenant       on profiles(tenant_id);
create index if not exists idx_sites_tenant           on sites(tenant_id);
create index if not exists idx_chemicals_tenant       on chemicals(tenant_id);
create index if not exists idx_chemicals_site         on chemicals(site_id);
create index if not exists idx_legal_tenant           on legal_requirements(tenant_id);
create index if not exists idx_audits_tenant          on audits(tenant_id);
create index if not exists idx_findings_tenant        on audit_findings(tenant_id);
create index if not exists idx_capa_tenant            on capa_actions(tenant_id);
create index if not exists idx_courses_tenant         on training_courses(tenant_id);
create index if not exists idx_records_tenant         on training_records(tenant_id);
create index if not exists idx_records_profile        on training_records(profile_id);
create index if not exists idx_docs_tenant            on documents(tenant_id);
create index if not exists idx_waste_tenant           on waste_streams(tenant_id);
create index if not exists idx_equipment_tenant       on equipment(tenant_id);
create index if not exists idx_risk_tenant            on risk_assessments(tenant_id);
create index if not exists idx_incidents_tenant       on incidents(tenant_id);
create index if not exists idx_scores_tenant_module   on compliance_scores(tenant_id, module);
create index if not exists idx_ai_findings_tenant     on ai_findings(tenant_id);
create index if not exists idx_ai_findings_source     on ai_findings(source_type, source_id);
create index if not exists idx_predict_runs_tenant    on predictability_runs(tenant_id, site_id);

-- Compliance / scheduling queries
create index if not exists idx_legal_review_date      on legal_requirements(next_review_date);
create index if not exists idx_legal_status           on legal_requirements(status);
create index if not exists idx_capa_due_date          on capa_actions(due_date);
create index if not exists idx_capa_status            on capa_actions(status);
create index if not exists idx_training_expiry        on training_records(expiry_date);
create index if not exists idx_equipment_calibration  on equipment(next_calibration_date);
create index if not exists idx_chemicals_sds_expiry   on chemicals(sds_expiry);
create index if not exists idx_incidents_type         on incidents(incident_type, occurred_at);
create index if not exists idx_audits_scheduled       on audits(scheduled_date, status);
