-- =============================================================================
-- AI Software Development Command Center — dev_* foundation (Phase 1)
-- =============================================================================
-- Creates the database foundation for the admin-only AI Dev Command Center: a
-- workspace where a Reliance operator hands software-development tasks to an AI
-- agent team. The agents PLAN, DESIGN, DRAFT code/SQL, TEST, REVIEW, and request
-- HUMAN APPROVAL before any dangerous change. They never deploy, migrate, delete,
-- or touch auth/RLS on their own — every such action lands in dev_approvals first.
--
-- POSITIONING: these are INTERNAL platform tables, NOT tenant/customer data.
-- They are SUPERADMIN-ONLY (Reliance operators with profiles.tenant_id IS NULL),
-- exactly like the ops_* and csp_* registries. Visibility is gated on
-- is_reliance_admin(); no row joins to a client tenant's data.
--
-- SAFETY / SCOPE:
--   • Additive only — no existing table is altered, renamed, or dropped.
--   • No existing RLS policy is modified. The auth helpers
--     (auth_tenant_id / is_reliance_admin) and the ops_set_updated_at trigger fn
--     are RE-DECLARED IDEMPOTENTLY (create or replace) — identical to the copies
--     already in prod, so this is a no-op for them, never a behavior change.
--   • No destructive SQL. Rollback = drop the dev_* tables (nothing else depends
--     on them).
--   • Seeds the 19 default agents idempotently (on conflict (key) do nothing).
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

-- A tiny helper to attach the superadmin-only RLS policy + updated_at trigger to
-- each dev_* table without repeating the boilerplate 16 times.
-- (Defined as a DO block per-table below rather than a function, so the policy
-- names are stable and greppable.)

-- =============================================================================
-- 1. dev_tasks — software-development tasks given to the AI team
-- =============================================================================
create table if not exists public.dev_tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  target_area   text,                                   -- e.g. 'sa/devcenter', 'lib/ai'
  priority      text not null default 'medium'
                check (priority in ('low','medium','high','urgent')),
  status        text not null default 'queued'
                check (status in ('queued','planning','in_progress','awaiting_approval',
                                  'in_review','blocked','done','rejected','cancelled','failed')),
  risk_level    text not null default 'low'
                check (risk_level in ('low','medium','high','critical')),
  metadata      jsonb not null default '{}'::jsonb,      -- structured task context
  created_by    text,                                    -- operator label (email)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists dev_tasks_status_idx on public.dev_tasks (status, created_at desc);
comment on table public.dev_tasks is
  'AI Dev Command Center: software-development tasks the operator gives the AI agent team. Superadmin-only.';

