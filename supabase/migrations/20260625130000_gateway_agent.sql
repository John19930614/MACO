-- =============================================================================
-- AI Gateway Agent — monitor & maintain the existing AI Gateway
-- =============================================================================
-- A monitoring agent that watches the live gateway pipeline (runGatewayPipeline)
-- + AI telemetry + the validation review backlog, judges gateway health, and
-- logs a snapshot each time it runs so health/trend is visible over time.
-- It does NOT replace the gateway — it keeps it healthy.
-- Superadmin tool; admin-only RLS. Additive and reversible.
-- =============================================================================

create table if not exists public.gateway_agent_health_log (
  id                 uuid primary key default gen_random_uuid(),
  checked_at         timestamptz not null default now(),
  tenant_id          uuid references public.tenants(id) on delete set null,

  overall_status     text not null default 'healthy',   -- healthy | degraded | critical
  gateway_overall    text,                               -- pass | warn | fail (pipeline overall)

  pass_count         integer not null default 0,
  warn_count         integer not null default 0,
  fail_count         integer not null default 0,
  reject_queue_count integer not null default 0,
  resolvable_count   integer not null default 0,
  human_review_queue integer not null default 0,
  csp_pending_reviews integer not null default 0,

  ai_calls           integer not null default 0,
  ai_fallback_rate   numeric not null default 0,
  ai_avg_latency_ms  integer not null default 0,
  ai_est_cost        numeric not null default 0,
  anomaly_count      integer not null default 0,

  findings           jsonb not null default '[]'::jsonb, -- [{title, severity, detail, recommendation}]
  metrics            jsonb not null default '{}'::jsonb,
  generated_by       text,
  created_at         timestamptz not null default now()
);
create index if not exists idx_gateway_health_at on public.gateway_agent_health_log(checked_at desc);

alter table public.gateway_agent_health_log enable row level security;
drop policy if exists admin_all on public.gateway_agent_health_log;
create policy admin_all on public.gateway_agent_health_log for all to authenticated
  using ((select private.is_reliance_admin()))
  with check ((select private.is_reliance_admin()));
