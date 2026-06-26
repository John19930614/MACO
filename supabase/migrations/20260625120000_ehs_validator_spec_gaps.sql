-- =============================================================================
-- EHS Validation Agent — close 3 spec-fidelity gaps found in review
--   §8 memory expiration/review date, §6 returned_for_correction decision.
-- (Per-risk confidence thresholds are code-only — no schema change.)
-- Additive and reversible.
-- =============================================================================

-- §8 — every memory lesson must have an expiration or review date.
alter table public.csp_agent_memory
  add column if not exists expiration_date date,
  add column if not exists review_date     date;

-- §6 — allow a reviewer to return a record for correction.
alter type public.csp_review_status add value if not exists 'returned_for_correction';
