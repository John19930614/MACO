import { describe, test, expect } from "vitest";
import { computeOsha300ASummary, filterCasesByYear } from "@/lib/osha/osha300a";
import type { OshaCase } from "@/lib/types";

function makeCase(overrides: Partial<OshaCase>): OshaCase {
  return {
    id: overrides.id ?? "case-1",
    tenant_id: "tenant-1",
    caseNo: overrides.caseNo ?? "1",
    employee: "Jane Doe",
    jobTitle: "Technician",
    date: overrides.date ?? "2026-03-01",
    location: "Lab A",
    description: "",
    classification: overrides.classification ?? "other_recordable",
    injuryType: overrides.injuryType ?? "injury",
    daysAway: overrides.daysAway ?? 0,
    daysRestricted: overrides.daysRestricted ?? 0,
    isPrivacy: false,
    isSevereInjury: false,
    howOccurred: "",
    equipment: "",
    physician: "",
    medFacility: "",
    treatmentER: false,
    treatmentHospitalized: false,
    created_at: "2026-03-01T00:00:00Z",
    ...overrides,
  };
}

const BASE = { oshaHours: 87360, avgEmployees: 42, hoursConfigured: true, employeesConfigured: true };

describe("filterCasesByYear", () => {
  test("keeps only cases dated within the given calendar year", () => {
    const cases = [
      makeCase({ id: "a", date: "2025-12-31" }),
      makeCase({ id: "b", date: "2026-01-01" }),
      makeCase({ id: "c", date: "2026-12-31" }),
      makeCase({ id: "d", date: "2027-01-01" }),
    ];
    expect(filterCasesByYear(cases, 2026).map((c) => c.id)).toEqual(["b", "c"]);
  });
});

describe("computeOsha300ASummary", () => {
  test("computes correct DART count and category totals from mixed case fixtures", () => {
    const cases = [
      makeCase({ id: "1", classification: "fatality", injuryType: "injury" }),
      makeCase({ id: "2", classification: "days_away", injuryType: "skin_disorder", daysAway: 5 }),
      makeCase({ id: "3", classification: "restricted", injuryType: "respiratory", daysRestricted: 3 }),
      makeCase({ id: "4", classification: "restricted", injuryType: "poisoning", daysRestricted: 2 }),
      makeCase({ id: "5", classification: "other_recordable", injuryType: "hearing_loss" }),
      makeCase({ id: "6", classification: "other_recordable", injuryType: "other_illness" }),
    ];

    const summary = computeOsha300ASummary({ cases, year: 2026, ...BASE });

    expect(summary.totals.totalCases).toBe(6);
    expect(summary.totals.deaths).toBe(1);
    expect(summary.totals.daysAwayCases).toBe(1);
    expect(summary.totals.restrictedTransferCases).toBe(2);
    expect(summary.totals.otherRecordableCases).toBe(2);
    // DART = days-away cases + restricted/transfer cases
    expect(summary.totals.dartCases).toBe(3);
    expect(summary.totals.totalDaysAway).toBe(5);
    expect(summary.totals.totalDaysRestricted).toBe(5);
    expect(summary.totals.injuryTypeCounts).toEqual({
      injury: 1, skin_disorder: 1, respiratory: 1, poisoning: 1, hearing_loss: 1, other_illness: 1,
    });
    expect(summary.missingFields).toEqual([]);
    expect(summary.anomalies).toEqual([]);
    expect(summary.noCasesToReport).toBe(false);
  });

  test("only counts cases within the requested year", () => {
    const cases = [
      makeCase({ id: "1", date: "2025-06-01", classification: "days_away" }),
      makeCase({ id: "2", date: "2026-06-01", classification: "days_away" }),
    ];
    const summary = computeOsha300ASummary({ cases, year: 2026, ...BASE });
    expect(summary.totals.totalCases).toBe(1);
    expect(summary.totals.daysAwayCases).toBe(1);
  });

  test("flags missing establishment average employees", () => {
    const summary = computeOsha300ASummary({
      cases: [], year: 2026, oshaHours: 87360, avgEmployees: 42,
      hoursConfigured: true, employeesConfigured: false,
    });
    expect(summary.missingFields).toContain("Average number of employees");
    expect(summary.missingFields).not.toContain("Total hours worked by all employees");
  });

  test("flags missing establishment hours worked", () => {
    const summary = computeOsha300ASummary({
      cases: [], year: 2026, oshaHours: 87360, avgEmployees: 42,
      hoursConfigured: false, employeesConfigured: true,
    });
    expect(summary.missingFields).toContain("Total hours worked by all employees");
  });

  test("returns null rates when hours worked is literally zero", () => {
    const summary = computeOsha300ASummary({
      cases: [], year: 2026, oshaHours: 0, avgEmployees: 42,
      hoursConfigured: false, employeesConfigured: true,
    });
    expect(summary.totals.trir).toBeNull();
    expect(summary.totals.dartRate).toBeNull();
  });

  test("flags anomaly when nonzero cases but hours worked isn't configured", () => {
    const cases = [makeCase({ id: "1", classification: "days_away", date: "2026-05-01" })];
    const summary = computeOsha300ASummary({
      cases, year: 2026, oshaHours: 87360, avgEmployees: 42,
      hoursConfigured: false, employeesConfigured: true,
    });
    expect(summary.anomalies.length).toBeGreaterThan(0);
    expect(summary.anomalies[0]).toMatch(/hours worked/i);
  });

  test("no anomaly when there are zero cases, even with hours unconfigured", () => {
    const summary = computeOsha300ASummary({
      cases: [], year: 2026, oshaHours: 87360, avgEmployees: 42,
      hoursConfigured: false, employeesConfigured: true,
    });
    expect(summary.anomalies).toEqual([]);
    expect(summary.noCasesToReport).toBe(true);
  });

  test("computes TRIR and DART rate per 100 FTE when hours are known", () => {
    const cases = [
      makeCase({ id: "1", classification: "days_away" }),
      makeCase({ id: "2", classification: "restricted" }),
    ];
    const summary = computeOsha300ASummary({ cases, year: 2026, oshaHours: 200000, avgEmployees: 96, hoursConfigured: true, employeesConfigured: true });
    expect(summary.totals.trir).toBe(2);
    expect(summary.totals.dartRate).toBe(2);
  });
});
