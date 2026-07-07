-- ============================================================
-- Phase 3 — AI Agent Logic: Predictive Risk Engine (additive only).
-- Builds on 20260707030000_predictive_risk_engine.sql (site_risk_scores). This
-- migration adds ONLY the Phase 3 logging/review surfaces plus one nullable
-- column — no destructive changes, no changes to existing rows.
--
-- Phase 3 scope reminder (see docs/phase-3-ai-agent.md):
--   • ai_gateway_trigger_log     — read-only OBSERVATION of what the gateway
--                                  WOULD alert on. No alert/escalation is sent
--                                  from any code path in this phase (that's Phase 4).
--   • ai_recommendation_reviews  — auditable human sign-off on AI-written text.
--   • site_risk_scores.ai_recommendation_text — AI prevention guidance, written
--                                  by the AI Gateway server action.
--
-- Multi-tenancy: both new tables carry tenant_id and follow the existing
-- in_tenant(tenant_id) RLS convention (see 0002_rls.sql), exactly like
-- site_risk_scores. Writes happen ONLY through service-role server actions
-- (evaluateGatewayTrigger / generateSitePreventionRecommendation /
-- recordRecommendationReview), which enforce role + tenant ownership in the app
-- layer (assertTenantOwnership) — so there is no client-side insert/update policy.
--
-- RLS policy names (grep targets for the manual RLS verification step):
--   tenant_read_ai_gateway_trigger_log       (select on ai_gateway_trigger_log, in_tenant)
--   tenant_read_ai_recommendation_reviews    (select on ai_recommendation_reviews, in_tenant)
--   manager_manage_ai_recommendation_reviews (all on ai_recommendation_reviews, admin/ehs_manager)
-- The superadmin "Risk Score Reliability" screen reads the trigger log via the
-- service-role client (cross-tenant) — a Reliance superadmin has tenant_id IS
-- NULL and so cannot satisfy in_tenant(), by design.
-- ============================================================

create table if not exists public.ai_gateway_trigger_log (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  site_id              uuid not null references public.sites(id) on delete cascade,
  triggered_at         timestamptz not null default now(),
  trigger_reason       text not null check (trigger_reason in ('band_crossing','multi_indicator_degrade')),
  from_band            text,
  to_band              text,
  indicators_degraded  jsonb not null default '[]'::jsonb, -- array of leading_indicator keys that worsened
  created_at           timestamptz not null default now()
);

create index if not exists idx_ai_gateway_trigger_log_site_time
  on public.ai_gateway_trigger_log (site_id, triggered_at desc);

create table if not exists public.ai_recommendation_reviews (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  site_risk_score_id   uuid not null references public.site_risk_scores(id) on delete cascade,
  recommendation_text  text not null,
  reviewed_by          text not null, -- the named EHS lead who reviewed (recorded for audit)
  reviewed_at          timestamptz not null default now(),
  verdict              text not null check (verdict in ('accurate','inaccurate','needs_edit')),
  notes                text
);

create index if not exists idx_ai_recommendation_reviews_score
  on public.ai_recommendation_reviews (site_risk_score_id, reviewed_at desc);

-- Additive nullable column on the Phase 1 table — populated by the AI Gateway
-- server action; NULL until a recommendation has been generated (the site risk
-- page falls back to the templated explanation_text when NULL).
alter table public.site_risk_scores
  add column if not exists ai_recommendation_text text;

alter table public.ai_gateway_trigger_log    enable row level security;
alter table public.ai_recommendation_reviews enable row level security;

-- Tenants can read their own rows (in_tenant convention). Cross-tenant reads for
-- the Reliance reliability screen go through the service-role client, which
-- bypasses RLS. No insert/update policy: all writes are service-role only.
create policy tenant_read_ai_gateway_trigger_log on public.ai_gateway_trigger_log
  for select using (public.in_tenant(tenant_id));

create policy tenant_read_ai_recommendation_reviews on public.ai_recommendation_reviews
  for select using (public.in_tenant(tenant_id));

-- An EHS lead (admin/ehs_manager) may also manage reviews directly via RLS,
-- mirroring admin_manage_leading_indicators in the Phase 1 migration. The
-- recordRecommendationReview server action still runs through the service-role
-- client and enforces role + tenant ownership itself.
create policy manager_manage_ai_recommendation_reviews on public.ai_recommendation_reviews
  for all using (auth.jwt() ->> 'role' in ('admin', 'ehs_manager'))
  with check (auth.jwt() ->> 'role' in ('admin', 'ehs_manager'));

-- No trigger wires an alert/escalation/paging call on insert into
-- ai_gateway_trigger_log — Phase 3 is observation-only, by design. Sending real
-- alerts is Phase 4; retraining the model is Phase 5.
