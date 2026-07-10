import { describe, it, expect } from "vitest";
import {
  decideGate,
  computeAge,
  FEDERAL_HAZARDOUS_RULES,
  type GateProfile,
  type HazardousTaskRule,
} from "@/lib/young-worker/gate-logic";

// These tests exercise the pure decision core (decideGate). The server action
// (task-assignment-gate.ts) is a thin I/O wrapper around it; the repo forces
// MOCK_MODE in vitest and has no live Supabase, so testing the pure logic gives
// deterministic, meaningful coverage of every rule branch without mocking the DB.

const rulesFor = (taskCode: string): HazardousTaskRule[] =>
  FEDERAL_HAZARDOUS_RULES.filter((r) => r.task_code === taskCode);

// A fixed "now" so age math is stable regardless of when the suite runs.
const AT = "2026-07-10T09:00:00.000Z";
// Born 2010-01-01 → 16 on the AT date.
const DOB_16 = "2010-01-01";
// Born 2007-01-01 → 19 on the AT date.
const DOB_19 = "2007-01-01";

function profile(overrides: Partial<GateProfile>): GateProfile {
  return {
    dob: DOB_16,
    work_state: "WI",
    classification: "temp",
    work_permit_expiry_date: null,
    ca_permit_to_employ_number: null,
    ca_permit_to_work_number: null,
    ...overrides,
  };
}

describe("computeAge", () => {
  it("computes whole-year age at a given instant", () => {
    expect(computeAge(DOB_16, AT)).toBe(16);
    expect(computeAge(DOB_19, AT)).toBe(19);
  });

  it("does not round up before the birthday", () => {
    // Birthday is 2026-12-31; on 2026-07-10 they are still one year younger.
    expect(computeAge("2009-12-31", AT)).toBe(16);
  });
});

describe("federal hazardous-task hard block", () => {
  it("blocks forklift for a 16-year-old", () => {
    const r = decideGate(profile({}), rulesFor("FORKLIFT"), {
      taskCode: "FORKLIFT",
      equipmentCode: "forklift",
      scheduledAt: AT,
    });
    expect(r.decision).toBe("blocked");
    expect(r.reasons.join(" ")).toMatch(/prohibited for workers under 18/);
    expect(r.ruleIdsMatched).toContain("fed-forklift");
  });

  it.each(["ROOFING", "DEMOLITION", "TRENCHING", "FORKLIFT", "SKID_STEER"])(
    "blocks %s for an under-18 worker (no exception path)",
    (task) => {
      const r = decideGate(profile({}), rulesFor(task), {
        taskCode: task,
        scheduledAt: AT,
      });
      expect(r.decision).toBe("blocked");
    },
  );

  it("allows every federal hazardous task for an 18+ worker", () => {
    for (const task of ["ROOFING", "DEMOLITION", "TRENCHING", "FORKLIFT", "SKID_STEER"]) {
      const r = decideGate(profile({ dob: DOB_19 }), rulesFor(task), {
        taskCode: task,
        scheduledAt: AT,
      });
      expect(r.decision).toBe("allowed");
    }
  });
});

describe("student-learner / youth-apprentice exception", () => {
  it("allows a supervised student-learner on a task that permits the exception", () => {
    const r = decideGate(
      profile({ classification: "student_learner" }),
      rulesFor("ROOFING"), // HO 16 — exception exists
      { taskCode: "ROOFING", scheduledAt: AT, supervisionDocumented: true },
    );
    expect(r.decision).toBe("allowed_with_alert");
    expect(r.reasons.join(" ")).toMatch(/student-learner/i);
  });

  it("blocks the same worker when supervision is not documented", () => {
    const r = decideGate(
      profile({ classification: "student_learner" }),
      rulesFor("ROOFING"),
      { taskCode: "ROOFING", scheduledAt: AT, supervisionDocumented: false },
    );
    expect(r.decision).toBe("blocked");
  });

  it("does NOT apply the exception to a task that lacks it (forklift)", () => {
    const r = decideGate(
      profile({ classification: "student_learner" }),
      rulesFor("FORKLIFT"), // HO 7 — no exception
      { taskCode: "FORKLIFT", scheduledAt: AT, supervisionDocumented: true },
    );
    expect(r.decision).toBe("blocked");
  });
});

describe("permit validity", () => {
  it("blocks when the work permit has expired before the scheduled start", () => {
    const r = decideGate(
      profile({ dob: DOB_19, work_permit_expiry_date: "2026-01-01" }),
      [],
      { taskCode: "GENERAL", scheduledAt: AT },
    );
    expect(r.decision).toBe("blocked");
    expect(r.reasons.join(" ")).toMatch(/permit has expired/);
  });

  it("allows when the permit is still valid", () => {
    const r = decideGate(
      profile({ dob: DOB_19, work_permit_expiry_date: "2026-12-01" }),
      [],
      { taskCode: "GENERAL", scheduledAt: AT },
    );
    expect(r.decision).toBe("allowed");
  });
});

describe("California pre-first-shift permits", () => {
  it("blocks a CA worker missing the Permit to Employ and Permit to Work", () => {
    const r = decideGate(
      profile({ dob: DOB_19, work_state: "CA" }),
      [],
      { taskCode: "GENERAL", scheduledAt: AT },
    );
    expect(r.decision).toBe("blocked");
    expect(r.reasons.join(" ")).toMatch(/Permit to Employ and Permit to Work/);
  });

  it("allows a CA worker once both permits are on file", () => {
    const r = decideGate(
      profile({
        dob: DOB_19,
        work_state: "CA",
        ca_permit_to_employ_number: "PE-123",
        ca_permit_to_work_number: "PW-456",
      }),
      [],
      { taskCode: "GENERAL", scheduledAt: AT },
    );
    expect(r.decision).toBe("allowed");
  });
});

describe("equipment scoping", () => {
  it("does not fire an equipment-scoped rule when the work uses different equipment", () => {
    // Forklift rule is scoped to equipment 'forklift'; a hand-cart task shouldn't trip it.
    const r = decideGate(profile({}), rulesFor("FORKLIFT"), {
      taskCode: "FORKLIFT",
      equipmentCode: "hand_cart",
      scheduledAt: AT,
    });
    expect(r.decision).toBe("allowed");
    expect(r.ruleIdsMatched).toHaveLength(0);
  });
});
