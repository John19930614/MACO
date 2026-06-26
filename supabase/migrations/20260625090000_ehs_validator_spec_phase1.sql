-- =============================================================================
-- EHS Validation Agent — Spec build, Phase 1
-- Settings (guardrails), Autonomy Blockers, Evidence Rules, full Qualifications.
-- Bridged onto the existing csp_* tables (no parallel universe).
-- Additive and reversible.
-- =============================================================================

-- ── 1) New required-human-review settings (added to csp_guardrails) ───────────
-- Judgment-based safety rules are LOCKED (platform-enforced — AI never decides
-- these). Evidence/conflict routing is operator-tunable.
insert into public.csp_guardrails (key, label, description, enabled, locked) values
  ('require_human_review_high_risk',        'Require human review for high-risk records',
   'High-risk safety records always require qualified human approval.', true, true),
  ('require_human_review_osha_recordability','Require human review for OSHA recordability',
   'Recordability decisions (29 CFR 1904) always require a qualified human.', true, true),
  ('require_human_review_legal',            'Require human review for legal interpretation',
   'Legal or regulatory interpretation always requires a human.', true, true),
  ('require_human_review_sif',              'Require human review for SIF potential',
   'Serious-injury / fatality potential always requires a human.', true, true),
  ('require_human_review_missing_evidence', 'Require human review for missing evidence',
   'Records missing required evidence are routed to human review.', true, false),
  ('require_human_review_conflicting_info', 'Require human review for conflicting information',
   'Records with conflicting information are routed to human review.', true, false)
on conflict (key) do nothing;

-- ── 2) Qualifications — add free-form record_types, reseed the full spec set ───
alter table public.csp_agent_qualifications
  add column if not exists record_types text[] not null default array[]::text[];

-- Replace the original 4 platform seeds with the full 14 from the spec.
delete from public.csp_agent_qualifications
  where granted_by = 'Reliance Platform'
    and code in ('OSHA-1904-RECORDKEEPING','NIOSH-HIERARCHY-OF-CONTROLS','INCIDENT-COMPLETENESS','AUDIT-FINDING-REVIEW');

insert into public.csp_agent_qualifications (kind, code, title, description, record_types, grants_autonomy, granted_by) values
  ('certification','NIOSH-HIERARCHY-OF-CONTROLS','NIOSH Hierarchy of Controls',
   'Competency to assess corrective-action control strength from elimination through PPE.',
   array['incident','audit_finding','corrective_action'], false, 'Reliance Platform'),
  ('certification','OSHA-1904-RECORDKEEPING','OSHA Injury & Illness Recordkeeping',
   'Competency to evaluate 29 CFR 1904 recordability criteria. Does not grant autonomy — recordable decisions always require human review.',
   array['incident','injury','illness','recordability_review'], false, 'Reliance Platform'),
  ('skill','AUDIT-FINDING-COMPLETENESS','Audit Finding Completeness Review',
   'Validates required fields and evidence on audit findings. Grants autonomy only for complete, low-risk findings.',
   array['audit_finding'], true, 'Reliance Platform'),
  ('skill','INCIDENT-COMPLETENESS','Incident Record Completeness Review',
   'Validates required fields and evidence on incident records. Grants autonomy only for complete, low-risk incident records.',
   array['incident'], true, 'Reliance Platform'),
  ('skill','JSA-AHA-COMPLETENESS','JSA / AHA Completeness Review',
   'Validates JSA/AHA scope, hazards, PPE, permits, controls, signatures, and jobsite requirements.',
   array['jsa','aha','pre_task_plan'], true, 'Reliance Platform'),
  ('skill','PERMIT-COMPLETENESS','Permit Completeness Review',
   'Reviews permit forms for completeness only. Does not approve high-risk work.',
   array['hot_work_permit','confined_space_permit','loto_permit','trench_permit','lift_permit','mewp_permit'], true, 'Reliance Platform'),
  ('skill','TRAINING-RECORD-VALIDATION','Training Record Validation',
   'Validates training title, employee, provider, completion date, expiration date, and certificate evidence.',
   array['training_record'], true, 'Reliance Platform'),
  ('skill','CORRECTIVE-ACTION-CLOSURE','Corrective Action Closure Review',
   'Validates corrective action owner, due date, completion date, closeout evidence, and verification.',
   array['corrective_action'], true, 'Reliance Platform'),
  ('skill','HAZCOM-SDS-GHS','HazCom / SDS / GHS Validation',
   'Validates chemical name, SDS availability, GHS label elements, hazard statements, pictograms, and revision dates.',
   array['chemical_record','sds','ghs_label'], true, 'Reliance Platform'),
  ('skill','HIGH-RISK-WORK-RECOGNITION','High-Risk Work Recognition',
   'Identifies crane work, energized work, confined space, excavation, fall exposure, LOTO, and other high-risk work requiring human review.',
   array['permit','incident','audit_finding','jsa'], false, 'Reliance Platform'),
  ('skill','SIF-POTENTIAL-RECOGNITION','SIF Potential Recognition',
   'Identifies serious injury or fatality potential. Always requires human review.',
   array['incident','near_miss','audit_finding'], false, 'Reliance Platform'),
  ('skill','REGULATORY-CITATION-MATCHING','Regulatory Citation Matching',
   'Suggests applicable OSHA, NFPA, DOT, EPA, client, or company rule references. Final legal interpretation requires human review.',
   array['audit_finding','incident','program_review','legal_register'], false, 'Reliance Platform'),
  ('skill','DOCUMENT-VERSION-CONTROL','Document Version Control Review',
   'Confirms whether the uploaded record uses the current approved company template, SOP, form, or program version.',
   array['document','sop','form','program'], true, 'Reliance Platform'),
  ('skill','CONTRACTOR-QUALIFICATION','Contractor Qualification Review',
   'Reviews contractor qualification records such as COI, EMR, OSHA logs, safety manual, training, and required documents.',
   array['contractor_record','qualification_packet'], false, 'Reliance Platform')
