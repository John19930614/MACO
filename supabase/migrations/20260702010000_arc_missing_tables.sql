-- =============================================================================
-- ARC missing tables — the six tables repo.ts queries in live mode that were
-- never created by the foundational ARC migrations (0001_init / 0002_rls).
-- =============================================================================
-- The ARC layer went live in prod on 2026-06-27 (see 20260627006000), but
-- evidence_files, comments, event_cells, behavior_cells, gateway_rejects and
-- staged_records only ever existed as mock fixtures. In live mode today:
--   * cell/event submission crashes (gateway staging insert),
--   * the staging-review and exception-queue pages crash (dbRead throws),
--   * evidence/comments/events/behaviors reads silently return empty.
-- Additive only. Column shapes track src/lib/types.ts (EvidenceFile, Comment,
-- EventCell, BehaviorCell, GatewayReject, StagedRecord); enum CHECK constraints
-- mirror src/lib/constants.ts (SEVERITIES, EVENT_KINDS, BEHAVIOR_PATTERNS —
-- NOTE: unlike 0001_init these are not covered by the schema-consistency test,
-- which parses only the foundational files).
-- RLS mirrors 0002_rls: every table gated through in_tenant(tenant_id), with
-- tenant_id nullable to match the existing ARC tables (null = global operator).

-- ── Evidence files (attachments on a Safety Cell) ─────────────────────────────
create table if not exists public.evidence_files (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references public.tenants(id),
  cell_id      uuid not null references public.safety_cells(id) on delete cascade,
  kind         text not null check (kind in ('photo','video','document','note')),
  name         text not null,
  storage_path text not null,
  summary      text,
  uploaded_by  uuid not null references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists evidence_files_cell_id_idx on public.evidence_files(cell_id);

-- ── Comments (collaboration thread on a Safety Cell) ──────────────────────────
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.tenants(id),
  cell_id    uuid not null references public.safety_cells(id) on delete cascade,
  author_id  uuid not null references public.profiles(id),
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_cell_id_idx on public.comments(cell_id);

-- ── Event Cells (outcomes: incidents, near-misses, findings, claims) ──────────
create table if not exists public.event_cells (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references public.tenants(id),
  site_id     uuid not null references public.sites(id) on delete cascade,
  cell_id     uuid references public.safety_cells(id) on delete set null,
  kind        text not null check (kind in ('incident','near_miss','audit_finding','claim')),
  title       text not null,
  description text not null default '',
  severity    text not null check (severity in ('low','medium','high','critical')),
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists event_cells_site_id_idx on public.event_cells(site_id);

-- ── Behavior Cells (curated recurring patterns; live mode merges these with
--    patterns derived on the fly from the cell population) ─────────────────────
create table if not exists public.behavior_cells (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references public.tenants(id),
  site_id     uuid not null references public.sites(id) on delete cascade,
  pattern     text not null check (pattern in ('production_pressure','weak_closeout','recurring_issue')),
  title       text not null,
  description text not null default '',
  cell_ids    uuid[] not null default '{}',
  occurrences int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists behavior_cells_site_id_idx on public.behavior_cells(site_id);

-- ── Gateway exception queue (records blocked by the AI Gateway) ───────────────
create table if not exists public.gateway_rejects (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.tenants(id),
  kind       text not null check (kind in ('safety_cell','event_cell')),
  summary    text not null,
  category   text not null default 'Gateway',
  reason     text not null default '',
  status     text not null default 'blocked' check (status in ('blocked','resolved')),
  payload    jsonb not null default '{}'::jsonb,
  actor_id   uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists gateway_rejects_status_idx on public.gateway_rejects(status);

-- ── Staging queue (gateway-admitted records awaiting human review) ────────────
create table if not exists public.staged_records (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references public.tenants(id),
  kind         text not null check (kind in ('safety_cell','event_cell')),
  title        text not null,
  submitted_by uuid not null references public.profiles(id),
  submitted_at timestamptz not null default now(),
  payload      jsonb not null,
  evidence     jsonb
);

-- ── RLS: same single-helper tenant isolation as 0002_rls ──────────────────────
alter table public.evidence_files  enable row level security;
alter table public.comments        enable row level security;
alter table public.event_cells     enable row level security;
alter table public.behavior_cells  enable row level security;
alter table public.gateway_rejects enable row level security;
alter table public.staged_records  enable row level security;

drop policy if exists tenant_read_evidence   on public.evidence_files;
drop policy if exists tenant_write_evidence  on public.evidence_files;
drop policy if exists tenant_read_comments   on public.comments;
drop policy if exists tenant_write_comments  on public.comments;
drop policy if exists tenant_read_events     on public.event_cells;
drop policy if exists tenant_write_events    on public.event_cells;
drop policy if exists tenant_read_behaviors  on public.behavior_cells;
drop policy if exists tenant_write_behaviors on public.behavior_cells;
drop policy if exists tenant_read_rejects    on public.gateway_rejects;
drop policy if exists tenant_write_rejects   on public.gateway_rejects;
drop policy if exists tenant_read_staged     on public.staged_records;
drop policy if exists tenant_write_staged    on public.staged_records;

create policy tenant_read_evidence   on public.evidence_files  for select using (public.in_tenant(tenant_id));
create policy tenant_write_evidence  on public.evidence_files  for all    using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));
create policy tenant_read_comments   on public.comments        for select using (public.in_tenant(tenant_id));
create policy tenant_write_comments  on public.comments        for all    using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));
create policy tenant_read_events     on public.event_cells     for select using (public.in_tenant(tenant_id));
create policy tenant_write_events    on public.event_cells     for all    using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));
create policy tenant_read_behaviors  on public.behavior_cells  for select using (public.in_tenant(tenant_id));
create policy tenant_write_behaviors on public.behavior_cells  for all    using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));
create policy tenant_read_rejects    on public.gateway_rejects for select using (public.in_tenant(tenant_id));
create policy tenant_write_rejects   on public.gateway_rejects for all    using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));
create policy tenant_read_staged     on public.staged_records  for select using (public.in_tenant(tenant_id));
create policy tenant_write_staged    on public.staged_records  for all    using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));
