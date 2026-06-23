-- ════════════════════════════════════════════════════════════════════════
-- Biosafety: BSL lab registry and biohazardous agent inventory
-- ════════════════════════════════════════════════════════════════════════

-- ── BSL Laboratory Registry ───────────────────────────────────────────────────

create table if not exists biosafety_labs (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  lab_code          text not null,                                -- e.g. "LAB-001"
  name              text not null,
  bsl_level         text not null default 'BSL-1'
                      check (bsl_level in ('BSL-1','BSL-2','BSL-3','BSL-4')),
  personnel_count   int  not null default 0,
  last_inspection   date,
  next_inspection   date,
  status            text not null default 'compliant'
                      check (status in ('compliant','minor_gap','major_gap','inspection_due')),
  open_findings     int  not null default 0,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_biosafety_labs_updated
  before update on biosafety_labs
  for each row execute function set_updated_at();

create index if not exists idx_biosafety_labs_tenant on biosafety_labs(tenant_id);

-- ── Biohazardous Agent Inventory ─────────────────────────────────────────────

create table if not exists biohazard_agents (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  agent_code       text not null,                                -- e.g. "AGT-001"
  agent_name       text not null,
  risk_class       text not null default 'Risk Group 1'
                     check (risk_class in ('Risk Group 1','Risk Group 2','Risk Group 3','Risk Group 4')),
  storage_location text not null,
  quantity         text not null default '0 units',
  status           text not null default 'registered'
                     check (status in ('registered','review_required','suspended')),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_biohazard_agents_updated
  before update on biohazard_agents
  for each row execute function set_updated_at();

create index if not exists idx_biohazard_agents_tenant on biohazard_agents(tenant_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table biosafety_labs    enable row level security;
alter table biohazard_agents  enable row level security;

-- BSL Labs
create policy biosafety_labs_read on biosafety_labs
  for select using (in_tenant(tenant_id));

create policy biosafety_labs_write on biosafety_labs
  for insert with check (
    in_tenant(tenant_id)
    and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin')
  );

create policy biosafety_labs_update on biosafety_labs
  for update using (
    in_tenant(tenant_id)
    and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin')
  );

-- Biohazard Agents
create policy biohazard_agents_read on biohazard_agents
  for select using (in_tenant(tenant_id));

create policy biohazard_agents_write on biohazard_agents
  for insert with check (
    in_tenant(tenant_id)
    and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin')
  );

create policy biohazard_agents_update on biohazard_agents
  for update using (
    in_tenant(tenant_id)
    and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin')
  );

-- ── Grants (mirror 0008_grants.sql pattern) ───────────────────────────────────

grant select, insert, update on biosafety_labs   to authenticated;
grant select, insert, update on biohazard_agents to authenticated;
