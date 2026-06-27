-- =============================================================================
-- AI Dev Command Center — Phase 3: dev_tasks status lifecycle
-- =============================================================================
-- Phase 3 makes task intake real. The intake flow sets a new task to 'intake'
-- and the task moves through a richer 16-state lifecycle. The Phase 1 CHECK
-- constraint only allowed the old 10-state set, so this updates it.
--
-- SAFETY: dev_tasks is empty (0 rows) when this runs, so no existing row can
-- violate the new constraint. Additive/reversible — the old constraint can be
-- restored. No data is touched; only the column's CHECK + default change.
-- =============================================================================

alter table public.dev_tasks drop constraint if exists dev_tasks_status_check;

alter table public.dev_tasks
  add constraint dev_tasks_status_check check (status in (
    'intake','planning','requirements_review','architecture_review','experience_review',
    'code_plan','needs_approval','approved','building','testing','security_review',
    'documentation','ready_for_release','complete','rejected','blocked'
  ));

alter table public.dev_tasks alter column status set default 'intake';
