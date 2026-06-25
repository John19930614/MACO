-- AI call telemetry: durable per-call latency/token/cost record so the in-app
-- observability survives serverless cold starts (previously an in-memory ring
-- buffer that reset on every cold start). Operational data, not tenant business
-- data — platform operators read it; any authenticated session may append its
-- own AI-call log row. Additive and reversible (drop table public.ai_telemetry).
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

drop policy if exists "ai_telemetry_admin_read" on public.ai_telemetry;
create policy "ai_telemetry_admin_read" on public.ai_telemetry
  for select to authenticated
  using (is_reliance_admin());

drop policy if exists "ai_telemetry_insert" on public.ai_telemetry;
create policy "ai_telemetry_insert" on public.ai_telemetry
  for insert to authenticated
  with check (true);

create index if not exists ai_telemetry_at_idx on public.ai_telemetry (at desc);
