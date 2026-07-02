-- Waste Profile composition + guided questionnaire + AI suggestions
-- =================================================================
-- ADDITIVE ONLY. Adds three jsonb columns to the existing, live
-- public.waste_profiles table so the guided "chemical waste profile"
-- wizard can store: the selected inventory chemicals with their weight
-- percentages, the guided characterization answers, and the AI's
-- (advisory) classification suggestions.
--
-- No existing column is altered or dropped; no row is modified. The two
-- existing rows simply receive the column defaults ('[]' / '{}' / null).
-- RLS is already enabled on waste_profiles with insert/select/update
-- tenant policies — nothing here touches security.

alter table public.waste_profiles
  add column if not exists composition    jsonb not null default '[]'::jsonb,
  add column if not exists questionnaire  jsonb not null default '{}'::jsonb,
  add column if not exists ai_suggestions jsonb;

comment on column public.waste_profiles.composition is
  'Selected inventory chemicals + weight percentages: [{chemical_id,name,cas_number,percentage,ghs_classes,hazard_statements,physical_state}]. Connects chemical inventory to the waste profile at selection time only.';
comment on column public.waste_profiles.questionnaire is
  'Guided characterization answers keyed by question id (generation process, physical state, free liquids, pH, ignitability, monthly volume, container type).';
comment on column public.waste_profiles.ai_suggestions is
  'AI- or rules-drafted classification suggestions + rationale. ADVISORY ONLY — a profile still requires human EHS approval (state ehs_review -> approved) before it can be activated.';
