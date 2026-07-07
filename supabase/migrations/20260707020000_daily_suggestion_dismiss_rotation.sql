-- =============================================================================
-- Daily Suggestion card — dismiss + rotation (AI Dev Command Center)
-- =============================================================================
-- Lets an operator dismiss a daily platform-improvement suggestion for good
-- (per-admin-profile) and links tasks back to the suggestion they came from so
-- converted suggestions stop showing up. Additive only — no existing table,
-- column, or policy is altered.
-- =============================================================================

create extension if not exists pgcrypto;

-- =============================================================================
-- 1. dismissed_suggestions — suggestions an admin has dismissed for good
-- =============================================================================
-- Scoped per profile (unlike the shared/global Platform Review finding
-- dismissal in dev_audit_log): each superadmin sees and controls their own
-- Daily Suggestion queue.
create table if not exists public.dismissed_suggestions (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  suggestion_id  text not null,
  dismissed_at   timestamptz not null default now(),
  unique (profile_id, suggestion_id)
);
create index if not exists dismissed_suggestions_profile_idx on public.dismissed_suggestions (profile_id);
comment on table public.dismissed_suggestions is
  'AI Dev Command Center: Daily Suggestion card dismissals, scoped per admin profile.';

alter table public.dismissed_suggestions enable row level security;

drop policy if exists dismissed_suggestions_own_row on public.dismissed_suggestions;
create policy dismissed_suggestions_own_row
  on public.dismissed_suggestions
  for all
  using (auth.uid() = profile_id and public.is_reliance_admin())
  with check (auth.uid() = profile_id and public.is_reliance_admin());

-- =============================================================================
-- 2. dev_tasks.source_suggestion_id — link a task back to its Daily Suggestion
-- =============================================================================
alter table public.dev_tasks
  add column if not exists source_suggestion_id text;

create index if not exists dev_tasks_source_suggestion_id_idx
  on public.dev_tasks (source_suggestion_id)
  where source_suggestion_id is not null;
