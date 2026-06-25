-- =============================================================================
-- CSP Validation Agent — Guardrails, Qualifications/Skills, and Memory Bank
-- =============================================================================
-- Extends the CSP agent (migration 20260625050000) so it can GROW under control:
--
--  • csp_agent_qualifications — certifications / skills / qualifications granted
--    to the agent. A qualification can grant AUTONOMY for specific record types
--    (the agent may auto-accept clean records of that type). Superadmin grants
--    and revokes them — this is how you widen what the agent is trusted to do.
--
--  • csp_guardrails — toggles that govern the agent: whether it learns from
--    approvals / rejections, whether it applies learned memory, whether autonomy
--    requires a qualification, and the minimum confidence for autonomy. A locked
--    guardrail (never auto-accept a recordable) is platform-enforced.
--
--  • csp_agent_memory — lessons the agent accumulates from human review sign-offs
--    (only when the matching learning guardrail is ON) plus manual entries. These
--    nudge future validations (raise/lower confidence, escalate, or annotate).
--
-- Additive and reversible. RLS follows the established pattern.
-- =============================================================================

-- ── Guardrails (reference config; read-all, admin-write) ──────────────────────
create table if not exists public.csp_guardrails (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  label       text not null,
  description text,
  enabled     boolean not null default true,
  threshold   numeric,                       -- optional numeric parameter (e.g. min confidence)
  locked      boolean not null default false, -- platform-enforced, cannot be turned off in UI
  updated_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_csp_guardrails_updated_at before update on public.csp_guardrails
  for each row execute function public.csp_set_updated_at();

-- ── Qualifications / certifications / skills (reference; read-all, admin-write) ─
create table if not exists public.csp_agent_qualifications (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'certification' check (kind in ('certification','skill','qualification')),
  code        text not null unique,
  title       text not null,
  description text,
  scope_record_types public.csp_record_type[] not null default array[]::public.csp_record_type[],
  grants_autonomy boolean not null default false,
  status      text not null default 'active' check (status in ('active','revoked','expired')),
  granted_by  text,
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_csp_quals_status on public.csp_agent_qualifications(status);
create trigger trg_csp_quals_updated_at before update on public.csp_agent_qualifications
  for each row execute function public.csp_set_updated_at();

-- ── Memory bank (tenant-scoped + global lessons) ──────────────────────────────
create table if not exists public.csp_agent_memory (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references public.tenants(id) on delete cascade, -- null = global lesson
  scope         text not null default 'global' check (scope in ('global','tenant')),
  record_type   public.csp_record_type,
  finding_category text,
  directive     text not null default 'note' check (directive in ('raise_confidence','lower_confidence','escalate','note')),
  lesson        text not null,
  weight        numeric not null default 3,
  source        text not null default 'human_decision' check (source in ('human_decision','manual')),
  source_run_id uuid references public.csp_validation_runs(id) on delete set null,
  source_decision_id uuid references public.csp_review_decisions(id) on delete set null,
  times_applied integer not null default 0,
  active        boolean not null default true,
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_csp_memory_lookup on public.csp_agent_memory(record_type, active);
create index if not exists idx_csp_memory_tenant on public.csp_agent_memory(tenant_id);
create trigger trg_csp_memory_updated_at before update on public.csp_agent_memory
  for each row execute function public.csp_set_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['csp_guardrails','csp_agent_qualifications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists ref_read on public.%I', t);
    execute format('create policy ref_read on public.%I for select to authenticated using (true)', t);
    execute format('drop policy if exists ref_admin_write on public.%I', t);
    execute format(
      'create policy ref_admin_write on public.%I for all to authenticated '
      || 'using ((select private.is_reliance_admin())) with check ((select private.is_reliance_admin()))',
      t);
  end loop;
end $$;

-- Memory: global lessons (tenant_id null) readable by all; tenant lessons by that
-- tenant; admin reads/writes all; tenant members may write their own tenant rows.
alter table public.csp_agent_memory enable row level security;
drop policy if exists csp_memory_read on public.csp_agent_memory;
create policy csp_memory_read on public.csp_agent_memory for select to authenticated
  using (tenant_id is null or tenant_id = (select private.auth_tenant_id()) or (select private.is_reliance_admin()));
drop policy if exists csp_memory_write on public.csp_agent_memory;
create policy csp_memory_write on public.csp_agent_memory for all to authenticated
  using ((tenant_id = (select private.auth_tenant_id())) or (select private.is_reliance_admin()))
  with check ((tenant_id = (select private.auth_tenant_id())) or (select private.is_reliance_admin()));

-- =============================================================================
-- SEED
-- =============================================================================
insert into public.csp_guardrails (key, label, description, enabled, threshold, locked) values
  ('learn_from_approvals', 'Learn from approvals',
   'When a reviewer approves a record, record a lesson the agent can apply to similar future records.', true, null, false),
  ('learn_from_rejections', 'Learn from rejections',
   'When a reviewer rejects or escalates a record, record a lesson so the agent treats similar cases more cautiously.', true, null, false),
  ('apply_learned_memory', 'Apply learned memory',
   'Allow the agent to use its memory bank to adjust confidence, escalate, or annotate new validations.', true, null, false),
  ('autonomy_requires_qualification', 'Autonomy requires qualification',
   'The agent may only auto-accept a record type it holds an active qualification granting autonomy for. Otherwise it escalates to human review.', true, null, false),
  ('min_autonomy_confidence', 'Minimum confidence for autonomy',
   'The agent may only auto-accept when its confidence is at or above this percentage; below it, the record goes to human review.', true, 85, false),
  ('never_auto_accept_recordable', 'Never auto-accept a possible recordable',
   'A possible OSHA recordable / reportable case is ALWAYS routed to a credentialed human, regardless of other settings. Platform-enforced.', true, null, true)
on conflict (key) do nothing;

insert into public.csp_agent_qualifications (kind, code, title, description, scope_record_types, grants_autonomy, granted_by) values
  ('certification', 'OSHA-1904-RECORDKEEPING', 'OSHA Injury & Illness Recordkeeping',
   'Competency to evaluate 29 CFR 1904 recordability criteria. Does NOT grant autonomy — recordable decisions always require a human.',
   array['incident']::public.csp_record_type[], false, 'Reliance Platform'),
  ('certification', 'NIOSH-HIERARCHY-OF-CONTROLS', 'NIOSH Hierarchy of Controls',
   'Competency to assess corrective-action control strength (elimination → PPE).',
   array['incident','audit_finding','corrective_action']::public.csp_record_type[], false, 'Reliance Platform'),
  ('skill', 'INCIDENT-COMPLETENESS', 'Incident record completeness review',
   'Validate required fields and evidence on incident records. Grants autonomy to auto-accept complete, low-risk incident records.',
   array['incident']::public.csp_record_type[], true, 'Reliance Platform'),
  ('skill', 'AUDIT-FINDING-REVIEW', 'Audit finding completeness review',
   'Validate required fields and evidence on audit findings. Grants autonomy to auto-accept complete, low-risk findings.',
   array['audit_finding']::public.csp_record_type[], true, 'Reliance Platform')
on conflict (code) do nothing;

-- =============================================================================
-- END
-- =============================================================================
