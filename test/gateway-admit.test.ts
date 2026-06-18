import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { setSessionUser } from "@/lib/data/store";
import { createCell, updateCell, getRejects, getSites, getLocations, getCells, getStaged, approveStaged, revalidateReject, dismissReject, GatewayRejectionError, AuthorizationError } from "@/lib/data/repo";
import { admitCell } from "@/lib/gateway/admit";
import { POST as cellsPOST } from "@/app/api/cells/route";
import { PATCH as rejectsPATCH } from "@/app/api/gateway/rejects/route";
import type { SafetyCellInput } from "@/lib/schemas";

afterEach(() => setSessionUser("u_admin"));

// A valid Safety Cell at a real summit location; override the title per test so
// independent tests don't collide on the duplicate gate.
const input = (over: Partial<SafetyCellInput> = {}): SafetyCellInput => ({
  site_id: "site_ridge", location_id: "loc_l3", title: "Gateway admit base title", description: "d", task: "t",
  crew: null, company: null, permit_ref: null,
  hazard_genome: { energySource: "electrical", exposureType: "contact", trigger: "t", controlGap: "missing" },
  severity: "low", likelihood: 1, status: "open", owner_id: null, ...over,
});

const post = (body: unknown) =>
  cellsPOST(new NextRequest("http://localhost/api/cells", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }));

describe("AI Gateway — write-time admission", () => {
  it("admitCell accepts a valid candidate and rejects a dangling location", async () => {
    setSessionUser("u_admin");
    const [sites, locations, cells] = await Promise.all([getSites(), getLocations(), getCells()]);
    expect(admitCell({ title: "fresh", site_id: "site_ridge", location_id: "loc_l3", tenant_id: "tenant_summit" }, { sites, locations, cells }).ok).toBe(true);
    expect(admitCell({ title: "fresh", site_id: "site_ridge", location_id: "loc_NOPE", tenant_id: "tenant_summit" }, { sites, locations, cells }).ok).toBe(false);
  });

  it("blocks a duplicate cell at write time and logs it to the exception queue", async () => {
    setSessionUser("u_admin");
    const a = await createCell(input({ title: "Dup gate alpha" }), "u_admin");
    expect(a.id).toBeTruthy();
    await expect(createCell(input({ title: "Dup gate alpha" }), "u_admin")).rejects.toBeInstanceOf(GatewayRejectionError);
    const rejects = await getRejects();
    expect(rejects.some((r) => r.kind === "safety_cell" && /duplicate/i.test(r.reason))).toBe(true);
  });

  it("blocks a cell with a dangling location reference", async () => {
    setSessionUser("u_admin");
    await expect(createCell(input({ title: "Bad ref cell", location_id: "loc_NOPE" }), "u_admin")).rejects.toBeInstanceOf(GatewayRejectionError);
  });

  it("returns 422 from POST /api/cells when the gateway blocks a duplicate", async () => {
    setSessionUser("u_admin");
    const body = input({ title: "Route dup gate" });
    expect((await post(body)).status).toBe(201);
    const dup = await post(body);
    expect(dup.status).toBe(422);
    const j = await dup.json();
    expect(j.error).toBe("rejected");
    expect(j.rejections.length).toBeGreaterThan(0);
  });

  it("re-validates a blocked record after the blocker is cleared, admitting it", async () => {
    setSessionUser("u_admin");
    const a = await createCell(input({ title: "Revalidate me" }), "u_admin");
    await expect(createCell(input({ title: "Revalidate me" }), "u_admin")).rejects.toBeInstanceOf(GatewayRejectionError);
    const rej = (await getRejects()).find((r) => r.summary === "Revalidate me")!;
    expect(rej).toBeTruthy();
    // Approve the staged original so it's live, then close it → the duplicate
    // blocker is gone, so re-validation should now admit the blocked record.
    const stagedA = (await getStaged()).find((s) => s.payload.id === a.id)!;
    await approveStaged(stagedA.id, "u_admin");
    await updateCell(a.id, { status: "closed" }, "u_admin");
    const res = await revalidateReject(rej.id, "u_admin");
    expect(res?.ok).toBe(true);
    expect((await getRejects()).some((r) => r.id === rej.id)).toBe(false); // resolved, off the queue
  });

  it("keeps a record blocked when re-validation still fails", async () => {
    setSessionUser("u_admin");
    await createCell(input({ title: "Still dupe" }), "u_admin");
    await expect(createCell(input({ title: "Still dupe" }), "u_admin")).rejects.toBeInstanceOf(GatewayRejectionError);
    const rej = (await getRejects()).find((r) => r.summary === "Still dupe")!;
    const res = await revalidateReject(rej.id, "u_admin"); // original is still open
    expect(res?.ok).toBe(false);
    expect((await getRejects()).some((r) => r.id === rej.id)).toBe(true);
  });

  it("dismisses a blocked record via the route, and only supervisors+ may act", async () => {
    setSessionUser("u_admin");
    await createCell(input({ title: "Dismiss me" }), "u_admin");
    await expect(createCell(input({ title: "Dismiss me" }), "u_admin")).rejects.toBeInstanceOf(GatewayRejectionError);
    const rej = (await getRejects()).find((r) => r.summary === "Dismiss me")!;
    // a contributor cannot act
    setSessionUser("u_field");
    await expect(dismissReject(rej.id)).rejects.toBeInstanceOf(AuthorizationError);
    // the steward can, via the route
    setSessionUser("u_admin");
    const res = await rejectsPATCH(new NextRequest("http://localhost/api/gateway/rejects", { method: "PATCH", body: JSON.stringify({ id: rej.id, action: "dismiss" }), headers: { "Content-Type": "application/json" } }));
    expect(res.status).toBe(200);
    expect((await getRejects()).some((r) => r.id === rej.id)).toBe(false);
  });
});