on conflict (code) do nothing;

-- ── 3) Autonomy Blockers — hard stops that force human review ─────────────────
create table if not exists public.ehs_autonomy_blockers (
  id          uuid primary key default gen_random_uuid(),
  trigger_key text not null unique,
  label       text not null,
  action      text not null default 'human_review_required',  -- human_review_required | immediate_escalation
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_ehs_blockers_updated_at before update on public.ehs_autonomy_blockers
  for each row execute function public.csp_set_updated_at();

insert into public.ehs_autonomy_blockers (trigger_key, label, action) values
  ('possible_osha_recordable','Possible OSHA recordable injury or illness','human_review_required'),
  ('medical_treatment_beyond_first_aid','Medical treatment beyond first aid','human_review_required'),
  ('lost_time_restricted_duty_transfer','Lost time, restricted duty, or job transfer','human_review_required'),
  ('fatality_hospitalization_amputation_eye_loss','Fatality, hospitalization, amputation, or eye loss','immediate_escalation'),
  ('sif_potential','Serious injury or fatality potential','human_review_required'),
  ('high_risk_work','High-risk work activity','human_review_required'),
  ('confined_space_rescue_or_idlh','Confined space rescue, IDLH condition, or emergency exposure','immediate_escalation'),
  ('energized_work_or_loto_failure','Energized work concern or LOTO failure','human_review_required'),
  ('crane_lift_or_dropped_object','Crane incident, lift issue, dropped object, or suspended load exposure','human_review_required'),
  ('missing_required_evidence','Missing required evidence','human_review_required'),
  ('conflicting_information','Conflicting information in the record','human_review_required'),
  ('legal_interpretation','Legal or regulatory interpretation required','human_review_required'),
  ('repeat_issue','Repeat issue involving same contractor, location, task, or hazard','human_review_required'),
  ('corrective_action_closed_without_proof','Corrective action marked closed without verification evidence','human_review_required')
on conflict (trigger_key) do nothing;

-- ── 4) Evidence Rules — required evidence by record type ──────────────────────
create table if not exists public.ehs_evidence_rules (
  id              uuid primary key default gen_random_uuid(),
  record_type     text not null unique,
  module_label    text,
  required_fields text[] not null default array[]::text[],
  optional_fields text[] not null default array[]::text[],
  autonomy_allowed boolean not null default false,
  autonomy_limit  text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_ehs_evidence_rules_updated_at before update on public.ehs_evidence_rules
  for each row execute function public.csp_set_updated_at();

insert into public.ehs_evidence_rules (record_type, module_label, required_fields, optional_fields, autonomy_allowed, autonomy_limit) values
  ('incident','Incident',
   array['date_time','location','contractor_or_company','affected_person','event_description','injury_or_illness_status','first_aid_or_medical_treatment','witnesses','immediate_corrective_action','root_cause','final_corrective_action','supervisor_review','safety_review','human_recordability_decision'],
   array['photos','statements','attachments'], false, null),
  ('audit_finding','Audit Finding',
   array['finding_type','location','contractor_or_trade','hazard_category','severity','description','corrective_action_owner','due_date','closeout_evidence','reviewer_approval'],
   array['photo','regulatory_reference','company_rule_reference'], true, 'low_risk_complete_findings_only'),
  ('corrective_action','Corrective Action',
   array['linked_original_issue','corrective_action_description','owner','due_date','completion_date','verification_evidence','reviewer_verification'],
   array['photo','document_attachment','reopen_reason'], true, 'low_risk_complete_closeouts_only'),
  ('training_record','Training Record',
   array['employee_name','training_title','training_provider','completion_date','expiration_date','certificate_or_roster','required_by_role_or_jobsite','renewal_status'],
   array['trainer_signature','employee_signature'], true, null),
  ('permit','Permit',
   array['permit_type','scope_of_work','date_time_active','authorized_person','required_controls','required_signatures','pre_job_inspection','closeout_section'],
   array['photos','gas_monitoring_log','lift_plan','rescue_plan','attachments'], true, 'form_completeness_only_not_work_approval'),
  ('jsa_aha','JSA / AHA',
   array['task_scope','crew_or_contractor','location','date','steps','hazards','controls','ppe','permits_required','signatures'],
   array['photos','attachments','client_specific_requirements'], true, 'completeness_review_only'),
  ('sds_ghs','SDS / GHS',
   array['chemical_name','manufacturer','sds_available','sds_revision_date','ghs_pictograms','signal_word','hazard_statements','precautionary_statements','storage_requirements','ppe_requirements'],
   array['cas_number','synonyms','waste_code','label_image'], true, null)
on conflict (record_type) do nothing;

-- ── 5) Richer audit: record which blockers fired on each validation run ────────
alter table public.csp_validation_runs
  add column if not exists autonomy_blockers_triggered jsonb not null default '[]'::jsonb;

-- ── RLS (reference config: read by all authenticated, write by superadmin) ─────
do $$
declare t text;
begin
  foreach t in array array['ehs_autonomy_blockers','ehs_evidence_rules'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists ref_read on public.%I', t);
    execute format('create policy ref_read on public.%I for select to authenticated using (true)', t);
    execute format('drop policy if exists ref_admin_write on public.%I', t);
    execute format('create policy ref_admin_write on public.%I for all to authenticated using ((select private.is_reliance_admin())) with check ((select private.is_reliance_admin()))', t);
  end loop;
end $$;
