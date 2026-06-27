-- 0002_rls.sql
-- Row-level security + tenant isolation for the ARC schema (0001_init.sql).
--
-- Every tenant-scoped table is locked down with RLS and reads/writes are gated
-- through a single helper, in_tenant(), so the isolation rule lives in one place
-- and can never silently drift per-table. VELA insights are the deliberate
-- exception: cross-tenant intelligence readable by every authenticated tenant.

-- ── Tenant-isolation helpers ────────────────────────────────────────────────────

-- The caller's tenant, resolved from their profile row.
create or replace function current_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from profiles where id = auth.uid()
$$;

-- True when a row's tenant matches the caller's tenant.
create or replace function in_tenant(row_tenant uuid) returns boolean
language sql stable as $$
  select row_tenant is not distinct from current_tenant_id()
$$;

-- ── Enable RLS on every tenant-scoped table ──────────────────────────────────────
alter table profiles       enable row level security;
alter table sites          enable row level security;
alter table safety_cells   enable row level security;
alter table control_proofs enable row level security;
alter table causal_edges   enable row level security;
alter table ai_findings    enable row level security;
alter table actions        enable row level security;
alter table hsl_signals    enable row level security;
alter table exp_captures   enable row level security;
alter table pclss_runs     enable row level security;
alter table audit_log      enable row level security;
alter table vela_insights  enable row level security;

-- ── Tenant-scoped policies ───────────────────────────────────────────────────────
-- Each policy uses in_tenant(tenant_id) so tenant isolation is defined once.
create policy tenant_read_cells     on safety_cells   for select using (in_tenant(tenant_id));
create policy tenant_write_cells    on safety_cells   for all    using (in_tenant(tenant_id)) with check (in_tenant(tenant_id));
create policy tenant_read_proofs    on control_proofs for select using (in_tenant(tenant_id));
create policy tenant_write_proofs   on control_proofs for all    using (in_tenant(tenant_id)) with check (in_tenant(tenant_id));
create policy tenant_read_edges     on causal_edges   for select using (in_tenant(tenant_id));
create policy tenant_write_edges    on causal_edges   for all    using (in_tenant(tenant_id)) with check (in_tenant(tenant_id));
create policy tenant_read_findings  on ai_findings    for select using (in_tenant(tenant_id));
create policy tenant_write_findings on ai_findings    for all    using (in_tenant(tenant_id)) with check (in_tenant(tenant_id));
create policy tenant_read_actions   on actions        for select using (in_tenant(tenant_id));
create policy tenant_write_actions  on actions        for all    using (in_tenant(tenant_id)) with check (in_tenant(tenant_id));
create policy tenant_read_hsl       on hsl_signals    for select using (in_tenant(tenant_id));
create policy tenant_read_exp       on exp_captures   for select using (in_tenant(tenant_id));
create policy tenant_read_pclss     on pclss_runs     for select using (in_tenant(tenant_id));
create policy tenant_read_audit     on audit_log      for select using (in_tenant(tenant_id));

-- ── VELA stays cross-tenant ──────────────────────────────────────────────────────
-- Shared intelligence: any authenticated tenant may read it.
create policy read_vela on vela_insights for select using (auth.role() = 'authenticated');
