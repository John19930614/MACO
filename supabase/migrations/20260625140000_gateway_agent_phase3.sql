-- =============================================================================
-- AI Gateway Agent — Phase 3: settings (thresholds), version history, notes
-- Additive and reversible. Admin-only (superadmin monitoring tool).
-- =============================================================================

-- Configurable thresholds the health check uses to decide degraded/critical.
create table if not exists public.gateway_agent_settings (
  id                       uuid primary key default gen_random_uuid(),
  enabled                  boolean not null default true,
  fallback_warn_pct        integer not null default 25,
  fallback_critical_pct    integer not null default 50,
  reject_queue_warn        integer not null default 10,
  review_backlog_warn      integer not null default 5,
  review_backlog_critical  integer not null default 15,
  updated_by               text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create trigger trg_gateway_settings_updated_at before update on public.gateway_agent_settings
  for each row execute function public.csp_set_updated_at();
insert into public.gateway_agent_settings (updated_by) values ('Reliance Platform');

-- Version / rule history for traceability.
create table if not exists public.gateway_agent_versions (
  id              uuid primary key default gen_random_uuid(),
  agent_name      text not null default 'AI Gateway Agent',
  gateway_version text not null,
  rule_version    text not null,
  change_summary  text,
  changed_by_name text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
insert into public.gateway_agent_versions (gateway_version, rule_version, change_summary, changed_by_name) values
  ('gw-agent-v1.0', 'rules-v1.0',
   'Initial gateway monitoring agent: health snapshots, maintenance findings, daily cron, configurable thresholds, version history, notes.',
   'Reliance Platform');

-- Maintenance notes — how a finding was resolved (lightweight memory/log).
create table if not exists public.gateway_agent_notes (
  id            uuid primary key default gen_random_uuid(),
  health_log_id uuid references public.gateway_agent_health_log(id) on delete set null,
  note          text not null,
  author        text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_gateway_notes_created on public.gateway_agent_notes(created_at desc);

-- RLS — admin only.
do $$
declare t text;
begin
  foreach t in array array['gateway_agent_settings','gateway_agent_versions','gateway_agent_notes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using ((select private.is_reliance_admin())) with check ((select private.is_reliance_admin()))', t);
  end loop;
end $$;
