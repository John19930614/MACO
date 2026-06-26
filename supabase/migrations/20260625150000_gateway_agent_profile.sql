-- =============================================================================
-- AI Gateway Agent — profile + qualifications (modeled on the HSE/EHS agent)
-- Gives the gateway monitoring agent a credentialed profile, the same way the
-- EHS Records Validation Agent has csp_agent_qualifications. Admin-only.
-- Additive and reversible.
-- =============================================================================

create table if not exists public.gateway_agent_qualifications (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null default 'skill' check (kind in ('certification','skill','qualification')),
  code         text not null unique,
  title        text not null,
  description  text,
  scope        text[] not null default array[]::text[],   -- what it monitors
  grants_autonomy boolean not null default false,          -- may flag/act on its own vs recommend-only
  status       text not null default 'active' check (status in ('active','revoked')),
  granted_by   text,
  granted_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_gateway_quals_updated_at before update on public.gateway_agent_qualifications
  for each row execute function public.csp_set_updated_at();

insert into public.gateway_agent_qualifications (kind, code, title, description, scope, grants_autonomy, granted_by) values
  ('certification','GW-PIPELINE-HEALTH','Gateway Pipeline Health Assessment',
   'Competency to assess the 3-gate validation pipeline (schema, business-rule, anomaly) and the Nothing-Missed review.',
   array['gateway_pipeline'], true, 'Reliance Platform'),
  ('certification','GW-TELEMETRY-DRIFT','AI Telemetry & Drift Monitoring',
   'Competency to read AI call latency, fallback rate, token cost, and detect cost/drift anomalies.',
   array['ai_telemetry'], true, 'Reliance Platform'),
  ('skill','GW-REJECT-TRIAGE','Reject Queue Triage',
   'Identifies records blocked in the reject queue and which are auto-resolvable. Grants autonomy to flag.',
   array['reject_queue'], true, 'Reliance Platform'),
  ('skill','GW-REVIEW-BACKLOG','Review Backlog Monitoring',
   'Tracks AI finding + validation review backlog and surfaces when it is building.',
   array['review_queue','validation_queue'], true, 'Reliance Platform'),
  ('skill','GW-ANOMALY-DETECT','Anomaly Detection',
   'Surfaces telemetry/cost/latency anomalies for investigation. Grants autonomy to flag.',
   array['ai_telemetry'], true, 'Reliance Platform'),
  ('skill','GW-AUDIT-INTEGRITY','Audit Log Integrity Check',
   'Confirms gateway decisions are logged and the audit trail is complete.',
   array['audit_log'], true, 'Reliance Platform'),
  ('skill','GW-THRESHOLD-CALIBRATION','Threshold Calibration',
   'Recommends adjustments to degraded/critical thresholds. Does NOT grant autonomy — config changes need a human.',
   array['gateway_settings'], false, 'Reliance Platform'),
  ('skill','GW-MAINTENANCE-RECOMMENDATION','Maintenance Recommendation',
   'Produces maintenance recommendations for the operator. Recommends only — a human acts.',
   array['gateway_pipeline','reject_queue','review_queue'], false, 'Reliance Platform')
on conflict (code) do nothing;

alter table public.gateway_agent_qualifications enable row level security;
drop policy if exists admin_all on public.gateway_agent_qualifications;
create policy admin_all on public.gateway_agent_qualifications for all to authenticated
  using ((select private.is_reliance_admin())) with check ((select private.is_reliance_admin()));
