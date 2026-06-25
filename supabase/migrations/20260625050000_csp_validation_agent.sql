-- =============================================================================
-- CSP-Informed EHS Records Validation Agent
-- =============================================================================
-- A background agent that validates EHS records for completeness, consistency,
-- evidence quality, risk, and regulatory triggers — and routes high-stakes or
-- low-confidence cases to a credentialed human reviewer on the superadmin side.
--
-- POSITIONING: this agent is NOT a licensed CSP and does not replace a qualified
-- EHS professional. It is "CSP-informed". High-risk, regulatory-sensitive,
-- reportable, or low-confidence records require human review.
--
-- BRIDGED, NOT PARALLEL: unlike the source schema this is adapted from, it does
-- NOT introduce its own companies/sites/records universe. Every row keys to the
-- live platform: tenant_id -> public.tenants, site_id -> public.sites, and a
-- polymorphic (source_type, source_id) pointer at real module rows
-- (incidents, audit_findings, audits, chemical_inventory, ...) exactly like the
-- existing ehs_ai_findings does.
--
-- RLS mirrors the live platform pattern exactly: a single tenant_crud ALL policy
-- using private.auth_tenant_id() / private.is_reliance_admin(). Reference tables
-- (rules, requirements, agent registry) are world-readable to authenticated
-- sessions but writable only by the Reliance superadmin.
--
-- Additive and reversible. To roll back: drop the csp_* tables and types.
-- =============================================================================

create extension if not exists pgcrypto;

