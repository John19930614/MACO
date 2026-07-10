// Plain-language escalation notifications + threshold logic for reporting clocks.
// Pure module (no I/O) so it is unit-testable and safe to import from both the
// cron escalation action and the UI.

export type ClockStatus =
  | "not_applicable"
  | "pending_start"
  | "running"
  | "escalated_amber"
  | "escalated_red"
  | "overdue"
  | "reported"
  | "closed_no_report_required";

// Fraction of the deadline elapsed that trips each escalation band. Mirrors the
// thresholds named in the feature request (75% amber, 90% red, 100% overdue).
export const ESCALATION_THRESHOLDS = {
  amber: 0.75,
  red: 0.9,
  overdue: 1.0,
} as const;

/**
 * Given a clock's start and deadline and a reference "now", return the status the
 * clock should be in (only escalating states; a reported/closed clock is handled
 * by the caller and never passed here).
 */
export function statusForElapsed(
  startedAt: string,
  deadlineAt: string,
  now: Date = new Date(),
): Extract<ClockStatus, "running" | "escalated_amber" | "escalated_red" | "overdue"> {
  const start = new Date(startedAt).getTime();
  const end = new Date(deadlineAt).getTime();
  const t = now.getTime();
  if (t >= end) return "overdue";
  const span = end - start;
  const frac = span <= 0 ? 1 : (t - start) / span;
  if (frac >= ESCALATION_THRESHOLDS.red) return "escalated_red";
  if (frac >= ESCALATION_THRESHOLDS.amber) return "escalated_amber";
  return "running";
}

/** Whole hours remaining until the deadline (negative once overdue, floored). */
export function hoursRemaining(deadlineAt: string, now: Date = new Date()): number {
  const ms = new Date(deadlineAt).getTime() - now.getTime();
  return Math.floor(ms / 3600_000);
}

/**
 * Build a plain-language escalation message naming the specific report and the
 * time remaining/overdue. Addressed to the incident's managers per policy.
 * e.g. "OSHA fatality report is due in 2 hour(s) and has not been confirmed."
 */
export function buildEscalationMessage(clock: {
  description: string;
  hoursRemaining: number;
  status: string;
}): string {
  if (clock.hoursRemaining <= 0) {
    return `${clock.description} is now overdue and has not been confirmed. Please report immediately and enter the confirmation number.`;
  }
  return `${clock.description} is due in ${clock.hoursRemaining} hour(s) and has not been confirmed.`;
}

// ── UI helpers ──────────────────────────────────────────────────────────────────

/** Green / amber / red bucket for the countdown visual. */
export function colorBand(status: string): "green" | "amber" | "red" {
  if (status === "overdue" || status === "escalated_red") return "red";
  if (status === "escalated_amber") return "amber";
  return "green";
}

/** Plain-language time-remaining label, e.g. "5 hours left to report". */
export function plainLanguageTimeRemaining(deadlineAt: string, now: Date = new Date()): string {
  const hrs = hoursRemaining(deadlineAt, now);
  if (hrs <= 0) {
    const overdueBy = Math.abs(hrs);
    return overdueBy === 0
      ? "Deadline reached — report now"
      : `Overdue by ${overdueBy} hour(s) — report immediately`;
  }
  if (hrs === 1) return "1 hour left to report";
  return `${hrs} hours left to report`;
}
