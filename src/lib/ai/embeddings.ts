/**
 * pgvector embeddings (server-only). Generates semantic embeddings for Safety
 * Cell text and runs tenant-scoped cosine similarity via the match_cells SQL
 * function. Active only in live mode with an OpenAI key; mock mode falls back to
 * the genome-based similarity in src/lib/arc/intelligence.ts.
 */
import "server-only";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { serverSecrets, SUPABASE_URL } from "@/lib/env";
import type { SafetyCell, EventCell } from "@/lib/types";

export const EMBED_MODEL = process.env.SAFETYIQ_EMBED_MODEL ?? "text-embedding-3-small";
if (!process.env.SAFETYIQ_EMBED_MODEL) {
  console.warn(
    "[embeddings] SAFETYIQ_EMBED_MODEL env var is not set. " +
      "Falling back to default model 'text-embedding-3-small'. " +
      "Set SAFETYIQ_EMBED_MODEL in your deployment environment to silence this warning.",
  );
}
export const EMBED_DIM = 1536;

/** pgvector accepts a textual array literal: "[1,2,3]". */
export const toVector = (a: number[]): string => `[${a.join(",")}]`;

function admin() {
  const { serviceRoleKey } = serverSecrets();
  return createClient(SUPABASE_URL, serviceRoleKey, { auth: { persistSession: false } });
}

export function buildCellText(cell: SafetyCell): string {
  const g = cell.hazard_genome;
  return [
    cell.title,
    cell.description,
    `task: ${cell.task}`,
    `energy: ${g.energySource}`,
    `exposure: ${g.exposureType}`,
    `trigger: ${g.trigger}`,
    `control gap: ${g.controlGap}`,
    g.environment,
  ]
    .filter(Boolean)
    .join(". ");
}

export async function embedText(text: string): Promise<number[]> {
  return (await embedTexts([text]))[0];
}

/**
 * Embed many texts in a SINGLE OpenAI request. The embeddings API accepts an
 * array and returns one vector per input in order — far cheaper and faster than
 * a request per cell.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { openaiKey } = serverSecrets();
  const client = new OpenAI({ apiKey: openaiKey });
  const r = await client.embeddings.create({ model: EMBED_MODEL, input: texts });
  // Sort by index defensively — the API preserves order, but don't rely on it.
  return [...r.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** Generate and persist the embedding for a cell (called on create in live mode). */
export async function embedAndStoreCell(cell: SafetyCell): Promise<void> {
  await embedAndStoreCells([cell]);
}

/**
 * Embed and persist many cells at once, skipping any whose text is unchanged
 * since it was last embedded. This makes a re-index cheap (only changed cells
 * hit the API) and batches the rest into one embeddings request.
 */
export async function embedAndStoreCells(cells: SafetyCell[]): Promise<{ embedded: number; skipped: number }> {
  if (cells.length === 0) return { embedded: 0, skipped: 0 };
  const db = admin();
  const desired = cells.map((cell) => ({ cell, content: buildCellText(cell) }));

  // Look up existing content so we can skip cells whose text hasn't changed.
  const { data: existing } = await db
    .from("cell_embeddings")
    .select("cell_id, content")
    .in("cell_id", cells.map((c) => c.id));
  const priorContent = new Map((existing ?? []).map((r: { cell_id: string; content: string }) => [r.cell_id, r.content]));

  const stale = desired.filter((d) => priorContent.get(d.cell.id) !== d.content);
  if (stale.length === 0) {
    return { embedded: 0, skipped: cells.length };
  }

  const vectors = await embedTexts(stale.map((d) => d.content));
  const now = new Date().toISOString();
  const rows = stale.map((d, i) => ({
    cell_id: d.cell.id,
    tenant_id: d.cell.tenant_id,
    content: d.content,
    embedding: toVector(vectors[i]),
    updated_at: now,
  }));
  await db.from("cell_embeddings").upsert(rows);
  return { embedded: stale.length, skipped: cells.length - stale.length };
}

/** Semantic nearest neighbours within the cell's tenant (excludes self). */
export async function getSimilarCellIdsByVector(cell: SafetyCell, limit = 5): Promise<{ cell_id: string; similarity: number }[]> {
  const embedding = await embedText(buildCellText(cell));
  const { data } = await admin().rpc("match_cells", {
    query_embedding: toVector(embedding),
    match_tenant: cell.tenant_id,
    match_count: limit + 1,
  });
  return ((data ?? []) as { cell_id: string; similarity: number }[]).filter((r) => r.cell_id !== cell.id).slice(0, limit);
}

// ── Event Cell embeddings (outcomes) ─────────────────────────────────────────
export function buildEventText(e: EventCell): string {
  return [e.title, e.description, `kind: ${e.kind}`, `severity: ${e.severity}`].filter(Boolean).join(". ");
}

export async function embedAndStoreEvent(event: EventCell): Promise<void> {
  await embedAndStoreEvents([event]);
}

/** Embed + persist many Event Cells, skipping any whose text is unchanged. */
export async function embedAndStoreEvents(events: EventCell[]): Promise<{ embedded: number; skipped: number }> {
  if (events.length === 0) return { embedded: 0, skipped: 0 };
  const db = admin();
  const desired = events.map((event) => ({ event, content: buildEventText(event) }));
  const { data: existing } = await db.from("event_embeddings").select("event_id, content").in("event_id", events.map((e) => e.id));
  const priorContent = new Map((existing ?? []).map((r: { event_id: string; content: string }) => [r.event_id, r.content]));

  const stale = desired.filter((d) => priorContent.get(d.event.id) !== d.content);
  if (stale.length === 0) return { embedded: 0, skipped: events.length };

  const vectors = await embedTexts(stale.map((d) => d.content));
  const now = new Date().toISOString();
  const rows = stale.map((d, i) => ({
    event_id: d.event.id,
    tenant_id: d.event.tenant_id,
    content: d.content,
    embedding: toVector(vectors[i]),
    updated_at: now,
  }));
  await db.from("event_embeddings").upsert(rows);
  return { embedded: stale.length, skipped: events.length - stale.length };
}

/** Semantic nearest-neighbour outcomes within the event's tenant (excludes self). */
export async function getSimilarEventIdsByVector(event: EventCell, limit = 5): Promise<{ event_id: string; similarity: number }[]> {
  const embedding = await embedText(buildEventText(event));
  const { data } = await admin().rpc("match_events", {
    query_embedding: toVector(embedding),
    match_tenant: event.tenant_id,
    match_count: limit + 1,
  });
  return ((data ?? []) as { event_id: string; similarity: number }[]).filter((r) => r.event_id !== event.id).slice(0, limit);
}
