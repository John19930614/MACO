-- =============================================================================
-- Per-tenant module access — tenant_module_access (+ audit trail)
-- =============================================================================
-- Adds a per-tenant on/off switch for each of the 10 EHS modules (chemical,
-- legal, audits, capa, training, documents, waste, equipment, risk, incidents —
-- see src/lib/constants.ts EHS_MODULES), decoupled from the platform-wide
-- Module Control Panel maintenance toggle (which is currently an in-memory
-- store, src/lib/data/store.ts moduleStates — not a DB table, so it is not
-- duplicated here; the app combines both sources at read time in
-- src/lib/modules/moduleAccess.ts).
--
-- A missing row for a given (tenant_id, module_key) means "enabled" — existing
-- tenants are unaffected until a Reliance operator explicitly toggles a module
-- off for them from the Company > Modules tab.
--
-- Writes are Reliance-superadmin only (is_reliance_admin()), matching every
-- other sa_*/dev_* platform table. Reads are scoped to the tenant's own admins
-- plus superadmins, via the same auth_tenant_id()/is_reliance_admin() helpers
-- used by audit_log and the dev_* tables — reused idempotently below, never
-- redefined differently.
--
-- Additive + reversible: drop tenant_module_access / tenant_module_access_audit
-- to roll back; no existing table, column, or policy is altered.
-- =============================================================================

create extension if not exists pgcrypto;

-- ── Shared helpers (already in prod; re-declared idempotently — no-op) ─────────
create or replace function public.auth_tenant_id()
returns uuid language sql stable security definer set search_path = public
as $$ select tenant_id from profiles where id = auth.uid() limit 1; $$;

create or replace function public.is_reliance_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from profiles where id = auth.uid() and tenant_id is null); $$;

create or replace function public.ops_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- =============================================================================
-- tenant_module_access
-- =============================================================================
create table if not exists public.tenant_module_access (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  module_key   text not null check (module_key in (
                 'chemical', 'legal', 'audits', 'capa', 'training',
                 'documents', 'waste', 'equipment', 'risk', 'incidents'
               )),
  is_enabled   boolean not null default true,
  updated_by   text,                                     -- operator label (display name / email)
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (tenant_id, module_key)
);

create index if not exists tenant_module_access_tenant_idx on public.tenant_module_access (tenant_id);

drop trigger if exists tenant_module_access_set_updated_at on public.tenant_module_access;
create trigger tenant_module_access_set_updated_at
  before update on public.tenant_module_access
  for each row execute function public.ops_set_updated_at();

alter table public.tenant_module_access enable row level security;

drop policy if exists tenant_module_access_read on public.tenant_module_access;
create policy tenant_module_access_read on public.tenant_module_access for select
  using ((tenant_id = (select public.auth_tenant_id())) or (select public.is_reliance_admin()));

drop policy if exists tenant_module_access_write on public.tenant_module_access;
create policy tenant_module_access_write on public.tenant_module_access for all
  using ((select public.is_reliance_admin()))
  with check ((select public.is_reliance_admin()));

-- =============================================================================
-- tenant_module_access_audit — append-only change log (who / when / before / after)
-- =============================================================================
create table if not exists public.tenant_module_access_audit (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  module_key      text not null,
  previous_value  boolean,
  new_value       boolean not null,
  changed_by      text,
  changed_at      timestamptz not null default now()
);

create index if not exists tenant_module_access_audit_tenant_idx
  on public.tenant_module_access_audit (tenant_id, changed_at desc);

alter table public.tenant_module_access_audit enable row level security;

-- Superadmin-only: this is an internal platform artifact (like sa_* audit logs),
-- not tenant-facing data.
drop policy if exists tenant_module_access_audit_rw on public.tenant_module_access_audit;
create policy tenant_module_access_audit_rw on public.tenant_module_access_audit for all
  using ((select public.is_reliance_admin()))
  with check ((select public.is_reliance_admin()));
