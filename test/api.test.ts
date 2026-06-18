import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as cellsGET, POST as cellsPOST } from "@/app/api/cells/route";
import { POST as analyzePOST } from "@/app/api/ai/analyze-cell/route";
import { GET as graphGET } from "@/app/api/graph/route";
import { GET as hslGET } from "@/app/api/arc/hsl/route";
import { PATCH as proofPATCH } from "@/app/api/proof/route";
import { POST as pclssPOST } from "@/app/api/arc/pclss/route";
import { GET as similarGET } from "@/app/api/cells/[id]/similar/route";
import { GET as eventsGET, POST as eventsPOST } from "@/app/api/events/route";
import { getCells } from "@/lib/data/repo";
import { setSessionUser } from "@/lib/data/store";

function req(url: string, init?: { method?: string; body?: unknown }) {
  return new NextRequest(`http://localhost${url}`, {
    method: init?.method ?? "GET",
    body: init?.body ? JSON.stringify(init.body) : undefined,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
}

describe("GET /api/cells", () => {
  it("returns cells filtered by site", async () => {
    const res = await cellsGET(req("/api/cells?site_id=site_harbor"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.cells)).toBe(true);
    expect(json.cells.every((c: { site_id: string }) => c.site_id === "site_harbor")).toBe(true);
  });
});

describe("POST /api/cells", () => {
  it("rejects an invalid body with 400", async () => {
    const res = await cellsPOST(req("/api/cells", { method: "POST", body: { title: "x" } }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation");
  });

  it("creates a cell with 201 and returns it", async () => {
    const res = await cellsPOST(
      req("/api/cells", {
        method: "POST",
        body: {
          site_id: "site_harbor",
          location_id: "loc_gate",
          title: "API created cell",
          description: "via test",
          task: "testing",
          severity: "medium",
          likelihood: 3,
          hazard_genome: { energySource: "motion", exposureType: "struck_by", trigger: "test", controlGap: "weak" },
        },
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.cell.title).toBe("API created cell");
    expect(json.cell.risk_score).toBeGreaterThan(0);
  });
});

describe("POST /api/ai/analyze-cell", () => {
  it("returns 404 for an unknown cell", async () => {
    const res = await analyzePOST(req("/api/ai/analyze-cell", { method: "POST", body: { cell_id: "nope" } }));
    expect(res.status).toBe(404);
  });

  it("returns 201 with a pending finding for a real cell", async () => {
    const res = await analyzePOST(req("/api/ai/analyze-cell", { method: "POST", body: { cell_id: "cell_003" } }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.finding.review_status).toBe("pending");
    // cell_003 is critical → must be flagged for human review
    expect(json.finding.human_review_required).toBe(true);
  });

  it("only materializes edges to real, in-scope, non-self targets", async () => {
    const res = await analyzePOST(req("/api/ai/analyze-cell", { method: "POST", body: { cell_id: "cell_001" } }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(Array.isArray(json.suggested_edges)).toBe(true);
    expect(Array.isArray(json.skipped_edges)).toBe(true);
    const cells = await getCells();
    const ids = new Set(cells.map((c) => c.id));
    for (const e of json.suggested_edges) {
      expect(ids.has(e.target_cell_id)).toBe(true); // never dangling
      expect(e.source_cell_id).not.toBe(e.target_cell_id); // never self
      expect(e.confidence).toBeGreaterThanOrEqual(0);
      expect(e.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe("POST /api/events", () => {
  it("rejects an invalid event (too-short title)", async () => {
    const res = await eventsPOST(req("/api/events", { method: "POST", body: { site_id: "site_harbor", kind: "incident", severity: "high", title: "no" } }));
    expect(res.status).toBe(400);
  });

  it("logs an event into staging (tenant stamped), not live until approved", async () => {
    const res = await eventsPOST(req("/api/events", { method: "POST", body: { site_id: "site_ridge", kind: "near_miss", severity: "medium", title: "Test logged outcome", cell_id: "cell_006" } }));
    expect(res.status).toBe(201);
    const { event, pending } = await res.json();
    expect(event.tenant_id).toBe("tenant_summit"); // derived from the site, not the actor
    expect(event.cell_id).toBe("cell_006");
    expect(pending).toBe(true); // held for human review

    // It must NOT be live in the database until a reviewer approves it.
    const list = await eventsGET(req("/api/events?site_id=site_ridge"));
    const { events } = await list.json();
    expect(events.some((e: { id: string }) => e.id === event.id)).toBe(false);
  });

  it("returns 403 when the user's role/tenant is not permitted", async () => {
    setSessionUser("u_field"); // tenant_summit contributor — events require supervisor+
    try {
      const res = await eventsPOST(req("/api/events", { method: "POST", body: { site_id: "site_ridge", kind: "incident", severity: "high", title: "Contributor tries to log" } }));
      expect(res.status).toBe(403);
    } finally {
      setSessionUser("u_admin"); // restore the global operator for later tests
    }
  });
});

describe("GET /api/graph", () => {
  it("returns nodes and edges", async () => {
    const res = await graphGET(req("/api/graph?site_id=site_harbor"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.nodes)).toBe(true);
    expect(Array.isArray(json.edges)).toBe(true);
  });
});

describe("GET /api/arc/hsl", () => {
  it("returns HSL readings", async () => {
    const res = await hslGET(req("/api/arc/hsl?site_id=site_ridge"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.readings.length).toBe(6);
  });
});

describe("POST /api/arc/pclss (proactive run)", () => {
  it("runs the engine, returns counts, and queues pending findings", async () => {
    const res = await pclssPOST(req("/api/arc/pclss", { method: "POST", body: {} }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.run).toBeTruthy();
    expect(json.run.stage).toBe("preempt");
    expect(typeof json.signals).toBe("number");
    expect(json.queued).toBeGreaterThanOrEqual(0);
  });
});

describe("GET /api/cells/[id]/similar", () => {
  it("returns similar cells for a real cell", async () => {
    const res = await similarGET(req("/api/cells/cell_001/similar"), { params: Promise.resolve({ id: "cell_001" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.similar)).toBe(true);
    // cell_002 shares Dock A location + struck_by exposure with cell_001
    expect(json.similar.some((s: { cell: { id: string } }) => s.cell.id === "cell_002")).toBe(true);
  });
});

describe("PATCH /api/proof", () => {
  it("rejects an invalid status", async () => {
    const res = await proofPATCH(req("/api/proof", { method: "PATCH", body: { id: "pf_001", status: "bogus" } }));
    expect(res.status).toBe(400);
  });
  it("updates a real proof", async () => {
    const res = await proofPATCH(req("/api/proof", { method: "PATCH", body: { id: "pf_003", status: "proven" } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.proof.status).toBe("proven");
  });
});
