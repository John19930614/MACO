# SDS Expiry Alerts (Chemicals Page)

## What this does

Every chemical record has an **SDS Review Due Date** (`sds_expiry` — this field
already existed and doubled as the review date; this feature makes it visible,
consistent, and actionable everywhere it's shown). The Chemicals table and the
Dashboard compliance health tile show you, in plain language, which chemicals
need attention:

- **SDS Overdue (Nd)** (red) — the review date has passed. Fix this first.
- **SDS Due in Nd** (amber) — due within the next 90 days.
- **SDS Missing** (red) — no SDS document linked, or no review date on file.
  Treated with the same urgency as overdue — you should not ignore these.
- **SDS OK** (green) — more than 90 days away, no action needed yet.

## Where to see it

- **Chemicals table** (`/chemicals`, Inventory tab): a dedicated "SDS Status"
  column with a text + icon badge (never color alone), sortable by clicking
  the column header, and filterable via the SDS Status chips above the table
  (All / Overdue / Due Soon / Missing / OK).
- **Dashboard** (`/dashboard`): the Compliance Health row has an "SDS Review
  Status" tile showing a plain-English count, e.g. "12 chemicals need SDS
  review — 5 overdue, 6 due in 90 days, 1 missing." Click it to jump straight
  to the Chemicals table pre-filtered to those statuses.

## Defaults and overrides

When a chemical is created, the SDS Review Due Date field defaults to **3
years from today**. If your company policy requires more frequent review for
certain hazard classes (e.g. annual review), override the date directly in
the chemical's add/edit form — it's just a regular date field.

## Renewing an SDS ("resetting the clock")

For a chemical that already has an SDS document linked, flagged rows
(Overdue / Due Soon) show an **"Upload New SDS"** quick action. Clicking it
resets the review due date to 3 years from today without needing to touch the
document link — use it after confirming the SDS document is current (e.g. you
re-uploaded the same file at the same location, or checked it's still the
latest supplier revision).

For a chemical with no SDS linked at all, use the existing **"Link SDS"**
action instead — it captures both the document URL and the review date in one
step.

## Existing chemicals (backfill)

The `20260707010000_sds_review_due_date.sql` migration backfills existing
records: any chemical that already had an SDS document linked gets a review
due date of 3 years from its upload/creation date. Chemicals with no SDS
document linked are **left as "Missing"** on purpose — a blanket backfill
would have hidden that gap instead of surfacing it. Use the dashboard tile or
the Chemicals table filter to see how many need a closer look.

## Implementation notes

- Single source of truth: `src/lib/sds/sdsStatus.ts` (`getSdsStatus`,
  `computeDefaultReviewDueDate`). Every surface (Chemicals table, Chemicals
  page SDS Coverage card, SDS Register tab, Dashboard tile) computes status
  through this one function — no duplicated overdue/due-soon logic.
- Server action: `src/lib/actions/sdsReview.ts` (`setSdsReviewDate`) sets or
  resets the review date. It follows this app's existing session model
  (`getCtx()` / tenant-scoped RLS client in live mode, mock-store branch in
  `NEXT_PUBLIC_SAFETYIQ_MOCK` mode) — there is no granular role/permission
  system in this codebase (`profiles.role` is a free-text display string, not
  an enum), so this intentionally does not invent one.
