// Pure, DB-free logic for the Evacuation Drill Compliance Calendar.
//
// Kept out of the "use server" action file (which may export async functions
// only) and out of React so it can be unit-tested in a plain Node/Vitest
// environment — mirrors src/lib/waste/generator-category.ts and the young-worker
// decideGate() helper.

export const DRILL_EVENT_TYPES = [
  "fire",
  "chemical_release",
  "shelter_in_place",
  "severe_weather",
  "active_threat",
  "medical",
  "spill",
  "rcra_contingency",
  "confined_space_rescue",
  "accountability",
  "comms_test",
  "tabletop",
  "business_continuity",
] as const;

export type DrillEventType = (typeof DRILL_EVENT_TYPES)[number];

export const DRILL_EVENT_LABELS: Record<DrillEventType, string> = {
  fire: "Fire evacuation",
  chemical_release: "Chemical release",
  shelter_in_place: "Shelter in place",
  severe_weather: "Severe weather",
  active_threat: "Active threat",
  medical: "Medical emergency",
  spill: "Spill response",
  rcra_contingency: "RCRA contingency",
  confined_space_rescue: "Confined-space rescue",
  accountability: "Accountability",
  comms_test: "Communications test",
  tabletop: "Tabletop exercise",
  business_continuity: "Business continuity",
};

export type Shift = { id: string; name: string };

// ── Frequency handling ────────────────────────────────────────────────────────
// The number of months between occurrences. Deliberately NOT defaulted to a
// single annual drill — an unknown frequency string is treated as annual only as
// a last-resort fallback, and the calendar supports monthly → biennial cadences.
const FREQUENCY_MONTHS: Record<string, number> = {
  weekly: 0.25,
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  triannual: 4,
  semiannual: 6,
  "semi-annual": 6,
  annual: 12,
  yearly: 12,
  biennial: 24,
};

/** Months between occurrences for a frequency string. */
export function frequencyToMonths(frequency: string | null | undefined): number {
  if (!frequency) return 12;
  const key = frequency.trim().toLowerCase();
  // Support "per-shift-annual" style compound labels by stripping qualifiers.
  const base = key.replace(/^per-?shift-?/, "").replace(/-per-?shift$/, "");
  return FREQUENCY_MONTHS[base] ?? FREQUENCY_MONTHS[key] ?? 12;
}

/**
 * Pick the effective (more frequent) cadence between the legally required
 * frequency and the company's own goal. Fewer months = stricter = wins.
 */
export function pickEffectiveFrequency(
  requiredFrequency: string,
  companyRequiredFrequency?: string | null,
): string {
  if (!companyRequiredFrequency) return requiredFrequency;
  return frequencyToMonths(companyRequiredFrequency) < frequencyToMonths(requiredFrequency)
    ? companyRequiredFrequency
    : requiredFrequency;
}

/**
 * Compute the next due date as an ISO (yyyy-mm-dd) string, `frequency` months
 * after `from` (defaults to today). Fractional months (e.g. weekly) are handled
 * by day math so sub-month cadences aren't silently rounded to monthly.
 */
export function computeNextDueDate(frequency: string, from: Date = new Date()): string {
  const months = frequencyToMonths(frequency);
  // Operate in UTC so the result is independent of the server's timezone.
  const d = new Date(from.getTime());
  if (months >= 1) {
    d.setUTCMonth(d.getUTCMonth() + Math.round(months));
  } else {
    d.setUTCDate(d.getUTCDate() + Math.round(months * 30));
  }
  return d.toISOString().slice(0, 10);
}

export type FrequencyRequirement = {
  event_type: string;
  required_frequency: string;
  company_required_frequency?: string | null;
  per_shift?: boolean | null;
  active?: boolean | null;
};

export type GeneratedCalendarEvent = {
  event_type: string;
  shift_id: string | null;
  shift_name: string | null;
  scheduled_date: string;
  due_date: string;
  effective_frequency: string;
  status: "scheduled";
};

/**
 * Build the set of calendar occurrences for a site from its frequency
 * requirements. One event per requirement, or one per shift when per_shift is
 * true. Purely functional — the server action persists the returned rows.
 */
export function buildCalendarEvents(
  requirements: FrequencyRequirement[],
  shifts: Shift[],
  from: Date = new Date(),
): GeneratedCalendarEvent[] {
  const events: GeneratedCalendarEvent[] = [];
  for (const req of requirements) {
    if (req.active === false) continue;
    const effective = pickEffectiveFrequency(req.required_frequency, req.company_required_frequency);
    const dueDate = computeNextDueDate(effective, from);
    const targets: Array<Shift | null> =
      req.per_shift && shifts.length > 0 ? shifts : [null];
    for (const shift of targets) {
      events.push({
        event_type: req.event_type,
        shift_id: shift?.id ?? null,
        shift_name: shift?.name ?? null,
        scheduled_date: dueDate,
        due_date: dueDate,
        effective_frequency: effective,
        status: "scheduled",
      });
    }
  }
  return events;
}

// ── Drill-record evaluation ───────────────────────────────────────────────────

export type DrillRecordEval = {
  participants: string[];
  wardens: string[];
  accountabilityTimeSeconds?: number | null;
  result: "passed" | "failed" | "incomplete";
  realEmergencyTriggered?: boolean;
};

export type DrillEvaluation = {
  missingWardens: boolean;
  rosterMismatch: boolean;
  eapReviewRequired: boolean;
  eapReviewReason: "failed_drill" | "real_emergency" | null;
};

/**
 * Derive the compliance signals from a drill record:
 *  - missingWardens: a drill ran with no warden on duty.
 *  - rosterMismatch: people were counted as participating but accountability was
 *    never reconciled (no accountability time captured), i.e. the head-count at
 *    assembly can't be squared against who was expected.
 *  - eapReviewRequired: a failed drill or a real emergency mandates EAP review.
 */
export function evaluateDrillRecord(record: DrillRecordEval): DrillEvaluation {
  const missingWardens = record.wardens.length === 0;
  const rosterMismatch =
    record.participants.length > 0 &&
    (record.accountabilityTimeSeconds === undefined ||
      record.accountabilityTimeSeconds === null);

  const eapReviewRequired = record.result === "failed" || record.realEmergencyTriggered === true;
  const eapReviewReason: DrillEvaluation["eapReviewReason"] = !eapReviewRequired
    ? null
    : record.result === "failed"
      ? "failed_drill"
      : "real_emergency";

  return { missingWardens, rosterMismatch, eapReviewRequired, eapReviewReason };
}

/** A scheduled event is overdue when its due date is strictly before `today`. */
export function isOverdue(dueDate: string, today: Date = new Date()): boolean {
  return dueDate < today.toISOString().slice(0, 10);
}
