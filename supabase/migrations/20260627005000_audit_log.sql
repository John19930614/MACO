-- =============================================================================
-- Create public.audit_log (was missing in production)
-- =============================================================================
-- The app writes audit rows via repo.addAudit() -> insert into public.audit_log,
-- but the table only existed in the mock/ARC layer, never in the live DB — so
-- every audit write threw in prod and the console Audit Trail page was broken.
--
-- Columns match the app's AuditEntry (src/lib/types.ts). The DB generates the
-- uuid id + created_at (the code fix stops supplying the mock-counter id, which
-- collided across cold starts). RLS uses the live platform helpers
-- auth_tenant_id() / is_reliance_admin(): a user may write/read audits for their
-- own tenant; the Reliance superadmin sees all (and writes global tenant_id=null
-- rows). Additive + reversible (drop the table).
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.tenants(id) on delete set null,
  actor_id   text,
  action     text not null,
  entity     text not null,
  entity_id  text not null,
  reason     text,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_tenant_time_idx on public.audit_log (tenant_id, created_at desc);

alter table public.audit_log enable row level security;
drop policy if exists audit_log_rw on public.audit_log;
create policy audit_log_rw on public.audit_log for all
  using ((tenant_id = (select public.auth_tenant_id())) or (select public.is_reliance_admin()))
  with check ((tenant_id = (select public.auth_tenant_id())) or (select public.is_reliance_admin()));
