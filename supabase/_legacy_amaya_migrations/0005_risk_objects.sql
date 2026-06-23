-- ════════════════════════════════════════════════════════════════════════
-- Reliance Risk Intelligence Framework objects (build manual §6). The six-object
-- model already maps Precursor → safety_cells, Control/Failure → control_proofs,
-- and Learning → ai_findings / vela_insights. These two tables add the
-- previously-missing objects: Event Cells (outcomes) and Behavior Cells
-- (repeated human/organizational patterns). Tenant-scoped + role-gated, like the
-- rest of the model (see 0002_rls.sql for in_tenant / current_role_name).
-- ════════════════════════════════════════════════════════════════════════

-- ── event_cells (outcomes — incidents, claims, audit findings, …) ────────────
create table if not exists event_cells (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references tenants(id),
  site_id     uuid not null references sites(id) on delete cascade,
  cell_id     uuid references safety_cells(id) on delete set null, -- precursor it traces to
  kind        text not null default 'incident'
                check (kind in ('incident','near_miss','claim','audit_finding','compliance_failure','property_loss','service_interruption')),
  title       text not null,
  description text not null default '',
  severity    text not null default 'low'
                check (severity in ('low','medium','high','critical')),
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists idx_event_cells_site on event_cells(site_id);
create index if not exists idx_event_cells_cell on event_cells(cell_id);
create index if not exists idx_event_cells_tenant on event_cells(tenant_id);

-- ── behavior_cells (repeated human / organizational patterns) ────────────────
create table if not exists behavior_cells (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references tenants(id),
  site_id     uuid not null references sites(id) on delete cascade,
  pattern     text not null
                check (pattern in ('weak_closeout','slow_response','recurring_issue','process_drift','production_pressure')),
  title       text not null,
  description text not null default '',
  cell_ids    uuid[] not null default '{}',           -- precursors the pattern recurs across
  occurrences int not null default 1,
  created_at  timestamptz not null default now()
);
create index if not exists idx_behavior_cells_site on behavior_cells(site_id);
create index if not exists idx_behavior_cells_tenant on behavior_cells(tenant_id);

-- ── Row Level Security (mirrors 0002_rls.sql) ────────────────────────────────
alter table event_cells    enable row level security;
alter table behavior_cells enable row level security;

create policy read_events on event_cells for select using (in_tenant(tenant_id));
create policy write_events on event_cells
  for all using (in_tenant(tenant_id) and current_role_name() in ('supervisor','safety_manager','admin'))
  with check (in_tenant(tenant_id) and current_role_name() in ('supervisor','safety_manager','admin'));

create policy read_behaviors on behavior_cells for select using (in_tenant(tenant_id));
create policy write_behaviors on behavior_cells
  for all using (in_tenant(tenant_id) and current_role_name() in ('safety_manager','admin'))
  with check (in_tenant(tenant_id) and current_role_name() in ('safety_manager','admin'));
