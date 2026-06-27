-- 0003_embeddings.sql
-- pgvector semantic search over Safety Cells. Powers near-duplicate detection
-- and "find similar cells" (src/lib/ai/embeddings.ts). 1536-dim vectors match
-- OpenAI text-embedding-3-small.

create extension if not exists vector;

create table if not exists cell_embeddings (
  cell_id    uuid primary key references safety_cells(id) on delete cascade,
  tenant_id  uuid not null references tenants(id),
  content    text not null,
  embedding  vector(1536) not null,
  model      text not null default 'text-embedding-3-small',
  created_at timestamptz not null default now()
);

create index if not exists cell_embeddings_ivfflat
  on cell_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Tenant-scoped nearest-neighbour search. The caller passes their tenant so the
-- ANN scan never crosses tenant boundaries.
create or replace function match_cells(
  query_embedding vector(1536),
  match_tenant    uuid,
  match_count     int default 10
) returns table (cell_id uuid, similarity real)
language sql stable as $$
  select e.cell_id, 1 - (e.embedding <=> query_embedding) as similarity
  from cell_embeddings e
  where e.tenant_id = match_tenant
  order by e.embedding <=> query_embedding
  limit match_count
$$;
