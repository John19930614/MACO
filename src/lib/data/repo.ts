/**
 * Repository — the single data-access facade used by every API route and
 * server component. In mock mode it reads/writes the in-memory store. In live
 * mode it queries Supabase (table names match the migration in
 * supabase/migrations). UI code never imports Supabase or the store directly.
 */
import { cache } from "react";
import { MOCK_MODE } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { store, nextId, getSessionUserId } from "./store";
import type {
  CellBundle,
  Tenant,
  SafetyCell,
  ControlProof,
  EvidenceFile,
  CausalEdge,
  AiFinding,
  SafetyAction,
  AuditEntry,
  Profile,
  Site,
  SafetyLocation,
  ExpCapture,
  HslReading,
  PclssRun,
  VelaInsight,
  Comment,
  EventCell,
  BehaviorCell,
} from "@/lib/types";
import { buildRiskGraph, type RiskGraph } from "@/lib/risk/objects";
import { detectBehaviors, similarOutcomes, type SimilarOutcome } from "@/lib/risk/derive";
import { buildForecast, type LocationForecast } from "@/lib/risk/forecast";
import type { SafetyCellInput, EventInput } from "@/lib/schemas";
import { WRITE_ROLES, SUPERVISOR_ROLES } from "@/lib/constants";
import type { ReviewStatus, ProofStatus, Role } from "@/lib/constants";
import { admitCell, admitEvent, type Rejection } from "@/lib/gateway/admit";
import type { GatewayReject, StagedRecord } from "@/lib/types";
import { scoreSimilarCells, computeHsl, deriveVelaInsights, type SimilarHit, type ComputedHsl } from "@/lib/arc/intelligence";

const now = () => new Date().toISOString();

export interface CellFilter {
  site_id?: string;
  status?: string;
  severity?: string;
  task?: string;
  owner_id?: string;
}

async function sb() {
  return createServerSupabase();
}

/**
 * Surface Supabase errors instead of silently ignoring them. A failed write
 * (RLS rejection, FK/constraint violation, connection drop) must NOT look like a
 * success — without these, `const { data } = await q` dropped the error and a
 * broken write returned the in-memory object as if it had persisted.
 */
async function dbWrite(op: PromiseLike<{ error: unknown }>): Promise<void> {
  const { error } = await op;
  if (error) throw new Error(`Supabase write failed: ${(error as { message?: string })?.message ?? "unknown error"}`);
}
async function dbRead<T>(op: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await op;
  if (error) throw new Error(`Supabase query failed: ${(error as { message?: string })?.message ?? "unknown error"}`);
  return data;
}
// For `.single()` reads where "no row" is a valid null result (PGRST116) but any
// other error must still surface rather than silently becoming null.
async function dbReadMaybe<T>(op: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  const { data, error } = await op;
  if (error && (error as { code?: string }).code !== "PGRST116") {
    throw new Error(`Supabase query failed: ${(error as { message?: string })?.message ?? "unknown error"}`);
  }
  return data ?? null;
}

// ── Multi-tenancy ────────────────────────────────────────────────────────────
export function currentUser(): Profile {
  // Mock session. In live mode the app-layer tenant/role checks are the mock
  // emulation of Postgres RLS, which is the authoritative gate after cutover.
  return store.profiles.find((p) => p.id === getSessionUserId()) ?? store.profiles[0];
}

/**
 * Resolve the acting user for a write. In mock mode this is the mock session
 * user; in live mode it is the real authenticated user (Supabase session →
 * profile) so records are stamped with the actual auth.uid() — which the uuid
 * foreign keys to `profiles` require. Routes await this for the actor id instead
 * of the synchronous currentUser(), which can't reach the live session.
 */
export const getSessionUser = cache(async (): Promise<Profile> => {
  if (MOCK_MODE) return currentUser();
  const c = await sb();
  const { data: auth } = await c!.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new AuthorizationError("not authenticated");
  const { data } = await c!.from("profiles").select("*").eq("id", uid).single();
  if (!data) throw new AuthorizationError("no profile for the authenticated user");
  return data as Profile;
});

/**
 * The acting user for an authorization decision on a write. Mock mode uses the
 * synchronous mock session; live mode uses the real Supabase session (memoized
 * per request by getSessionUser's cache()), so assertCanWrite/resolveWriteTenant
 * gate on the actual authenticated user, not the mock fixture.
 */
async function getActingUser(): Promise<Profile> {
  return MOCK_MODE ? currentUser() : getSessionUser();
}

/**
 * The active tenant scope. null = global operator (sees every tenant). In live
 * mode this is enforced by RLS in Postgres; in mock mode we emulate the same
 * isolation here so behavior matches before and after cutover.
 */
export function tenantScope(): string | null {
  return currentUser().tenant_id;
}

function inScope<T extends { tenant_id: string | null }>(rows: T[]): T[] {
  const t = tenantScope();
  return t === null ? rows : rows.filter((r) => r.tenant_id === t);
}

/**
 * Thrown when a write is denied by app-layer authorization. Routes map it to a
 * 403. In live mode Postgres RLS (0002_rls.sql) is the real enforcement; this
 * mirrors the same tenant + role rules in the app/mock layer so isolation holds
 * everywhere, not only against the database.
 */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Assert the current user may write a row in `targetTenantId` with one of
 * `allowed` roles. Global operators (tenant_id null) pass the tenant check;
 * the role check still applies. Mirrors the RLS `in_tenant` + role gates.
 */
