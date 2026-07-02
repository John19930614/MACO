-- =============================================================================
-- AI Dev Command Center — Phase 11: GitHub workflow settings
-- =============================================================================
-- Stores the repo settings, default branch, branch-naming rule, and PR template
-- the team uses when it PREPARES a branch/PR plan. Phase 11 only prepares plans
-- and approval requests — it performs no GitHub action and no production change.
--
-- SAFETY: brand-new config table, additive, reversible. Seeds one row. Superadmin
-- only, like every dev_* table.
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists public.dev_github_settings (
  id                   uuid primary key default gen_random_uuid(),
  repo_owner           text,
  repo_name            text,
  default_branch       text not null default 'master',
  protected_branch     text not null default 'master',   -- never pushed to directly
  branch_naming_format text not null default 'ai-dev/task-{taskId-short}-{safe-task-title}',
  pr_title_template    text not null default 'AI Dev: {task_title}',
  pr_body_template     text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table public.dev_github_settings is
  'AI Dev Command Center: GitHub repo + branch + PR settings used to PREPARE branch/PR plans. No GitHub action runs from here. Superadmin-only.';

alter table public.dev_github_settings enable row level security;
drop policy if exists dev_github_settings_superadmin on public.dev_github_settings;
create policy dev_github_settings_superadmin on public.dev_github_settings for all
  using (public.is_reliance_admin()) with check (public.is_reliance_admin());

drop trigger if exists dev_github_settings_set_updated_at on public.dev_github_settings;
create trigger dev_github_settings_set_updated_at before update on public.dev_github_settings
  for each row execute function public.ops_set_updated_at();

-- Seed one settings row (idempotent: only if the table is empty).
insert into public.dev_github_settings (repo_owner, repo_name, default_branch, protected_branch, pr_body_template)
select 'John19930614', 'MACO', 'master', 'master',
$tpl$## Task summary
{task_summary}

## Business goal
{business_goal}

## Files changed
{files_changed}

## Database changes
{database_changes}

## AI agents involved
{agents_involved}

## QA results
{qa_results}

## Security review
{security_review}

## Experience review
{experience_review}

## Human approvals
{human_approvals}

## Rollback plan
{rollback_plan}
$tpl$
where not exists (select 1 from public.dev_github_settings);
