/**
 * runPredictabilityScan() failure surfacing — a single failed analysis no
 * longer silently disappears: the batch continues, the failed item becomes a
 * user-safe warning on the scan result, and telemetry is emitted. Plus a
 * happy-path regression check that the successful return shape/values are
 * unchanged (warnings is additive and empty on full success).
 *
 * Live mode is forced by overriding MOCK_MODE; the engine, repo, and session
 * context are mocked so the scan runs deterministically with no network.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  MOCK_MODE: false,
}));
// Keep the import graph light — these are only used by other actions in the module.
vi.mock("@/lib/ai/programBuilder", () => ({ PROGRAM_DEFS: [], generateProgram: vi.fn() }));
vi.mock("@/lib/ai/extractDocuments", () => ({ KIND_DEFS: {}, extractRows: vi.fn() }));

const fixtures = vi.hoisted(() => ({
  chemicals: [
    { id: "chem-1", ghs_classes: ["flammable"], is_scheduled: false, sds_expiry: null },
    { id: "chem-2", ghs_classes: ["toxic", "corrosive"], is_scheduled: true, sds_expiry: null },
  ],
  legal: [{ id: "legal-1", status: "major_gap" }],
  courses: [{ id: "course-1" }],
  profiles: [{ id: "profile-1", role: "ehs_manager" }],
}));

vi.mock("@/lib/data/ehsRepo", () => ({
  getChemicals: async () => fixtures.chemicals,
  getLegalRequirements: async () => fixtures.legal,
  getTrainingRecords: async () => [],
  getTrainingCourses: async () => fixtures.courses,
  getCapaActions: async () => [],
  getIncidents: async () => [],
  getAudits: async () => [],
  getRiskAssessments: async () => [],
  getEquipment: async () => [],
  getWasteStreams: async () => [],
  getDocuments: async () => [],
  getOshaCases: async () => [],
  getBiosafetyLabs: async () => [],
  getErgonomicsJobTasks: async () => [],
  getProfiles: async () => fixtures.profiles,
  getAiFindings: async () => [],
}));

const engine = vi.hoisted(() => {
  const state = { chemicalFailsFor: new Set<string>(), gapFails: false, trainingFails: false };
  const finding = (sourceType: string, sourceId: string | null) => ({
    id: `f-${sourceType}-${sourceId ?? "tenant"}`,
    tenant_id: "tenant-1",
    site_id: "site-1",
    job: "predictability_scan",
    source_type: sourceType,
    source_id: sourceId,
    model: "test-model",
    prompt_version: "v1",
    input_summary: "test",
    output: { recommended_actions: [] },
    confidence: 0.9,
    review_status: "pending",
    human_review_required: false,
  });
  return { state, finding };
});

vi.mock("@/lib/ai/engine", () => ({
  analyzeChemical: async (c: { id: string }) => {
    if (engine.state.chemicalFailsFor.has(c.id)) throw new Error("model timeout after 30s");
    return engine.finding("chemical", c.id);
  },
  analyzeComplianceGap: async (l: { id: string }) => {
    if (engine.state.gapFails) throw new Error("provider returned malformed JSON");
    return engine.finding("legal_requirement", l.id);
  },
  analyzeWaste: async (w: { id: string }) => engine.finding("waste_stream", w.id),
  analyzeTraining: async () => {
    if (engine.state.trainingFails) throw new Error("training analysis crashed");
    return engine.finding("training", null);
  },
  buildPredictabilityForecast: () => ({
    compliance_trend: "stable",
    predicted_compliance_score_30d: 82,
    top_risk_modules: ["training"],
  }),
}));

const db = vi.hoisted(() => ({ inserted: {} as Record<string, unknown[]> }));

vi.mock("@/lib/actions/ehs-shared", () => ({
  getCtx: async () => ({
    client: {
      from(table: string) {
        interface EqChain { eq: () => EqChain }
        const chainEq = (): EqChain => ({ eq: chainEq });
        return {
          delete: () => ({ eq: chainEq }),
          insert: (rows: unknown) => {
            const arr = Array.isArray(rows) ? rows : [rows];
            db.inserted[table] = [...(db.inserted[table] ?? []), ...arr];
            return Promise.resolve({ error: null });
          },
        };
      },
    },
    tenantId: "tenant-1",
    siteId: "site-1",
    profileId: "profile-1",
  }),
}));

import { runPredictabilityScan } from "@/lib/actions/ehs-ai";

type ScanSuccess = Extract<Awaited<ReturnType<typeof runPredictabilityScan>>, { warnings: unknown }>;

async function runScan(): Promise<ScanSuccess> {
  const result = await runPredictabilityScan();
  if (!("warnings" in result) || result.warnings === undefined) {
    throw new Error(`expected a scan result with warnings, got: ${JSON.stringify(result)}`);
  }
  return result as ScanSuccess;
}

beforeEach(() => {
  engine.state.chemicalFailsFor.clear();
  engine.state.gapFails = false;
  engine.state.trainingFails = false;
  db.inserted = {};
  vi.restoreAllMocks();
});

describe("runPredictabilityScan() — failed analyses surface as warnings", () => {
  it("attaches per-item warnings and telemetry when analyses throw, while the rest of the batch still succeeds", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    engine.state.chemicalFailsFor.add("chem-2");
    engine.state.gapFails = true;

    const result = await runScan();

    // chem-1 + training succeeded; chem-2 + legal-1 failed → 2 findings, 2 warnings.
    expect(result.ok).toBe(true);
    expect(result.findings).toBe(2);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toMatchObject({ module: "chemical", itemId: "chem-2" });
    expect(result.warnings[1]).toMatchObject({ module: "complianceGap", itemId: "legal-1" });
    // Warning text is user-safe — no raw error detail.
    expect(result.warnings[0].message).not.toContain("model timeout");
    // Successful findings were still persisted.
    expect(db.inserted["ehs_ai_findings"]).toHaveLength(2);
    // Telemetry carries the real error detail for engineering follow-up.
    expect(errSpy).toHaveBeenCalledWith(
      "[ai_analysis_failed]",
      expect.objectContaining({ module: "chemical", itemId: "chem-2", message: "model timeout after 30s" }),
    );
    expect(errSpy).toHaveBeenCalledWith(
      "[ai_analysis_failed]",
      expect.objectContaining({ module: "complianceGap", itemId: "legal-1", message: "provider returned malformed JSON" }),
    );
    // The persisted run log also records that analyses were incomplete.
    const run = db.inserted["predictability_runs"]?.[0] as { summary: string };
    expect(run.summary).toContain("2 analyses could not be completed");
  });

  it("reports the tenant-level training analysis failure with the tenant as itemId", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    engine.state.trainingFails = true;

    const result = await runScan();

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({ module: "training", itemId: "tenant-1" });
    // chem-1, chem-2, legal-1 all succeeded.
    expect(result.findings).toBe(3);
  });

  it("regression: happy path is unchanged — same counts, warnings empty, run summary has no failure note", async () => {
    const result = await runScan();

    expect(result.ok).toBe(true);
    expect(result.findings).toBe(4); // chem-1, chem-2, legal-1, training
    expect(result.modules).toBe(13);
    expect(typeof result.scanned).toBe("number");
    expect(result.warnings).toEqual([]);
    expect(db.inserted["ehs_ai_findings"]).toHaveLength(4);
    const run = db.inserted["predictability_runs"]?.[0] as { summary: string };
    expect(run.summary).not.toContain("could not be completed");
  });
});