async function assertCanWrite(targetTenantId: string, allowed: readonly Role[]): Promise<void> {
  const u = await getActingUser();
  const sameTenant = u.tenant_id === null || u.tenant_id === targetTenantId;
  if (!sameTenant) throw new AuthorizationError("cross-tenant write denied");
  if (!allowed.includes(u.role)) throw new AuthorizationError(`role '${u.role}' is not permitted for this action`);
}

/**
 * Resolve the tenant a write should land in: the row's own tenant if known,
 * else the caller's scope. Refuses (rather than persisting an empty-tenant,
 * mis-tenanted row) when neither is available.
 */
async function resolveWriteTenant(candidate: string | null | undefined): Promise<string> {
  const t = candidate ?? (await getActingUser()).tenant_id;
  if (!t) throw new AuthorizationError("could not resolve a tenant for this write");
  return t;
}

/**
 * Thrown when the AI Gateway blocks a record at write time (bad reference,
 * duplicate, …). Routes map it to a 422. The blocked record is recorded to the
 * exception log first (recordRejection) so it surfaces in the /gateway queue.
 */
export class GatewayRejectionError extends Error {
  rejections: Rejection[];
  constructor(rejections: Rejection[]) {
    super(rejections.map((r) => r.reason).join("; "));
    this.name = "GatewayRejectionError";
    this.rejections = rejections;
  }
}

// Log one exception-queue entry per blocked record (reasons joined), carrying
// the attempted payload so a steward can re-validate it later.
async function recordRejection(kind: GatewayReject["kind"], summary: string, tenant_id: string, actor_id: string, payload: Record<string, unknown>, rejections: Rejection[]): Promise<void> {
  const row: GatewayReject = {
    id: nextId("rej"), tenant_id, kind, summary,
    category: [...new Set(rejections.map((r) => r.category))].join(" · ") || "Gateway",
    reason: rejections.map((r) => r.reason).join("; "),
    status: "blocked", payload, actor_id, created_at: now(),
  };
  if (MOCK_MODE) { store.rejects.unshift(row); return; }
  const c = await sb();
  await dbWrite(c!.from("gateway_rejects").insert(row));
}

/** The AI Gateway exception log — records currently blocked from the database. */
export async function getRejects(): Promise<GatewayReject[]> {
  if (MOCK_MODE) return inScope(store.rejects).filter((r) => r.status === "blocked");
  const c = await sb();
  const data = await dbRead(c!.from("gateway_rejects").select("*").eq("status", "blocked"));
  return (data ?? []) as GatewayReject[];
}

async function findBlockedReject(id: string): Promise<GatewayReject | null> {
  if (MOCK_MODE) return store.rejects.find((r) => r.id === id && r.status === "blocked") ?? null;
  const c = await sb();
  return await dbReadMaybe<GatewayReject>(c!.from("gateway_rejects").select("*").eq("id", id).eq("status", "blocked").single());
}

async function setRejectFields(id: string, rej: GatewayReject, patch: Partial<Pick<GatewayReject, "status" | "reason">>): Promise<void> {
  if (MOCK_MODE) { Object.assign(rej, patch); return; }
  await dbWrite((await sb())!.from("gateway_rejects").update(patch).eq("id", id));
}

export interface RevalidateResult {
  ok: boolean;
  reason?: string; // why it is still blocked, when ok is false
}

/**
 * Re-run the AI Gateway over a previously-blocked record's stored payload. If it
 * now admits (e.g. the duplicate was closed, the missing location was added),
 * the record is written and the exception entry is marked resolved. Steward
 * action — supervisor and up. Passes logReject:false so a re-failure updates the
 * existing entry instead of stacking a new one.
 */
export async function revalidateReject(id: string, userId: string): Promise<RevalidateResult | null> {
  const rej = await findBlockedReject(id);
  if (!rej) return null;
  await assertCanWrite(rej.tenant_id ?? "", [...SUPERVISOR_ROLES]);
  try {
    if (rej.kind === "safety_cell") await createCell(rej.payload as unknown as SafetyCellInput, userId, { logReject: false });
    else await createEvent(rej.payload as unknown as EventInput, userId, { logReject: false });
    await setRejectFields(id, rej, { status: "resolved" });
    return { ok: true };
  } catch (e) {
    if (e instanceof GatewayRejectionError) {
      const reason = e.rejections.map((r) => r.reason).join("; ");
      await setRejectFields(id, rej, { reason });
      return { ok: false, reason };
    }
    throw e;
  }
}

/** Dismiss a blocked record — mark the exception entry resolved without writing. */
export async function dismissReject(id: string): Promise<GatewayReject | null> {
  const rej = await findBlockedReject(id);
  if (!rej) return null;
  await assertCanWrite(rej.tenant_id ?? "", [...SUPERVISOR_ROLES]);
  await setRejectFields(id, rej, { status: "resolved" });
  return rej;
}

// ── Staging / human review ───────────────────────────────────────────────────
// Gateway-validated records wait here until a human reviewer approves them.
// Nothing in staging is in the live Cell Database (map / graph / 3D web).

/** Records awaiting human review, scoped to the caller's tenant. */
export async function getStaged(): Promise<StagedRecord[]> {
  if (MOCK_MODE) return inScope(store.staged);
  const c = await sb();
  const data = await dbRead(c!.from("staged_records").select("*"));
  return (data ?? []) as StagedRecord[];
}

