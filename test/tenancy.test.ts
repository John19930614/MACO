import { describe, it, expect, afterEach } from "vitest";
import { setSessionUser } from "@/lib/data/store";
import {
  getCells,
  getCell,
  getSites,
  getProofs,
  getHslReadings,
  getVelaInsights,
  currentUser,
  tenantScope,
  createCell,
  createEvent,
  createComment,
  createAction,
  updateAction,
  AuthorizationError,
} from "@/lib/data/repo";
import type { SafetyCellInput } from "@/lib/schemas";

/**
 * Tenant isolation. In mock mode the repo emulates exactly what Postgres RLS
 * (0002_rls.sql) will enforce: a tenant-scoped user sees only their tenant's
 * rows; a global operator sees everything; VELA is cross-tenant. These tests
 * are the behavioral contract the live RLS must reproduce after cutover.
 */
afterEach(() => {
  // u_admin is the global operator — restore it between tests.
  setSessionUser("u_admin");
});

describe("tenant isolation (RLS-equivalent in mock mode)", () => {
  it("a Pacific user sees only Pacific cells", async () => {
    setSessionUser("u_mgr"); // tenant_pacific
    expect(tenantScope()).toBe("tenant_pacific");
    const cells = await getCells();
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((c) => c.tenant_id === "tenant_pacific")).toBe(true);
  });

  it("a Summit user sees only Summit cells", async () => {
    setSessionUser("u_field"); // tenant_summit
    const cells = await getCells();
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((c) => c.tenant_id === "tenant_summit")).toBe(true);
  });

  it("tenants do not overlap and the global operator sees them all", async () => {
    setSessionUser("u_mgr"); // tenant_pacific
    const pacific = (await getCells()).map((c) => c.id);
    setSessionUser("u_field"); // tenant_summit
    const summit = (await getCells()).map((c) => c.id);
    setSessionUser("u_mgr3"); // tenant_apex
    const apex = (await getCells()).map((c) => c.id);
    // pairwise disjoint
    expect(new Set([...pacific, ...summit, ...apex]).size).toBe(pacific.length + summit.length + apex.length);

    setSessionUser("u_admin"); // global
    expect(tenantScope()).toBeNull();
    const all = (await getCells()).map((c) => c.id);
    expect(all.length).toBe(pacific.length + summit.length + apex.length);
    for (const id of [...pacific, ...summit, ...apex]) expect(all).toContain(id);
  });

  it("a scoped user cannot read another tenant's cell by id", async () => {
    setSessionUser("u_admin");
    const summitCell = (await getCells()).find((c) => c.tenant_id === "tenant_summit")!;
    setSessionUser("u_mgr"); // pacific
    expect(await getCell(summitCell.id)).toBeNull();
  });

  it("scopes sites, proofs and HSL readings too", async () => {
    setSessionUser("u_field"); // summit
    expect((await getSites()).every((s) => s.tenant_id === "tenant_summit")).toBe(true);
    expect((await getProofs()).every((p) => p.tenant_id === "tenant_summit")).toBe(true);
    expect((await getHslReadings()).every((h) => h.tenant_id === "tenant_summit")).toBe(true);
  });

  it("VELA insights are visible cross-tenant", async () => {
    setSessionUser("u_mgr");
    const a = await getVelaInsights();
    setSessionUser("u_field");
    const b = await getVelaInsights();
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBe(a.length); // same cross-tenant set regardless of scope
  });

  it("a new cell is stamped with the tenant of its site, not the actor", async () => {
    setSessionUser("u_admin"); // global actor
    const input: SafetyCellInput = {
      site_id: "site_ridge", // a Summit site
      location_id: "loc_l3",
      title: "Tenancy stamp test",
      description: "d",
      task: "t",
      crew: null,
      company: null,
      permit_ref: null,
      severity: "low",
      likelihood: 1,
      status: "open",
      owner_id: null,
      hazard_genome: { energySource: "electrical", exposureType: "contact", trigger: "t", controlGap: "missing" },
    };
    const cell = await createCell(input, currentUser().id);
    expect(cell.tenant_id).toBe("tenant_summit");
  });

  const cellInput = (site_id: string): SafetyCellInput => ({
    site_id,
    location_id: "loc_l3",
    title: "Authz test cell",
    description: "d",
    task: "t",
    crew: null,
    company: null,
    permit_ref: null,
    severity: "low",
    likelihood: 1,
    status: "open",
    hazard_genome: { energySource: "electrical", exposureType: "contact", trigger: "t", controlGap: "missing" },
    owner_id: null,
  });

  it("denies a cross-tenant write (Summit user writing into a Pacific site)", async () => {
    setSessionUser("u_field"); // tenant_summit contributor
    await expect(createCell(cellInput("site_harbor"), currentUser().id)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("denies a write whose role is not permitted (contributor logging an Event)", async () => {
    setSessionUser("u_field"); // contributor — events require supervisor+
    await expect(createEvent({ site_id: "site_ridge", kind: "incident", severity: "high", title: "Contributor event" }, currentUser().id)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("allows an in-tenant, sufficiently-privileged write", async () => {
    setSessionUser("u_sup2"); // tenant_summit supervisor
    const ev = await createEvent({ site_id: "site_ridge", kind: "near_miss", severity: "medium", title: "Supervisor-logged outcome", cell_id: "cell_006" }, currentUser().id);
    expect(ev.tenant_id).toBe("tenant_summit");
    // and a contributor may still comment within their tenant
    setSessionUser("u_field");
    const cm = await createComment("cell_006", "Field note", currentUser().id);
    expect(cm?.tenant_id).toBe("tenant_summit");
  });

  it("refuses a write whose tenant cannot be resolved (global operator, unknown site)", async () => {
    setSessionUser("u_admin"); // global operator — tenantScope() is null
    // Unknown site → no row tenant and no caller scope → must refuse, not write "".
    await expect(createCell(cellInput("site_does_not_exist"), currentUser().id)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("gates a mutate path (updateAction) the same way creates are gated", async () => {
    setSessionUser("u_sup2"); // tenant_summit supervisor — may create the action
    const action = await createAction({ cell_id: "cell_006", title: "Authz mutate test", kind: "preventive" }, currentUser().id);
    // A contributor in the same tenant cannot change it (supervisor+ only).
    setSessionUser("u_field");
    await expect(updateAction(action.id, { status: "in_progress" }, currentUser().id)).rejects.toBeInstanceOf(AuthorizationError);
    // The supervisor can.
    setSessionUser("u_sup2");
    const updated = await updateAction(action.id, { status: "in_progress" }, currentUser().id);
    expect(updated?.status).toBe("in_progress");
  });
});
