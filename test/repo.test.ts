import { describe, it, expect } from "vitest";
import {
  getCells,
  getCell,
  createCell,
  getStaged,
  approveStaged,
  getBundle,
  computeRiskScore,
  updateProofStatus,
  reviewEdge,
  createEdge,
  getAudit,
  getProofs,
} from "@/lib/data/repo";
import type { SafetyCellInput } from "@/lib/schemas";

const input: SafetyCellInput = {
  site_id: "site_harbor",
  location_id: "loc_gate",
  title: "Repo test cell",
  description: "created in test",
  task: "testing",
  crew: null,
  company: null,
  permit_ref: null,
  severity: "critical",
  likelihood: 5,
  status: "open",
  owner_id: null,
  hazard_genome: { energySource: "motion", exposureType: "struck_by", trigger: "test", controlGap: "missing" },
};

describe("computeRiskScore", () => {
  it("is bounded 0-100 and ranks critical above low", () => {
    const low = computeRiskScore("low", 1);
    const crit = computeRiskScore("critical", 5);
    expect(low).toBeGreaterThanOrEqual(0);
    expect(crit).toBeLessThanOrEqual(100);
    expect(crit).toBeGreaterThan(low);
  });
});

describe("createCell (staged for human review)", () => {
  it("stages the cell with a risk score + audit, and admits it only on approval", async () => {
    const before = (await getCells()).length;
    const cell = await createCell(input, "u_field");
    expect(cell.id).toBeTruthy();
    expect(cell.risk_score).toBeGreaterThan(0);
    expect(cell.created_by).toBe("u_field");

    // Staged — NOT yet live in the database (no map / graph / 3D web exposure).
    expect((await getCells()).length).toBe(before);
    expect(await getCell(cell.id)).toBeNull();
    const staged = (await getStaged()).find((s) => s.payload.id === cell.id);
    expect(staged).toBeTruthy();

    const audit = await getAudit();
    expect(audit.some((a) => a.action === "cell.stage" && a.entity_id === cell.id)).toBe(true);

    // A reviewer approving it is what admits it into the live database.
    await approveStaged(staged!.id, "u_admin");
    expect((await getCells()).length).toBe(before + 1);
    expect((await getCell(cell.id))?.title).toBe("Repo test cell");
  });
});

describe("getBundle", () => {
  it("assembles cell + location + site + related records", async () => {
    const bundle = await getBundle("cell_001");
    expect(bundle).not.toBeNull();
    expect(bundle!.cell.id).toBe("cell_001");
    expect(bundle!.location.id).toBe(bundle!.cell.location_id);
    expect(bundle!.site.id).toBe(bundle!.cell.site_id);
    expect(bundle!.proofs.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown cell", async () => {
    expect(await getBundle("does_not_exist")).toBeNull();
  });
});

describe("updateProofStatus", () => {
  it("changes status, records verifier, and audits the change", async () => {
    const proof = (await getProofs("cell_001"))[0];
    const updated = await updateProofStatus(proof.id, "proven", "u_sup", { reason: "verified in test" });
    expect(updated?.status).toBe("proven");
    expect(updated?.verifier_id).toBe("u_sup");
    expect(updated?.verified_at).toBeTruthy();
    const audit = await getAudit();
    expect(audit.some((a) => a.action === "proof.status_change" && a.entity_id === proof.id)).toBe(true);
  });
});

describe("causal edge review", () => {
  it("creates a manual edge as accepted and an AI edge as pending", async () => {
    const manual = await createEdge(
      { source_cell_id: "cell_004", target_cell_id: "cell_001", type: "same_location", confidence: 0.5, rationale: "test" },
      "u_sup",
      false,
    );
    expect(manual.review_status).toBe("accepted");
    expect(manual.ai_generated).toBe(false);

    const ai = await createEdge(
      { source_cell_id: "cell_004", target_cell_id: "cell_002", type: "contributed_to", confidence: 0.5, rationale: "test ai" },
      "u_sup",
      true,
    );
    expect(ai.review_status).toBe("pending");

    const rejected = await reviewEdge(ai.id, "rejected", "u_sup");
    expect(rejected?.review_status).toBe("rejected");
  });
});
