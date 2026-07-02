import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  mapDocumentStatus,
  groupDocumentActivity,
  type DocumentActivityData,
} from "@/lib/documents/activity";
import type { Document } from "@/lib/types";

// ── Mock the session + data layer for the server-action test (pure logic above
// stays real — it doesn't touch these modules). Mirrors the pattern in
// chemical-export-summaries.test.ts. getEffectiveTenantId reads next/headers
// cookies() at runtime, which throws outside a request scope, so we stub it.
const mockGetEffectiveTenantId = vi.fn();
const mockGetDocuments = vi.fn();
const mockGetProfiles = vi.fn();
const mockGetChemicals = vi.fn();
const mockGetBiosafetyLabs = vi.fn();
const mockGetWasteStreams = vi.fn();
const mockRequiredPrograms = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getEffectiveTenantId: (...a: unknown[]) => mockGetEffectiveTenantId(...a),
}));
vi.mock("@/lib/data/ehsRepo", () => ({
  getDocuments: (...a: unknown[]) => mockGetDocuments(...a),
  getProfiles: (...a: unknown[]) => mockGetProfiles(...a),
  getChemicals: (...a: unknown[]) => mockGetChemicals(...a),
  getBiosafetyLabs: (...a: unknown[]) => mockGetBiosafetyLabs(...a),
  getWasteStreams: (...a: unknown[]) => mockGetWasteStreams(...a),
}));
vi.mock("@/lib/ai/programBuilder", () => ({
  requiredPrograms: (...a: unknown[]) => mockRequiredPrograms(...a),
}));

import { getDocumentActivity } from "@/lib/actions/getDocumentActivity";

const NOW = Date.UTC(2026, 6, 1); // 2026-07-01, fixed so tests are deterministic
const DAY = 86_400_000;

function doc(overrides: Partial<Document> = {}): Document {
  return {
    id: "doc-1",
    tenant_id: "t-1",
    site_id: null,
    title: "Test Document",
    category: "sop",
    version: "1.0",
    storage_path: "",
    effective_date: new Date(NOW - 5 * DAY).toISOString(),
    review_date: new Date(NOW + 90 * DAY).toISOString(),
    status: "draft",
    owner_id: null,
    acknowledgment_required: false,
    regulation_ref: null,
    created_at: new Date(NOW - 5 * DAY).toISOString(),
    updated_at: new Date(NOW - 1 * DAY).toISOString(),
    ...overrides,
  };
}

describe("mapDocumentStatus", () => {
  test("draft → Draft", () => {
    expect(mapDocumentStatus(doc({ status: "draft" }), NOW)).toBe("Draft");
  });
  test("under_review → In Review", () => {
    expect(mapDocumentStatus(doc({ status: "under_review" }), NOW)).toBe("In Review");
  });
  test("active with future review date → Approved", () => {
    expect(
      mapDocumentStatus(doc({ status: "active", review_date: new Date(NOW + 30 * DAY).toISOString() }), NOW)
    ).toBe("Approved");
  });
  test("active past its review date → Expired", () => {
    expect(
      mapDocumentStatus(doc({ status: "active", review_date: new Date(NOW - 1 * DAY).toISOString() }), NOW)
    ).toBe("Expired");
  });
  test("active requiring acknowledgment → Needs Signature (before Approved)", () => {
    expect(
      mapDocumentStatus(
        doc({ status: "active", acknowledgment_required: true, review_date: new Date(NOW + 30 * DAY).toISOString() }),
        NOW
      )
    ).toBe("Needs Signature");
  });
  test("superseded / obsolete → null (not surfaced)", () => {
    expect(mapDocumentStatus(doc({ status: "superseded" }), NOW)).toBeNull();
    expect(mapDocumentStatus(doc({ status: "obsolete" }), NOW)).toBeNull();
  });
});