async function findStaged(id: string): Promise<StagedRecord | null> {
  if (MOCK_MODE) return store.staged.find((s) => s.id === id) ?? null;
  const c = await sb();
  return await dbReadMaybe<StagedRecord>(c!.from("staged_records").select("*").eq("id", id).single());
}

async function removeStaged(id: string): Promise<void> {
  if (MOCK_MODE) {
    const idx = store.staged.findIndex((s) => s.id === id);
    if (idx !== -1) store.staged.splice(idx, 1);
    return;
  }
  await dbWrite((await sb())!.from("staged_records").delete().eq("id", id));
}

/**
 * Approve a staged record: admit it into the live Cell Database — THIS is the
 * moment it appears on the map / graph / 3D web — and attach any carried
 * evidence. Reviewer action: supervisor and up.
 */
export async function approveStaged(id: string, userId: string): Promise<StagedRecord | null> {
  const rec = await findStaged(id);
  if (!rec) return null;
  await assertCanWrite(rec.tenant_id ?? "", [...SUPERVISOR_ROLES]);
  if (rec.kind === "safety_cell") {
    if (MOCK_MODE) store.cells.unshift(rec.payload as SafetyCell);
    else await dbWrite((await sb())!.from("safety_cells").insert(rec.payload as SafetyCell));
    for (const e of rec.evidence ?? []) {
      await createEvidence({ cell_id: (rec.payload as SafetyCell).id, kind: e.kind, name: e.name, summary: e.summary }, userId);
    }
    await addAudit({ actor_id: userId, action: "cell.admit", entity: "safety_cell", entity_id: rec.payload.id, reason: "approved by reviewer" });
  } else {
    if (MOCK_MODE) store.events.unshift(rec.payload as EventCell);
    else await dbWrite((await sb())!.from("event_cells").insert(rec.payload as EventCell));
    await addAudit({ actor_id: userId, action: "event.admit", entity: "event_cell", entity_id: rec.payload.id, reason: "approved by reviewer" });
  }
  await removeStaged(id);
  return rec;
}

/** Reject a staged record: it never enters the database; logged to the queue. */
export async function rejectStaged(id: string, userId: string): Promise<StagedRecord | null> {
  const rec = await findStaged(id);
  if (!rec) return null;
  await assertCanWrite(rec.tenant_id ?? "", [...SUPERVISOR_ROLES]);
  await recordRejection(rec.kind, rec.title, rec.tenant_id ?? "", userId, rec.payload as unknown as Record<string, unknown>, [
    { category: "Human Review", reason: "Rejected by human reviewer" },
  ]);
  await removeStaged(id);
  await addAudit({ actor_id: userId, action: rec.kind === "safety_cell" ? "cell.reject" : "event.reject", entity: rec.kind, entity_id: rec.payload.id, reason: "rejected by reviewer" });
  return rec;
}

export async function getTenants(): Promise<Tenant[]> {
  if (MOCK_MODE) return store.tenants;
  const c = await sb();
  const { data } = await c!.from("tenants").select("*");
  return (data ?? []) as Tenant[];
}

// ── Reference data ───────────────────────────────────────────────────────────
export async function getProfiles(): Promise<Profile[]> {
  if (MOCK_MODE) return store.profiles;
  const c = await sb();
  const { data } = await c!.from("profiles").select("*");
  return (data ?? []) as Profile[];
}

export async function getSites(): Promise<Site[]> {
  if (MOCK_MODE) return inScope(store.sites);
  const c = await sb();
  const { data } = await c!.from("sites").select("*");
  return (data ?? []) as Site[];
}

export async function getLocations(siteId?: string): Promise<SafetyLocation[]> {
  if (MOCK_MODE) {
    return inScope(siteId ? store.locations.filter((l) => l.site_id === siteId) : store.locations);
  }
  const c = await sb();
  let q = c!.from("locations").select("*");
  if (siteId) q = q.eq("site_id", siteId);
  const { data } = await q;
  return (data ?? []) as SafetyLocation[];
}

// ── Safety Cells ─────────────────────────────────────────────────────────────
export async function getCells(filter: CellFilter = {}): Promise<SafetyCell[]> {
  if (MOCK_MODE) {
    return inScope(store.cells).filter(
      (c) =>
        (!filter.site_id || c.site_id === filter.site_id) &&
        (!filter.status || c.status === filter.status) &&
        (!filter.severity || c.severity === filter.severity) &&
        (!filter.owner_id || c.owner_id === filter.owner_id) &&
        (!filter.task || c.task.toLowerCase().includes(filter.task.toLowerCase())),
    );
  }
  const c = await sb();
  let q = c!.from("safety_cells").select("*");
  if (filter.site_id) q = q.eq("site_id", filter.site_id);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.severity) q = q.eq("severity", filter.severity);
  if (filter.owner_id) q = q.eq("owner_id", filter.owner_id);
  const { data } = await q;
  return (data ?? []) as SafetyCell[];
}

export async function getCell(id: string): Promise<SafetyCell | null> {
  if (MOCK_MODE) return inScope(store.cells).find((c) => c.id === id) ?? null;
  const c = await sb();
  const { data } = await c!.from("safety_cells").select("*").eq("id", id).single();
  return (data as SafetyCell) ?? null;
}

