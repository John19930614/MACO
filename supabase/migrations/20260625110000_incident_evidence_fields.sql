-- =============================================================================
-- Incident form — capture the evidence fields the CSP validator requires
-- so incident records arrive complete instead of being flagged for the agent.
-- Additive and reversible. RLS unchanged (existing tenant_crud covers new cols).
-- =============================================================================

alter table public.incidents
  add column if not exists contractor_or_company   text,
  add column if not exists witnesses                text,
  add column if not exists final_corrective_action  text,
  add column if not exists supervisor_review        text,
  add column if not exists safety_review            text,
  add column if not exists recordability_decision   text;