describe("groupDocumentActivity", () => {
  test("routes each document into the correct section", () => {
    const docs: Document[] = [
      doc({ id: "d-draft", status: "draft", updated_at: new Date(NOW - 2 * DAY).toISOString() }),
      doc({ id: "d-review", status: "under_review" }),
      doc({ id: "d-sig", status: "active", acknowledgment_required: true, review_date: new Date(NOW + 30 * DAY).toISOString() }),
      doc({ id: "d-exp", status: "active", review_date: new Date(NOW - 10 * DAY).toISOString() }),
      doc({ id: "d-appr", status: "active", review_date: new Date(NOW + 60 * DAY).toISOString() }),
      doc({ id: "d-old", status: "obsolete" }),
    ];
    const g = groupDocumentActivity(docs, [], {}, NOW);
    expect(g.recentlyGenerated.map((i) => i.id)).toEqual(["d-draft"]);
    expect(g.underReview.map((i) => i.id)).toEqual(["d-review"]);
    expect(g.outstandingApprovals.map((i) => i.id)).toEqual(["d-sig"]);
    expect(g.missingDocuments.map((i) => i.id)).toEqual(["d-exp"]);
    expect(g.completedExports.map((i) => i.id)).toEqual(["d-appr"]);
  });

  test("drafts older than 30 days are excluded from Recently Created", () => {
    const docs: Document[] = [doc({ id: "d-stale", status: "draft", updated_at: new Date(NOW - 45 * DAY).toISOString() })];
    const g = groupDocumentActivity(docs, [], {}, NOW);
    expect(g.recentlyGenerated).toHaveLength(0);
  });

  test("Approved items carry an exportCompletedAt; others do not", () => {
    const docs: Document[] = [
      doc({ id: "d-appr", status: "active", review_date: new Date(NOW + 60 * DAY).toISOString() }),
    ];
    const g = groupDocumentActivity(docs, [], {}, NOW);
    expect(g.completedExports[0].exportCompletedAt).toBeTruthy();
    expect(g.underReview.every((i) => i.exportCompletedAt === undefined)).toBe(true);
  });

  test("missing required programs become synthetic Missing rows", () => {
    const g = groupDocumentActivity(
      [],
      [{ title: "Chemical Hygiene Plan", regulation: "OSHA 29 CFR 1910.1450" }],
      {},
      NOW
    );
    expect(g.missingDocuments).toHaveLength(1);
    expect(g.missingDocuments[0].status).toBe("Missing");
    expect(g.missingDocuments[0].title).toBe("Chemical Hygiene Plan");
    expect(g.missingDocuments[0].detailUrl).toBe("/documents");
  });

  test("resolves owner name, falling back to Unassigned", () => {
    const docs: Document[] = [
      doc({ id: "d1", status: "under_review", owner_id: "p1" }),
      doc({ id: "d2", status: "under_review", owner_id: "missing" }),
      doc({ id: "d3", status: "under_review", owner_id: null }),
    ];
    const g = groupDocumentActivity(docs, [], { p1: "Jane Doe" }, NOW);
    const byId = Object.fromEntries(g.underReview.map((i) => [i.id, i.owner]));
    expect(byId.d1).toBe("Jane Doe");
    expect(byId.d2).toBe("Unassigned");
    expect(byId.d3).toBe("Unassigned");
  });

  test("detail / review / approve URLs point at the document", () => {
    const docs: Document[] = [doc({ id: "abc", status: "under_review" })];
    const g = groupDocumentActivity(docs, [], {}, NOW);
    expect(g.underReview[0].detailUrl).toBe("/documents/abc");
    expect(g.underReview[0].reviewUrl).toBe("/documents/abc");
    expect(g.underReview[0].approveUrl).toBe("/documents/abc");
  });
});

describe("getDocumentActivity (server action)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEffectiveTenantId.mockResolvedValue("t-1");
    mockGetProfiles.mockResolvedValue([{ id: "p1", display_name: "Jane Doe" }]);
    mockGetChemicals.mockResolvedValue([]);
    mockGetBiosafetyLabs.mockResolvedValue([]);
    mockGetWasteStreams.mockResolvedValue([]);
    mockRequiredPrograms.mockReturnValue([]);
  });

  test("returns success with all five section keys and arrays", async () => {
    mockGetDocuments.mockResolvedValue([
      doc({ id: "d-review", status: "under_review", owner_id: "p1" }),
    ]);

    const result = await getDocumentActivity();
    expect(result.success).toBe(true);
    expect(mockGetDocuments).toHaveBeenCalledWith("t-1");

    const data = result.data as DocumentActivityData;
    const keys: (keyof DocumentActivityData)[] = [
      "recentlyGenerated",
      "underReview",
      "outstandingApprovals",
      "missingDocuments",
      "completedExports",
    ];
    for (const key of keys) {
      expect(data).toHaveProperty(key);
      expect(Array.isArray(data[key])).toBe(true);
    }
    expect(data.underReview[0].owner).toBe("Jane Doe");
  });

  test("surfaces required programs with no document as Missing rows", async () => {
    mockGetDocuments.mockResolvedValue([]);
    mockRequiredPrograms.mockReturnValue([
      { title: "Chemical Hygiene Plan", regulation: "OSHA 29 CFR 1910.1450", category: "plan" },
    ]);

    const result = await getDocumentActivity();
    expect(result.success).toBe(true);
    expect(result.data?.missingDocuments.map((i) => i.status)).toEqual(["Missing"]);
  });

  test("returns a structured error (never throws) when the data layer fails", async () => {
    mockGetDocuments.mockRejectedValue(new Error("boom"));
    const result = await getDocumentActivity();
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
