-- =============================================================================
-- Ops Console — Access Register (SOP-18) + Secrets Register (SOP-12)
-- =============================================================================
-- Two more superadmin-only governance tables for the Admin Ops Console:
--   * ops_access_register  — who has access to which surface (GitHub/Vercel/
--     Supabase/app), their role, and grant/revoke status. Backs SOP-18 access
--     control & offboarding.
--   * ops_secrets_register — the REQUIRED-secrets checklist: name, scope, whether
--     it's set in Vercel, and last-rotated date. Backs SOP-12. STORES NO SECRET
--     VALUES — only names + metadata.
--
-- Same pattern as 20260627000000_ops_console.sql: superadmin RLS via
-- public.is_reliance_admin(), self-auditing via created_by + timestamps.
-- Additive + reversible (drop the two tables). The secrets register is seeded
-- with the known required keys (idempotent on name).
-- =============================================================================

create extension if not exists pgcrypto;

-- ── ops_access_register (SOP-18) ──────────────────────────────────────────────
create table if not exists public.ops_access_register (
  id            uuid primary key default gen_random_uuid(),
  person        text not null,                       -- name / email of the person
  surface       text not null check (surface in ('github','vercel','supabase','app','other')),
  role          text,                                -- e.g. 'collaborator', 'admin', 'viewer'
  is_superadmin boolean not null default false,      -- cross-tenant reach (keep minimal)
  status        text not null default 'active' check (status in ('active','revoked')),
  notes         text,
  granted_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── ops_secrets_register (SOP-12) — names + metadata only, NEVER values ────────
create table if not exists public.ops_secrets_register (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,                 -- env var name
  scope        text not null check (scope in ('public','server')),
  in_vercel    boolean not null default false,       -- set in Vercel Production scope?
  last_rotated date,
  owner        text,
  notes        text,
  created_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Seed the known required keys (SOP-12). Idempotent on name; no values stored.
insert into public.ops_secrets_register (name, scope) values
  ('SUPABASE_SERVICE_ROLE_KEY','server'),
  ('OPENAI_API_KEY','server'),
  ('ANTHROPIC_API_KEY','server'),
  ('RESEND_API_KEY','server'),
  ('CRON_SECRET','server'),
  ('NEXT_PUBLIC_SUPABASE_URL','public'),
  ('NEXT_PUBLIC_SUPABASE_ANON_KEY','public')
on conflict (name) do nothing;

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists ops_access_register_person_idx on public.ops_access_register (person, status);
create index if not exists ops_access_register_status_idx on public.ops_access_register (status, created_at desc);

-- ── updated_at triggers (reuses public.ops_set_updated_at from the first migration) ──
do $$
declare t text;
begin
  foreach t in array array['ops_access_register','ops_secrets_register'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I;', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I '
      || 'for each row execute function public.ops_set_updated_at();', t, t);
  end loop;
end $$;

-- ── RLS: superadmin-only ──────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['ops_access_register','ops_secrets_register'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_superadmin on public.%I;', t, t);
    execute format(
      'create policy %I_superadmin on public.%I for all '
      || 'using (public.is_reliance_admin()) with check (public.is_reliance_admin());', t, t);
  end loop;
end $$;