/** Risk score is for sorting/heat only — never a risk-acceptance verdict. */
export function computeRiskScore(severity: string, likelihood: number): number {
  const sevWeight: Record<string, number> = { low: 25, medium: 50, high: 75, critical: 95 };
  const base = sevWeight[severity] ?? 50;
  return Math.round(base * 0.7 + (likelihood / 5) * 100 * 0.3);
}

export async function createCell(
  input: SafetyCellInput,
  userId: string,
  opts: { logReject?: boolean; evidence?: StagedRecord["evidence"] } = {},
): Promise<SafetyCell> {
  // Derive tenant from the chosen site so the cell can never be mis-tenanted.
  const sites = MOCK_MODE ? store.sites : await getSites();
  const tenant_id = await resolveWriteTenant(sites.find((s) => s.id === input.site_id)?.tenant_id);
  await assertCanWrite(tenant_id, [...WRITE_ROLES]);
  // AI Gateway admission: block bad references / duplicates before they enter.
  // Duplicate detection spans the live database AND the staging queue, so two
  // pending dupes can't both sit awaiting review.
  const locations = MOCK_MODE ? store.locations : await getLocations();
  const stagedCells = (MOCK_MODE ? store.staged : await getStaged()).filter((s) => s.kind === "safety_cell").map((s) => s.payload as SafetyCell);
  const existingCells = [...(MOCK_MODE ? store.cells : await getCells()), ...stagedCells];
  const gate = admitCell({ title: input.title, site_id: input.site_id, location_id: input.location_id, tenant_id }, { sites, locations, cells: existingCells });
  if (!gate.ok) {
    if (opts.logReject !== false) await recordRejection("safety_cell", input.title, tenant_id, userId, input as unknown as Record<string, unknown>, gate.rejections);
    throw new GatewayRejectionError(gate.rejections);
  }
  const cell: SafetyCell = {
    id: nextId("cell"),
    tenant_id,
    site_id: input.site_id,
    location_id: input.location_id,
    title: input.title,
    description: input.description,
    task: input.task,
    crew: input.crew ?? null,
    company: input.company ?? null,
    permit_ref: input.permit_ref ?? null,
    hazard_genome: input.hazard_genome,
    severity: input.severity,
    likelihood: input.likelihood,
    risk_score: computeRiskScore(input.severity, input.likelihood),
    status: input.status ?? "open",
    owner_id: input.owner_id ?? null,
    created_by: userId,
    created_at: now(),
    updated_at: now(),
  };
  // Gateway-validated — hold in STAGING for human review. The cell does NOT enter
  // the live Cell Database (and therefore the map / graph / 3D web) until a
  // reviewer approves it via approveStaged().
  if (MOCK_MODE) {
    store.staged.unshift({ id: nextId("stg"), tenant_id, kind: "safety_cell", title: cell.title, submitted_by: userId, submitted_at: now(), payload: cell, evidence: opts.evidence });
    await addAudit({ actor_id: userId, action: "cell.stage", entity: "safety_cell", entity_id: cell.id, reason: null });
    return cell;
  }
  const c = await sb();
  await dbWrite(c!.from("staged_records").insert({ id: nextId("stg"), tenant_id, kind: "safety_cell", title: cell.title, submitted_by: userId, submitted_at: now(), payload: cell, evidence: opts.evidence ?? null }));
  await addAudit({ actor_id: userId, action: "cell.stage", entity: "safety_cell", entity_id: cell.id, reason: null });
  return cell;
}

export async function updateCell(id: string, patch: Partial<SafetyCell>, userId: string): Promise<SafetyCell | null> {
  const existing = await getCell(id);
  if (!existing) return null;
  await assertCanWrite(existing.tenant_id, [...WRITE_ROLES]);
  if (MOCK_MODE) {
    const i = store.cells.findIndex((c) => c.id === id);
    if (i === -1) return null;
    store.cells[i] = { ...store.cells[i], ...patch, updated_at: now() };
    await addAudit({ actor_id: userId, action: "cell.update", entity: "safety_cell", entity_id: id, reason: null });
    return store.cells[i];
  }
  const c = await sb();
  const data = await dbRead(c!.from("safety_cells").update({ ...patch, updated_at: now() }).eq("id", id).select().single());
  return (data as SafetyCell) ?? null;
}

// ── Bundles (cell + everything attached) ─────────────────────────────────────
export async function getBundle(id: string): Promise<CellBundle | null> {
  const cell = await getCell(id);
  if (!cell) return null;
  const [locations, sites, proofs, evidence, findings, actions] = await Promise.all([
    getLocations(cell.site_id),
    getSites(),
    getProofs(id),
    getEvidence(id),
    getFindings(id),
    getActions(id),
  ]);
  const location = locations.find((l) => l.id === cell.location_id)!;
  const site = sites.find((s) => s.id === cell.site_id)!;
  return { cell, location, site, proofs, evidence, findings, actions };
}

// ── Control proofs ───────────────────────────────────────────────────────────
export async function getProofs(cellId?: string): Promise<ControlProof[]> {
  if (MOCK_MODE) return inScope(cellId ? store.proofs.filter((p) => p.cell_id === cellId) : store.proofs);
  const c = await sb();
  let q = c!.from("control_proofs").select("*");
  if (cellId) q = q.eq("cell_id", cellId);
  const { data } = await q;
  return (data ?? []) as ControlProof[];
}

