-- 20260706000000_event_embeddings.sql
-- pgvector semantic search over Event Cells (outcomes), mirroring 0003_embeddings.sql
-- for safety_cells. Backs src/lib/ai/embeddings.ts (embedAndStoreEvents /
-- getSimilarEventIdsByVector), which was querying this table before it existed
-- in any applied migration (Platform Review finding scan:ghost-table:event_embeddings).

create extension if not exists vector;

create table if not exists public.event_embeddings (
  event_id   uuid primary key references public.event_cells(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id),
  content    text,
  embedding  vector(1536),
  updated_at timestamptz not null default now()
);

create index if not exists event_embeddings_ivfflat
  on public.event_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table public.event_embeddings enable row level security;

drop policy if exists tenant_read_event_embeddings  on public.event_embeddings;
drop policy if exists tenant_write_event_embeddings on public.event_embeddings;
create policy tenant_read_event_embeddings  on public.event_embeddings for select using (public.in_tenant(tenant_id));
create policy tenant_write_event_embeddings on public.event_embeddings for all    using (public.in_tenant(tenant_id)) with check (public.in_tenant(tenant_id));

-- Tenant-scoped cosine similarity over event text, mirroring match_cells.
create or replace function public.match_events(
  query_embedding vector(1536),
  match_tenant    uuid,
  match_count     int default 5
) returns table (event_id uuid, similarity real)
language sql stable as $$
  select e.event_id, 1 - (e.embedding <=> query_embedding) as similarity
  from public.event_embeddings e
  where e.tenant_id = match_tenant
  order by e.embedding <=> query_embedding
  limit match_count
$$;

alter function public.match_events(vector, uuid, int) set search_path = public;
