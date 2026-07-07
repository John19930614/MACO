-- ============================================================
-- Predictive Risk Engine — go-live two-person sign-off (Phase 1 gate).
-- STAGING/PREVIEW ONLY until the checklist in docs/predictive-risk-engine.md is
-- complete. Depends on public.tenants (0001_*) and in_tenant() (0002_rls.sql);
-- ordered after 20260707030000_predictive_risk_engine.sql.
--
-- Backs the "Preview mode" vs "Live" banner and the sign-off panel. One row per
-- tenant. status flips to 'live' only once BOTH approvals are recorded, and that
-- flip is performed by the server action approveGoLiveStep() (service role), not
-- by a client. No AI, no schema changes to any existing table.
-- ============================================================

create table if not exists public.predictive_risk_go_live (
  tenant_id               uuid primary key references public.tenants(id) on delete cascade,
  status                  text not null default 'preview' check (status in ('preview', 'live')),
  ehs_lead_approved_at    timestamptz,
  ehs_lead_approved_by    uuid references auth.users(id),
  superadmin_approved_at  timestamptz,
  superadmin_approved_by  uuid references auth.users(id),
  updated_at              timestamptz not null default now()
);

alter table public.predictive_risk_go_live enable row level security;

-- Tenant members may READ their own tenant's go-live status (needed to render
-- the Preview/Live badge). Uses the platform in_tenant() convention. Note: a
-- Reliance superadmin (profiles.tenant_id IS NULL) does NOT satisfy in_tenant()
-- for any client tenant — superadmin reads/writes go through the service-role
-- server action, which enforces isSuperadmin() itself. That mirrors the write
-- model already used for site_risk_scores.
create policy tenant_read_predictive_risk_go_live on public.predictive_risk_go_live
  for select using (public.in_tenant(tenant_id));

-- No client-side insert/update policy. All writes go through approveGoLiveStep()
-- (createServiceRoleClient, bypasses RLS) which enforces:
--   * ehs_lead step   -> caller is a tenant manager (safety_manager/ehs_manager/admin)
--   * superadmin step -> caller is a Reliance superadmin (isSuperadmin())
-- Two distinct parties are required to reach 'live'. Fine-grained role naming is
-- validated in the action layer, not in SQL, so tuning it never needs a migration.
