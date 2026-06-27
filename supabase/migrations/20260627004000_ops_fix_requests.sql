-- =============================================================================
-- Ops Console — ops_fix_requests (Code-Fix Agent approval queue)
-- =============================================================================
-- Backs the console "Fix Queue": the human-approval cockpit for the code-fix
-- bot. Flow: John logs a problem (or asks in chat) → Claude writes a proposal
-- (plain-English fix + diff + validation plan) → John APPROVES here → Claude
-- applies + validates + writes the result back. The console holds the approval
-- + audit record; the actual code edit/validation runs via Claude Code (a
-- browser can't edit/run code). AI proposes; the human approves — no code change
-- is applied without an approved row (blueprint "recommend/validate-only").
--
-- Superadmin-only, additive, reversible (drop the table). Same ops_* pattern.
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists public.ops_fix_requests (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,                 -- short name of the issue/fix
  problem           text,                          -- what's broken / the request (human)
  proposal          text,                          -- plain-English proposed fix (bot)
  diff              text,                          -- files touched / change summary (bot)
  validation_plan   text,                          -- what will be run to validate (bot)
  status            text not null default 'open'
                    check (status in ('open','proposed','approved','rejected','applied','validated','failed')),
  files_changed     jsonb not null default '[]'::jsonb,  -- after apply
  validation_result text,                          -- PASS/FAIL + summary, after validate
  decided_by        text,
  decided_at        timestamptz,
  decision_note     text,
  created_by        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists ops_fix_requests_status_idx on public.ops_fix_requests (status, created_at desc);

drop trigger if exists ops_fix_requests_set_updated_at on public.ops_fix_requests;
create trigger ops_fix_requests_set_updated_at before update on public.ops_fix_requests
  for each row execute function public.ops_set_updated_at();

alter table public.ops_fix_requests enable row level security;
drop policy if exists ops_fix_requests_superadmin on public.ops_fix_requests;
create policy ops_fix_requests_superadmin on public.ops_fix_requests for all
  using (public.is_reliance_admin()) with check (public.is_reliance_admin());
