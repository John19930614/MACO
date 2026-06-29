-- =============================================================================
-- AI Dev Command Center — Phase 15: experience skill layer
-- =============================================================================
-- Adds three review-gate types (workflow, accessibility, performance) so the six
-- required experience scores each have a gate. Together with the existing
-- experience / plain_english / admin_workflow gates, every feature is reviewed
-- for ease of use, clarity, simplicity, accessibility, speed, and admin support.
--
-- SAFETY: dev_review_gates is empty (0 rows). Superset CHECK (keeps existing
-- types). Additive + reversible. No data touched.
-- =============================================================================

alter table public.dev_review_gates drop constraint if exists dev_review_gates_gate_type_check;
alter table public.dev_review_gates add constraint dev_review_gates_gate_type_check check (gate_type in (
  'qa','security','experience','plain_english','admin_workflow','documentation',
  'workflow','accessibility','performance'
));
