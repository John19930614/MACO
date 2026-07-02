-- =============================================================================
-- AI Dev Command Center — Phase 12: controlled code application (working area)
-- =============================================================================
-- When an APPROVED artifact passes every safety check, its content is applied to
-- this staging "working area" — NOT to the real codebase. The web app cannot (and
-- must not) write to its own source files at runtime, so this table is the safe,
-- audited, reversible place an applied change lands until a later, separately-
-- gated worker writes it to a real branch.
--
-- SAFETY: brand-new table, additive, reversible. Every row ties to a task_id.
-- Superadmin-only, like every dev_* table. Nothing here touches production.
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists public.dev_applied_changes (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.dev_tasks(id) on delete cascade,
  artifact_id   uuid references public.dev_artifacts(id) on delete set null,
  file_path     text not null,
  change_type   text,
  content       text,                                -- the applied draft content (staged)
  rollback_note text,
  dangerous     boolean not null default false,      -- needed an extra approval
  status        text not null default 'applied'
                check (status in ('applied','rolled_back')),
  applied_by    text,
  applied_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists dev_applied_changes_task_idx on public.dev_applied_changes (task_id, applied_at desc);
comment on table public.dev_applied_changes is
  'AI Dev Command Center: staging working area for applied approved artifacts. NOT the real codebase. Superadmin-only.';

alter table public.dev_applied_changes enable row level security;
drop policy if exists dev_applied_changes_superadmin on public.dev_applied_changes;
create policy dev_applied_changes_superadmin on public.dev_applied_changes for all
  using (public.is_reliance_admin()) with check (public.is_reliance_admin());

drop trigger if exists dev_applied_changes_set_updated_at on public.dev_applied_changes;
create trigger dev_applied_changes_set_updated_at before update on public.dev_applied_changes
  for each row execute function public.ops_set_updated_at();
