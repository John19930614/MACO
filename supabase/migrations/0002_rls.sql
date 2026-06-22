-- ════════════════════════════════════════════════════════════════════════
-- SafetyIQ Row Level Security — multi-tenant isolation.
-- Every tenant-scoped table is readable only within the user's tenant;
-- a Reliance global operator (profiles.tenant_id IS NULL) sees all tenants.
-- Writes are additionally gated by EHS role.
-- ════════════════════════════════════════════════════════════════════════

alter table profiles              enable row level security;
alter table tenants               enable row level security;
alter table sites                 enable row level security;
alter table chemicals             enable row level security;
alter table legal_requirements    enable row level security;
alter table audits                enable row level security;
alter table audit_findings        enable row level security;
alter table capa_actions          enable row level security;
alter table training_courses      enable row level security;
alter table training_records      enable row level security;
alter table documents             enable row level security;
alter table document_acknowledgments enable row level security;
alter table waste_streams         enable row level security;
alter table equipment             enable row level security;
alter table risk_assessments      enable row level security;
alter table incidents             enable row level security;
alter table compliance_scores     enable row level security;
alter table ai_findings           enable row level security;
alter table predictability_runs   enable row level security;
alter table audit_log             enable row level security;
alter table reliance_insights     enable row level security;

-- ── Helper functions ──────────────────────────────────────────────────────────

create or replace function current_ehs_role()
returns text language sql stable as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function current_tenant_id()
returns uuid language sql stable as $$
  select tenant_id from profiles where id = auth.uid()
$$;

-- True when the row's tenant is visible to the current user.
-- Reliance global operators (tenant_id IS NULL) see every tenant.
create or replace function in_tenant(row_tenant uuid)
returns boolean language sql stable as $$
  select current_tenant_id() is null or row_tenant = current_tenant_id()
$$;

-- ── Profiles ──────────────────────────────────────────────────────────────────

create policy profiles_self_read on profiles
  for select using (auth.uid() = id or current_ehs_role() = 'admin');
create policy profiles_self_update on profiles
  for update using (auth.uid() = id or current_ehs_role() = 'admin');

-- ── Tenants ───────────────────────────────────────────────────────────────────

create policy tenants_read on tenants
  for select using (current_tenant_id() is null or id = current_tenant_id());

-- ── Sites ─────────────────────────────────────────────────────────────────────

create policy sites_read  on sites for select using (in_tenant(tenant_id));
create policy sites_write on sites
  for all using   (in_tenant(tenant_id) and current_ehs_role() in ('admin'))
  with check (in_tenant(tenant_id) and current_ehs_role() in ('admin'));

-- ── Chemical Inventory ────────────────────────────────────────────────────────

