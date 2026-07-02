-- =============================================================================
-- AI Dev Command Center — Phase 8: code draft artifacts
-- =============================================================================
-- Lets agents save code/SQL/test/doc DRAFTS as artifacts for review. Adds an
-- artifact_type classification, a plain description, language, risk level, and an
-- approval flag, and extends the status lifecycle. Nothing is ever written to the
-- real codebase or database — these are drafts only.
--
-- SAFETY: dev_artifacts is empty (0 rows). The status CHECK is a SUPERSET of the
-- old values (so the planning agents that write 'proposed' keep working) plus the
-- Phase 8 statuses. New columns are nullable/defaulted. Additive + reversible.
-- =============================================================================

alter table public.dev_artifacts add column if not exists artifact_type   text;
alter table public.dev_artifacts add column if not exists description      text;
alter table public.dev_artifacts add column if not exists language         text;
alter table public.dev_artifacts add column if not exists risk_level       text;
alter table public.dev_artifacts add column if not exists approval_required boolean not null default true;

-- artifact_type — the 10 Phase 8 types (null allowed for planning/other artifacts)
alter table public.dev_artifacts drop constraint if exists dev_artifacts_artifact_type_check;
alter table public.dev_artifacts add constraint dev_artifacts_artifact_type_check check (
  artifact_type is null or artifact_type in (
    'react_component','nextjs_route','server_action','api_route','supabase_sql',
    'rls_policy','test_file','documentation','config_change','release_notes'
  ));

-- risk_level — optional, validated against the standard scale
alter table public.dev_artifacts drop constraint if exists dev_artifacts_risk_level_check;
alter table public.dev_artifacts add constraint dev_artifacts_risk_level_check check (
  risk_level is null or risk_level in ('low','medium','high','critical'));

-- status — superset: existing values (planning uses 'proposed') + Phase 8 lifecycle
alter table public.dev_artifacts drop constraint if exists dev_artifacts_status_check;
alter table public.dev_artifacts add constraint dev_artifacts_status_check check (status in (
  'draft','proposed','approved','rejected','applied','superseded',
  'needs_review','revised','ready_for_branch'
));
