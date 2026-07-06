import { describe, test, expect, vi, beforeEach } from "vitest";

const mockGetIncidents = vi.fn();
const mockGetCapaActions = vi.fn();
const mockGetAuditFindings = vi.fn();
const mockGetChemicals = vi.fn();
const mockGetWasteStreams = vi.fn();
const mockGetTrainingRecords = vi.fn();
const mockGetEffectiveTenantId = vi.fn();
const mockGenerate = vi.fn();
const mockHasLiveAi = vi.fn();

vi.mock("@/lib/data/ehsRepo", () => ({
  getIncidents: (...a: unknown[]) => mockGetIncidents(...a),
  getCapaActions: (...a: unknown[]) => mockGetCapaActions(...a),
  getAuditFindings: (...a: unknown[]) => mockGetAuditFindings(...a),
  getChemicals: (...a: unknown[]) => mockGetChemicals(...a),
  getWasteStreams: (...a: unknown[]) => mockGetWasteStreams(...a),
  getTrainingRecords: (...a: unknown[]) => mockGetTrainingRecords(...a),
}));
vi.mock("@/lib/auth/session", () => ({
  getEffectiveTenantId: (...a: unknown[]) => mockGetEffectiveTenantId(...a),
}));
vi.mock("@/lib/ai/provider", () => ({
  generateStructuredJson: (...a: unknown[]) => mockGenerate(...a),
}));
vi.mock("@/lib/env", () => ({
  hasLiveAi: (...a: unknown[]) => mockHasLiveAi(...a),
}));

import { getDashboardTrends, type TrendCardKey } from "@/lib/actions/getDashboardTrends";

const ALL_KEYS: TrendCardKey[] = [
  "injuries",
  "capas",
  "auditFindings",
  "chemicalHazard",
  "wasteActivity",
  "recurringProblems",
  "complianceGaps",
];

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

const POPULATED = {
  incidents: [
    { id: "i1", incident_type: "lost_time_injury", occurred_at: monthsAgo(1), status: "closed", severity: "high" },
    { id: "i2", incident_type: "near_miss", occurred_at: monthsAgo(2), status: "closed", severity: "low" },
    { id: "i3", incident_type: "near_miss", occurred_at: monthsAgo(1), status: "closed", severity: "low" },
  ],
  capas: [
    { id: "c1", title: "Fix fume hood interlock", status: "open", due_date: daysFromNow(5), created_at: monthsAgo(1) },
    { id: "c2", title: "Retrain on spill kit use", status: "closed", due_date: daysFromNow(30), created_at: monthsAgo(2) },
  ],
  findings: [
    {
      id: "f1",
      title: "PPE not worn in BSL-2 lab",
      category: "ppe",
      status: "open",
      due_date: daysFromNow(20),
      created_at: monthsAgo(1),
    },
    {
      id: "f2",
      title: "PPE signage missing",
      category: "ppe",
      status: "open",
      due_date: daysFromNow(45),
      created_at: monthsAgo(2),
    },
  ],
  chemicals: [
    {
      id: "chem1",
      name: "Formaldehyde",
      is_scheduled: false,
      hazard_band: "high",
      hazard_statements: ["H350"],
      sds_expiry: daysFromNow(60),
      expiration_date: null,
      created_at: monthsAgo(1),
    },
    {
      id: "chem2",
      name: "Ethanol",
      is_scheduled: false,
      hazard_band: "low",
      hazard_statements: [],
      sds_expiry: null,
      expiration_date: null,
      created_at: monthsAgo(3),
    },
  ],
  waste: [{ id: "w1", created_at: monthsAgo(1) }, { id: "w2", created_at: monthsAgo(8) }],
  training: [{ id: "t1", expiry_date: daysFromNow(10) }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetEffectiveTenantId.mockResolvedValue("tenant-1");
  // Default: AI provider configured, so tests exercise the real try/catch
  // fallback and AI-overlay paths. The dedicated "no key configured" test
  // below overrides this to false.
  mockHasLiveAi.mockReturnValue(true);
});

