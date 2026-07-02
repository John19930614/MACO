-- AI model benchmark results: one row per (model × prompt) call from a
-- superadmin-triggered benchmark run on /sa/gateway. Platform operations data,
-- not tenant business data — tenant_id is nullable because superadmin profiles
-- have tenant_id null (that is what makes them superadmins). Additive and
-- reversible (drop table public.ai_model_benchmarks).
create table if not exists public.ai_model_benchmarks (
  id            uuid          primary key default gen_random_uuid(),
  run_at        timestamptz   not null default now(),
  model         text          not null,
  prompt_key    text          not null,
  latency_ms    integer,      -- null = call failed or was skipped
  input_tokens  integer       not null default 0,
  output_tokens integer       not null default 0,
  score         numeric(5,2), -- completeness score 0-100; null = call failed
  cost_est_usd  numeric(10,6) not null default 0,
  raw_response  text          not null default '',
  error         text,
  created_by    uuid          references public.profiles(id) on delete set null,
  tenant_id     uuid          references public.tenants(id)  on delete set null
);

alter table public.ai_model_benchmarks enable row level security;

-- Platform operators read; no RLS insert path at all — the benchmark server
-- action writes with the service-role client, which bypasses RLS. Matches the
-- ai_telemetry admin-read pattern.
drop policy if exists "ai_model_benchmarks_admin_read" on public.ai_model_benchmarks;
create policy "ai_model_benchmarks_admin_read" on public.ai_model_benchmarks
  for select to authenticated
  using (is_reliance_admin());

create index if not exists ai_model_benchmarks_run_at_idx
  on public.ai_model_benchmarks (run_at desc);
