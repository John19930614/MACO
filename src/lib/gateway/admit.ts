/**
 * AI Gateway — write-time admission gate. A single candidate record must clear
 * these checks BEFORE it is persisted to the Cell Database; anything that fails
 * is blocked and logged to the exception queue rather than written. Schema/
 * format is already enforced by the route's zod layer, so this gate covers the
 * relational + duplication rules that need the surrounding dataset to judge.
 * Pure + deterministic.
 */
import type { Site, SafetyLocation, SafetyCell } from "@/lib/types";

export interface Rejection {
  category: string;
  reason: string;
}

export type AdmissionResult = { ok: true } | { ok: false; rejections: Rejection[] };

const norm = (s: string) => s.trim().toLowerCase();

export interface CellCandidate {
  title: string;
  site_id: string;
  location_id: string;
  tenant_id: string;
}

export function admitCell(
  c: CellCandidate,
  ctx: { sites: Site[]; locations: SafetyLocation[]; cells: SafetyCell[] },
): AdmissionResult {
  const rejections: Rejection[] = [];
  const site = ctx.sites.find((s) => s.id === c.site_id);
  const loc = ctx.locations.find((l) => l.id === c.location_id);

  if (!site) rejections.push({ category: "Gateway 1 · Reference", reason: `Unknown site ${c.site_id}` });
  if (!loc) rejections.push({ category: "Gateway 1 · Reference", reason: `Unknown location ${c.location_id}` });
  else if (loc.site_id !== c.site_id) rejections.push({ category: "Gateway 2 · Cross-field", reason: "Location is not in the selected site" });

  // Duplicate: an existing OPEN cell with the same tenant, location and title
  // (case-insensitive) — a re-submission of the same observation.
  const dupe = ctx.cells.find(
    (x) => x.tenant_id === c.tenant_id && x.location_id === c.location_id && x.status !== "closed" && norm(x.title) === norm(c.title),
  );
  if (dupe) rejections.push({ category: "Gateway 2 · Duplicate", reason: `Duplicate of open cell ${dupe.id}` });

  return rejections.length ? { ok: false, rejections } : { ok: true };
}

export interface EventCandidate {
  title: string;
  site_id: string;
}

export function admitEvent(e: EventCandidate, ctx: { sites: Site[] }): AdmissionResult {
  const rejections: Rejection[] = [];
  if (!ctx.sites.find((s) => s.id === e.site_id)) {
    rejections.push({ category: "Gateway 1 · Reference", reason: `Unknown site ${e.site_id}` });
  }
  return rejections.length ? { ok: false, rejections } : { ok: true };
}
