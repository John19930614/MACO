import { describe, test, expect, vi, beforeEach } from "vitest";

// ── Pure helper: formula-injection guard in the xlsx engine ────────────────────
import { antiInjection, xlsxBytes } from "@/lib/xlsExport";

describe("antiInjection (Excel formula-injection guard)", () => {
  test("prefixes strings that open with = + - @", () => {
    expect(antiInjection("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(antiInjection("+cmd")).toBe("'+cmd");
    expect(antiInjection("-1+1")).toBe("'-1+1");
    expect(antiInjection("@SUM")).toBe("'@SUM");
  });

  test("prefixes leading tab/CR that Excel trims before parsing", () => {
    expect(antiInjection("\t=1")).toBe("'\t=1");
  });

  test("passes normal text through unchanged", () => {
    expect(antiInjection("Acetone")).toBe("Acetone");
    expect(antiInjection("67-64-1")).toBe("67-64-1"); // CAS numbers start with a digit, not a trigger char
  });
});

describe("xlsxBytes", () => {
  test("returns a non-empty zip (PK signature) for a sample workbook", () => {
    const bytes = xlsxBytes({
      filename: "t.xlsx",
      sheets: [{ name: "S", rows: [{ cells: [{ v: "Acetone" }, { v: "=EVIL()" }] }] }],
    });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    // .xlsx is a zip — first two bytes are "PK".
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });
});

// ── Server action: exportChemicalSummaries ─────────────────────────────────────
const mockGetChemicals = vi.fn();
const mockGetEffectiveTenantId = vi.fn();
const mockGetServerProfileId = vi.fn();
const mockAddAudit = vi.fn();
const mockGenerate = vi.fn();

vi.mock("@/lib/data/ehsRepo", () => ({
  getChemicals: (...a: unknown[]) => mockGetChemicals(...a),
}));
vi.mock("@/lib/auth/session", () => ({
  getEffectiveTenantId: (...a: unknown[]) => mockGetEffectiveTenantId(...a),
  getServerProfileId: (...a: unknown[]) => mockGetServerProfileId(...a),
}));
vi.mock("@/lib/data/repo", () => ({
  addAudit: (...a: unknown[]) => mockAddAudit(...a),
}));
vi.mock("@/lib/ai/provider", () => ({
  generateStructuredJson: (...a: unknown[]) => mockGenerate(...a),
}));

import { exportChemicalSummaries } from "@/lib/actions/exportChemicalSummaries";

const CHEMS = [
  {
    id: "chem-1",
    name: "Acetone",
    cas_number: "67-64-1",
    sds_url: "https://sds/acetone.pdf",
    sds_expiry: "2026-01-01",
    is_scheduled: false,
    storage_location: "Lab A / Cabinet 3",
    storage_class: "FLAMMABLE",
    hazard_statements: ["H225", "H319"],
  },
  {
    id: "chem-2",
    name: "Pseudoephedrine",
    cas_number: "90-82-4",
    sds_url: null,
    sds_expiry: null,
    is_scheduled: true,
    storage_location: "",
    storage_class: null,
    hazard_statements: [],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetChemicals.mockResolvedValue(CHEMS);
  mockGetEffectiveTenantId.mockResolvedValue("tenant-1");
  mockGetServerProfileId.mockResolvedValue("profile-1");
  mockAddAudit.mockResolvedValue(undefined);
});

describe("exportChemicalSummaries", () => {
  test("falls back to constructed summaries when the AI gateway throws", async () => {
    mockGenerate.mockRejectedValue(new Error("circuit open"));
    const res = await exportChemicalSummaries();

    expect(res.recordCount).toBe(2);
    expect(res.aiEnriched).toBe(false);
    // Every row has a non-empty summary built from its own field values.
    expect(res.summaries["chem-1"]).toContain("Acetone");
    expect(res.summaries["chem-1"]).toContain("Safety Data Sheet on file");
    expect(res.summaries["chem-2"]).toContain("MISSING");
    expect(res.summaries["chem-2"]).toContain("Scheduled");
  });

  test("uses the AI summary when the provider returns valid data", async () => {
    mockGenerate.mockResolvedValue({
      data: { summaries: [{ id: "chem-1", summary: "Acetone is compliant with an SDS on file." }] },
      model: "claude-haiku-4-5",
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    const res = await exportChemicalSummaries();

    expect(res.aiEnriched).toBe(true);
    expect(res.summaries["chem-1"]).toBe("Acetone is compliant with an SDS on file.");
    // chem-2 was not returned by the model → keeps its constructed fallback.
    expect(res.summaries["chem-2"]).toContain("Pseudoephedrine");
  });

  test("writes exactly one audit entry with the record count and never mutates records", async () => {
    mockGenerate.mockRejectedValue(new Error("no ai"));
    await exportChemicalSummaries();

    expect(mockAddAudit).toHaveBeenCalledTimes(1);
    const entry = mockAddAudit.mock.calls[0][0];
    expect(entry.action).toBe("chemical.export_summaries");
    expect(entry.entity).toBe("chemical_inventory");
    expect(entry.detail.record_count).toBe(2);
  });
});
