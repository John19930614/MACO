import { describe, it, expect } from "vitest";
import {
  evaluateReportability,
  mapPlainLanguageAnswers,
} from "@/lib/regulatory/jurisdictionEngine";
import {
  statusForElapsed,
  buildEscalationMessage,
  colorBand,
  plainLanguageTimeRemaining,
} from "@/lib/regulatory/notifications";

const REF = "2026-07-10T00:00:00.000Z";

describe("jurisdictionEngine — federal OSHA rules", () => {
  it("starts a federal 8hr clock on fatality", () => {
    const r = evaluateReportability({ fatality: true, referenceTime: REF });
    const c = r.clocks.find((x) => x.jurisdiction === "federal_osha" && x.eventType === "fatality");
    expect(c?.deadlineHours).toBe(8);
    expect(c?.deadlineAt).toBe("2026-07-10T08:00:00.000Z");
  });

  it("starts a federal 24hr clock on in-patient hospitalization", () => {
    const r = evaluateReportability({ inpatientHospitalization: true, referenceTime: REF });
    expect(r.clocks.some((c) => c.jurisdiction === "federal_osha" && c.deadlineHours === 24)).toBe(true);
  });

  it("starts a federal 24hr clock on amputation and loss of eye", () => {
    const amp = evaluateReportability({ amputation: true });
    const eye = evaluateReportability({ lossOfEye: true });
    expect(amp.clocks.some((c) => c.eventType === "amputation" && c.deadlineHours === 24)).toBe(true);
    expect(eye.clocks.some((c) => c.eventType === "loss_of_eye" && c.deadlineHours === 24)).toBe(true);
  });

  it("produces no clocks for a non-reportable near miss", () => {
    const r = evaluateReportability({});
    expect(r.clocks).toHaveLength(0);
  });
});

describe("jurisdictionEngine — California overlay runs independently", () => {
  it("runs a CA 8hr clock alongside the federal 24hr clock for a CA serious injury + hospitalization", () => {
    const r = evaluateReportability({
      state: "CA",
      seriousInjuryIllnessOrDeath: true,
      inpatientHospitalization: true,
      referenceTime: REF,
    });
    const federal = r.clocks.find((c) => c.jurisdiction === "federal_osha");
    const ca = r.clocks.find((c) => c.jurisdiction === "california_cal_osha");
    expect(federal?.deadlineHours).toBe(24);
    expect(ca?.deadlineHours).toBe(8);
    // Two independent clocks attached to one incident.
    expect(r.clocks).toHaveLength(2);
  });

  it("does NOT start the CA overlay outside California", () => {
    const r = evaluateReportability({ state: "TX", seriousInjuryIllnessOrDeath: true });
    expect(r.clocks.some((c) => c.jurisdiction === "california_cal_osha")).toBe(false);
  });
});

describe("jurisdictionEngine — environmental release", () => {
  it("starts an EPA/state timer independent of injury clocks", () => {
    const r = evaluateReportability({ environmentalRelease: true, reportableQuantityExceeded: true });
    expect(r.clocks.some((c) => c.jurisdiction === "epa_environmental_release")).toBe(true);
  });

  it("does NOT start an EPA timer when the reportable quantity is not exceeded", () => {
    const r = evaluateReportability({ environmentalRelease: true, reportableQuantityExceeded: false });
    expect(r.clocks.some((c) => c.jurisdiction === "epa_environmental_release")).toBe(false);
  });
});

describe("mapPlainLanguageAnswers — decision helper", () => {
  it("maps yes/no answers to the correct clocks without OSHA jargon", () => {
    const facts = mapPlainLanguageAnswers(
      { hospital_overnight: true, in_california: true, ca_serious: true },
      REF,
    );
    const r = evaluateReportability(facts);
    expect(r.clocks.some((c) => c.jurisdiction === "federal_osha" && c.deadlineHours === 24)).toBe(true);
    expect(r.clocks.some((c) => c.jurisdiction === "california_cal_osha" && c.deadlineHours === 8)).toBe(true);
  });

  it("maps a release + reportable-quantity yes to the EPA clock", () => {
    const facts = mapPlainLanguageAnswers({ released_substance: true, over_reportable_qty: true });
    const r = evaluateReportability(facts);
    expect(r.clocks.some((c) => c.jurisdiction === "epa_environmental_release")).toBe(true);
  });
});

describe("escalation thresholds + messaging", () => {
  const started = "2026-07-10T00:00:00.000Z";
  const deadline = "2026-07-10T08:00:00.000Z"; // 8hr clock

  it("escalates green → amber (75%) → red (90%) → overdue (100%)", () => {
    expect(statusForElapsed(started, deadline, new Date("2026-07-10T01:00:00Z"))).toBe("running");
    expect(statusForElapsed(started, deadline, new Date("2026-07-10T06:00:00Z"))).toBe("escalated_amber"); // 75%
    expect(statusForElapsed(started, deadline, new Date("2026-07-10T07:12:00Z"))).toBe("escalated_red"); // 90%
    expect(statusForElapsed(started, deadline, new Date("2026-07-10T08:30:00Z"))).toBe("overdue");
  });

  it("builds plain-language messages naming the clock and time", () => {
    expect(buildEscalationMessage({ description: "Report the fatality to OSHA", hoursRemaining: 2, status: "escalated_red" }))
      .toBe("Report the fatality to OSHA is due in 2 hour(s) and has not been confirmed.");
    expect(buildEscalationMessage({ description: "Report the fatality to OSHA", hoursRemaining: 0, status: "overdue" }))
      .toContain("is now overdue");
  });

  it("maps status to a color band and a plain time label", () => {
    expect(colorBand("running")).toBe("green");
    expect(colorBand("escalated_amber")).toBe("amber");
    expect(colorBand("overdue")).toBe("red");
    expect(plainLanguageTimeRemaining(deadline, new Date("2026-07-10T03:00:00Z"))).toBe("5 hours left to report");
    expect(plainLanguageTimeRemaining(deadline, new Date("2026-07-10T10:00:00Z"))).toContain("Overdue");
  });
});
