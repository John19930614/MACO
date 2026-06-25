-- =============================================================================
-- Agent Standup — standing agenda checklist + closing open-thoughts reflections
-- =============================================================================
-- Adds two columns to csp_agent_meetings so each daily standup walks a fixed
-- agenda (every key item is checked off with a note) and ends with each agent's
-- own free reflection. Additive and reversible.
-- =============================================================================

alter table public.csp_agent_meetings
  add column if not exists agenda      jsonb not null default '[]'::jsonb,   -- [{key,title,covered,note}]
  add column if not exists reflections jsonb not null default '[]'::jsonb;   -- [{speaker,thought}]
