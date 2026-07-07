// Single source of truth for "is this chemical's SDS current?" — used by the
// Chemicals table, the dashboard compliance widget, and the SDS coverage
// analytics on the chemicals page. `sds_expiry` doubles as the SDS review due
// date (see Chemical.sds_expiry in src/lib/types.ts).
//
// A chemical counts as "missing" if it has no SDS document linked (sds_url)
// OR no review due date on file — either gap needs attention and must not be
// silently treated as fine.

export type SdsStatus = "overdue" | "due_soon" | "ok" | "missing";

export interface SdsStatusInput {
  sdsUrl: string | null | undefined;
  reviewDueDate: string | null | undefined;
}

export interface SdsStatusResult {
  status: SdsStatus;
  label: string; // plain-English label, e.g. 'SDS Overdue (12d)', 'SDS Due in 45d', 'SDS OK', 'SDS Missing'
  daysUntilDue: number | null;
  colorClass: string; // tailwind classes for badge background/text/border
}

const DUE_SOON_WINDOW_DAYS = 90;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const RED = "bg-red-100 text-red-800 border border-red-300";
const AMBER = "bg-amber-100 text-amber-800 border border-amber-300";
const GREEN = "bg-green-100 text-green-800 border border-green-300";

export function getSdsStatus(input: SdsStatusInput, now: Date = new Date()): SdsStatusResult {
  if (!input.sdsUrl || !input.reviewDueDate) {
    return { status: "missing", label: "SDS Missing", daysUntilDue: null, colorClass: RED };
  }

  const due = new Date(input.reviewDueDate);
  const daysUntilDue = Math.floor((due.getTime() - now.getTime()) / MS_PER_DAY);

  if (daysUntilDue < 0) {
    return { status: "overdue", label: `SDS Overdue (${Math.abs(daysUntilDue)}d)`, daysUntilDue, colorClass: RED };
  }

  if (daysUntilDue <= DUE_SOON_WINDOW_DAYS) {
    return { status: "due_soon", label: `SDS Due in ${daysUntilDue}d`, daysUntilDue, colorClass: AMBER };
  }

  return { status: "ok", label: "SDS OK", daysUntilDue, colorClass: GREEN };
}

// Rank used to pick the "worst" status across a group of containers, and to
// sort rows with missing/overdue first regardless of daysUntilDue being null.
export const SDS_STATUS_RANK: Record<SdsStatus, number> = { missing: 0, overdue: 1, due_soon: 2, ok: 3 };

export function computeDefaultReviewDueDate(uploadedAt: Date = new Date()): string {
  const due = new Date(uploadedAt);
  due.setFullYear(due.getFullYear() + 3);
  return due.toISOString().slice(0, 10);
}
