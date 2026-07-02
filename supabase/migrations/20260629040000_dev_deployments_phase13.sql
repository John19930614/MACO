-- =============================================================================
-- AI Dev Command Center — Phase 13: release planning + preview tracking
-- =============================================================================
-- Expands dev_deployments.status to cover the Phase 13 release lifecycle
-- (preview tracking + a production-release that stays manual/separately approved).
-- The status set is a SUPERSET of the existing values (so the Phase 11 release
-- plan that writes 'planned' keeps working) plus the new ones.
--
-- SAFETY: dev_deployments is empty (0 rows). Additive + reversible. No data
-- touched. NOTHING here deploys anything — it only records status.
-- =============================================================================

alter table public.dev_deployments drop constraint if exists dev_deployments_status_check;
alter table public.dev_deployments add constraint dev_deployments_status_check check (status in (
  -- existing (kept)
  'planned','branch_created','pr_open','preview_ready','merged','released','failed','rolled_back',
  -- Phase 13 lifecycle
  'not_started','pr_created','preview_pending','preview_failed',
  'approved_for_production','production_released','cancelled'
));
