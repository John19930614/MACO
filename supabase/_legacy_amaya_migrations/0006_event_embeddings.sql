-- ════════════════════════════════════════════════════════════════════════
-- pgvector embeddings for Event Cells (outcomes), mirroring 0003 for cells.
-- Lets "find similar outcomes" run as real semantic similarity, tenant-scoped.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists event_embeddings (
  event_id   uuid primary key references event_cells(id) on delete cascade,
  tenant_id  uuid references tenants(id),
  content    text,
  embedding  vector(1536),
  updated_at timestamptz not null default now()
);

create index if not exists idx_event_embeddings_cosine
  on event_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table event_embeddings enable row level security;
create policy read_event_embeddings on event_embeddings for select using (in_tenant(tenant_id));

-- Tenant-scoped cosine similarity over event text. (1 - cosine_distance).
create or replace function match_events(
  query_embedding vector(1536),
  match_tenant uuid,
  match_count int default 5
)
returns table (event_id uuid, similarity float)
language sql stable as $$
  select e.event_id, 1 - (e.embedding <=> query_embedding) as similarity
  from event_embeddings e
  where e.tenant_id = match_tenant
  order by e.embedding <=> query_embedding
  limit match_count
$$;
