-- =============================================================================
-- AI Dev Command Center — Phase 16: testing system
-- =============================================================================
-- Expands dev_test_results so the QA agent can record structured test results
-- (test type, name, expected vs actual, recommended fix). Failed tests block a
-- task from completing.
--
-- SAFETY: dev_test_results is empty (0 rows). Additive + reversible. No data
-- touched. Nothing here runs anything against production.
-- =============================================================================

alter table public.dev_test_results add column if not exists test_type        text;
alter table public.dev_test_results add column if not exists test_name        text;
alter table public.dev_test_results add column if not exists expected_result  text;
alter table public.dev_test_results add column if not exists actual_result    text;
alter table public.dev_test_results add column if not exists recommended_fix  text;
alter table public.dev_test_results add column if not exists created_by_agent text;

alter table public.dev_test_results drop constraint if exists dev_test_results_test_type_check;
alter table public.dev_test_results add constraint dev_test_results_test_type_check check (
  test_type is null or test_type in (
    'unit','component','form_validation','route_loading','supabase_query',
    'rls_access','approval_gate','agent_workflow','experience_review','audit_log'
  ));
