-- =============================================================================
-- EHS Validation Agent — Spec build, Phase 2
-- Escalation Matrix, Model/Rule Version History, Reviewer Override Log.
-- Additive and reversible.
-- =============================================================================

-- ── Escalation matrix (who to escalate to, and how fast) ──────────────────────
create table if not exists public.ehs_escalation_matrix (
  id          uuid primary key default gen_random_uuid(),
  condition_key text not null unique,
  label       text not null,
  escalate_to text[] not null default array[]::text[],
  urgency     text not null default 'normal',  -- immediate | same_day | normal
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_ehs_escalation_updated_at before update on public.ehs_escalation_matrix
  for each row execute function public.csp_set_updated_at();

insert into public.ehs_escalation_matrix (condition_key, label, escalate_to, urgency) values
  ('fatality_hospitalization_amputation_eye_loss','Fatality, hospitalization, amputation, or eye loss', array['HSE Director','Executive Leadership','Legal'], 'immediate'),
  ('possible_osha_recordable','Possible OSHA recordable', array['Safety Manager','HSE Director'], 'same_day'),
  ('sif_potential','SIF potential', array['Safety Manager','HSE Director'], 'same_day'),
  ('high_risk_work_issue','High-risk work issue', array['Safety Manager'], 'same_day'),
  ('missing_evidence','Missing evidence', array['Record Owner'], 'normal'),
  ('repeat_contractor_issue','Repeat contractor issue', array['Safety Manager','Contractor Manager'], 'same_day'),
  ('legal_interpretation_required','Legal interpretation required', array['HSE Director','Legal'], 'same_day')
on conflict (condition_key) do nothing;

-- ── Model / rule version history ──────────────────────────────────────────────
create table if not exists public.ehs_model_rule_versions (
  id              uuid primary key default gen_random_uuid(),
  agent_name      text not null,
  agent_version   text not null,
  ai_model_name   text,
  ai_model_version text,
  rule_version    text not null,
  change_summary  text,
  changed_by      uuid,
  changed_by_name text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

insert into public.ehs_model_rule_versions (agent_name, agent_version, ai_model_name, ai_model_version, rule_version, change_summary, changed_by_name, active) values
  ('Senior EHS Record Validation Agent','csp-v1.0','claude-sonnet-4-6','sonnet-4-6','rules-v1.0',
   'Initial CSP-informed validation ruleset: required-human-review settings, 14 autonomy blockers, 7 evidence-rule sets, 14 qualifications, confidence thresholds, memory-bank learning.',
   'Reliance Platform', true)
on conflict do nothing;

-- ── Reviewer override log (human decisions that diverge from the AI) ──────────
create table if not exists public.ehs_reviewer_override_log (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  record_id       uuid,
  record_type     text not null,
  validation_run_id uuid references public.csp_validation_runs(id) on delete set null,
  ai_recommendation text,
  ai_status       text,
  human_decision  text not null,
  override_reason text not null,
  reviewer_id     uuid,
  reviewer_name   text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_ehs_override_created on public.ehs_reviewer_override_log(created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['ehs_escalation_matrix','ehs_model_rule_versions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists ref_read on public.%I', t);
    execute format('create policy ref_read on public.%I for select to authenticated using (true)', t);
    execute format('drop policy if exists ref_admin_write on public.%I', t);
    execute format('create policy ref_admin_write on public.%I for all to authenticated using ((select private.is_reliance_admin())) with check ((select private.is_reliance_admin()))', t);
  end loop;
end $$;

-- Override log is tenant business data: tenant members + admin (mirror csp pattern).
alter table public.ehs_reviewer_override_log enable row level security;
drop policy if exists tenant_crud on public.ehs_reviewer_override_log;
create policy tenant_crud on public.ehs_reviewer_override_log for all to authenticated
  using ((tenant_id = (select private.auth_tenant_id())) or (select private.is_reliance_admin()))
  with check ((tenant_id = (select private.auth_tenant_id())) or (select private.is_reliance_admin()));