create policy chemicals_read on chemicals for select using (in_tenant(tenant_id));
create policy chemicals_write on chemicals
  for insert with check (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'));
create policy chemicals_update on chemicals
  for update using (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'));

-- ── Legal Requirements ────────────────────────────────────────────────────────

create policy legal_read  on legal_requirements for select using (in_tenant(tenant_id));
create policy legal_write on legal_requirements
  for all using   (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'))
  with check (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'));

-- ── Audits ────────────────────────────────────────────────────────────────────

create policy audits_read  on audits for select using (in_tenant(tenant_id));
create policy audits_write on audits
  for all using   (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'))
  with check (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'));

create policy findings_read  on audit_findings for select using (in_tenant(tenant_id));
create policy findings_write on audit_findings
  for all using   (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'))
  with check (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'));

-- ── CAPA ──────────────────────────────────────────────────────────────────────

create policy capa_read  on capa_actions for select using (in_tenant(tenant_id));
create policy capa_write on capa_actions
  for all using   (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'))
  with check (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'));

-- ── Training ──────────────────────────────────────────────────────────────────

create policy courses_read  on training_courses for select using (in_tenant(tenant_id));
create policy courses_write on training_courses
  for all using   (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'))
  with check (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'));

create policy records_read  on training_records for select using (in_tenant(tenant_id));
create policy records_write on training_records
  for insert with check (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'));

-- ── Documents ─────────────────────────────────────────────────────────────────

create policy docs_read  on documents for select using (in_tenant(tenant_id));
create policy docs_write on documents
  for all using   (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'))
  with check (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'));

-- Any authenticated user in the tenant may acknowledge a document.
create policy ack_read on document_acknowledgments
  for select using (in_tenant(tenant_id));
create policy ack_write on document_acknowledgments
  for insert with check (in_tenant(tenant_id) and auth.uid() = profile_id);

-- ── Waste Streams ─────────────────────────────────────────────────────────────

create policy waste_read  on waste_streams for select using (in_tenant(tenant_id));
create policy waste_write on waste_streams
  for insert with check (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'));
create policy waste_update on waste_streams
  for update using (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'));

-- ── Equipment ─────────────────────────────────────────────────────────────────

create policy equipment_read  on equipment for select using (in_tenant(tenant_id));
create policy equipment_write on equipment
  for all using   (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'))
  with check (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'));

-- ── Risk Assessments ──────────────────────────────────────────────────────────

create policy risk_read  on risk_assessments for select using (in_tenant(tenant_id));
create policy risk_write on risk_assessments
  for all using   (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'))
  with check (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'));

-- ── Incidents ─────────────────────────────────────────────────────────────────

-- Field officers may submit incidents; coordinator+ may manage them.
create policy incidents_read on incidents for select using (in_tenant(tenant_id));
create policy incidents_insert on incidents
  for insert with check (in_tenant(tenant_id) and current_ehs_role() in ('field_officer','ehs_coordinator','ehs_manager','admin'));
create policy incidents_update on incidents
  for update using (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'));

-- ── Compliance Scores ─────────────────────────────────────────────────────────

-- Scores are written by the server (service role bypasses RLS). Humans read only.
create policy scores_read on compliance_scores for select using (in_tenant(tenant_id));

-- ── AI Findings ───────────────────────────────────────────────────────────────

-- Written by the server (service role). EHS managers and above review them.
create policy ai_read on ai_findings for select using (in_tenant(tenant_id));
create policy ai_review on ai_findings
  for update using (in_tenant(tenant_id) and current_ehs_role() in ('ehs_manager','admin'));

-- ── Predictability Runs ───────────────────────────────────────────────────────

create policy predict_read on predictability_runs for select using (in_tenant(tenant_id));

-- ── Audit log ─────────────────────────────────────────────────────────────────

create policy audit_log_read on audit_log
  for select using (in_tenant(tenant_id) and current_ehs_role() in ('ehs_manager','admin'));

-- ── Reliance Insights (cross-tenant — any authenticated user may read) ────────

create policy reliance_insights_read on reliance_insights
  for select using (auth.role() = 'authenticated');

-- ── Arc Safety Cell domain ────────────────────────────────────────────────────

alter table safety_cells   enable row level security;
alter table control_proofs enable row level security;
alter table causal_edges   enable row level security;
alter table actions        enable row level security;

-- Safety Cells: any tenant member reads; field_officer+ may create; coordinator+ may update
create policy cells_read   on safety_cells for select using (in_tenant(tenant_id));
create policy cells_insert on safety_cells
  for insert with check (in_tenant(tenant_id) and current_ehs_role() in ('field_officer','ehs_coordinator','ehs_manager','admin'));
create policy cells_update on safety_cells
  for update using (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'));

-- Control Proofs
create policy proofs_read  on control_proofs for select using (in_tenant(tenant_id));
create policy proofs_write on control_proofs
  for all using   (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'))
  with check (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'));

-- Causal Edges
create policy edges_read  on causal_edges for select using (in_tenant(tenant_id));
create policy edges_write on causal_edges
  for all using   (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'))
  with check (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'));

-- Actions: supervisors create/update; all tenant members read
create policy actions_read  on actions for select using (in_tenant(tenant_id));
create policy actions_write on actions
  for all using   (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'))
  with check (in_tenant(tenant_id) and current_ehs_role() in ('ehs_coordinator','ehs_manager','admin'));

-- VELA Insights: cross-tenant — any authenticated user may read
create policy read_vela on vela_insights
  for select using (auth.role() = 'authenticated');
