import { describe, it, expect, afterEach } from "vitest";
import { setSessionUser } from "@/lib/data/store";
import { runGatewayPipeline, loadGatewayDataset, evaluateGateways } from "@/lib/gateway/pipeline";
import type { SafetyCell } from "@/lib/types";

afterEach(() => setSessionUser("u_admin"));

const NOW = Date.parse("2026-06-11T00:00:00Z");

describe("AI Gateway pipeline", () => {
  it("models 3 gateways (5 checks each) + a 10-check final review", async () => {
    const r = await runGatewayPipeline();
    expect(r.gateways.map((g) => g.id)).toEqual(["g1", "g2", "g3"]);
    for (const g of r.gateways) expect(g.checks).toHaveLength(5);
    expect(r.finalReview).toHaveLength(10);
    expect(r.finalReview.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r.counts.pass + r.counts.warn + r.counts.fail).toBe(
      r.gateways.reduce((n, g) => n + g.checks.length, 0) + r.finalReview.length,
    );
  });

  it("passes every gateway on the healthy fixture dataset (nothing in the reject queue)", async () => {
    const dataset = await loadGatewayDataset();
    const r = evaluateGateways(dataset, NOW);
    console.log("REJECTS:", JSON.stringify(r.rejectQueue));
    expect(r.counts.fail).toBe(0);
    expect(["pass", "warn"]).toContain(r.overall);
    expect(r.gateways.every((g) => g.status !== "fail")).toBe(true);
    expect(r.rejectQueue).toHaveLength(0);
  });

  it("exposes Cell Database stats including graph bridges & linchpins", async () => {
    const r = await runGatewayPipeline();
    expect(r.stats.cells).toBeGreaterThan(0);
    expect(r.stats.platforms).toBeGreaterThan(0);
    expect(r.stats.riskObjects).toBeGreaterThan(0);
    expect(r.stats.bridges).toBeGreaterThanOrEqual(0);
    expect(r.stats.inchpins).toBeGreaterThanOrEqual(0);
  });

  it("blocks a malformed record into the reject queue and fails the relevant gateways", async () => {
    setSessionUser("u_admin");
    const dataset = await loadGatewayDataset();
    const badCell: SafetyCell = {
      id: "cell_bad", tenant_id: "tenant_summit", site_id: "site_NOPE", location_id: "loc_NOPE",
      title: "x", description: "", task: "", crew: null, company: null, permit_ref: null,
      hazard_genome: { energySource: "", exposureType: "", trigger: "", controlGap: "" },
      severity: "high", likelihood: 9, risk_score: 999, status: "open", owner_id: null,
      created_by: "u_admin", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    };
    const r = evaluateGateways({ ...dataset, cells: [...dataset.cells, badCell] }, NOW);

    const entry = r.rejectQueue.find((e) => e.recordId === "cell_bad");
    expect(entry).toBeTruthy();
    expect(entry!.reason.length).toBeGreaterThan(0);
    expect(r.overall).toBe("fail");
    expect(r.gateways.find((g) => g.id === "g1")!.status).toBe("fail"); // schema + reference
    expect(r.gateways.find((g) => g.id === "g2")!.status).toBe("fail"); // range
  });

  it("blocks a CAPA whose source reference does not resolve (g1_reference)", async () => {
    setSessionUser("u_admin");
    const dataset = await loadGatewayDataset();
    const base = dataset.capas[0];
    const danglingCapa = {
      ...base,
      id: "capa_dangling",
      title: `${base.title} (ref test)`,
      source_type: "incident" as const,
      source_id: "inc_DOES_NOT_EXIST",
    };
    const r = evaluateGateways({ ...dataset, capas: [...dataset.capas, danglingCapa] }, NOW);

    const entry = r.rejectQueue.find((e) => e.recordId === "capa_dangling");
    expect(entry).toBeTruthy();
    expect(entry!.category).toContain("Reference");
    expect(r.gateways.find((g) => g.id === "g1")!.status).toBe("fail");
  });

  it("is deterministic for a fixed dataset + clock", async () => {
    const dataset = await loadGatewayDataset();
    const a = evaluateGateways(dataset, NOW);
    const b = evaluateGateways(dataset, NOW);
    expect(a.counts).toEqual(b.counts);
    expect(a.overall).toBe(b.overall);
  });
});
