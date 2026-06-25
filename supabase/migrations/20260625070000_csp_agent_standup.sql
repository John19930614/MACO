-- =============================================================================
-- Daily Agent Standup — GUS  ×  EHS Records Validation Agent
-- =============================================================================
-- A platform-level "meeting" where GUS (Global Unified Safety Intelligence —
-- platform-wide health, P-Engine, module weakness) and the CSP-informed EHS
-- Records Validation Agent (validation runs, findings, review backlog, learned
-- memory, qualification coverage) share what each is seeing, debate it, and
-- surface GAPS + improvement ACTION ITEMS the operator should act on.
--
-- Runs once a day (Vercel cron) or on demand from the superadmin Standup panel.
-- Platform governance artifact — superadmin (is_reliance_admin) only.
-- Additive and reversible.
-- =============================================================================

create table if not exists public.csp_agent_meetings (
  id            uuid primary key default gen_random_uuid(),
  meeting_date  date not null default current_date,
  title         text not null default 'Daily Agent Standup',
  status        text not null default 'completed',
  participants  text[] not null default array['GUS','EHS Records Validation Agent']::text[],

  gus_briefing  text,            -- what GUS brought to the table
  ehs_briefing  text,            -- what the EHS agent brought
  exchange      jsonb not null default '[]'::jsonb,   -- [{speaker, message}]
  gaps_found    jsonb not null default '[]'::jsonb,   -- [{title, detail, severity}]
  action_items  jsonb not null default '[]'::jsonb,   -- [{item, owner, priority}]
  shared_summary text,           -- the agreed-on summary / headline
  metrics       jsonb not null default '{}'::jsonb,   -- the data snapshot they discussed

  model         text,
  generated_by  text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_csp_meetings_date on public.csp_agent_meetings(meeting_date desc, created_at desc);

alter table public.csp_agent_meetings enable row level security;
drop policy if exists admin_all on public.csp_agent_meetings;
create policy admin_all on public.csp_agent_meetings for all to authenticated
  using ((select private.is_reliance_admin()))
  with check ((select private.is_reliance_admin()));
-- (The daily cron writes with the service-role key, which bypasses RLS.)