export async function updateProofStatus(
  id: string,
  status: ProofStatus,
  userId: string,
  opts: { evidence_summary?: string | null; expires_at?: string | null; reason?: string } = {},
): Promise<ControlProof | null> {
  const proof = (await getProofs()).find((p) => p.id === id);
  if (!proof) return null;
  await assertCanWrite(proof.tenant_id, [...WRITE_ROLES]);
  if (MOCK_MODE) {
    const i = store.proofs.findIndex((p) => p.id === id);
    if (i === -1) return null;
    store.proofs[i] = {
      ...store.proofs[i],
      status,
      verifier_id: userId,
      verified_at: now(),
      evidence_summary: opts.evidence_summary ?? store.proofs[i].evidence_summary,
      expires_at: opts.expires_at ?? store.proofs[i].expires_at,
    };
    await addAudit({ actor_id: userId, action: "proof.status_change", entity: "control_proof", entity_id: id, reason: opts.reason ?? null });
    return store.proofs[i];
  }
  const c = await sb();
  const data = await dbRead(
    c!
      .from("control_proofs")
      .update({ status, verifier_id: userId, verified_at: now(), evidence_summary: opts.evidence_summary, expires_at: opts.expires_at })
      .eq("id", id)
      .select()
      .single(),
  );
  return (data as ControlProof) ?? null;
}

// ── Evidence ─────────────────────────────────────────────────────────────────
export async function getEvidence(cellId?: string): Promise<EvidenceFile[]> {
  if (MOCK_MODE) return inScope(cellId ? store.evidence.filter((e) => e.cell_id === cellId) : store.evidence);
  const c = await sb();
  let q = c!.from("evidence_files").select("*");
  if (cellId) q = q.eq("cell_id", cellId);
  const { data } = await q;
  return (data ?? []) as EvidenceFile[];
}

export async function createEvidence(
  e: { cell_id: string; kind: EvidenceFile["kind"]; name: string; summary?: string },
  userId: string,
): Promise<EvidenceFile> {
  const cell = await getCell(e.cell_id);
  const tenant_id = await resolveWriteTenant(cell?.tenant_id);
  await assertCanWrite(tenant_id, [...WRITE_ROLES]);
  const file: EvidenceFile = {
    id: nextId("ev"),
    tenant_id,
    cell_id: e.cell_id,
    kind: e.kind,
    name: e.name,
    storage_path: `mock://${e.name}`,
    summary: e.summary ?? null,
    uploaded_by: userId,
    created_at: now(),
  };
  if (MOCK_MODE) store.evidence.push(file);
  else {
    const c = await sb();
    await dbWrite(c!.from("evidence_files").insert(file));
  }
  return file;
}

// ── Causal edges ─────────────────────────────────────────────────────────────
export async function getEdges(siteId?: string): Promise<CausalEdge[]> {
  if (MOCK_MODE) {
    const scoped = inScope(store.edges);
    if (!siteId) return scoped;
    const cellIds = new Set(store.cells.filter((c) => c.site_id === siteId).map((c) => c.id));
    return scoped.filter((e) => cellIds.has(e.source_cell_id) || cellIds.has(e.target_cell_id));
  }
  const c = await sb();
  const { data } = await c!.from("causal_edges").select("*");
  return (data ?? []) as CausalEdge[];
}

export async function createEdge(
  e: { source_cell_id: string; target_cell_id: string; type: CausalEdge["type"]; confidence: number; rationale: string },
  userId: string,
  aiGenerated = false,
): Promise<CausalEdge> {
  const src = await getCell(e.source_cell_id);
  const tenant_id = src?.tenant_id ?? tenantScope() ?? "";
  // AI-generated edges are a system write (the causality engine); only gate the
  // human-authored path so role enforcement doesn't block automated analysis.
  if (!aiGenerated) await assertCanWrite(await resolveWriteTenant(src?.tenant_id), [...WRITE_ROLES]);
  const edge: CausalEdge = {
    id: nextId("edge"),
    tenant_id,
    ...e,
    review_status: aiGenerated ? "pending" : "accepted",
    ai_generated: aiGenerated,
    created_at: now(),
  };
  if (MOCK_MODE) store.edges.push(edge);
  else {
    const c = await sb();
    await dbWrite(c!.from("causal_edges").insert(edge));
  }
  await addAudit({ actor_id: userId, action: "edge.create", entity: "causal_edge", entity_id: edge.id, reason: null });
  return edge;
}

export async function reviewEdge(
  id: string,
  review_status: ReviewStatus,
  userId: string,
  patch: { type?: CausalEdge["type"]; rationale?: string } = {},
): Promise<CausalEdge | null> {
  const edge = (await getEdges()).find((e) => e.id === id);
  if (!edge) return null;
  await assertCanWrite(edge.tenant_id, [...SUPERVISOR_ROLES]);
  if (MOCK_MODE) {
    const i = store.edges.findIndex((e) => e.id === id);
    if (i === -1) return null;
    store.edges[i] = { ...store.edges[i], review_status, ...patch };
    await addAudit({ actor_id: userId, action: `edge.${review_status}`, entity: "causal_edge", entity_id: id, reason: patch.rationale ?? null });
    return store.edges[i];
  }
  const c = await sb();
  const data = await dbRead(c!.from("causal_edges").update({ review_status, ...patch }).eq("id", id).select().single());
  return (data as CausalEdge) ?? null;
}

