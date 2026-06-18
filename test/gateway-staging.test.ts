import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { setSessionUser } from "@/lib/data/store";
import { createCell, getCells, getStaged, approveStaged, rejectStaged, getRejects, AuthorizationError } from "@/lib/data/repo";
import { GET as stagedGET, PATCH as stagedPATCH } from "@/app/api/staged/route";
import type { SafetyCellInput } from "@/lib/schemas";

afterEach(() => setSessionUser("u_admin"));

const input = (over: Partial<SafetyCellInput> = {}): SafetyCellInput => ({
  site_id: "site_ridge", location_id: "loc_l3", title: "Staging base title", description: "d", task: "t",
  crew: null, company: null, permit_ref: null,
  hazard_genome: { energySource: "electrical", exposureType: "contact", trigger: "t", controlGap: "missing" },
  severity: "low", likelihood: 1, status: "open", owner_id: null, ...over,
});

const stagedIdFor = async (cellId: string) => (await getStaged()).find((s) => s.payload.id === cellId)!.id;

describe("Two-stage admission (gateway → human review)", () => {
  it("a gateway-validated cell is staged, NOT live in the database, until approved", async () => {
    setSessionUser("u_admin");
    const a = await createCell(input({ title: "Stage not live" }), "u_admin");
    // not in the live Cell Database (what feeds the map / graph / 3D web)
    expect((await getCells()).some((c) => c.id === a.id)).toBe(false);
    // but waiting in staging
    expect((await getStaged()).some((s) => s.payload.id === a.id)).toBe(true);
  });

  it("approval admits the record into the live database", async () => {
    setSessionUser("u_admin");
    const a = await createCell(input({ title: "Approve to live" }), "u_admin");
    await approveStaged(await stagedIdFor(a.id), "u_admin");
    expect((await getCells()).some((c) => c.id === a.id)).toBe(true); // now live
    expect((await getStaged()).some((s) => s.payload.id === a.id)).toBe(false); // off the queue
  });

  it("rejection keeps it out of the database and logs it to the exception queue", async () => {
    setSessionUser("u_admin");
    const a = await createCell(input({ title: "Reject in review" }), "u_admin");
    await rejectStaged(await stagedIdFor(a.id), "u_admin");
    expect((await getCells()).some((c) => c.id === a.id)).toBe(false); // never entered
    expect((await getRejects()).some((r) => /Rejected by human reviewer/i.test(r.reason))).toBe(true);
  });

  it("only a supervisor+ may approve or reject staged records", async () => {
    setSessionUser("u_admin");
    const a = await createCell(input({ title: "Steward only" }), "u_admin");
    const sid = await stagedIdFor(a.id);
    setSessionUser("u_field"); // contributor (tenant_summit)
    await expect(approveStaged(sid, "u_field")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("the staged record is visible and approvable through the route", async () => {
    setSessionUser("u_admin");
    const a = await createCell(input({ title: "Route approve" }), "u_admin");
    const sid = await stagedIdFor(a.id);
    const list = await (await stagedGET()).json();
    expect(list.staged.some((s: { id: string }) => s.id === sid)).toBe(true);
    const res = await stagedPATCH(new NextRequest("http://localhost/api/staged", { method: "PATCH", body: JSON.stringify({ id: sid, action: "approve" }), headers: { "Content-Type": "application/json" } }));
    expect(res.status).toBe(200);
    expect((await getCells()).some((c) => c.id === a.id)).toBe(true);
  });
});
