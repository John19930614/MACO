// Regulatory incident-reporting rules engine (pure, DB-free, unit-testable).
//
// Given the classification facts of an incident, decide which regulatory reports
// are required and by when. This module intentionally holds NO "use server"
// directive and performs NO I/O — it is the deterministic core that the server
// actions (which persist clock rows) and the decision-helper UI both call.
//
// The REGULATORY_RULES constant below MIRRORS the seed rows in
// 20260710050000_regulatory_reporting_clocks.sql (regulatory_reporting_rules).
// The DB table is the persistence/admin-config copy; this constant is the source
// of truth for computation. Keep the two in sync.
//
// ⚠ NOT LEGAL ADVICE — deadlines are illustrative and require legal review.

export type Jurisdiction =
  | "federal_osha"
  | "california_cal_osha"
  | "epa_environmental_release";

export type RegulatoryEventType =
  | "fatality"
  | "inpatient_hospitalization"
  | "amputation"
  | "loss_of_eye"
  | "serious_injury_illness_or_death"
  | "reportable_quantity_release";

export type RegulatoryRule = {
  jurisdiction: Jurisdiction;
  eventType: RegulatoryEventType;
  deadlineHours: number;
  description: string;
};

// Mirrors the seeded regulatory_reporting_rules rows.
export const REGULATORY_RULES: readonly RegulatoryRule[] = [
  { jurisdiction: "federal_osha", eventType: "fatality", deadlineHours: 8, description: "Report the fatality to OSHA" },
  { jurisdiction: "federal_osha", eventType: "inpatient_hospitalization", deadlineHours: 24, description: "Report the in-patient hospitalization to OSHA" },
  { jurisdiction: "federal_osha", eventType: "amputation", deadlineHours: 24, description: "Report the amputation to OSHA" },
  { jurisdiction: "federal_osha", eventType: "loss_of_eye", deadlineHours: 24, description: "Report the loss of an eye to OSHA" },
  { jurisdiction: "california_cal_osha", eventType: "serious_injury_illness_or_death", deadlineHours: 8, description: "Report to Cal/OSHA — immediately, no later than 8 hours" },
  { jurisdiction: "epa_environmental_release", eventType: "reportable_quantity_release", deadlineHours: 24, description: "Report the reportable-quantity release to EPA / state" },
] as const;

// The classification inputs the engine reasons over. All optional/boolean so the
// decision helper can build them incrementally from yes/no answers.
export type IncidentFacts = {
  fatality?: boolean;
  inpatientHospitalization?: boolean;
  amputation?: boolean;
  lossOfEye?: boolean;
  state?: string; // e.g. "CA"
  seriousInjuryIllnessOrDeath?: boolean;
  environmentalRelease?: boolean;
  reportableQuantityExceeded?: boolean;
  // Reference time the clocks start from (incident occurrence / discovery).
  // ISO string; defaults to now when omitted.
  referenceTime?: string;
};

export type EvaluatedClock = {
  jurisdiction: Jurisdiction;
  eventType: RegulatoryEventType;
  deadlineHours: number;
  description: string;
  deadlineAt: string; // ISO
};

export type ReportabilityResult = {
  clocks: EvaluatedClock[];
};

function ruleFor(jurisdiction: Jurisdiction, eventType: RegulatoryEventType): RegulatoryRule | undefined {
  return REGULATORY_RULES.find((r) => r.jurisdiction === jurisdiction && r.eventType === eventType);
}

/**
 * Evaluate which regulatory clocks apply to an incident. Each applicable rule
 * yields an independent clock with its own deadline. Federal and California
 * clocks run concurrently and independently (a CA serious injury that is also an
 * in-patient hospitalization produces BOTH a federal 24hr clock and a CA 8hr
 * clock). Environmental-release clocks are independent of injury clocks.
 */
export function evaluateReportability(facts: IncidentFacts): ReportabilityResult {
  const start = facts.referenceTime ? new Date(facts.referenceTime) : new Date();
  const clocks: EvaluatedClock[] = [];

  const push = (jurisdiction: Jurisdiction, eventType: RegulatoryEventType) => {
    const rule = ruleFor(jurisdiction, eventType);
    if (!rule) return;
    const deadlineAt = new Date(start.getTime() + rule.deadlineHours * 3600_000).toISOString();
    clocks.push({
      jurisdiction: rule.jurisdiction,
      eventType: rule.eventType,
      deadlineHours: rule.deadlineHours,
      description: rule.description,
      deadlineAt,
    });
  };

  // Federal OSHA (29 CFR 1904.39)
  if (facts.fatality) push("federal_osha", "fatality");
  if (facts.inpatientHospitalization) push("federal_osha", "inpatient_hospitalization");
  if (facts.amputation) push("federal_osha", "amputation");
  if (facts.lossOfEye) push("federal_osha", "loss_of_eye");

  // California overlay (Cal/OSHA) — runs independently of the federal clock.
  if (facts.state === "CA" && facts.seriousInjuryIllnessOrDeath) {
    push("california_cal_osha", "serious_injury_illness_or_death");
  }

  // Environmental release (EPA/state) — independent of injury clocks.
  if (facts.environmentalRelease && facts.reportableQuantityExceeded) {
    push("epa_environmental_release", "reportable_quantity_release");
  }

  return { clocks };
}

// ── Plain-language decision helper ──────────────────────────────────────────────
// The UI asks these yes/no questions (no OSHA jargon). Each answer maps to one or
// more IncidentFacts. Consumed by RegulatoryIncidentReporting.tsx.

export type DecisionQuestion = {
  id: string;
  question: string;
};

export const DECISION_QUESTIONS: readonly DecisionQuestion[] = [
  { id: "died", question: "Did anyone die as a result of this incident?" },
  { id: "hospital_overnight", question: "Was anyone admitted to a hospital as an in-patient (stayed, not just treated and released)?" },
  { id: "amputation", question: "Did anyone lose a body part (an amputation)?" },
  { id: "lost_eye", question: "Did anyone lose an eye?" },
  { id: "in_california", question: "Did this happen in California?" },
  { id: "ca_serious", question: "Was it a serious injury, illness, or death?" },
  { id: "released_substance", question: "Was there a spill or release of a hazardous substance to the environment (air, water, or ground)?" },
  { id: "over_reportable_qty", question: "Did the amount released reach or exceed the reportable quantity?" },
] as const;

/**
 * Map the decision-helper yes/no answers into IncidentFacts. Answers is a record
 * keyed by DecisionQuestion.id → boolean (true = "yes").
 */
export function mapPlainLanguageAnswers(
  answers: Record<string, boolean>,
  referenceTime?: string,
): IncidentFacts {
  return {
    fatality: !!answers.died,
    inpatientHospitalization: !!answers.hospital_overnight,
    amputation: !!answers.amputation,
    lossOfEye: !!answers.lost_eye,
    state: answers.in_california ? "CA" : undefined,
    seriousInjuryIllnessOrDeath: !!answers.ca_serious,
    environmentalRelease: !!answers.released_substance,
    reportableQuantityExceeded: !!answers.over_reportable_qty,
    referenceTime,
  };
}
