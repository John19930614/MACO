-- =============================================================================
-- AI Dev Command Center — Phase 9: required review gates
-- =============================================================================
-- A task must pass required reviews (QA, Security, Experience, Documentation)
-- before it can move toward release. This table holds one gate per review type
-- per task, with a checklist, a status, and any required fixes. Superadmin-only,
-- like every dev_* table.
--
-- SAFETY: brand-new table — additive, reversible (drop it). No existing object
-- depends on it; no data touched.
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists public.dev_review_gates (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid not null references public.dev_tasks(id) on delete cascade,
  gate_type      text not null
                 check (gate_type in ('qa','security','experience','plain_english','admin_workflow','documentation')),
  agent_name     text,
  status         text not null default 'pending'
                 check (status in ('pending','passed','failed','needs_revision','waived_by_admin')),
  summary        text,
  checklist      jsonb not null default '[]'::jsonb,   -- [{label, passed, note}]
  required_fixes jsonb not null default '[]'::jsonb,   -- [string]
  score          int,
  decided_by     text,
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (task_id, gate_type)
);
create index if not exists dev_review_gates_task_idx on public.dev_review_gates (task_id, gate_type);
comment on table public.dev_review_gates is
  'AI Dev Command Center: required review gates (QA/Security/Experience/Plain-English/Admin/Docs) per task. Superadmin-only.';

alter table public.dev_review_gates enable row level security;
drop policy if exists dev_review_gates_superadmin on public.dev_review_gates;
create policy dev_review_gates_superadmin on public.dev_review_gates for all
  using (public.is_reliance_admin()) with check (public.is_reliance_admin());

drop trigger if exists dev_review_gates_set_updated_at on public.dev_review_gates;
create trigger dev_review_gates_set_updated_at before update on public.dev_review_gates
  for each row execute function public.ops_set_updated_at();
