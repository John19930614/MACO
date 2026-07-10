-- ============================================================
-- Phase 5 — Learning Loop / Evolve: Predictive Risk Engine
--
-- Adds the two tables the learning loop needs:
--   • risk_model_feedback         — did a recommendation get followed, and did
--                                   risk actually fall afterward? (reweighting input)
--   • risk_model_validation_runs  — a validation snapshot + a PROPOSED reweighting
--                                   awaiting human (EHS lead) approval.
--
-- Deliberately NOT included (kept in sync with docs/phase-5-learning-loop.md):
--   • No risk_score_snapshots table — public.site_risk_scores already records a
--     point-in-time predicted band per site (score_date + band_key). Validation
--     derives its follow-up windows from those rows (see validation-data.ts).
--   • No changes to leading_indicators / risk_score_bands SHAPE — reweighting
--     tunes existing columns (leading_indicators.weight, risk_score_bands
--     min_score/max_score). There is no separate "cutoff" column.
--   • NOTHING here touches any trigger, escalation, paging, or notification
--     table. Approval updates scoring inputs only; alerting stays separate and
--     off (see paging.ts PAGING_ENABLED=false).
--
-- Reference-data note: leading_indicators and risk_score_bands are platform-wide
-- (not tenant-scoped) by design — see 20260707030000_predictive_risk_engine.sql.
-- RLS below mirrors that migration's ('admin','ehs_manager') policy pattern.
-- ============================================================

-- ── Feedback capture ────────────────────────────────────────────────────────
create table if not exists public.risk_model_feedback (
  id                uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null,           -- the leading-indicator recommendation acted on (no FK: recs are derived, not a table)
  site_id           uuid not null references public.sites(id) on delete cascade,
  was_followed      boolean not null,
  risk_score_before numeric not null,
  risk_score_after  numeric,                 -- null until a later score is observed
  observed_at       timestamptz not null,
  notes             text,
  created_at        timestamptz not null default now()
);

-- ── Validation runs + reweighting proposals ─────────────────────────────────
create table if not exists public.risk_model_validation_runs (
  id                      uuid primary key default gen_random_uuid(),
  status                  text not null default 'pending_approval'
                            check (status in ('pending_approval','approved','rejected')),
  correlation_coefficient numeric,
  p_value                 numeric,
  sample_size             integer,
  false_positive_rate     numeric,
  fp_tolerance            numeric not null default 0.15,
  -- [{ id, key, oldWeight, newWeight }]
  proposed_indicators     jsonb not null default '[]'::jsonb,
  -- [{ id, band_key, oldMin, newMin, oldMax, newMax }]
  proposed_bands          jsonb not null default '[]'::jsonb,
  approved_by             uuid references auth.users(id),
  approved_at             timestamptz,
  created_at              timestamptz not null default now()
);

create index if not exists idx_risk_model_feedback_site
  on public.risk_model_feedback (site_id);
create index if not exists idx_risk_model_validation_runs_status
  on public.risk_model_validation_runs (status, created_at desc);

-- ── RLS: admin / ehs_manager only (mirrors the existing predictive-risk tables) ─
alter table public.risk_model_feedback        enable row level security;
alter table public.risk_model_validation_runs enable row level security;

create policy admin_manage_risk_model_feedback on public.risk_model_feedback
  for all using (auth.jwt() ->> 'role' in ('admin', 'ehs_manager'))
  with check (auth.jwt() ->> 'role' in ('admin', 'ehs_manager'));

create policy admin_manage_risk_model_validation_runs on public.risk_model_validation_runs
  for all using (auth.jwt() ->> 'role' in ('admin', 'ehs_manager'))
  with check (auth.jwt() ->> 'role' in ('admin', 'ehs_manager'));

-- Writes in the app go through the service-role server actions (which enforce
-- role in the application layer, matching recalculateSiteRiskScores); these
-- policies cover any direct authenticated access.
