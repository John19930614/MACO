-- ============================================================
-- Phase 4 — Action & Response: risk_escalations (human-in-the-loop queue).
--
-- When a public.site_risk_scores row lands in the 'red' band (Phase 3's
-- read-only threshold), evaluateRiskEscalation() creates ONE risk_escalations
-- row (status 'needs_review') plus a linked DRAFT public.capa_records row.
-- NOTHING is notified automatically. An EHS manager must open the review queue
-- and explicitly confirm before an in-app notification appears. Real paging
-- (SMS / phone / on-call) is intentionally NOT wired anywhere in this phase —
-- see src/lib/predictive-risk-engine/paging.ts (PAGING_ENABLED = false).
--
-- Additive & reversible: this migration ONLY creates the risk_escalations table
-- (+ its indexes/RLS). It makes NO changes to existing tables. capa_records
-- already carries source_type + source_id, so the escalation→CAPA link needs no
-- ALTER (source_type = 'risk_score_escalation', source_id = site_risk_scores.id).
--
-- RLS policy names (grep targets for the manual RLS verification step):
--   tenant_read_risk_escalations   (select on risk_escalations, in_tenant)
-- Writes happen only via the service-role server actions (evaluate/confirm/
-- dismiss), which enforce tenant ownership in app code — so, like
-- site_risk_scores, no client insert/update policy is defined.
-- ============================================================

create table if not exists public.risk_escalations (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  site_id               uuid not null references public.sites(id) on delete cascade,
  site_risk_score_id    uuid not null references public.site_risk_scores(id) on delete cascade,
  status                text not null default 'needs_review'
                          check (status in ('needs_review', 'confirmed', 'dismissed')),
  capa_record_id        uuid references public.capa_records(id) on delete set null,
  reason_plain_text     text not null default '',
  recipients            text[] not null default '{}',
  created_at            timestamptz not null default now(),
  reviewed_by           uuid references public.profiles(id),
  reviewed_at           timestamptz,
  notification_sent_at  timestamptz,
  notified_recipient    text
);

-- One escalation per triggering score row. This is the idempotency guarantee:
-- re-running the evaluation against the same site_risk_scores row can never
-- create a duplicate escalation (or a duplicate draft CAPA).
create unique index if not exists risk_escalations_one_per_score
  on public.risk_escalations (site_risk_score_id);

create index if not exists idx_risk_escalations_tenant_status
  on public.risk_escalations (tenant_id, status);

alter table public.risk_escalations enable row level security;

-- Tenant isolation via the existing in_tenant(tenant_id) helper (see
-- 0002_rls.sql), matching site_risk_scores. Managers read their own tenant's
-- queue; a Reliance superadmin (tenant_id IS NULL) reads via the service-role
-- client in app code, not this policy.
create policy tenant_read_risk_escalations on public.risk_escalations
  for select using (public.in_tenant(tenant_id));

-- No changes to any existing table. No destructive operations. No trigger wiring
-- an alert/page/escalation on insert — notification is a manual, human-gated
-- server action, by design.
