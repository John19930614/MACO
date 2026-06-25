-- ============================================================================
-- Chemical & GHS Intelligence Module — BRIDGE EDITION
-- ============================================================================
-- Adds net-new "build 2" capability ON TOP of the existing live tables:
--   * public.chemical_inventory  — the live, flat chemical master (4 rows)
--   * public.sds_documents       — already live (used by lib/actions/sds.ts)
--
-- No parallel ghs_chemicals master is created. Every chemical_id foreign key
-- points at public.chemical_inventory(id). RLS is wired to the platform's real
-- helpers auth_tenant_id() / is_reliance_admin().
--
-- DEFERRED (not created here — pull in later if the formal label package is
-- wanted): chemical_ghs_label_elements + label join tables, label_templates,
-- ghs_review_workflow, ghs_ai_extraction_field_log, a separate inventory table.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── Tenant helpers (already in prod; re-declared idempotently) ───────────────
create or replace function public.auth_tenant_id()
returns uuid language sql stable security definer set search_path = public
as $$ select tenant_id from profiles where id = auth.uid() limit 1; $$;

create or replace function public.is_reliance_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from profiles where id = auth.uid() and tenant_id is null); $$;

-- ============================================================
-- ENUM TYPES (only those used by the bridge tables)
-- ============================================================