-- ── updated_at helper (namespaced so it never clobbers an existing trigger fn) ──
create or replace function public.csp_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── Enum types (csp_-prefixed to avoid collision) ─────────────────────────────
do $$ begin
  create type public.csp_record_type as enum (
    'incident','near_miss','positive_observation','negative_observation',
    'audit_finding','inspection','training_record','permit','chemical_sds',
    'chemical_inventory','waste_record','equipment_inspection','dot_record',
    'contractor_record','corrective_action','other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.csp_risk_level as enum (
    'low','medium','high','critical','sif_potential','idlh_imminent_danger'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.csp_validation_status as enum (
    'accepted','accepted_with_minor_corrections','rejected_incomplete',
    'needs_human_review','potential_regulatory_issue',
    'potential_recordable_or_reportable','system_error'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.csp_review_status as enum (
    'not_required','pending','approved','approved_with_changes',
    'rejected','escalated','closed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.csp_rule_source as enum (
    'osha','epa','dot','state','client_requirement','company_policy',
    'site_rule','manufacturer_requirement','industry_standard','other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.csp_actor_type as enum (
    'user','ai_agent','human_reviewer','admin','system'
  );
exception when duplicate_object then null; end $$;

-- ── Agent registry (governance / positioning) ─────────────────────────────────
create table if not exists public.csp_agents (
  id            uuid primary key default gen_random_uuid(),
  agent_name    text not null unique,
  positioning   text not null default 'CSP-informed EHS Records Validation Agent. The AI is not a licensed CSP and does not replace a qualified EHS professional.',
  model_name    text,
  model_provider text,
  prompt_version text not null default 'csp-v1.0',
  system_prompt  text,
  human_review_rules jsonb not null default '{}'::jsonb,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_csp_agents_updated_at before update on public.csp_agents
  for each row execute function public.csp_set_updated_at();

-- ── Legal register (sources the rules cite) ───────────────────────────────────
create table if not exists public.csp_legal_sources (
  id              uuid primary key default gen_random_uuid(),
  source_name     text not null,
  source_type     public.csp_rule_source not null,
  jurisdiction    text,
  issuing_authority text,
  source_url      text,
  version_label   text not null default 'v1.0',
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(source_name, version_label)
);
create trigger trg_csp_legal_sources_updated_at before update on public.csp_legal_sources
  for each row execute function public.csp_set_updated_at();

-- ── Rule library (what the agent checks against) ──────────────────────────────
create table if not exists public.csp_rules (
  id              uuid primary key default gen_random_uuid(),
  legal_source_id uuid references public.csp_legal_sources(id) on delete set null,
  rule_code       text not null,
  rule_title      text not null,
  source_type     public.csp_rule_source not null,
  jurisdiction    text,
  citation        text,
  rule_summary    text,
  rule_text       text not null,
  decision_logic  jsonb not null default '{}'::jsonb,
  applies_to_record_types public.csp_record_type[] not null default array[]::public.csp_record_type[],
  required_fields jsonb not null default '[]'::jsonb,
  human_review_triggers jsonb not null default '[]'::jsonb,
  source_url      text,
  version_label   text not null default 'v1.0',
  active          boolean not null default true,
  created_by      text,
  approved_by     text,
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(rule_code, version_label)
);
create trigger trg_csp_rules_updated_at before update on public.csp_rules
  for each row execute function public.csp_set_updated_at();

-- Append-only snapshot of every rule version, for defensible change history.
create table if not exists public.csp_rule_versions (
  id            uuid primary key default gen_random_uuid(),
  rule_id       uuid not null references public.csp_rules(id) on delete cascade,
  version_label text not null,
  change_summary text,
  changed_by    text,
  rule_snapshot jsonb not null,
  created_at    timestamptz not null default now(),
  unique(rule_id, version_label)
);

-- ── Required-field configuration per record type ──────────────────────────────
create table if not exists public.csp_record_requirements (
  id              uuid primary key default gen_random_uuid(),
  record_type     public.csp_record_type not null,
  module_name     text not null,
  required_fields jsonb not null default '[]'::jsonb,
  recommended_fields jsonb not null default '[]'::jsonb,
  evidence_requirements jsonb not null default '[]'::jsonb,
  mandatory_human_review_conditions jsonb not null default '[]'::jsonb,
  version_label   text not null default 'v1.0',
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(record_type, module_name, version_label)
);
create trigger trg_csp_record_requirements_updated_at before update on public.csp_record_requirements
  for each row execute function public.csp_set_updated_at();

-- ── Validation runs (the durable background log) ──────────────────────────────
create table if not exists public.csp_validation_runs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  site_id       uuid references public.sites(id) on delete set null,

  source_type   text not null,                 -- 'incident', 'audit_finding', ...
  source_id     uuid,                           -- polymorphic; intentionally no FK
  record_type   public.csp_record_type not null,
  module_name   text not null,

  agent_name    text not null,
  agent_version text not null,
  model_name    text,
  model_provider text,
  prompt_version text not null,
  rule_library_version text,

  input_snapshot jsonb not null,
  input_hash    text generated always as (encode(digest(input_snapshot::text, 'sha256'), 'hex')) stored,

  validation_status public.csp_validation_status not null,
  risk_level    public.csp_risk_level not null,
  confidence_score numeric(5,2) check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 100)),

  rules_checked        jsonb not null default '[]'::jsonb,
  citations_used       jsonb not null default '[]'::jsonb,
  evidence_reviewed    jsonb not null default '[]'::jsonb,
  missing_fields       jsonb not null default '[]'::jsonb,
  inconsistencies_found jsonb not null default '[]'::jsonb,
  regulatory_triggers  jsonb not null default '[]'::jsonb,

  ai_summary    text,
  ai_reasoning_summary text,
  ai_recommendation text,
  recommended_corrections jsonb not null default '[]'::jsonb,

  human_review_required boolean not null default false,
  human_review_reason text,
  human_review_status public.csp_review_status not null default 'not_required',

  final_output  jsonb not null default '{}'::jsonb,
  final_output_hash text generated always as (encode(digest(final_output::text, 'sha256'), 'hex')) stored,

  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_csp_runs_tenant   on public.csp_validation_runs(tenant_id);
create index if not exists idx_csp_runs_source   on public.csp_validation_runs(source_type, source_id);
create index if not exists idx_csp_runs_status   on public.csp_validation_runs(validation_status);
create index if not exists idx_csp_runs_review   on public.csp_validation_runs(human_review_required, human_review_status);
create index if not exists idx_csp_runs_created  on public.csp_validation_runs(created_at desc);

-- ── Per-finding detail ────────────────────────────────────────────────────────
create table if not exists public.csp_validation_findings (
  id            uuid primary key default gen_random_uuid(),
  validation_run_id uuid not null references public.csp_validation_runs(id) on delete cascade,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,

  finding_title text not null,
  finding_description text,
  finding_category text not null,    -- missing_field, evidence_gap, regulatory_trigger, risk_escalation, inconsistency, corrective_action_needed
  risk_level    public.csp_risk_level not null,

  rule_id       uuid references public.csp_rules(id) on delete set null,
  citation      text,
  source_url    text,

  recommended_action text,
  requires_corrective_action boolean not null default false,
  requires_human_review boolean not null default false,

  status        text not null default 'open',
  created_at    timestamptz not null default now(),
  closed_at     timestamptz
);
create index if not exists idx_csp_findings_run    on public.csp_validation_findings(validation_run_id);
create index if not exists idx_csp_findings_tenant on public.csp_validation_findings(tenant_id);
create index if not exists idx_csp_findings_status on public.csp_validation_findings(status);

-- ── Human review queue (drives the superadmin review panel) ───────────────────
create table if not exists public.csp_review_queue (
  id            uuid primary key default gen_random_uuid(),
  validation_run_id uuid not null references public.csp_validation_runs(id) on delete cascade,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  site_id       uuid references public.sites(id) on delete set null,
  source_type   text not null,
  source_id     uuid,

  assigned_to   text,
  assigned_to_user_id uuid,
  assigned_reviewer_credentials text,   -- CSP, ASP, CHST, CIH, PE, EHS Manager, ...
  priority      text not null default 'normal',  -- low, normal, high, urgent
  review_reason text not null,
  due_at        timestamptz,

  status        public.csp_review_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  closed_at     timestamptz
);
create index if not exists idx_csp_queue_tenant on public.csp_review_queue(tenant_id);
create index if not exists idx_csp_queue_status on public.csp_review_queue(status);
create index if not exists idx_csp_queue_due    on public.csp_review_queue(due_at);
create trigger trg_csp_queue_updated_at before update on public.csp_review_queue
  for each row execute function public.csp_set_updated_at();

-- ── Credentialed human review decisions (signed sign-off) ─────────────────────
create table if not exists public.csp_review_decisions (
  id            uuid primary key default gen_random_uuid(),
  review_queue_id uuid references public.csp_review_queue(id) on delete set null,
  validation_run_id uuid not null references public.csp_validation_runs(id) on delete cascade,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,

  reviewer_name text not null,
  reviewer_user_id uuid,
  reviewer_credentials text,
  reviewer_role text,

  decision      public.csp_review_status not null,
  decision_summary text not null,
  reviewer_notes text,
  changes_required jsonb not null default '[]'::jsonb,
  final_classification jsonb not null default '{}'::jsonb,
  final_risk_level public.csp_risk_level,

  reviewer_signature_text text,
  signed_at     timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_csp_decisions_run    on public.csp_review_decisions(validation_run_id);
create index if not exists idx_csp_decisions_tenant on public.csp_review_decisions(tenant_id);

-- ── Record change history (tamper-evident audit trail) ────────────────────────
create table if not exists public.csp_record_change_history (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  source_type   text not null,
  source_id     uuid,
  validation_run_id uuid references public.csp_validation_runs(id) on delete set null,

  changed_by    text not null,
  changed_by_user_id uuid,
  changed_by_type public.csp_actor_type not null,
  change_reason text not null,

  field_changed text,
  previous_value jsonb,
  new_value     jsonb,
  previous_hash text generated always as (case when previous_value is null then null else encode(digest(previous_value::text, 'sha256'), 'hex') end) stored,
  new_hash      text generated always as (case when new_value is null then null else encode(digest(new_value::text, 'sha256'), 'hex') end) stored,

  created_at    timestamptz not null default now()
);
create index if not exists idx_csp_change_tenant on public.csp_record_change_history(tenant_id);
create index if not exists idx_csp_change_source on public.csp_record_change_history(source_type, source_id);

-- ── Audit export packages ─────────────────────────────────────────────────────
create table if not exists public.csp_audit_packages (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  site_id       uuid references public.sites(id) on delete set null,

  package_title text not null,
  package_description text,
  audit_type    text,                  -- OSHA, client, insurance, internal, ISO, DOT, EPA, other
  period_start  date,
  period_end    date,

  included_run_ids uuid[] not null default array[]::uuid[],
  included_finding_ids uuid[] not null default array[]::uuid[],

  export_summary jsonb not null default '{}'::jsonb,
  file_path     text,
  file_hash     text,

  generated_by  text,
  generated_at  timestamptz not null default now(),
  locked        boolean not null default false,
  locked_at     timestamptz
);
create index if not exists idx_csp_packages_tenant on public.csp_audit_packages(tenant_id);

-- ── Auto-enqueue a human review when a run requires it (SECURITY DEFINER) ──────
create or replace function public.csp_enqueue_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.human_review_required = true then
    insert into public.csp_review_queue (
      validation_run_id, tenant_id, site_id, source_type, source_id, priority, review_reason, status
    ) values (
      new.id, new.tenant_id, new.site_id, new.source_type, new.source_id,
      case
        when new.risk_level in ('critical','sif_potential','idlh_imminent_danger') then 'urgent'
        when new.risk_level = 'high' then 'high'
        else 'normal'
      end,
      coalesce(new.human_review_reason, 'AI validation requires qualified human EHS review.'),
      'pending'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_csp_enqueue_review on public.csp_validation_runs;
create trigger trg_csp_enqueue_review
  after insert on public.csp_validation_runs
  for each row execute function public.csp_enqueue_review();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Tenant-scoped tables: mirror the live platform's tenant_crud pattern exactly.
-- with_check also admits is_reliance_admin() because the superadmin operates the
-- review/sign-off surface and writes decisions on behalf of the platform.
do $$
declare t text;
begin
  foreach t in array array[
    'csp_validation_runs','csp_validation_findings','csp_review_queue',
    'csp_review_decisions','csp_record_change_history','csp_audit_packages'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_crud on public.%I', t);
    execute format(
      'create policy tenant_crud on public.%I for all to authenticated '
      || 'using ((tenant_id = (select private.auth_tenant_id())) or (select private.is_reliance_admin())) '
      || 'with check ((tenant_id = (select private.auth_tenant_id())) or (select private.is_reliance_admin()))',
      t);
  end loop;
end $$;

-- Reference / governance tables: readable by any authenticated session (the
-- agent needs them at runtime), writable only by the Reliance superadmin.
do $$
declare t text;
begin
  foreach t in array array[
    'csp_agents','csp_legal_sources','csp_rules','csp_rule_versions','csp_record_requirements'
  ] loop
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

-- =============================================================================
-- SEED DATA (starter governance content — review against current legal register)
-- =============================================================================

insert into public.csp_agents (agent_name, model_name, model_provider, prompt_version, system_prompt, human_review_rules)
values (
  'Senior EHS Record Validation Agent',
  'claude-sonnet-4-6', 'anthropic', 'csp-v1.0',
  'You are a CSP-informed EHS Records Validation Agent. You are not a licensed CSP and must not claim to hold credentials. Review EHS records for completeness, consistency, evidence quality, risk level, and potential regulatory triggers. Do not invent missing facts. High-risk, regulatory-sensitive, reportable, or low-confidence records require human review.',
  '{"always_require_human_review_when":["fatality_or_possible_fatality","inpatient_hospitalization_amputation_eye_loss","possible_OSHA_recordable","environmental_release_or_reportable_spill","DOT_reportable","SIF_potential","IDLH_or_imminent_danger","confidence_score_below_80","missing_critical_evidence","legal_or_client_notification_possible"]}'::jsonb
)
on conflict (agent_name) do nothing;

insert into public.csp_legal_sources (source_name, source_type, jurisdiction, issuing_authority, source_url, version_label)
values
  ('OSHA Injury and Illness Recordkeeping', 'osha', 'Federal - United States', 'Occupational Safety and Health Administration', 'https://www.osha.gov/recordkeeping', 'v1.0'),
  ('NIOSH Hierarchy of Controls', 'industry_standard', 'Federal - United States', 'National Institute for Occupational Safety and Health', 'https://www.cdc.gov/niosh/hierarchy-of-controls/about/index.html', 'v1.0')
on conflict (source_name, version_label) do nothing;

insert into public.csp_rules (
  legal_source_id, rule_code, rule_title, source_type, jurisdiction, citation,
  rule_summary, rule_text, decision_logic, applies_to_record_types,
  required_fields, human_review_triggers, source_url, version_label
)
select l.id, 'OSHA-1904-RECORDABLE-DECISION', 'OSHA Recordability Decision Review', 'osha',
  'Federal - United States', '29 CFR Part 1904',
  'Determine whether an injury or illness may be OSHA recordable based on work-relatedness, new case status, and general recording criteria.',
  'Review injury and illness records for work-relatedness, new case status, and possible OSHA recording criteria. Potential recordable decisions require qualified human EHS review before final classification.',
  '{"decision_steps":["Did an injury or illness occur?","Is the case work-related?","Is it a new case?","Did it involve death, days away, restricted work, transfer, medical treatment beyond first aid, loss of consciousness, or significant diagnosis?","If yes or uncertain, require human EHS review."]}'::jsonb,
  array['incident']::public.csp_record_type[],
  '["event_date","description","person_involved","work_relatedness","treatment_level","supervisor","location","evidence"]'::jsonb,
  '["possible_recordable","medical_treatment_beyond_first_aid","days_away","restricted_work","loss_of_consciousness","significant_diagnosis","uncertain_classification"]'::jsonb,
  'https://www.osha.gov/recordkeeping', 'v1.0'
from public.csp_legal_sources l where l.source_name = 'OSHA Injury and Illness Recordkeeping'
on conflict (rule_code, version_label) do nothing;

insert into public.csp_rules (
  legal_source_id, rule_code, rule_title, source_type, jurisdiction, citation,
  rule_summary, rule_text, decision_logic, applies_to_record_types,
  required_fields, human_review_triggers, source_url, version_label
)
select l.id, 'EHS-HIERARCHY-OF-CONTROLS', 'Hierarchy of Controls Review', 'industry_standard',
  'Federal - United States', 'NIOSH Hierarchy of Controls',
  'Evaluate whether corrective actions use the strongest feasible controls before relying on PPE alone.',
  'Corrective actions should consider elimination, substitution, engineering controls, administrative controls, and PPE in preferred order of effectiveness.',
  '{"preferred_order":["elimination","substitution","engineering","administrative","ppe"],"ai_review_question":"Does the corrective action rely only on PPE when stronger controls may be feasible?"}'::jsonb,
  array['incident','near_miss','negative_observation','audit_finding','inspection','corrective_action']::public.csp_record_type[],
  '["hazard","existing_controls","recommended_controls","responsible_person","due_date"]'::jsonb,
  '["high_risk_hazard","ppe_only_control_for_serious_hazard","missing_corrective_action","repeat_finding"]'::jsonb,
  'https://www.cdc.gov/niosh/hierarchy-of-controls/about/index.html', 'v1.0'
from public.csp_legal_sources l where l.source_name = 'NIOSH Hierarchy of Controls'
on conflict (rule_code, version_label) do nothing;

insert into public.csp_record_requirements (
  record_type, module_name, required_fields, recommended_fields,
  evidence_requirements, mandatory_human_review_conditions, version_label
) values
  ('incident', 'Incident Management',
   '["event_date","location","person_involved","description","immediate_action","supervisor","injury_or_illness","treatment_level","work_relatedness","corrective_action"]'::jsonb,
   '["photos","witness_statement","root_cause","potential_severity","actual_severity","equipment_involved","permit_involved"]'::jsonb,
   '["photo_or_documented_reason_no_photo","supervisor_statement","medical_or_first_aid_note_if_treatment","corrective_action_closeout_evidence"]'::jsonb,
   '["fatality","hospitalization","amputation","eye_loss","possible_recordable","restricted_work","days_away","high_or_critical_potential","SIF_potential","uncertain_treatment_level"]'::jsonb,
   'v1.0'),
  ('audit_finding', 'Audit Management',
   '["audit_date","auditor","location","finding_description","risk_level","responsible_party","corrective_action","due_date"]'::jsonb,
   '["photo","rule_reference","repeat_finding_status","trade","contractor","verification_method"]'::jsonb,
   '["photo_or_documented_reason_no_photo","corrective_action_evidence","closeout_verification"]'::jsonb,
   '["critical_risk","SIF_potential","repeat_finding","imminent_danger","regulatory_trigger","overdue_corrective_action"]'::jsonb,
   'v1.0')
on conflict (record_type, module_name, version_label) do nothing;

-- =============================================================================
-- SECURITY HARDENING (clears the Supabase advisor warnings for these objects)
-- =============================================================================
-- Pin the updated_at helper's search_path; revoke direct RPC execute on the
-- trigger-only enqueue function so it can't be called outside the trigger.
alter function public.csp_set_updated_at() set search_path = public;
revoke execute on function public.csp_enqueue_review() from public, anon, authenticated;

-- =============================================================================
-- END
-- =============================================================================