// ── AI findings ──────────────────────────────────────────────────────────────
export async function getFindings(cellId?: string): Promise<AiFinding[]> {
  if (MOCK_MODE) return inScope(cellId ? store.findings.filter((f) => f.cell_id === cellId) : store.findings);
  const c = await sb();
  let q = c!.from("ai_findings").select("*");
  if (cellId) q = q.eq("cell_id", cellId);
  const { data } = await q;
  return (data ?? []) as AiFinding[];
}

export async function saveFinding(f: AiFinding): Promise<AiFinding> {
  if (MOCK_MODE) store.findings.unshift(f);
  else {
    const c = await sb();
    await dbWrite(c!.from("ai_findings").insert(f));
  }
  return f;
}

export async function reviewFinding(id: string, review_status: ReviewStatus, userId: string): Promise<AiFinding | null> {
  const finding = (await getFindings()).find((f) => f.id === id);
  if (!finding) return null;
  await assertCanWrite(finding.tenant_id, [...SUPERVISOR_ROLES]);
  if (MOCK_MODE) {
    const i = store.findings.findIndex((f) => f.id === id);
    if (i === -1) return null;
    store.findings[i] = { ...store.findings[i], review_status };
    await addAudit({ actor_id: userId, action: `ai.${review_status}`, entity: "ai_finding", entity_id: id, reason: null });
    return store.findings[i];
  }
  const c = await sb();
  const data = await dbRead(c!.from("ai_findings").update({ review_status }).eq("id", id).select().single());
  return (data as AiFinding) ?? null;
}

// ── Actions ──────────────────────────────────────────────────────────────────
export async function getActions(cellId?: string): Promise<SafetyAction[]> {
  if (MOCK_MODE) return inScope(cellId ? store.actions.filter((a) => a.cell_id === cellId) : store.actions);
  const c = await sb();
  let q = c!.from("actions").select("*");
  if (cellId) q = q.eq("cell_id", cellId);
  const { data } = await q;
  return (data ?? []) as SafetyAction[];
}

export async function createAction(
  a: { cell_id: string; title: string; kind: "corrective" | "preventive"; owner_id?: string | null; due_date?: string | null },
  userId: string,
): Promise<SafetyAction> {
  const cell = await getCell(a.cell_id);
  const tenant_id = await resolveWriteTenant(cell?.tenant_id);
  await assertCanWrite(tenant_id, [...SUPERVISOR_ROLES]);
  const action: SafetyAction = {
    id: nextId("act"),
    tenant_id,
    cell_id: a.cell_id,
    title: a.title,
    kind: a.kind,
    owner_id: a.owner_id ?? null,
    due_date: a.due_date ?? null,
    status: "open",
    closed_with_proof: false,
    closure_note: null,
    created_at: now(),
  };
  if (MOCK_MODE) store.actions.unshift(action);
  else {
    const c = await sb();
    await dbWrite(c!.from("actions").insert(action));
  }
  await addAudit({ actor_id: userId, action: "action.create", entity: "action", entity_id: action.id, reason: null });
  return action;
}

export async function updateAction(id: string, patch: Partial<SafetyAction>, userId: string): Promise<SafetyAction | null> {
  const action = (await getActions()).find((a) => a.id === id);
  if (!action) return null;
  await assertCanWrite(action.tenant_id, [...SUPERVISOR_ROLES]);
  if (MOCK_MODE) {
    const i = store.actions.findIndex((a) => a.id === id);
    if (i === -1) return null;
    store.actions[i] = { ...store.actions[i], ...patch };
    await addAudit({ actor_id: userId, action: "action.update", entity: "action", entity_id: id, reason: patch.closure_note ?? null });
    return store.actions[i];
  }
  const c = await sb();
  const data = await dbRead(c!.from("actions").update(patch).eq("id", id).select().single());
  return (data as SafetyAction) ?? null;
}

// ── Audit ────────────────────────────────────────────────────────────────────
export async function addAudit(entry: Omit<AuditEntry, "id" | "created_at" | "tenant_id">): Promise<void> {
  // Use the acting user's tenant (the real authenticated user in live mode), so
  // the audit row passes the in_tenant RLS check — tenantScope() is the mock
  // session and would be null in live.
  const row: AuditEntry = { id: nextId("aud"), tenant_id: (await getActingUser()).tenant_id, created_at: now(), ...entry };
  if (MOCK_MODE) store.audit.unshift(row);
  else {
    const c = await sb();
    await dbWrite(c!.from("audit_log").insert(row));
  }
}

