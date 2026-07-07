import { describe, it, expect } from "vitest";
import { getSdsStatus, computeDefaultReviewDueDate, SDS_STATUS_RANK } from "@/lib/sds/sdsStatus";

const NOW = new Date("2026-01-01T00:00:00Z");
const url = "https://supplier.com/sds/chemical.pdf";

describe("getSdsStatus", () => {
  it("treats a missing review due date as needing attention (red), even with an SDS linked", () => {
    const result = getSdsStatus({ sdsUrl: url, reviewDueDate: null }, NOW);
    expect(result.status).toBe("missing");
    expect(result.label).toMatch(/Missing/);
    expect(result.daysUntilDue).toBeNull();
    expect(result.colorClass).toMatch(/red/);
  });

  it("treats a missing SDS link as missing, even with a review date on file", () => {
    const result = getSdsStatus({ sdsUrl: null, reviewDueDate: "2027-01-01" }, NOW);
    expect(result.status).toBe("missing");
  });

  it("treats no SDS link and no review date as missing", () => {
    const result = getSdsStatus({ sdsUrl: null, reviewDueDate: null }, NOW);
    expect(result.status).toBe("missing");
  });

  it("flags a past due date as overdue (red)", () => {
    const result = getSdsStatus({ sdsUrl: url, reviewDueDate: "2025-12-01" }, NOW);
    expect(result.status).toBe("overdue");
    expect(result.daysUntilDue).toBeLessThan(0);
    expect(result.colorClass).toMatch(/red/);
  });

  const daysFromNow = (n: number) => new Date(NOW.getTime() + n * 86400000).toISOString().slice(0, 10);

  it("flags a date within 90 days as due_soon (amber)", () => {
    const result = getSdsStatus({ sdsUrl: url, reviewDueDate: daysFromNow(45) }, NOW);
    expect(result.status).toBe("due_soon");
    expect(result.colorClass).toMatch(/amber/);
  });

  it("treats exactly 90 days out as due_soon (boundary is inclusive)", () => {
    const result = getSdsStatus({ sdsUrl: url, reviewDueDate: daysFromNow(90) }, NOW);
    expect(result.status).toBe("due_soon");
  });

  it("treats 91 days out as ok (green)", () => {
    const result = getSdsStatus({ sdsUrl: url, reviewDueDate: daysFromNow(91) }, NOW);
    expect(result.status).toBe("ok");
    expect(result.colorClass).toMatch(/green/);
  });

  it("ranks missing/overdue ahead of due_soon/ok for sorting", () => {
    expect(SDS_STATUS_RANK.missing).toBeLessThan(SDS_STATUS_RANK.overdue);
    expect(SDS_STATUS_RANK.overdue).toBeLessThan(SDS_STATUS_RANK.due_soon);
    expect(SDS_STATUS_RANK.due_soon).toBeLessThan(SDS_STATUS_RANK.ok);
  });
});

describe("computeDefaultReviewDueDate", () => {
  it("defaults to exactly 3 years from the upload date", () => {
    const uploaded = new Date("2026-06-01T00:00:00Z");
    expect(computeDefaultReviewDueDate(uploaded)).toBe("2029-06-01");
  });

  it("defaults to today when no upload date is given", () => {
    const before = new Date();
    const due = computeDefaultReviewDueDate();
    const after = new Date();
    expect(new Date(due).getFullYear()).toBeGreaterThanOrEqual(before.getFullYear() + 3);
    expect(new Date(due).getFullYear()).toBeLessThanOrEqual(after.getFullYear() + 3);
  });
});