-- =============================================================================
-- 2. dev_agents — the AI agent roster (role, system prompt, tools, restrictions)
-- =============================================================================
create table if not exists public.dev_agents (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,                   -- stable slug, e.g. 'dev-manager'
  name           text not null,
  role           text not null,                          -- short role line
  description    text,
  system_prompt  text,                                   -- the agent's operating instructions
  allowed_tools  jsonb not null default '[]'::jsonb,     -- ['read','plan','draft_code', ...]
  restrictions   jsonb not null default '[]'::jsonb,     -- ['no_deploy','no_migrate', ...]
  model          text,                                   -- preferred model id (optional)
  is_manager     boolean not null default false,
  sort_order     int not null default 100,
  status         text not null default 'active'
                 check (status in ('active','inactive')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.dev_agents is
  'AI Dev Command Center: agent profiles — role, system prompt, allowed tools and restrictions. Superadmin-only.';

-- =============================================================================
-- 3. dev_agent_runs — one agent execution tied to a task
-- =============================================================================
create table if not exists public.dev_agent_runs (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.dev_tasks(id) on delete cascade,
  agent_id     uuid references public.dev_agents(id) on delete set null,
  phase        text not null default 'plan'
               check (phase in ('plan','design','recommend','draft','test','review','document','other')),
  status       text not null default 'queued'
               check (status in ('queued','running','succeeded','failed','cancelled')),
  input        jsonb not null default '{}'::jsonb,
  output       jsonb not null default '{}'::jsonb,        -- structured agent output
  model        text,
  tokens_used  int,
  error        text,
  started_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists dev_agent_runs_task_idx on public.dev_agent_runs (task_id, created_at desc);
comment on table public.dev_agent_runs is
  'AI Dev Command Center: each agent execution against a task (phase, status, structured output). Superadmin-only.';

-- =============================================================================
-- 4. dev_agent_messages — agent thoughts, outputs, and timeline messages
-- =============================================================================
create table if not exists public.dev_agent_messages (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid references public.dev_agent_runs(id) on delete cascade,
  task_id     uuid references public.dev_tasks(id) on delete cascade,
  agent_id    uuid references public.dev_agents(id) on delete set null,
  role        text not null default 'assistant'
              check (role in ('system','user','assistant','tool','thought')),
  content     text,
  structured  jsonb not null default '{}'::jsonb,         -- structured response payload
  seq         int,                                        -- ordering within a run
  created_at  timestamptz not null default now()
);
create index if not exists dev_agent_messages_run_idx on public.dev_agent_messages (run_id, seq);
create index if not exists dev_agent_messages_task_idx on public.dev_agent_messages (task_id, created_at);
comment on table public.dev_agent_messages is
  'AI Dev Command Center: agent thoughts, structured outputs and timeline messages. Superadmin-only.';

-- =============================================================================
-- 5. dev_artifacts — generated plans, SQL drafts, code drafts, docs, summaries
-- =============================================================================
create table if not exists public.dev_artifacts (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.dev_tasks(id) on delete cascade,
  run_id      uuid references public.dev_agent_runs(id) on delete set null,
  kind        text not null
              check (kind in ('plan','design','sql_draft','code_draft','doc','summary','test_plan','other')),
  title       text,
  path        text,                                       -- proposed file path (drafts only)
  content     text,                                       -- the draft text (code/sql/doc)
  structured  jsonb not null default '{}'::jsonb,
  status      text not null default 'draft'
              check (status in ('draft','proposed','approved','rejected','applied','superseded')),
  version     int not null default 1,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists dev_artifacts_task_idx on public.dev_artifacts (task_id, created_at desc);
comment on table public.dev_artifacts is
  'AI Dev Command Center: agent-generated DRAFTS (plans, SQL, code, docs). Never applied without approval. Superadmin-only.';

-- =============================================================================
-- 6. dev_file_change_plans — proposed file changes BEFORE they are applied
-- =============================================================================
create table if not exists public.dev_file_change_plans (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.dev_tasks(id) on delete cascade,
  artifact_id  uuid references public.dev_artifacts(id) on delete set null,
  file_path    text not null,
  change_type  text not null default 'modify'
               check (change_type in ('create','modify','delete','rename')),
  language     text,
  diff         text,                                      -- proposed diff / new content
  rationale    text,
  risk_level   text not null default 'medium'
               check (risk_level in ('low','medium','high','critical')),
  status       text not null default 'proposed'
               check (status in ('proposed','approved','rejected','applied')),
  applied_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists dev_file_change_plans_task_idx on public.dev_file_change_plans (task_id, status);
comment on table public.dev_file_change_plans is
  'AI Dev Command Center: proposed file changes (diff + rationale + risk) awaiting approval before apply. Superadmin-only.';

-- =============================================================================
-- 7. dev_code_reviews — AI code-review results
-- =============================================================================
create table if not exists public.dev_code_reviews (
  id                 uuid primary key default gen_random_uuid(),
  task_id            uuid not null references public.dev_tasks(id) on delete cascade,
  run_id             uuid references public.dev_agent_runs(id) on delete set null,
  artifact_id        uuid references public.dev_artifacts(id) on delete set null,
  reviewer_agent_id  uuid references public.dev_agents(id) on delete set null,
  summary            text,
  findings           jsonb not null default '[]'::jsonb,  -- [{file,line,severity,note}]
  verdict            text not null default 'pending'
                     check (verdict in ('approved','changes_requested','rejected','pending')),
  risk_level         text not null default 'low'
                     check (risk_level in ('low','medium','high','critical')),
  status             text not null default 'open'
                     check (status in ('open','resolved')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists dev_code_reviews_task_idx on public.dev_code_reviews (task_id, created_at desc);
comment on table public.dev_code_reviews is
  'AI Dev Command Center: AI code-review results (findings, verdict, risk). Superadmin-only.';

-- =============================================================================
-- 8. dev_test_results — test, lint, typecheck and QA results
-- =============================================================================
create table if not exists public.dev_test_results (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.dev_tasks(id) on delete cascade,
  run_id      uuid references public.dev_agent_runs(id) on delete set null,
  kind        text not null default 'unit'
              check (kind in ('unit','integration','system','lint','typecheck','qa','other')),
  status      text not null default 'pending'
              check (status in ('passed','failed','error','skipped','pending')),
  summary     text,
  passed      int not null default 0,
  failed      int not null default 0,
  skipped     int not null default 0,
  details     jsonb not null default '{}'::jsonb,
  log         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists dev_test_results_task_idx on public.dev_test_results (task_id, created_at desc);
comment on table public.dev_test_results is
  'AI Dev Command Center: test/lint/typecheck/QA results tied to a task. Superadmin-only.';

-- =============================================================================
-- 9. dev_security_reviews — security review findings
-- =============================================================================
create table if not exists public.dev_security_reviews (
  id                 uuid primary key default gen_random_uuid(),
  task_id            uuid not null references public.dev_tasks(id) on delete cascade,
  run_id             uuid references public.dev_agent_runs(id) on delete set null,
  reviewer_agent_id  uuid references public.dev_agents(id) on delete set null,
  summary            text,
  findings           jsonb not null default '[]'::jsonb,  -- [{category,severity,note}]
  risk_level         text not null default 'low'
                     check (risk_level in ('low','medium','high','critical')),
  verdict            text not null default 'pending'
                     check (verdict in ('pass','fail','needs_changes','pending')),
  status             text not null default 'open'
                     check (status in ('open','resolved')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists dev_security_reviews_task_idx on public.dev_security_reviews (task_id, created_at desc);
comment on table public.dev_security_reviews is
  'AI Dev Command Center: security-review findings (auth/RLS/secrets/injection). Superadmin-only.';

-- =============================================================================
-- 10. dev_experience_reviews — UX / plain-English / accessibility review results
-- =============================================================================
create table if not exists public.dev_experience_reviews (
  id                 uuid primary key default gen_random_uuid(),
  task_id            uuid not null references public.dev_tasks(id) on delete cascade,
  run_id             uuid references public.dev_agent_runs(id) on delete set null,
  reviewer_agent_id  uuid references public.dev_agents(id) on delete set null,
  perspective        text not null default 'ux'
                     check (perspective in ('ux','plain_english','accessibility','onboarding','simplification','other')),
  summary            text,
  findings           jsonb not null default '[]'::jsonb,
  score              int,                                 -- optional 0-100
  verdict            text not null default 'pending'
                     check (verdict in ('approved','changes_requested','rejected','pending')),
  status             text not null default 'open'
                     check (status in ('open','resolved')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists dev_experience_reviews_task_idx on public.dev_experience_reviews (task_id, created_at desc);
comment on table public.dev_experience_reviews is
  'AI Dev Command Center: human-experience reviews (UX, plain-English, a11y, onboarding, simplification). Superadmin-only.';

-- =============================================================================
-- 11. dev_approvals — human approval requests + decisions (THE SAFETY GATE)
-- =============================================================================
-- Every dangerous action becomes a pending row here and STOPS until a superadmin
-- decides. approval_type covers the full dangerous-action set. A generic
-- target_type/target_id points at the artifact/file-change/deployment in question
-- (no hard FK, to avoid table-order cycles).
create table if not exists public.dev_approvals (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid references public.dev_tasks(id) on delete cascade,
  approval_type   text not null
                  check (approval_type in ('database_change','auth_permission_change','file_write',
                                           'github_branch','pull_request','deployment',
                                           'production_release','delete_action','ai_tool_permission_change')),
  target_type     text,                                   -- e.g. 'dev_artifacts','dev_file_change_plans'
  target_id       uuid,
  risk_level      text not null default 'high'
                  check (risk_level in ('low','medium','high','critical')),
  summary         text not null,
  proposed_change text,                                   -- diff / SQL / config being approved
  details         jsonb not null default '{}'::jsonb,
  status          text not null default 'pending'
                  check (status in ('pending','approved','rejected','expired','cancelled')),
  requested_by    text,                                   -- agent key/name that requested it
  decided_by      text,                                   -- operator who decided
  decided_at      timestamptz,
  decision_note   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists dev_approvals_status_idx on public.dev_approvals (status, created_at desc);
create index if not exists dev_approvals_task_idx on public.dev_approvals (task_id);
comment on table public.dev_approvals is
  'AI Dev Command Center: human approval gate. Dangerous actions wait here until a superadmin approves/rejects. Superadmin-only.';

-- =============================================================================
-- 12. dev_deployments — branch, PR, preview, and release info
-- =============================================================================
create table if not exists public.dev_deployments (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid references public.dev_tasks(id) on delete cascade,
  approval_id      uuid references public.dev_approvals(id) on delete set null,
  branch           text,
  pull_request_url text,
  pr_number        int,
  preview_url      text,
  release_tag      text,
  commit_sha       text,
  environment      text not null default 'preview'
                   check (environment in ('preview','staging','production')),
  status           text not null default 'planned'
                   check (status in ('planned','branch_created','pr_open','preview_ready',
                                     'merged','released','failed','rolled_back')),
  notes            text,
  created_by       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists dev_deployments_task_idx on public.dev_deployments (task_id, created_at desc);
comment on table public.dev_deployments is
  'AI Dev Command Center: deployment records (branch/PR/preview/release). Tied to an approval. Superadmin-only.';

-- =============================================================================
-- 13. dev_audit_log — append-only record of every important action
-- =============================================================================
create table if not exists public.dev_audit_log (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid references public.dev_tasks(id) on delete set null,
  actor_type  text not null default 'agent'
              check (actor_type in ('agent','human','system')),
  actor_id    text,                                       -- agent key / operator email
  agent_id    uuid references public.dev_agents(id) on delete set null,
  action      text not null,
  entity      text,
  entity_id   text,
  risk_level  text check (risk_level in ('low','medium','high','critical')),
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists dev_audit_log_task_idx on public.dev_audit_log (task_id, created_at desc);
create index if not exists dev_audit_log_time_idx on public.dev_audit_log (created_at desc);
comment on table public.dev_audit_log is
  'AI Dev Command Center: append-only audit of every agent/human/system action. Superadmin-only.';

-- =============================================================================
-- 14. dev_agent_memory — approved/rejected patterns, preferences, lessons
-- =============================================================================
create table if not exists public.dev_agent_memory (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid references public.dev_agents(id) on delete cascade,  -- null = global memory
  task_id     uuid references public.dev_tasks(id) on delete set null,
  kind        text not null default 'lesson_learned'
              check (kind in ('approved_pattern','rejected_pattern','user_preference','lesson_learned')),
  title       text,
  content     text,
  structured  jsonb not null default '{}'::jsonb,
  tags        text[] not null default '{}',
  status      text not null default 'active'
              check (status in ('active','archived')),
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists dev_agent_memory_agent_idx on public.dev_agent_memory (agent_id, kind);
comment on table public.dev_agent_memory is
  'AI Dev Command Center: durable agent memory — approved/rejected patterns, user preferences, lessons learned. Superadmin-only.';

-- =============================================================================
-- 15. dev_tool_permissions — what tools each agent may use
-- =============================================================================
create table if not exists public.dev_tool_permissions (
  id                uuid primary key default gen_random_uuid(),
  agent_id          uuid not null references public.dev_agents(id) on delete cascade,
  tool              text not null,                        -- e.g. 'draft_sql','run_tests','open_pr'
  allowed           boolean not null default true,
  requires_approval boolean not null default false,       -- true → routes through dev_approvals
  scope             jsonb not null default '{}'::jsonb,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (agent_id, tool)
);
create index if not exists dev_tool_permissions_agent_idx on public.dev_tool_permissions (agent_id);
comment on table public.dev_tool_permissions is
  'AI Dev Command Center: per-agent tool allow-list (and which tools require human approval). Superadmin-only.';

-- =============================================================================
-- 16. dev_feedback — operator feedback on screens, AI mistakes, improvements
-- =============================================================================
create table if not exists public.dev_feedback (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid references public.dev_tasks(id) on delete set null,
  screen       text,                                      -- route / screen the feedback is about
  category     text not null default 'improvement'
               check (category in ('confusing_screen','wrong_recommendation','improvement','bug','other')),
  risk_level   text not null default 'low'
               check (risk_level in ('low','medium','high','critical')),
  message      text not null,
  status       text not null default 'open'
               check (status in ('open','triaged','in_progress','resolved','wontfix')),
  created_by   text,
  resolved_by  text,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists dev_feedback_status_idx on public.dev_feedback (status, created_at desc);
comment on table public.dev_feedback is
  'AI Dev Command Center: operator feedback (confusing screens, wrong AI recommendations, improvement requests). Superadmin-only.';

-- =============================================================================
-- RLS — superadmin-only on every dev_* table + updated_at triggers
-- =============================================================================
-- One policy shape everywhere: only a Reliance superadmin (is_reliance_admin())
-- can read or write. dev_audit_log has updated_at omitted (append-only), so it
-- gets no trigger. Everything is idempotent (drop policy if exists / if not
-- exists) so re-running the migration is safe.
do $$
declare
  t text;
  with_updated_at text[] := array[
    'dev_tasks','dev_agents','dev_agent_runs','dev_artifacts','dev_file_change_plans',
    'dev_code_reviews','dev_test_results','dev_security_reviews','dev_experience_reviews',
    'dev_approvals','dev_deployments','dev_agent_memory','dev_tool_permissions','dev_feedback'
  ];
  all_tables text[] := array[
    'dev_tasks','dev_agents','dev_agent_runs','dev_agent_messages','dev_artifacts',
    'dev_file_change_plans','dev_code_reviews','dev_test_results','dev_security_reviews',
    'dev_experience_reviews','dev_approvals','dev_deployments','dev_audit_log',
    'dev_agent_memory','dev_tool_permissions','dev_feedback'
  ];
begin
  -- RLS + superadmin policy for ALL dev_* tables
  foreach t in array all_tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_superadmin on public.%I;', t, t);
    execute format(
      'create policy %I_superadmin on public.%I for all '
      || 'using (public.is_reliance_admin()) with check (public.is_reliance_admin());', t, t);
  end loop;

  -- updated_at trigger only where the column exists
  foreach t in array with_updated_at loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I;', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I '
      || 'for each row execute function public.ops_set_updated_at();', t, t);
  end loop;
end $$;

-- =============================================================================
-- SEED — the 19 default agents (idempotent on the unique key)
-- =============================================================================
-- Embedded in the migration (not supabase/seed.sql) because prod migrations do
-- NOT run seed.sql — this is the only way the roster reaches a real database.
-- on conflict (key) do nothing → re-running never duplicates or overwrites
-- operator edits.
insert into public.dev_agents (key, name, role, description, system_prompt, allowed_tools, restrictions, is_manager, sort_order)
values
  ('dev-manager', 'Dev Manager Agent', 'Orchestration & delivery lead',
   'Breaks a task into phases, assigns the right agents, and shepherds it to a human-approved result.',
   'You are the Dev Manager. Decompose the task, sequence the specialist agents, and never let a dangerous action proceed without an approved dev_approvals row. You coordinate; you do not write production code or apply changes.',
   '["read","plan","assign","summarize"]'::jsonb,
   '["no_deploy","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   true, 10),

  ('product-requirements', 'Product Requirements Agent', 'Requirements & acceptance criteria',
   'Turns a rough task into clear requirements, scope, and acceptance criteria.',
   'You are the Product Requirements agent. Produce crisp requirements and acceptance criteria. You only write plans and docs — never code, SQL, or production changes.',
   '["read","plan","draft_doc"]'::jsonb,
   '["no_deploy","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   false, 20),

  ('platform-architect', 'Platform Architect Agent', 'Architecture & file impact',
   'Recommends the design, the files to add/modify, and the risks — as drafts only.',
   'You are the Platform Architect. Recommend an approach, the impacted files, and risks. You output recommendations and drafts only; you never apply changes.',
   '["read","plan","recommend_files","draft_doc"]'::jsonb,
   '["no_deploy","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   false, 30),

  ('ui-ux', 'UI/UX Agent', 'Interface & interaction design',
   'Proposes UI layouts, flows, and component structure consistent with the existing design system.',
   'You are the UI/UX agent. Propose interface and interaction designs that match the existing platform style. Drafts and recommendations only.',
   '["read","plan","draft_doc","draft_code"]'::jsonb,
   '["no_deploy","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   false, 40),

  ('frontend', 'Frontend Agent', 'React / Next.js implementation drafts',
   'Generates frontend code drafts (React/Next.js/Tailwind) for proposed file changes.',
   'You are the Frontend agent. Produce React/Next.js/Tailwind code DRAFTS against recommended files. Drafts go to dev_artifacts and require approval before any file write.',
   '["read","plan","draft_code"]'::jsonb,
   '["no_deploy","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   false, 50),

  ('backend-api', 'Backend/API Agent', 'Server & API implementation drafts',
   'Generates backend/API code drafts (route handlers, server actions, lib functions).',
   'You are the Backend/API agent. Produce server-side code DRAFTS. Never write files, deploy, or touch auth/RLS — those route through dev_approvals.',
   '["read","plan","draft_code"]'::jsonb,
   '["no_deploy","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   false, 60),

  ('database-supabase', 'Database/Supabase Agent', 'Schema & migration drafts',
   'Drafts SQL migrations and schema changes with a plain-English explanation — never runs them.',
   'You are the Database/Supabase agent. Draft SQL/migrations and explain them plainly. You NEVER run a migration or alter RLS; every DB change becomes a database_change approval.',
   '["read","plan","draft_sql"]'::jsonb,
   '["no_deploy","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   false, 70),

  ('ai-integration', 'AI Integration Agent', 'AI engine & gateway wiring',
   'Designs how a feature uses the existing AI engine/gateway (providers, telemetry, caching).',
   'You are the AI Integration agent. Reuse the existing lib/ai engine and gateway. Produce wiring designs and code drafts only.',
   '["read","plan","draft_code","draft_doc"]'::jsonb,
   '["no_deploy","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   false, 80),

  ('qa-test', 'QA/Test Agent', 'Tests, lint, typecheck, QA',
   'Writes test plans and test-code drafts; records lint/typecheck/QA results.',
   'You are the QA/Test agent. Produce test plans and vitest/system-test DRAFTS and record results in dev_test_results. You do not run anything against production.',
   '["read","plan","draft_code","record_test_result"]'::jsonb,
   '["no_deploy","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   false, 90),

  ('security-permissions', 'Security/Permissions Agent', 'Security & RLS review',
   'Reviews changes for auth, RLS, secrets, and injection risks; can block on critical findings.',
   'You are the Security/Permissions agent. Review for auth/RLS/secret/injection risk and record findings in dev_security_reviews. Flag anything touching auth or RLS as requiring an auth_permission_change approval.',
   '["read","review","record_security_finding"]'::jsonb,
   '["no_deploy","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   false, 100),

  ('devops-release', 'DevOps/Release Agent', 'Branch, PR, preview, release',
   'Prepares branch/PR/preview/release plans — every action gated by a human approval.',
   'You are the DevOps/Release agent. Plan branches, PRs, previews and releases and record them in dev_deployments. Every github_branch/pull_request/deployment/production_release action requires an approved dev_approvals row first.',
   '["read","plan","prepare_deployment"]'::jsonb,
   '["no_deploy_without_approval","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   false, 110),

  ('documentation', 'Documentation Agent', 'Docs & SOP updates',
   'Drafts documentation and SOP updates for a change.',
   'You are the Documentation agent. Draft docs/SOP updates as artifacts. Drafts only — publishing is a human step.',
   '["read","plan","draft_doc"]'::jsonb,
   '["no_deploy","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   false, 120),

  ('human-experience', 'Human Experience Agent', 'End-to-end experience review',
   'Reviews the change from a real operator''s point of view and flags friction.',
   'You are the Human Experience agent. Walk the change as a real user would and record friction in dev_experience_reviews. Review only.',
   '["read","review","record_experience_finding"]'::jsonb,
   '["no_deploy","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   false, 130),

  ('plain-english', 'Plain-English Agent', 'Clarity & plain language',
   'Rewrites UI copy, labels, and explanations into plain language.',
   'You are the Plain-English agent. Make copy and explanations clear and jargon-free. Drafts only.',
   '["read","review","draft_doc"]'::jsonb,
   '["no_deploy","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   false, 140),

  ('workflow-simplification', 'Workflow Simplification Agent', 'Reduce steps & friction',
   'Finds ways to cut steps and simplify flows without losing capability.',
   'You are the Workflow Simplification agent. Recommend simpler flows in dev_experience_reviews. Recommendations only.',
   '["read","review","record_experience_finding"]'::jsonb,
   '["no_deploy","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   false, 150),

  ('onboarding', 'Onboarding Agent', 'First-run & guidance',
   'Designs onboarding, empty states, and first-run guidance for new features.',
   'You are the Onboarding agent. Design first-run guidance and empty states. Drafts and recommendations only.',
   '["read","plan","draft_doc","draft_code"]'::jsonb,
   '["no_deploy","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   false, 160),

  ('accessibility', 'Accessibility Agent', 'WCAG & a11y review',
   'Reviews for accessibility (contrast, keyboard, ARIA, screen readers).',
   'You are the Accessibility agent. Review for WCAG/a11y issues and record them in dev_experience_reviews (perspective=accessibility). Review only.',
   '["read","review","record_experience_finding"]'::jsonb,
   '["no_deploy","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   false, 170),

  ('performance', 'Performance Agent', 'Speed & efficiency review',
   'Reviews for performance (queries, bundle size, render cost) and suggests improvements.',
   'You are the Performance agent. Identify performance risks and suggest improvements as recommendations/drafts. No production changes.',
   '["read","review","draft_doc"]'::jsonb,
   '["no_deploy","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   false, 180),

  ('admin-support', 'Admin Support Agent', 'Operator help & triage',
   'Helps the operator use the Command Center, triages feedback, and explains agent output.',
   'You are the Admin Support agent. Help the operator, triage dev_feedback, and explain what other agents produced. Read and summarize only.',
   '["read","summarize","triage_feedback"]'::jsonb,
   '["no_deploy","no_migrate","no_file_write","no_auth_change","no_rls_change","no_delete"]'::jsonb,
   false, 190)
on conflict (key) do nothing;
