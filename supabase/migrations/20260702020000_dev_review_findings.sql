-- =============================================================================
-- Platform Review — dev_review_findings + dev_rls_status() probe
-- =============================================================================
-- Makes the Platform Review find issues instead of reading a hardcoded catalog:
--   * dev_review_findings — one row per finding produced by the automated
--     review pipeline (scripts/platform-review-scan.mjs codified audits and the
--     optional Claude review pass). Keyed by a STABLE finding_key (rule + file)
--     so dismissals recorded in dev_audit_log keep working across runs, and so
--     a re-run can auto-resolve findings that no longer reproduce.
--     Written by the GitHub workflow via the service role; read by
--     /admin/dev-command/review. Superadmin-only under RLS.
--   * public.dev_rls_status() — SECURITY DEFINER reader over pg_tables so the
--     review's Security check can verify, live, that every public table has
--     row-level security enabled. PostgREST exposes no catalog views, hence the
--     function; EXECUTE is locked to service_role only (mirrors ops_migrations()).
--
-- Superadmin-only, additive, reversible (drop the table + function).
-- =============================================================================

create extension if not exists pgcrypto;

-- ── dev_review_findings ───────────────────────────────────────────────────────
create table if not exists public.dev_review_findings (
  finding_key      text primary key,          -- stable: '<rule>:<file-or-scope>'
  check_key        text not null check (check_key in
                     ('build_type','security','database','routes_ux','ai_engine','tech_debt')),
  title            text not null,
  detail           text not null,
  recommendation   text not null,
  severity         text not null default 'amber' check (severity in ('green','amber','red')),
  source           text not null check (source in ('scan','ai')),
  module           text not null default 'Platform Operations',
  who_uses_it      text,
  priority         text not null default 'medium' check (priority in ('urgent','high','medium','low')),
  risk_level       text not null default 'low' check (risk_level in ('low','medium','high','critical')),
  effort           text not null default 'medium' check (effort in ('small','medium','large')),
  where_hint       text,
  success_criteria text not null default '',
  status           text not null default 'open' check (status in ('open','resolved')),
  run_id           text,                      -- GitHub run id (or 'local')
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  resolved_at      timestamptz
);
create index if not exists dev_review_findings_open_idx
  on public.dev_review_findings (status, check_key);

alter table public.dev_review_findings enable row level security;
drop policy if exists dev_review_findings_superadmin on public.dev_review_findings;
create policy dev_review_findings_superadmin on public.dev_review_findings for all
  using (public.is_reliance_admin()) with check (public.is_reliance_admin());

-- ── dev_rls_status() — live RLS coverage probe (service_role only) ────────────
create or replace function public.dev_rls_status()
returns table(table_name text, rls_enabled boolean)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select tablename::text, rowsecurity
  from pg_catalog.pg_tables
  where schemaname = 'public'
  order by tablename
$$;

revoke execute on function public.dev_rls_status() from public;
revoke execute on function public.dev_rls_status() from anon;
revoke execute on function public.dev_rls_status() from authenticated;
grant  execute on function public.dev_rls_status() to service_role;
