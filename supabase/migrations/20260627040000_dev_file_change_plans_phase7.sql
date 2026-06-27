-- =============================================================================
-- AI Dev Command Center — Phase 7: file change plan system
-- =============================================================================
-- Expands dev_file_change_plans so agents can propose a richer set of changes
-- (migrations, tests, docs, config) with an explicit approval flag and a plain
-- summary. No real files are ever touched — these are plans only.
--
-- SAFETY: dev_file_change_plans is empty (0 rows), so the new CHECK constraints
-- can't conflict with existing data. Additive + reversible. No data touched.
-- =============================================================================

-- change_type: add migration / test / documentation / config
alter table public.dev_file_change_plans drop constraint if exists dev_file_change_plans_change_type_check;
alter table public.dev_file_change_plans
  add constraint dev_file_change_plans_change_type_check check (change_type in (
    'create','modify','delete','rename','migration','test','documentation','config'
  ));

-- status: the Phase 7 lifecycle
alter table public.dev_file_change_plans drop constraint if exists dev_file_change_plans_status_check;
alter table public.dev_file_change_plans
  add constraint dev_file_change_plans_status_check check (status in (
    'planned','needs_approval','approved','rejected','drafted','applied_later'
  ));
alter table public.dev_file_change_plans alter column status set default 'planned';

-- new columns: a plain summary + an explicit "needs your approval" flag
alter table public.dev_file_change_plans add column if not exists proposed_summary text;
alter table public.dev_file_change_plans add column if not exists approval_required boolean not null default true;
