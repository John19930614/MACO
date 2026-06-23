-- ════════════════════════════════════════════════════════════════════════
-- pgvector embeddings (build manual Phase 2). Replaces the genome-based
-- similarity stand-in with real semantic similarity over Safety Cell text.
-- Embeddings are generated server-side (text-embedding-3-small, 1536 dims) and
-- matched by cosine distance, scoped to the tenant.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists vector;

create table if not exists cell_embeddings (
  cell_id    uuid primary key references safety_cells(id) on delete cascade,
  tenant_id  uuid references tenants(id),
  content    text,
  embedding  vector(1536),
  updated_at timestamptz not null default now()
);

-- Approximate-nearest-neighbour index for cosine distance.
create index if not exists idx_cell_embeddings_cosine
  on cell_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table cell_embeddings enable row level security;
create policy read_embeddings on cell_embeddings for select using (in_tenant(tenant_id));

-- Tenant-scoped cosine similarity search. Returns the closest cells to a query
-- embedding within one tenant. (1 - cosine_distance) so 1.0 = identical.
create or replace function match_cells(
  query_embedding vector(1536),
  match_tenant uuid,
  match_count int default 5
)
returns table (cell_id uuid, similarity float)
language sql stable as $$
  select e.cell_id, 1 - (e.embedding <=> query_embedding) as similarity
  from cell_embeddings e
  where e.tenant_id = match_tenant
  order by e.embedding <=> query_embedding
  limit match_count
$$;
