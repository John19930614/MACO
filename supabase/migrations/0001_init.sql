-- 0001_init.sql
-- SafetyIQ · ARC (Adaptive Risk Continuum) foundational schema.
--
-- This is the Postgres cutover target for the Safety-Cell / EXP / P-CLSS layer
-- that currently runs on in-memory fixtures (mock mode). It is the database's
-- source of truth for the enum CHECK constraints the app mirrors in
-- src/lib/constants.ts (SEVERITIES, CELL_STATUSES, PROOF_STATUSES, EDGE_TYPES,
-- REVIEW_STATUSES, ROLES, ACTION_STATUSES) and src/lib/arc/arc.ts
-- (HSL_DIMENSIONS). The schema-consistency test proves the two never drift:
-- if a constant changes, this file must change with it.
--
-- Column shapes track the interfaces in src/lib/types.ts (SafetyCell,
-- ControlProof, CausalEdge, AiFinding, SafetyAction, ExpCapture, PclssRun,
-- VelaInsight, AuditEntry).

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ── Identity ──────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id           uuid primary key,
  display_name text not null,
  role         text not null default 'viewer'
                 check (role in ('viewer','field_officer','contributor','ehs_coordinator','supervisor','safety_manager','ehs_manager','admin')),
  job_title    text,
  created_at   timestamptz not null default now()
);

-- ── Sites & locations ─────────────────────────────────────────────────────────
create table if not exists sites (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists locations (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references sites(id) on delete cascade,
  label       text not null,
  description text,
  floor       text,
  zone        text,
  kind        text,
  lat         double precision,
  lng         double precision
);

-- ── Safety Cells (the ARC data atom) ────────────────────────────────────────────
create table if not exists safety_cells (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id) on delete cascade,
  location_id   uuid references locations(id) on delete set null,
  title         text not null,
  description   text not null default '',
  task          text not null default '',
  crew          text,
  company       text,
  permit_ref    text,
  hazard_genome jsonb not null default '{}'::jsonb,
  severity      text not null
                  check (severity in ('low','medium','high','critical')),
  likelihood    int  not null default 1 check (likelihood between 1 and 5),
  risk_score    int  not null default 0,
  status        text not null default 'open'
                  check (status in ('open','investigating','controlled','closed')),
  cell_type     text check (cell_type in ('precursor','control','failure','behavior','event','learning')),
  owner_id      uuid references profiles(id) on delete set null,
  created_by    uuid not null references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Control Proofs ──────────────────────────────────────────────────────────────
create table if not exists control_proofs (
  id               uuid primary key default gen_random_uuid(),
  cell_id          uuid not null references safety_cells(id) on delete cascade,
  control          text not null,
  status           text not null default 'not_checked'
                     check (status in ('not_checked','weak_proof','proven','missing','expired','conflicting','not_applicable')),
  verifier_id      uuid references profiles(id) on delete set null,
  verified_at      timestamptz,
  evidence_summary text,
  evidence_id      uuid,
  expires_at       timestamptz,
  required         boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ── Causal Edges ────────────────────────────────────────────────────────────────
create table if not exists causal_edges (
  id             uuid primary key default gen_random_uuid(),
  source_cell_id uuid not null references safety_cells(id) on delete cascade,
  target_cell_id uuid not null references safety_cells(id) on delete cascade,
  type           text not null
                   check (type in ('contributes_to','contributed_to','triggers','amplifies','inhibits','precedes','same_location','same_control_gap')),
  confidence     real not null default 0,
  rationale      text not null default '',
  review_status  text not null default 'pending'
                   check (review_status in ('pending','accepted','edited','rejected','archived')),
  ai_generated   boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ── AI Findings ─────────────────────────────────────────────────────────────────
create table if not exists ai_findings (
  id                    uuid primary key default gen_random_uuid(),
  site_id               uuid references sites(id) on delete cascade,
  cell_id               uuid references safety_cells(id) on delete cascade,
  job                   text not null,
  source_type           text,
  source_id             text,
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

-- ── Safety Actions ──────────────────────────────────────────────────────────────
create table if not exists actions (
  id                uuid primary key default gen_random_uuid(),
  cell_id           uuid references safety_cells(id) on delete cascade,
  title             text not null,
  kind              text not null check (kind in ('corrective','preventive')),
  owner_id          uuid references profiles(id) on delete set null,
  due_date          date,
  status            text not null default 'open'
                      check (status in ('open','in_progress','overdue','closed')),
  closed_with_proof boolean not null default false,
  closure_note      text,
  created_at        timestamptz not null default now()
);

-- ── Human Signal Layer readings ──────────────────────────────────────────────────
create table if not exists hsl_signals (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references sites(id) on delete cascade,
  dimension   text not null
                check (dimension in ('psych_safety_gap','cultural_drift_index','cognitive_load_monitor','invisible_workforce','knowledge_ghost','crew_trauma_score')),
  value       real not null default 0,
  recorded_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- ── EXP captures ────────────────────────────────────────────────────────────────
create table if not exists exp_captures (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id) on delete cascade,
  source        text not null check (source in ('interview','ai_interview','walk_floor','incident_debrief','manual')),
  subject       text not null,
  summary       text not null default '',
  hazard_memory jsonb,
  embedded      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ── P-CLSS engine runs ────────────────────────────────────────────────────────────
create table if not exists pclss_runs (
  id               uuid primary key default gen_random_uuid(),
  site_id          uuid not null references sites(id) on delete cascade,
  stage            text not null check (stage in ('anticipate','hunt','forecast','preempt','evolve')),
  summary          text not null default '',
  cells_scanned    int not null default 0,
  signals_found    int not null default 0,
  actions_proposed int not null default 0,
  created_at       timestamptz not null default now()
);

-- ── VELA — cross-tenant insight (intentionally NOT tenant-scoped) ──────────────────
create table if not exists vela_insights (
  id              uuid primary key default gen_random_uuid(),
  pattern         text not null,
  origin_sector   text not null,
  applies_to      text[] not null default '{}',
  confidence      real not null default 0,
  summary         text not null default '',
  regulatory_refs text[] not null default '{}',
  created_at      timestamptz not null default now()
);

-- ── Audit log ─────────────────────────────────────────────────────────────────────
create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid not null,
  action     text not null,
  entity     text not null,
  entity_id  text not null,
  reason     text,
  detail     jsonb,
  created_at timestamptz not null default now()
);

-- ── Multi-tenancy ─────────────────────────────────────────────────────────────────
-- Tenants were introduced after the initial single-tenant build, so tenant_id is
-- back-filled onto every tenant-scoped table via idempotent ADD COLUMN IF NOT
-- EXISTS. VELA insights stay global (no tenant_id) — they are shared across
-- tenants by design.
create table if not exists tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sector     text,
  created_at timestamptz not null default now()
);

alter table profiles       add column if not exists tenant_id uuid references tenants(id);
alter table sites          add column if not exists tenant_id uuid references tenants(id);
alter table safety_cells   add column if not exists tenant_id uuid references tenants(id);
alter table control_proofs add column if not exists tenant_id uuid references tenants(id);
alter table causal_edges   add column if not exists tenant_id uuid references tenants(id);
alter table ai_findings    add column if not exists tenant_id uuid references tenants(id);
alter table actions        add column if not exists tenant_id uuid references tenants(id);
alter table hsl_signals    add column if not exists tenant_id uuid references tenants(id);
alter table exp_captures   add column if not exists tenant_id uuid references tenants(id);
alter table pclss_runs     add column if not exists tenant_id uuid references tenants(id);
alter table audit_log      add column if not exists tenant_id uuid references tenants(id);
