-- =============================================================================
-- AI Dev Command Center — Phase 5: dev_tasks workflow stages
-- =============================================================================
-- Phase 5 adds the Dev Manager workflow engine. A task now moves through 17
-- ordered stages; this updates the status CHECK to those stages plus the two
-- off-ramp states ('rejected','blocked'). Default stays 'intake'.
--
-- SAFETY: the only existing rows use 'intake' (still valid), so no row can
-- violate the new constraint. Reversible. No data touched.
-- =============================================================================

alter table public.dev_tasks drop constraint if exists dev_tasks_status_check;

alter table public.dev_tasks
  add constraint dev_tasks_status_check check (status in (
    -- 17 workflow stages, in order
    'intake','requirements_review','architecture_review','ui_ux_review',
    'experience_review','code_plan','file_change_plan','approval_required',
    'approved_for_drafting','code_draft','qa_review','security_review',
    'experience_final_review','documentation','release_plan',
    'human_final_approval','complete',
    -- off-ramps
    'rejected','blocked'
  ));

alter table public.dev_tasks alter column status set default 'intake';