describe("getDashboardTrends", () => {
  test("aggregates populated data into correctly shaped cards", async () => {
    mockGetIncidents.mockResolvedValue(POPULATED.incidents);
    mockGetCapaActions.mockResolvedValue(POPULATED.capas);
    mockGetAuditFindings.mockResolvedValue(POPULATED.findings);
    mockGetChemicals.mockResolvedValue(POPULATED.chemicals);
    mockGetWasteStreams.mockResolvedValue(POPULATED.waste);
    mockGetTrainingRecords.mockResolvedValue(POPULATED.training);
    mockGenerate.mockRejectedValue(new Error("no ai in this test"));

    const result = await getDashboardTrends();

    expect(result.isDemoData).toBe(false);
    expect(result.demoBannerText).toBeNull();
    expect(Object.keys(result.cards).sort()).toEqual([...ALL_KEYS].sort());

    expect(result.cards.injuries.value).toBe(1); // only the lost_time_injury counts
    expect(result.cards.capas.value).toBe(1); // one open CAPA
    expect(result.cards.auditFindings.value).toBe(2); // both findings open
    expect(result.cards.recurringProblems.value).toBe(2); // "ppe" finding category + "near_miss" incident type each repeat
    expect(result.cards.chemicalHazard.isEmpty).toBe(false); // Formaldehyde is high-hazard
  });

  test("falls back to DEMO_TRENDS with isDemoData=true when all 6 sources are empty", async () => {
    mockGetIncidents.mockResolvedValue([]);
    mockGetCapaActions.mockResolvedValue([]);
    mockGetAuditFindings.mockResolvedValue([]);
    mockGetChemicals.mockResolvedValue([]);
    mockGetWasteStreams.mockResolvedValue([]);
    mockGetTrainingRecords.mockResolvedValue([]);
    mockGenerate.mockRejectedValue(new Error("no ai in this test"));

    const result = await getDashboardTrends();

    expect(result.isDemoData).toBe(true);
    expect(result.demoBannerText).toMatch(/Sample data/);
    expect(result.cards.injuries.value).toBeDefined();
    expect(result.nextComplianceDeadline).not.toBeNull();
  });

  test("uses deterministic fallback summaries (tagged as demo data) when the AI call fails", async () => {
    mockGetIncidents.mockResolvedValue([]);
    mockGetCapaActions.mockResolvedValue([]);
    mockGetAuditFindings.mockResolvedValue([]);
    mockGetChemicals.mockResolvedValue([]);
    mockGetWasteStreams.mockResolvedValue([]);
    mockGetTrainingRecords.mockResolvedValue([]);
    mockGenerate.mockRejectedValue(new Error("AI unavailable"));

    const result = await getDashboardTrends();

    expect(result.cards.injuries.summary).toMatch(/injuries/i);
    expect(result.cards.injuries.summary).toMatch(/\(Demo data\)$/);
  });

  test("skips the AI call entirely (no network wait) when no provider key is configured", async () => {
    mockGetIncidents.mockResolvedValue([]);
    mockGetCapaActions.mockResolvedValue([]);
    mockGetAuditFindings.mockResolvedValue([]);
    mockGetChemicals.mockResolvedValue([]);
    mockGetWasteStreams.mockResolvedValue([]);
    mockGetTrainingRecords.mockResolvedValue([]);
    mockHasLiveAi.mockReturnValue(false);

    const result = await getDashboardTrends();

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(result.cards.injuries.summary).toMatch(/injuries/i);
  });

  test("overlays AI summaries onto the deterministic floor when the provider succeeds", async () => {
    mockGetIncidents.mockResolvedValue(POPULATED.incidents);
    mockGetCapaActions.mockResolvedValue(POPULATED.capas);
    mockGetAuditFindings.mockResolvedValue(POPULATED.findings);
    mockGetChemicals.mockResolvedValue(POPULATED.chemicals);
    mockGetWasteStreams.mockResolvedValue(POPULATED.waste);
    mockGetTrainingRecords.mockResolvedValue(POPULATED.training);
    mockGenerate.mockResolvedValue({
      data: { summaries: [{ key: "injuries", summary: "One lost-time injury this month — watch the trend." }] },
      model: "claude-haiku-4-5",
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    const result = await getDashboardTrends();

    expect(result.cards.injuries.summary).toBe("One lost-time injury this month — watch the trend.");
    // capas summary was not returned by the model → keeps its deterministic fallback.
    expect(result.cards.capas.summary).toMatch(/CAPA/i);
  });

  test("surfaces a single nearest compliance deadline, not a list", async () => {
    mockGetIncidents.mockResolvedValue([]);
    mockGetCapaActions.mockResolvedValue([
      { id: "c1", title: "Far-out CAPA", status: "open", due_date: daysFromNow(80), created_at: monthsAgo(1) },
    ]);
    mockGetAuditFindings.mockResolvedValue([
      { id: "f1", title: "Near-term finding", category: "storage", status: "open", due_date: daysFromNow(3), created_at: monthsAgo(1) },
    ]);
    mockGetChemicals.mockResolvedValue([]);
    mockGetWasteStreams.mockResolvedValue([]);
    mockGetTrainingRecords.mockResolvedValue([]);
    mockGenerate.mockRejectedValue(new Error("no ai in this test"));

    const result = await getDashboardTrends();

    expect(result.nextComplianceDeadline).not.toBeNull();
    expect(result.nextComplianceDeadline?.label).toBe("Audit finding due: Near-term finding");
    // Date-only strings truncate to UTC midnight, so daysAway can round to 2 or 3
    // depending on time-of-day the test runs — either is correct, just not the far-out CAPA's ~80.
    expect(result.nextComplianceDeadline?.daysAway).toBeGreaterThanOrEqual(2);
    expect(result.nextComplianceDeadline?.daysAway).toBeLessThanOrEqual(3);
  });

  test("every card carries a non-empty emptyMessage — never a bare zero or N/A", async () => {
    mockGetIncidents.mockResolvedValue([]);
    mockGetCapaActions.mockResolvedValue([]);
    mockGetAuditFindings.mockResolvedValue([]);
    mockGetChemicals.mockResolvedValue([]);
    mockGetWasteStreams.mockResolvedValue([]);
    mockGetTrainingRecords.mockResolvedValue(POPULATED.training); // not fully empty → real cards, some individually empty
    mockGenerate.mockRejectedValue(new Error("no ai in this test"));

    const result = await getDashboardTrends();

    expect(result.isDemoData).toBe(false);
    for (const key of ALL_KEYS) {
      const card = result.cards[key];
      expect(card.emptyMessage.length).toBeGreaterThan(0);
      if (card.isEmpty) {
        expect(card.emptyMessage).not.toMatch(/^(0|n\/a|-)$/i);
      }
    }
  });
});
