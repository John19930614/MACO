-- ════════════════════════════════════════════════════════════════════════
-- Collaboration: comments on Safety Cells. Tenant-scoped + role-gated, like
-- the rest of the model. Action assignment, review queue, and the activity feed
-- reuse existing tables (actions, ai_findings, causal_edges, audit_log).
-- ════════════════════════════════════════════════════════════════════════
create table if not exists comments (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references tenants(id),
  cell_id    uuid not null references safety_cells(id) on delete cascade,
  author_id  uuid references profiles(id),
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_comments_cell on comments(cell_id);
create index if not exists idx_comments_tenant on comments(tenant_id);

alter table comments enable row level security;
create policy read_comments on comments for select using (in_tenant(tenant_id));
create policy write_comments on comments
  for insert with check (in_tenant(tenant_id) and current_role_name() in ('contributor','supervisor','safety_manager','admin'));
