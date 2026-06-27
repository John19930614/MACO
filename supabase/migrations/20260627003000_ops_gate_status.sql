-- =============================================================================
-- Ops Console — ops_gate_status (F3) + ops_migrations() reader
-- =============================================================================
-- Backs the live-signal tools served by /api/ops:
--   * ops_gate_status     — one row per CI gate run (typecheck/build/test/system/
--     tenancy/live + commit sha). Written by CI via the service role; read by
--     /api/ops. Lets the console show "gate green" HONESTLY (it can't run the gate).
--   * public.ops_migrations() — SECURITY DEFINER reader for
--     supabase_migrations.schema_migrations, which PostgREST does NOT expose even
--     to the service role. EXECUTE is locked to service_role only (so the anon/
--     authenticated security-definer advisor lint does not fire). /api/ops calls
--     it with the service role to list applied migrations for the Migration Gate.
--
-- Superadmin-only, additive, reversible (drop the table + function).
-- =============================================================================

create extension if not exists pgcrypto;

-- ── ops_gate_status (F3) ──────────────────────────────────────────────────────
create table if not exists public.ops_gate_status (
  id         uuid primary key default gen_random_uuid(),
  sha        text,
  branch     text,
  typecheck  text,                                  -- pass | fail | skip
  test       text,
  build      text,
  system     text,
  tenancy    text,
  live       text,
  source     text not null default 'ci' check (source in ('ci','manual')),
  created_at timestamptz not null default now()
);
create index if not exists ops_gate_status_recent_idx on public.ops_gate_status (created_at desc);

alter table public.ops_gate_status enable row level security;
drop policy if exists ops_gate_status_superadmin on public.ops_gate_status;
create policy ops_gate_status_superadmin on public.ops_gate_status for all
  using (public.is_reliance_admin()) with check (public.is_reliance_admin());

-- ── ops_migrations() — applied-migrations reader (service_role only) ───────────
create or replace function public.ops_migrations()
returns table(version text, name text)
language sql
security definer
set search_path = public, supabase_migrations
as $$
  select version, name
  from supabase_migrations.schema_migrations
  order by version
$$;

revoke execute on function public.ops_migrations() from public;
revoke execute on function public.ops_migrations() from anon;
revoke execute on function public.ops_migrations() from authenticated;
grant  execute on function public.ops_migrations() to service_role;
