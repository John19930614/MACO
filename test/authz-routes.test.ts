import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { setSessionUser } from "@/lib/data/store";
import { getProofs, getFindings, createEdge, createAction } from "@/lib/data/repo";
import { PATCH as actionsPATCH } from "@/app/api/actions/route";
import { PATCH as proofPATCH } from "@/app/api/proof/route";
import { PATCH as findingsPATCH } from "@/app/api/ai/findings/route";
import { PATCH as edgesPATCH } from "@/app/api/graph/edges/route";
import { PATCH as cellPATCH } from "@/app/api/cells/[id]/route";
import { POST as evidencePOST } from "@/app/api/evidence/route";
import { POST as expPOST } from "@/app/api/arc/exp/route";

/**
 * Authorization contract at the HTTP boundary. The repo gate (assertCanWrite)
 * and the withAuthz wrapper must together turn an under-privileged write into a
 * 403 on every mutate/create route — not just in the repo. A route added without
 * withAuthz, or wired to the wrong tier, fails here. All targets are in
 * tenant_summit so the role check (not the tenant check) is what bites.
 */
function req(url: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
  });
}

// tenant_summit users by tier: viewer < contributor < supervisor.
const VIEWER = "u_view";
const CONTRIB = "u_field";
const SUPER = "u_sup2";

let proofId: string;
let findingId: string;
let edgeId: string;
let actionId: string;

beforeAll(async () => {
  setSessionUser("u_admin"); // global operator — resolve targets across the store
  proofId = (await getProofs()).find((p) => p.tenant_id === "tenant_summit")!.id;
  findingId = (await getFindings()).find((f) => f.tenant_id === "tenant_summit")!.id;
  // Guarantee a summit edge to review (AI-generated create bypasses the gate).
  edgeId = (await createEdge({ source_cell_id: "cell_006", target_cell_id: "cell_008", type: "same_location", confidence: 0.5, rationale: "authz fixture" }, "u_admin", true)).id;
  actionId = (await createAction({ cell_id: "cell_006", title: "authz fixture action", kind: "preventive" }, "u_admin")).id;
});

afterEach(() => setSessionUser("u_admin"));

describe("authorization at the route layer (403 contract)", () => {
  // ── supervisor+ tier: contributor is denied, supervisor passes ──────────────
  it("PATCH /api/actions — contributor 403, supervisor 200", async () => {
    setSessionUser(CONTRIB);
    expect((await actionsPATCH(req("/api/actions", { id: actionId, status: "in_progress" }))).status).toBe(403);
    setSessionUser(SUPER);
    expect((await actionsPATCH(req("/api/actions", { id: actionId, status: "in_progress" }))).status).toBe(200);
  });

  it("PATCH /api/ai/findings — contributor 403, supervisor 200", async () => {
    setSessionUser(CONTRIB);
    expect((await findingsPATCH(req("/api/ai/findings", { id: findingId, review_status: "accepted" }))).status).toBe(403);
    setSessionUser(SUPER);
    expect((await findingsPATCH(req("/api/ai/findings", { id: findingId, review_status: "accepted" }))).status).toBe(200);
  });

  it("PATCH /api/graph/edges — contributor 403, supervisor 200", async () => {
    setSessionUser(CONTRIB);
    expect((await edgesPATCH(req("/api/graph/edges", { id: edgeId, review_status: "accepted" }))).status).toBe(403);
    setSessionUser(SUPER);
    expect((await edgesPATCH(req("/api/graph/edges", { id: edgeId, review_status: "accepted" }))).status).toBe(200);
  });

  // ── contributor+ tier: viewer is denied, contributor passes ─────────────────
  it("PATCH /api/cells/[id] — viewer 403, contributor 200", async () => {
    const params = { params: Promise.resolve({ id: "cell_006" }) };
    setSessionUser(VIEWER);
    expect((await cellPATCH(req("/api/cells/cell_006", { task: "authz" }), params)).status).toBe(403);
    setSessionUser(CONTRIB);
    expect((await cellPATCH(req("/api/cells/cell_006", { task: "authz" }), params)).status).toBe(200);
  });

  it("PATCH /api/proof — viewer 403, contributor 200", async () => {
    setSessionUser(VIEWER);
    expect((await proofPATCH(req("/api/proof", { id: proofId, status: "proven" }))).status).toBe(403);
    setSessionUser(CONTRIB);
    expect((await proofPATCH(req("/api/proof", { id: proofId, status: "proven" }))).status).toBe(200);
  });

  it("POST /api/evidence — viewer 403, contributor 201", async () => {
    const body = { cell_id: "cell_006", kind: "photo", name: "authz.jpg" };
    setSessionUser(VIEWER);
    expect((await evidencePOST(req("/api/evidence", body))).status).toBe(403);
    setSessionUser(CONTRIB);
    expect((await evidencePOST(req("/api/evidence", body))).status).toBe(201);
  });

  it("POST /api/arc/exp — viewer 403, contributor 201", async () => {
    const body = { site_id: "site_ridge", source: "walk_floor", subject: "authz", summary: "authz" };
    setSessionUser(VIEWER);
    expect((await expPOST(req("/api/arc/exp", body))).status).toBe(403);
    setSessionUser(CONTRIB);
    expect((await expPOST(req("/api/arc/exp", body))).status).toBe(201);
  });
});
