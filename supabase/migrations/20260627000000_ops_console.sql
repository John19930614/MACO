-- =============================================================================
-- Platform Operations Console — ops_* governance tables  (Admin Ops Console v1.2)
-- =============================================================================
-- Backs the SOP-driven tools in SafetyIQ-Admin-Console.html: it gives the
-- console a place to RUN SOP checklists and HOLD the evidence (who/when/sign-off),
-- instead of only viewing data.
--
-- POSITIONING: these are INTERNAL platform-governance tables, NOT tenant data.
-- They are superadmin-only (Reliance operators with profiles.tenant_id IS NULL),
-- exactly like the csp_* agent registry and ai_telemetry. They never expose one
-- tenant's data to another; a few carry an OPTIONAL affected-tenant pointer for
-- incidents / tickets / provisioning, but visibility is gated on is_reliance_admin().
--
-- SELF-AUDITING: every row carries created_by + timestamps; incidents carry a
-- timeline[] and releases/tickets carry approval + status history. The ops_*
-- tables ARE the audit trail for operator actions (no dependency on audit_log,
-- whose actor_id is a NOT NULL uuid the service-role console can't supply).
--
-- Additive and reversible. Rollback: drop the ops_* tables (no other object
-- depends on them).
-- =============================================================================

create extension if not exists pgcrypto;

-- ── Tenant/superadmin helpers (already in prod; re-declared idempotently) ─────
create or replace function public.auth_tenant_id()
returns uuid language sql stable security definer set search_path = public
as $$ select tenant_id from profiles where id = auth.uid() limit 1; $$;

create or replace function public.is_reliance_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from profiles where id = auth.uid() and tenant_id is null); $$;

-- ── updated_at helper (namespaced so it never clobbers an existing trigger fn) ─
create or replace function public.ops_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- =============================================================================
-- ops_checklist_runs — a run of any SOP checklist (the generic Checklist Runner)
-- =============================================================================
create table if not exists public.ops_checklist_runs (
  id            uuid primary key default gen_random_uuid(),
  sop_id        text not null,                       -- e.g. 'SOP-11'
  title         text not null,                       -- e.g. 'Release 2026-06-27'
  context       text,                                -- free note: what this run covers
  items         jsonb not null default '[]'::jsonb,  -- [{key,label,done,note,at}]
  status        text  not null default 'open'
                check (status in ('open','passed','failed','abandoned')),
  signed_off_by text,
  signed_off_at timestamptz,
  created_by    text,                                -- actor label (email / 'service-role admin')
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- =============================================================================
-- ops_incidents — SOP-14 Production Incident Response
-- =============================================================================
create table if not exists public.ops_incidents (
  id          uuid primary key default gen_random_uuid(),
  ref         text,                                  -- optional human ref (INC-2026-001)
  title       text not null,
  severity    text not null check (severity in ('SEV-1','SEV-2','SEV-3')),
  scope       text,                                  -- what's broken, for whom, since when
  tenant_id   uuid references public.tenants(id) on delete set null,  -- affected tenant (optional)
  status      text not null default 'open'
              check (status in ('open','contained','restored','communicated','closed')),
  timeline    jsonb not null default '[]'::jsonb,    -- [{at,actor,event}]
  root_cause  text,
  guard_added text,                                  -- test/guard that prevents recurrence
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  closed_at   timestamptz
);

-- =============================================================================
-- ops_releases — SOP-11 Release & Deployment
-- =============================================================================
create table if not exists public.ops_releases (
  id               uuid primary key default gen_random_uuid(),
  version          text,                             -- tag / sha / label
  summary          text,                             -- what shipped
  gate             jsonb not null default '{}'::jsonb, -- {typecheck,build,test,system,rls,schema}
  checklist_run_id uuid references public.ops_checklist_runs(id) on delete set null,
  vercel_url       text,
  approved_by      text,
  approved_at      timestamptz,
  smoke_ok         boolean,
  status           text not null default 'planned'
                   check (status in ('planned','approved','deployed','rolled_back')),
  created_by       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- =============================================================================
-- ops_support_tickets — SOP-22 Customer Support & QA
-- =============================================================================
create table if not exists public.ops_support_tickets (
  id                    uuid primary key default gen_random_uuid(),
  ref                   text,
  tenant_id             uuid references public.tenants(id) on delete set null,
  reporter              text,
  subject               text not null,
  detail                text,
  triage_class          text check (triage_class in ('incident','bug','question','feature','security')),
  severity              text check (severity in ('low','medium','high','critical')),
  status                text not null default 'open'
                        check (status in ('open','reproduced','in_progress','fixed','closed')),
  reproduced            boolean not null default false,
  fix_ref               text,                        -- commit / PR
  regression_test_added boolean not null default false,
  incident_id           uuid references public.ops_incidents(id) on delete set null,
  created_by            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  closed_at             timestamptz
);

-- =============================================================================
-- ops_provisioning — SOP-20 Tenant Provisioning / SOP-21 Pilot Management
-- =============================================================================
create table if not exists public.ops_provisioning (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid references public.tenants(id) on delete set null, -- null until tenant row exists
  company_name       text not null,
  owner              text,                           -- internal owner
  go_live_target     date,
  kind               text not null default 'tenant' check (kind in ('tenant','pilot')),
  steps              jsonb not null default '[]'::jsonb, -- checklist items
  isolation_verified boolean not null default false,
  status             text not null default 'open'
                     check (status in ('open','ready','live','closed')),
  created_by         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── Indexes for the common console queries (status / recency) ─────────────────
create index if not exists ops_checklist_runs_sop_idx   on public.ops_checklist_runs (sop_id, created_at desc);
create index if not exists ops_incidents_status_idx      on public.ops_incidents (status, created_at desc);
create index if not exists ops_releases_status_idx       on public.ops_releases (status, created_at desc);
create index if not exists ops_support_tickets_status_idx on public.ops_support_tickets (status, created_at desc);
create index if not exists ops_provisioning_status_idx   on public.ops_provisioning (status, created_at desc);

-- ── updated_at triggers ───────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'ops_checklist_runs','ops_incidents','ops_releases','ops_support_tickets','ops_provisioning'
  ] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I;', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I '
      || 'for each row execute function public.ops_set_updated_at();', t, t);
  end loop;
end $$;

-- ── RLS: superadmin-only (Reliance operators). One ALL policy per table. ───────
do $$
declare t text;
begin
  foreach t in array array[
    'ops_checklist_runs','ops_incidents','ops_releases','ops_support_tickets','ops_provisioning'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_superadmin on public.%I;', t, t);
    execute format(
      'create policy %I_superadmin on public.%I for all '
      || 'using (public.is_reliance_admin()) with check (public.is_reliance_admin());', t, t);
  end loop;
end $$;
