/**
 * OSHA Form 300A — Annual Summary calculation.
 *
 * Pure function so the on-screen summary, the reconciliation checks, and the
 * downloadable PDF all derive from the exact same numbers — there is no
 * separate "300A record" that could drift from the OSHA 300 log.
 */
import type { OshaCase, OshaInjuryType } from "@/lib/types";

export const INJURY_TYPES: OshaInjuryType[] = [
  "injury", "skin_disorder", "respiratory", "poisoning", "hearing_loss", "other_illness",
];

export interface Osha300ATotals {
  deaths: number;
  daysAwayCases: number;
  restrictedTransferCases: number;
  otherRecordableCases: number;
  totalCases: number;
  dartCases: number;
  totalDaysAway: number;
  totalDaysRestricted: number;
  injuryTypeCounts: Record<OshaInjuryType, number>;
  trir: number | null;
  dartRate: number | null;
}

export interface Osha300ASummary {
  year: number;
  totals: Osha300ATotals;
  missingFields: string[];
  anomalies: string[];
  noCasesToReport: boolean;
}

export interface Osha300AInput {
  cases: OshaCase[];
  year: number;
  /** Hours worked basis actually used for rate math — always > 0 (platform falls back to a default). */
  oshaHours: number;
  /** Average employee count actually used for display — always > 0 (platform falls back to a default). */
  avgEmployees: number;
  /** Whether the tenant has entered its own hours-worked figure in Settings (vs. the platform default). */
  hoursConfigured: boolean;
  /** Whether the tenant has entered its own average-employees figure in Settings (vs. the platform default). */
  employeesConfigured: boolean;
}

export function filterCasesByYear(cases: OshaCase[], year: number): OshaCase[] {
  return cases.filter((c) => {
    const d = new Date(`${c.date}T00:00:00`);
    return !Number.isNaN(d.getTime()) && d.getFullYear() === year;
  });
}

export function computeOsha300ASummary(input: Osha300AInput): Osha300ASummary {
  const { year, oshaHours, avgEmployees, hoursConfigured, employeesConfigured } = input;
  const cases = filterCasesByYear(input.cases, year);

  const deaths = cases.filter((c) => c.classification === "fatality").length;
  const daysAwayCases = cases.filter((c) => c.classification === "days_away").length;
  const restrictedTransferCases = cases.filter((c) => c.classification === "restricted").length;
  const otherRecordableCases = cases.filter((c) => c.classification === "other_recordable").length;
  const totalCases = cases.length;
  const dartCases = daysAwayCases + restrictedTransferCases;
  const totalDaysAway = cases.reduce((s, c) => s + c.daysAway, 0);
  const totalDaysRestricted = cases.reduce((s, c) => s + c.daysRestricted, 0);

  const injuryTypeCounts = INJURY_TYPES.reduce((acc, t) => {
    acc[t] = cases.filter((c) => c.injuryType === t).length;
    return acc;
  }, {} as Record<OshaInjuryType, number>);

  const hasHours = oshaHours > 0;
  const trir = hasHours ? Number(((totalCases / oshaHours) * 200000).toFixed(2)) : null;
  const dartRate = hasHours ? Number(((dartCases / oshaHours) * 200000).toFixed(2)) : null;

  const missingFields: string[] = [];
  if (!employeesConfigured || avgEmployees <= 0) missingFields.push("Average number of employees");
  if (!hoursConfigured || oshaHours <= 0) missingFields.push("Total hours worked by all employees");

  const anomalies: string[] = [];
  if (totalCases > 0 && (!hoursConfigured || oshaHours <= 0)) {
    anomalies.push(
      "You have recorded cases for this year, but total hours worked hasn't been entered — rates can't be trusted until you add it in Settings."
    );
  }

  return {
    year,
    totals: {
      deaths, daysAwayCases, restrictedTransferCases, otherRecordableCases,
      totalCases, dartCases, totalDaysAway, totalDaysRestricted,
      injuryTypeCounts, trir, dartRate,
    },
    missingFields,
    anomalies,
    noCasesToReport: totalCases === 0,
  };
}
