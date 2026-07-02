-- =============================================================================
-- AI Dev Command Center — Phase 14: learning & improvement loop
-- =============================================================================
-- Adds the feedback type + routing fields, and expands the agent-memory kinds so
-- the team can store reusable platform-improvement lessons. Memory holds NO
-- customer data — only reusable lessons.
--
-- SAFETY: both tables are empty (0 rows). Additive + reversible. The memory kind
-- CHECK is a SUPERSET (keeps the existing kinds). No data touched.
-- =============================================================================

-- ── dev_feedback: the 8 feedback types + routing fields ──────────────────────
alter table public.dev_feedback add column if not exists feedback_type     text;
alter table public.dev_feedback add column if not exists assigned_to       text;
alter table public.dev_feedback add column if not exists reviewed_by_agent text;

alter table public.dev_feedback drop constraint if exists dev_feedback_feedback_type_check;
alter table public.dev_feedback add constraint dev_feedback_feedback_type_check check (
  feedback_type is null or feedback_type in (
    'helpful','confusing','wrong_recommendation','feature_request',
    'broken_workflow','bad_wording','too_technical','too_many_steps'
  ));

-- ── dev_agent_memory: the Phase 14 memory kinds (superset) ───────────────────
alter table public.dev_agent_memory drop constraint if exists dev_agent_memory_kind_check;
alter table public.dev_agent_memory add constraint dev_agent_memory_kind_check check (kind in (
  -- existing
  'approved_pattern','rejected_pattern','user_preference','lesson_learned',
  -- Phase 14
  'preferred_label','workflow_rule','security_rule','ux_rule',
  'performance_rule','admin_support_rule','platform_standard'
));