do $$ begin
  create type hazard_type as enum ('physical', 'health', 'environmental', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type precautionary_category as enum ('general', 'prevention', 'response', 'storage', 'disposal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type label_type as enum ('primary_container', 'secondary_container', 'small_container', 'waste_container', 'workplace_hmis_nfpa', 'dot_shipping_review');
exception when duplicate_object then null; end $$;

do $$ begin
  create type waste_flag_status as enum ('open', 'under_review', 'not_applicable', 'confirmed', 'closed');
exception when duplicate_object then null; end $$;

-- ============================================================
-- GLOBAL REFERENCE TABLES
-- ============================================================

-- ── Pictograms ──────────────────────────────────────────────────────────────
create table if not exists public.ghs_pictograms (
  id uuid primary key default gen_random_uuid(),
  pictogram_code text not null unique,
  pictogram_name text not null,
  symbol_file_url text,
  description text,
  osha_required boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ghs_pictograms (pictogram_code, pictogram_name, description)
values
  ('GHS01', 'Exploding Bomb', 'Explosives, self-reactives, organic peroxides'),
  ('GHS02', 'Flame', 'Flammables, pyrophorics, self-heating, emits flammable gas, self-reactives, organic peroxides'),
  ('GHS03', 'Flame Over Circle', 'Oxidizers'),
  ('GHS04', 'Gas Cylinder', 'Gases under pressure'),
  ('GHS05', 'Corrosion', 'Skin corrosion/burns, eye damage, corrosive to metals'),
  ('GHS06', 'Skull and Crossbones', 'Acute toxicity, fatal or toxic'),
  ('GHS07', 'Exclamation Mark', 'Irritant, skin sensitizer, acute toxicity harmful, narcotic effects, respiratory tract irritant'),
  ('GHS08', 'Health Hazard', 'Carcinogen, mutagenicity, reproductive toxicity, respiratory sensitizer, target organ toxicity, aspiration hazard'),
  ('GHS09', 'Environment', 'Aquatic toxicity')
on conflict (pictogram_code) do nothing;

-- ── Hazard statements (H-codes) — seeded by 20260625020000 ──────────────────
create table if not exists public.ghs_hazard_statements (
  id uuid primary key default gen_random_uuid(),
  h_code text not null unique,
  statement text not null,
  hazard_type hazard_type default 'other',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_hazard_statement_code on public.ghs_hazard_statements(h_code);

-- ── Precautionary statements (P-codes) — seeded by 20260625020000 ───────────
create table if not exists public.ghs_precautionary_statements (
  id uuid primary key default gen_random_uuid(),
  p_code text not null unique,
  statement text not null,
  category precautionary_category default 'general',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_precautionary_statement_code on public.ghs_precautionary_statements(p_code);

-- ── PPE / control mapping ───────────────────────────────────────────────────
create table if not exists public.ghs_ppe_controls (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null,
  trigger_value text not null,
  control_category text not null,
  control_name text not null,
  control_description text not null,
  required boolean not null default false,
  requires_human_review boolean not null default true,
  applies_to_module text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(trigger_type, trigger_value, control_category, control_name)
);
create index if not exists idx_ppe_controls_trigger on public.ghs_ppe_controls(trigger_type, trigger_value);

insert into public.ghs_ppe_controls (trigger_type, trigger_value, control_category, control_name, control_description, required, applies_to_module)
values
  ('pictogram', 'GHS02', 'storage', 'Flammable Storage Review', 'Store in approved flammable storage where required and keep away from ignition sources.', true, array['Inventory','Audit','JSA','Permit']),
  ('pictogram', 'GHS02', 'handling', 'Ignition Source Control', 'Control sparks, open flames, hot work, and static discharge near this chemical.', true, array['JSA','Permit','Audit']),
  ('pictogram', 'GHS05', 'PPE', 'Chemical Splash Protection', 'Review need for chemical goggles, face shield, apron, and compatible gloves.', true, array['JSA','Training','Audit']),
  ('pictogram', 'GHS05', 'emergency', 'Eyewash/Shower Review', 'Verify eyewash or safety shower availability based on use and exposure potential.', true, array['Audit','JSA']),
  ('pictogram', 'GHS06', 'handling', 'Toxic Chemical Restricted Handling', 'Restrict handling to trained personnel and verify emergency exposure response.', true, array['JSA','Training','Audit']),
  ('pictogram', 'GHS08', 'health', 'Chronic Health Hazard Review', 'Review exposure controls, ventilation, medical surveillance, or respiratory protection needs.', true, array['JSA','Training','Audit']),
  ('pictogram', 'GHS09', 'waste', 'Environmental Disposal Review', 'Flag for environmental/waste disposal review before disposal or discharge.', true, array['Waste','Audit'])
on conflict (trigger_type, trigger_value, control_category, control_name) do nothing;

-- ── Storage compatibility rules ─────────────────────────────────────────────
create table if not exists public.chemical_storage_compatibility_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  trigger_hazard_class text,
  trigger_pictogram_code text,
  incompatible_with_hazard_class text,
  incompatible_with_pictogram_code text,
  warning_message text not null,
  severity text default 'warning',
  requires_review boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_storage_rules_trigger on public.chemical_storage_compatibility_rules(trigger_hazard_class, trigger_pictogram_code);

-- ── Audit question mapping ──────────────────────────────────────────────────
create table if not exists public.ghs_audit_question_mapping (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null,
  trigger_value text not null,
  audit_question text not null,
  expected_answer text default 'yes',
  finding_if_failed text,
  severity text default 'medium',
  applies_to_site_type text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_audit_mapping_trigger on public.ghs_audit_question_mapping(trigger_type, trigger_value);

insert into public.ghs_audit_question_mapping (trigger_type, trigger_value, audit_question, finding_if_failed, severity, applies_to_site_type)
values
  ('inventory_condition', 'secondary_container', 'Are all secondary containers labeled with the product identifier and required hazard information?', 'Secondary chemical container label missing or incomplete.', 'high', array['construction','general_industry','life_science','healthcare']),
  ('pictogram', 'GHS02', 'Are flammable chemicals stored away from ignition sources and in approved storage where required?', 'Flammable chemical storage or ignition source control issue.', 'high', array['construction','general_industry','life_science','healthcare']),
  ('pictogram', 'GHS05', 'Are corrosive chemicals stored properly and is splash protection available for use?', 'Corrosive chemical storage or splash protection issue.', 'high', array['general_industry','life_science','healthcare']),
  ('pictogram', 'GHS06', 'Are toxic chemicals restricted to trained/authorized personnel?', 'Toxic chemical access/control issue.', 'critical', array['general_industry','life_science','healthcare']),
  ('sds', 'missing_current_sds', 'Is the current SDS available to employees for this chemical?', 'SDS missing or not current.', 'high', array['construction','general_industry','life_science','healthcare'])
on conflict do nothing;

-- ── Training requirement mapping ────────────────────────────────────────────
create table if not exists public.ghs_training_requirement_mapping (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null,
  trigger_value text not null,
  training_name text not null,
  training_description text,
  frequency_months integer,
  required boolean not null default true,
  applies_to_roles text[],
  applies_to_site_type text[],
  requires_human_review boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(trigger_type, trigger_value, training_name)
);
create index if not exists idx_training_mapping_trigger on public.ghs_training_requirement_mapping(trigger_type, trigger_value);

insert into public.ghs_training_requirement_mapping (trigger_type, trigger_value, training_name, training_description, frequency_months, applies_to_roles, applies_to_site_type)
values
  ('chemical_use', 'any_hazardous_chemical', 'Hazard Communication Training', 'Training covering chemical hazards, labels, SDS access, and safe handling requirements.', 12, array['worker','supervisor','maintenance','lab_worker'], array['construction','general_industry','life_science','healthcare']),
  ('pictogram', 'GHS02', 'Flammable Liquid Handling', 'Training or briefing on flammable chemical storage, ignition source control, and spill response.', 12, array['worker','supervisor','maintenance','lab_worker'], array['construction','general_industry','life_science','healthcare']),
  ('pictogram', 'GHS05', 'Corrosive Chemical Handling', 'Training on corrosive chemical handling, splash protection, eyewash/shower response, and storage controls.', 12, array['worker','supervisor','lab_worker'], array['general_industry','life_science','healthcare']),
  ('pictogram', 'GHS06', 'Toxic Chemical Handling', 'Training for toxic chemical handling, restricted access, exposure response, and emergency controls.', 12, array['worker','supervisor','lab_worker'], array['general_industry','life_science','healthcare'])
on conflict (trigger_type, trigger_value, training_name) do nothing;

-- ============================================================
-- NET-NEW TABLES — bridged to public.chemical_inventory
-- ============================================================

-- ── Structured GHS classifications (one row per hazard) ─────────────────────
-- Child of chemical_inventory; complements the flat hazard_statements[] array.
create table if not exists public.ghs_classifications (
  id uuid primary key default gen_random_uuid(),
  chemical_id uuid not null references public.chemical_inventory(id) on delete cascade,
  hazard_class text not null,
  hazard_category text,
  hazard_type hazard_type default 'other',
  route text,
  signal_word text,
  classification_source text default 'sds',
  ai_confidence_score numeric(5,2),
  human_verified boolean not null default false,
  verified_by uuid,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ghs_class_chemical on public.ghs_classifications(chemical_id);
create index if not exists idx_ghs_class_hazard on public.ghs_classifications(hazard_class);

-- ── Per-chemical control recommendations ────────────────────────────────────
create table if not exists public.chemical_control_recommendations (
  id uuid primary key default gen_random_uuid(),
  chemical_id uuid not null references public.chemical_inventory(id) on delete cascade,
  ppe_control_id uuid references public.ghs_ppe_controls(id) on delete set null,
  recommendation_text text not null,
  module_source text,
  ai_generated boolean not null default false,
  human_verified boolean not null default false,
  verified_by uuid,
  verified_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_control_recs_chemical on public.chemical_control_recommendations(chemical_id);

-- ── Waste review flags (review prompts only — no legal waste codes) ─────────
create table if not exists public.chemical_waste_review_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  chemical_id uuid not null references public.chemical_inventory(id) on delete cascade,
  trigger_source text not null,
  trigger_value text not null,
  potential_waste_concern text not null,
  suggested_review_area text,
  status waste_flag_status not null default 'open',
  assigned_to uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  reviewer_notes text,
  final_determination text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_waste_flags_tenant on public.chemical_waste_review_flags(tenant_id);
create index if not exists idx_waste_flags_chemical on public.chemical_waste_review_flags(chemical_id);
create index if not exists idx_waste_flags_status on public.chemical_waste_review_flags(status);

-- ── Label print log (append-only compliance audit trail) ────────────────────
create table if not exists public.label_print_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  chemical_id uuid not null references public.chemical_inventory(id) on delete restrict,
  label_type label_type not null,
  printed_by uuid,
  printed_at timestamptz not null default now(),
  quantity integer not null default 1,
  container_id uuid,
  container_description text,
  location_description text,
  print_reason text,
  label_snapshot_json jsonb not null,
  voided boolean not null default false,
  voided_by uuid,
  voided_at timestamptz,
  void_reason text
);
create index if not exists idx_label_print_tenant on public.label_print_log(tenant_id);
create index if not exists idx_label_print_chemical on public.label_print_log(chemical_id);
create index if not exists idx_label_print_date on public.label_print_log(printed_at);

-- ============================================================
-- VIEW: inventory risk roll-up (over the live chemical_inventory)
-- ============================================================

create or replace view public.chemical_inventory_risk_view as
select
  ci.id as chemical_id,
  ci.tenant_id,
  ci.site_id,
  ci.name as product_name,
  ci.supplier as manufacturer,
  ci.storage_location,
  ci.quantity,
  ci.unit,
  ci.sds_expiry as expiration_date,
  ci.status as inventory_status,
  count(distinct wf.id) filter (where wf.status in ('open','under_review')) as open_waste_flags,
  count(distinct cr.id) filter (where cr.active = true) as active_control_recommendations
from public.chemical_inventory ci
left join public.chemical_waste_review_flags wf on wf.chemical_id = ci.id
left join public.chemical_control_recommendations cr on cr.chemical_id = ci.id
group by ci.id;

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array[
    'ghs_pictograms','ghs_hazard_statements','ghs_precautionary_statements',
    'ghs_ppe_controls','chemical_storage_compatibility_rules',
    'ghs_audit_question_mapping','ghs_training_requirement_mapping',
    'ghs_classifications','chemical_control_recommendations','chemical_waste_review_flags'
  ] loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I;', t, t);
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at();', t, t);
  end loop;
end $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- ── Tier 1: tenant-scoped tables (standard tenant_crud) ─────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['chemical_waste_review_flags','label_print_log'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "tenant_crud" on public.%I;', t);
    execute format(
      'create policy "tenant_crud" on public.%I for all to authenticated '
      || 'using ((tenant_id = auth_tenant_id()) or is_reliance_admin()) '
      || 'with check (tenant_id = auth_tenant_id());', t);
  end loop;
end $$;

-- ── Tier 2: child tables (scoped via chemical_inventory parent) ─────────────
do $$
declare
  t text;
begin
  foreach t in array array['ghs_classifications','chemical_control_recommendations'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "tenant_crud" on public.%I;', t);
    execute format(
      'create policy "tenant_crud" on public.%I for all to authenticated '
      || 'using (exists (select 1 from public.chemical_inventory ci '
      || '               where ci.id = chemical_id and (ci.tenant_id = auth_tenant_id() or is_reliance_admin()))) '
      || 'with check (exists (select 1 from public.chemical_inventory ci '
      || '               where ci.id = chemical_id and ci.tenant_id = auth_tenant_id()));', t);
  end loop;
end $$;

-- ── Tier 3: global reference tables (read=all authenticated, write=admin) ───
do $$
declare
  t text;
begin
  foreach t in array array[
    'ghs_pictograms','ghs_hazard_statements','ghs_precautionary_statements',
    'ghs_ppe_controls','chemical_storage_compatibility_rules',
    'ghs_audit_question_mapping','ghs_training_requirement_mapping'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "ref_read" on public.%I;', t);
    execute format('drop policy if exists "ref_write" on public.%I;', t);
    execute format('create policy "ref_read" on public.%I for select to authenticated using (true);', t);
    execute format(
      'create policy "ref_write" on public.%I for all to authenticated '
      || 'using (is_reliance_admin()) with check (is_reliance_admin());', t);
  end loop;
end $$;

-- ============================================================
-- NOTES
-- ============================================================
-- 1. chemical_id everywhere references public.chemical_inventory(id) (the live
--    flat master) — NOT a separate ghs_chemicals table.
-- 2. Waste flags are review prompts only. Do not auto-assign legal waste codes.
-- 3. Store label_snapshot_json at print time to preserve the exact printed label.
-- 4. Deferred to a later migration if the formal persisted-label package is
--    wanted: chemical_ghs_label_elements + label join tables, label_templates,
--    ghs_review_workflow, ghs_ai_extraction_field_log. The current label flow
--    keeps deriving pictograms/signal word on the fly via src/lib/ghsData.ts.
