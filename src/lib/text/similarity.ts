/**
 * Lexical near-duplicate detection (pure, deterministic, no API).
 *
 * Used by the data-validation gateway, which is synchronous and must run without
 * network/API access — so it can't use the pgvector/OpenAI semantic embeddings
 * (src/lib/ai/embeddings.ts) that power live cell similarity. Token-set Jaccard
 * generalises the old exact-title check: it also catches re-ordered words,
 * punctuation/case differences, and minor word additions. It does NOT catch pure
 * synonyms or stemming — that needs the embedding path.
 */

// Common, low-signal words ignored when comparing titles.
const STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "at", "to", "and", "or", "with", "for",
  "from", "by", "is", "was", "were", "are", "be", "no", "not", "this", "that",
  "it", "as", "into", "near", "during",
]);

/** Lowercase, strip punctuation, drop stopwords and single letters (keep digits). */
export function normalizeTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => (t.length >= 2 || /^\d+$/.test(t)) && !STOPWORDS.has(t));
}

function jaccardSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Token-set Jaccard similarity of two short texts, 0–1. */
export function titleSimilarity(a: string, b: string): number {
  return jaccardSets(new Set(normalizeTokens(a)), new Set(normalizeTokens(b)));
}

/**
 * Count near-duplicate records: greedily cluster titles, and every title that is
 * ≥ threshold similar to an earlier representative counts as one redundant
 * near-duplicate. Exact duplicates score 1.0, so this strictly generalises the
 * old exact-title metric (which counted `n-1` per identical-title group).
 * Deterministic over input order. Empty/blank titles are ignored.
 */
export function countNearDuplicates(texts: string[], threshold = 0.6): number {
  const reps: Set<string>[] = [];
  let dups = 0;
  for (const text of texts) {
    const toks = normalizeTokens(text);
    if (toks.length === 0) continue;
    const set = new Set(toks);
    if (reps.some((r) => jaccardSets(r, set) >= threshold)) dups++;
    else reps.push(set);
  }
  return dups;
}
