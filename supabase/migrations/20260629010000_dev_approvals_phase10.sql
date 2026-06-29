-- =============================================================================
-- AI Dev Command Center — Phase 10: stronger approval center
-- =============================================================================
-- Expands dev_approvals so every dangerous action carries a clear plain-English
-- summary, a technical summary, the affected files/tables, and an experience
-- note — and adds the new approval types and the needs_revision status.
--
-- SAFETY: dev_approvals is empty (0 rows). The approval_type CHECK is a SUPERSET
-- (keeps the existing types the workflow uses, adds the new ones). Additive +
-- reversible. No data touched.
-- =============================================================================

-- New descriptive columns
alter table public.dev_approvals add column if not exists reason                text;
alter table public.dev_approvals add column if not exists plain_english_summary text;
alter table public.dev_approvals add column if not exists technical_summary     text;
alter table public.dev_approvals add column if not exists experience_impact     text;
alter table public.dev_approvals add column if not exists affected_files        jsonb not null default '[]'::jsonb;
alter table public.dev_approvals add column if not exists affected_tables       jsonb not null default '[]'::jsonb;

-- approval_type — superset: existing types + Phase 10 additions
alter table public.dev_approvals drop constraint if exists dev_approvals_approval_type_check;
alter table public.dev_approvals add constraint dev_approvals_approval_type_check check (approval_type in (
  'database_change','auth_permission_change','rls_policy_change','file_write','file_delete',
  'github_branch','pull_request','deployment','production_release','environment_variable_change',
  'ai_tool_permission_change','delete_action'
));

-- status — add needs_revision
alter table public.dev_approvals drop constraint if exists dev_approvals_status_check;
alter table public.dev_approvals add constraint dev_approvals_status_check check (status in (
  'pending','approved','rejected','needs_revision','expired','cancelled'
));
