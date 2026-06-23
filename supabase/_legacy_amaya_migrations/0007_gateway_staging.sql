-- ════════════════════════════════════════════════════════════════════════
-- AI Gateway — staging + exception log (live-mode backing for the two-stage
-- admission the app enforces in mock mode). Nothing reaches the live Cell
-- Database until it clears the gateway AND a human reviewer.
--
--   staged_records  — gateway-validated records awaiting human approval. NOT
--                     part of the live database; the reviewer admits them.
--   gateway_rejects — the persistent exception log (write-time blocks + human
--                     rejections), surfaced in the /gateway reject queue.
--
-- RLS mirrors 0002_rls.sql: tenant-scoped reads (in_tenant); submission gated
-- to contributors+, approval/rejection gated to supervisors+.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists staged_records (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references tenants(id),
  kind         text not null check (kind in ('safety_cell','event_cell')),
  title        text not null,
  submitted_by uuid references profiles(id),
  submitted_at timestamptz not null default now(),
  payload      jsonb not null,                      -- the fully-built record, ready to admit
  evidence     jsonb                                -- carried evidence (cells), attached on approval
);

create table if not exists gateway_rejects (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references tenants(id),
  kind       text not null check (kind in ('safety_cell','event_cell')),
  summary    text not null,
  category   text not null,
  reason     text not null,
  status     text not null default 'blocked' check (status in ('blocked','resolved')),
  payload    jsonb not null default '{}'::jsonb,    -- attempted record, for re-validation
  actor_id   uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_staged_tenant on staged_records (tenant_id);
create index if not exists idx_rejects_status on gateway_rejects (tenant_id, status);

alter table staged_records  enable row level security;
alter table gateway_rejects enable row level security;

-- ── staged_records ──────────────────────────────────────────────────────────
create policy read_staged on staged_records
  for select using (in_tenant(tenant_id));
-- Anyone who may file the underlying record may stage it (contributor+).
create policy write_staged on staged_records
  for insert with check (in_tenant(tenant_id) and current_role_name() in ('contributor','supervisor','safety_manager','admin'));
-- Approving/rejecting removes the staged row — a reviewer (supervisor+) action.
create policy manage_staged on staged_records
  for delete using (in_tenant(tenant_id) and current_role_name() in ('supervisor','safety_manager','admin'));

-- ── gateway_rejects ─────────────────────────────────────────────────────────
create policy read_rejects on gateway_rejects
  for select using (in_tenant(tenant_id));
-- The write-time gate logs a block as the submitting user (contributor+).
create policy write_rejects on gateway_rejects
  for insert with check (in_tenant(tenant_id) and current_role_name() in ('contributor','supervisor','safety_manager','admin'));
-- Re-validate / dismiss update the entry — steward (supervisor+) action.
create policy update_rejects on gateway_rejects
  for update using (in_tenant(tenant_id) and current_role_name() in ('supervisor','safety_manager','admin'));
