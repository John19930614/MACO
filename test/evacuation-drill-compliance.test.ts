import { describe, test, expect } from "vitest";
import {
  frequencyToMonths,
  pickEffectiveFrequency,
  computeNextDueDate,
  buildCalendarEvents,
  evaluateDrillRecord,
  isOverdue,
  type FrequencyRequirement,
  type Shift,
} from "@/lib/drill-compliance/helpers";

// Fixed reference date so the suite is deterministic.
const FROM = new Date("2026-01-15T00:00:00Z");

describe("frequency handling", () => {
  test("maps common cadences to months (never defaults quarterly→annual)", () => {
    expect(frequencyToMonths("monthly")).toBe(1);
    expect(frequencyToMonths("quarterly")).toBe(3);
    expect(frequencyToMonths("semiannual")).toBe(6);
    expect(frequencyToMonths("annual")).toBe(12);
    expect(frequencyToMonths("biennial")).toBe(24);
  });

  test("strips per-shift qualifiers from compound labels", () => {
    expect(frequencyToMonths("per-shift-annual")).toBe(12);
    expect(frequencyToMonths("quarterly-per-shift")).toBe(3);
  });

  test("company goal wins only when strictly more frequent", () => {
    expect(pickEffectiveFrequency("annual", "quarterly")).toBe("quarterly");
    expect(pickEffectiveFrequency("quarterly", "annual")).toBe("quarterly");
    expect(pickEffectiveFrequency("annual", undefined)).toBe("annual");
  });

  test("computeNextDueDate offsets by the correct number of months", () => {
    expect(computeNextDueDate("quarterly", FROM)).toBe("2026-04-15");
    expect(computeNextDueDate("annual", FROM)).toBe("2027-01-15");
  });
});

describe("calendar generation", () => {
  const shifts: Shift[] = [
    { id: "day", name: "Day" },
    { id: "night", name: "Night" },
  ];

  test("a quarterly fire drill schedules well before a year is out (not 1×/year)", () => {
    const reqs: FrequencyRequirement[] = [
      { event_type: "fire", required_frequency: "quarterly", per_shift: false },
    ];
    const events = buildCalendarEvents(reqs, shifts, FROM);
    expect(events).toHaveLength(1);
    expect(events[0].due_date).toBe("2026-04-15");
    expect(events[0].effective_frequency).toBe("quarterly");
    expect(events[0].shift_id).toBeNull();
  });

  test("per_shift generates one event per shift", () => {
    const reqs: FrequencyRequirement[] = [
      { event_type: "fire", required_frequency: "annual", per_shift: true },
    ];
    const events = buildCalendarEvents(reqs, shifts, FROM);
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.shift_id).sort()).toEqual(["day", "night"]);
  });

  test("the stricter company cadence drives the due date", () => {
    const reqs: FrequencyRequirement[] = [
      {
        event_type: "chemical_release",
        required_frequency: "annual",
        company_required_frequency: "monthly",
        per_shift: false,
      },
    ];
    const events = buildCalendarEvents(reqs, shifts, FROM);
    expect(events[0].effective_frequency).toBe("monthly");
    expect(events[0].due_date).toBe("2026-02-15");
  });

  test("inactive requirements are skipped", () => {
    const reqs: FrequencyRequirement[] = [
      { event_type: "fire", required_frequency: "annual", active: false },
    ];
    expect(buildCalendarEvents(reqs, shifts, FROM)).toHaveLength(0);
  });
});

describe("drill record evaluation", () => {
  const base = {
    participants: ["u1", "u2"],
    wardens: ["w1"],
    accountabilityTimeSeconds: 120,
    result: "passed" as const,
  };

  test("flags missing warden when none recorded", () => {
    const e = evaluateDrillRecord({ ...base, wardens: [] });
    expect(e.missingWardens).toBe(true);
  });

  test("flags roster/accountability mismatch when participants present but accountability not captured", () => {
    const e = evaluateDrillRecord({ ...base, accountabilityTimeSeconds: undefined });
    expect(e.rosterMismatch).toBe(true);
  });

  test("no mismatch when accountability time is recorded", () => {
    expect(evaluateDrillRecord(base).rosterMismatch).toBe(false);
  });

  test("failed drill requires EAP review", () => {
    const e = evaluateDrillRecord({ ...base, result: "failed" });
    expect(e.eapReviewRequired).toBe(true);
    expect(e.eapReviewReason).toBe("failed_drill");
  });

  test("real emergency requires EAP review", () => {
    const e = evaluateDrillRecord({ ...base, realEmergencyTriggered: true });
    expect(e.eapReviewRequired).toBe(true);
    expect(e.eapReviewReason).toBe("real_emergency");
  });

  test("passing drill with wardens and accountability raises nothing", () => {
    const e = evaluateDrillRecord(base);
    expect(e).toEqual({
      missingWardens: false,
      rosterMismatch: false,
      eapReviewRequired: false,
      eapReviewReason: null,
    });
  });
});

describe("overdue detection", () => {
  test("a past due date is overdue; a future one is not", () => {
    const today = new Date("2026-06-01T00:00:00Z");
    expect(isOverdue("2026-05-31", today)).toBe(true);
    expect(isOverdue("2026-06-30", today)).toBe(false);
  });
});
