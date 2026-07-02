-- =============================================================================
-- ARC live hardening — applied 2026-06-27 alongside bringing the ARC layer live
-- =============================================================================
-- The foundational ARC migrations (0001_init / 0002_rls / 0003_embeddings) were
-- applied to the live prod DB on 2026-06-27 to make the Safety-Cell / EXP /
-- P-CLSS / HSL / VELA / gateway layer real in production (it had only ever
-- existed in mock fixtures). This file captures the deltas needed beyond those
-- canonical files so a fresh apply matches prod and the security advisor stays
-- clean:
--   * locations: 0001 created it but 0002 never enabled RLS → advisor ERROR.
--     Enable RLS, scoped via the parent site's tenant.
--   * cell_embeddings: 0003 created it without RLS → enable + tenant policies.
--   * in_tenant() / match_cells(): pin search_path = public (advisor WARN).
-- Additive + reversible.
-- =============================================================================

-- locations — RLS via parent site
alter table public.locations enable row level security;
drop policy if exists tenant_locations on public.locations;
create policy tenant_locations on public.locations for all
  using (exists (select 1 from public.sites s where s.id = locations.site_id and public.in_tenant(s.tenant_id)))
  with check (exists (select 1 from public.sites s where s.id = locations.site_id and public.in_tenant(s.tenant_id)));

-- cell_embeddings — RLS (0003 omitted it)
alter table public.cell_embeddings enable row level security;
drop policy if exists tenant_read_embeddings  on public.cell_embeddings;
drop policy if exists tenant_write_embeddings on public.cell_embeddings;
create policy tenant_read_embeddings  on public.cell_embeddings for select using (public.in_tenant(tenant_id));
create policy tenant_write_embeddings on public.cell_embeddings for all    using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));

-- pin search_path on the ARC helper + ANN function
create or replace function public.in_tenant(row_tenant uuid) returns boolean
  language sql stable set search_path = public as $$
  select row_tenant is not distinct from public.current_tenant_id()
$$;

create or replace function public.match_cells(
  query_embedding vector(1536),
  match_tenant    uuid,
  match_count     int default 10
) returns table (cell_id uuid, similarity real)
  language sql stable set search_path = public as $$
  select e.cell_id, 1 - (e.embedding <=> query_embedding) as similarity
  from public.cell_embeddings e
  where e.tenant_id = match_tenant
  order by e.embedding <=> query_embedding
  limit match_count
$$;