// ── Comments (collaboration) ─────────────────────────────────────────────────
export async function getComments(cellId?: string): Promise<Comment[]> {
  if (MOCK_MODE) {
    const rows = cellId ? store.comments.filter((c) => c.cell_id === cellId) : store.comments;
    return inScope(rows).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  const c = await sb();
  let q = c!.from("comments").select("*");
  if (cellId) q = q.eq("cell_id", cellId);
  const { data } = await q;
  return (data ?? []) as Comment[];
}

export async function createComment(cellId: string, body: string, userId: string): Promise<Comment | null> {
  const cell = await getCell(cellId);
  if (!cell) return null;
  await assertCanWrite(cell.tenant_id, [...WRITE_ROLES]);
  const comment: Comment = {
    id: nextId("cm"),
    tenant_id: cell.tenant_id,
    cell_id: cellId,
    author_id: userId,
    body,
    created_at: now(),
  };
  if (MOCK_MODE) store.comments.push(comment);
  else {
    const c = await sb();
    await dbWrite(c!.from("comments").insert(comment));
  }
  await addAudit({ actor_id: userId, action: "comment.create", entity: "comment", entity_id: comment.id, reason: null });
  return comment;
}

// ── Risk Intelligence Framework objects (manual §6) ──────────────────────────
export async function getEvents(siteId?: string): Promise<EventCell[]> {
  if (MOCK_MODE) return inScope(siteId ? store.events.filter((e) => e.site_id === siteId) : store.events);
  const c = await sb();
  let q = c!.from("event_cells").select("*");
  if (siteId) q = q.eq("site_id", siteId);
  const { data } = await q;
  return (data ?? []) as EventCell[];
}

/**
 * Behavior Cells are partly EMERGENT: we detect recurring patterns from the
 * scoped cell population and merge in any curated/stored behaviors for
 * (site, pattern) pairs detection didn't surface. So they grow with the data
 * rather than being purely hand-authored.
 */
/** Log an Event Cell (an outcome). Tenant is derived from the chosen site so it
 * can never be mis-tenanted, mirroring createCell. */
export async function createEvent(input: EventInput, userId: string, opts: { logReject?: boolean } = {}): Promise<EventCell> {
  const sites = MOCK_MODE ? store.sites : await getSites();
  const tenant_id = await resolveWriteTenant(sites.find((s) => s.id === input.site_id)?.tenant_id);
  await assertCanWrite(tenant_id, [...SUPERVISOR_ROLES]);
  const gate = admitEvent({ title: input.title, site_id: input.site_id }, { sites });
  if (!gate.ok) {
    if (opts.logReject !== false) await recordRejection("event_cell", input.title, tenant_id, userId, input as unknown as Record<string, unknown>, gate.rejections);
    throw new GatewayRejectionError(gate.rejections);
  }
  const event: EventCell = {
    id: nextId("evt"),
    tenant_id,
    site_id: input.site_id,
    cell_id: input.cell_id ?? null,
    kind: input.kind,
    title: input.title,
    description: input.description ?? "",
    severity: input.severity,
    occurred_at: input.occurred_at ?? now(),
    created_at: now(),
  };
  // Gateway-validated — hold in STAGING for human review (mirrors createCell).
  if (MOCK_MODE) {
    store.staged.unshift({ id: nextId("stg"), tenant_id, kind: "event_cell", title: event.title, submitted_by: userId, submitted_at: now(), payload: event });
    await addAudit({ actor_id: userId, action: "event.stage", entity: "event_cell", entity_id: event.id, reason: null });
    return event;
  }
  const c = await sb();
  await dbWrite(c!.from("staged_records").insert({ id: nextId("stg"), tenant_id, kind: "event_cell", title: event.title, submitted_by: userId, submitted_at: now(), payload: event }));
  await addAudit({ actor_id: userId, action: "event.stage", entity: "event_cell", entity_id: event.id, reason: null });
  return event;
}

export async function getBehaviors(siteId?: string): Promise<BehaviorCell[]> {
  if (MOCK_MODE) {
    const cells = inScope(siteId ? store.cells.filter((c) => c.site_id === siteId) : store.cells);
    const derived = detectBehaviors(cells);
    const seeded = inScope(siteId ? store.behaviors.filter((b) => b.site_id === siteId) : store.behaviors);
    const seen = new Set(derived.map((b) => `${b.site_id}|${b.pattern}`));
    return [...derived, ...seeded.filter((b) => !seen.has(`${b.site_id}|${b.pattern}`))];
  }
  const c = await sb();
  let q = c!.from("behavior_cells").select("*");
  if (siteId) q = q.eq("site_id", siteId);
  const { data } = await q;
  return (data ?? []) as BehaviorCell[];
}

/**
 * The unified six-object risk graph (Precursor/Control/Failure/Behavior/Event/
 * Learning) for the current tenant scope. Gathers the scoped source rows and
 * projects them via the pure builder in src/lib/risk/objects.ts.
 */
export async function getRiskGraph(siteId?: string): Promise<RiskGraph> {
  const [cells, proofs, events, behaviors, findings, vela] = await Promise.all([
    getCells(siteId ? { site_id: siteId } : {}),
    getProofs(),
    getEvents(siteId),
    getBehaviors(siteId),
    getFindings(),
    getVelaInsights(),
  ]);
  const cellIds = new Set(cells.map((c) => c.id));
  return buildRiskGraph({
    cells,
    proofs: proofs.filter((p) => cellIds.has(p.cell_id)),
    events,
    behaviors,
    findings: findings.filter((f) => f.cell_id !== null && cellIds.has(f.cell_id)),
    vela,
  });
}

/**
 * ARC P-CLSS Forecast — the per-location "what is likely to fail next"
 * prediction for the current tenant scope. Gathers the scoped leading
 * indicators and runs the pure engine in src/lib/risk/forecast.ts.
 */
export async function getForecast(siteId?: string): Promise<LocationForecast[]> {
  const [locations, cells, proofs, events, behaviors, actions, hsl, sites] = await Promise.all([
    getLocations(siteId),
    getCells(siteId ? { site_id: siteId } : {}),
    getProofs(),
    getEvents(siteId),
    getBehaviors(siteId),
    getActions(),
    getHslReadings(siteId),
    getSites(),
  ]);
  const cellIds = new Set(cells.map((c) => c.id));
  return buildForecast({
    locations,
    cells,
    proofs: proofs.filter((p) => cellIds.has(p.cell_id)),
    events,
    behaviors,
    actions: actions.filter((a) => cellIds.has(a.cell_id)),
    hsl,
    sites,
    now: Date.now(),
  });
}

export async function getAudit(): Promise<AuditEntry[]> {
  if (MOCK_MODE) return inScope(store.audit);
  const c = await sb();
  const { data } = await c!.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
  return (data ?? []) as AuditEntry[];
}

// ── ARC reads ────────────────────────────────────────────────────────────────
export async function getExpCaptures(siteId?: string): Promise<ExpCapture[]> {
  if (MOCK_MODE) return inScope(siteId ? store.exp.filter((e) => e.site_id === siteId) : store.exp);
  const c = await sb();
  let q = c!.from("exp_captures").select("*");
  if (siteId) q = q.eq("site_id", siteId);
  const { data } = await q;
  return (data ?? []) as ExpCapture[];
}

export async function createExpCapture(
  input: { site_id: string; source: ExpCapture["source"]; subject: string; summary: string; hazard_memory?: ExpCapture["hazard_memory"] },
  _userId: string,
): Promise<ExpCapture> {
  const sites = MOCK_MODE ? store.sites : await getSites();
  const tenant_id = await resolveWriteTenant(sites.find((s) => s.id === input.site_id)?.tenant_id);
  await assertCanWrite(tenant_id, [...WRITE_ROLES]);
  const capture: ExpCapture = {
    id: nextId("exp"),
    tenant_id,
    site_id: input.site_id,
    source: input.source,
    subject: input.subject,
    summary: input.summary,
    hazard_memory: input.hazard_memory ?? null,
    embedded: false,
    created_at: now(),
  };
  if (MOCK_MODE) store.exp.unshift(capture);
  else {
    const c = await sb();
    await dbWrite(c!.from("exp_captures").insert(capture));
  }
  return capture;
}

export async function getHslReadings(siteId?: string): Promise<HslReading[]> {
  if (MOCK_MODE) return inScope(siteId ? store.hsl.filter((h) => h.site_id === siteId) : store.hsl);
  const c = await sb();
  let q = c!.from("hsl_signals").select("*");
  if (siteId) q = q.eq("site_id", siteId);
  const { data } = await q;
  return (data ?? []) as HslReading[];
}

export async function getPclssRuns(siteId?: string): Promise<PclssRun[]> {
  if (MOCK_MODE) return inScope(siteId ? store.pclss.filter((r) => r.site_id === siteId) : store.pclss);
  const c = await sb();
  let q = c!.from("pclss_runs").select("*");
  if (siteId) q = q.eq("site_id", siteId);
  const { data } = await q;
  return (data ?? []) as PclssRun[];
}

/**
 * VELA is cross-tenant by design, so it reads across ALL tenants (no scope) —
 * in live mode this runs as a privileged service job. We merge patterns derived
 * from real data with curated seed insights, deduped by pattern.
 */
export async function getVelaInsights(): Promise<VelaInsight[]> {
  if (MOCK_MODE) {
    const derived = deriveVelaInsights(store.cells, store.sites, store.findings, store.edges, new Date().toISOString());
    const seen = new Set(derived.map((d) => d.pattern));
    return [...derived, ...store.velaInsights.filter((v) => !seen.has(v.pattern))];
  }
  const c = await sb();
  const { data } = await c!.from("vela_insights").select("*");
  return (data ?? []) as VelaInsight[];
}

export async function savePclssRun(run: PclssRun): Promise<PclssRun> {
  if (MOCK_MODE) store.pclss.unshift(run);
  else {
    const c = await sb();
    await dbWrite(c!.from("pclss_runs").insert(run));
  }
  return run;
}

// ── ARC intelligence (live) ──────────────────────────────────────────────────
/** EXP knowledge ghost: prior cells whose hazard genome resembles this one. */
export async function getSimilarCells(cellId: string, limit = 5): Promise<SimilarHit[]> {
  const cell = await getCell(cellId);
  if (!cell) return [];
  const others = await getCells();
  return scoreSimilarCells(cell, others, limit);
}

/** Past outcomes (Event Cells) from situations resembling this cell. */
export async function getSimilarOutcomes(cellId: string, limit = 5): Promise<SimilarOutcome[]> {
  const cell = await getCell(cellId);
  if (!cell) return [];
  const [events, cells] = await Promise.all([getEvents(), getCells()]);
  return similarOutcomes(cell, events, cells, limit);
}

/** Human Signal Layer computed from live data for a site (not static readings). */
export async function getComputedHsl(siteId: string): Promise<ComputedHsl[]> {
  const [cells, proofs, actions, exp, profiles] = await Promise.all([
    getCells({ site_id: siteId }),
    getProofs(),
    getActions(),
    getExpCaptures(siteId),
    getProfiles(),
  ]);
  const cellIds = new Set(cells.map((c) => c.id));
  return computeHsl(
    {
      cells,
      proofs: proofs.filter((p) => cellIds.has(p.cell_id)),
      actions: actions.filter((a) => cellIds.has(a.cell_id)),
      exp,
      profiles,
    },
    Date.now(),
  );
}
