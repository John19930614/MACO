# Document Activity Panel

## Purpose

A unified dashboard widget for the **Documents & Programs** module. It surfaces the
current state of a tenant's EHS documents in one place — recently created, under
review, awaiting approval, missing, and ready to download — so users don't have to
sweep multiple views to find what needs attention.

Aimed at document managers / EHS leads who need to track drafts, monitor reviews,
clear outstanding sign-offs, resolve missing or expired programs, and reach approved
documents to export.

---

## Route

- **Page:** `/documents/activity` → `src/app/(app)/documents/activity/page.tsx`
- Reachable from the **Activity** button in the Documents page header
  (`src/app/(app)/documents/page.tsx`).
- Deep links used by rows: document detail `/documents/[id]`; missing-program rows
  link to `/documents` (where the AI Program Builder can author the program).

> Note: unlike the original spec, this feature lives under the **existing** Documents
> module (`/documents/*`), not an invented `/dashboard` or `/platform` route.

---

## Panel Sections

| Section (UI)                | Internal key          | Contents |
|-----------------------------|-----------------------|----------|
| Recently Created            | `recentlyGenerated`   | `Draft` documents updated in the last 30 days |
| Currently Being Reviewed    | `underReview`         | `In Review` documents |
| Waiting for Approval        | `outstandingApprovals`| `Needs Signature` documents |
| Missing Paperwork           | `missingDocuments`    | `Missing` (required program with no doc) + `Expired` documents |
| Ready to Download           | `completedExports`    | `Approved` documents (each carries `exportCompletedAt`) |

---

## Status Model

The six user-facing states are a **projection** of the stored `DocumentStatus` enum
(`draft | active | under_review | superseded | obsolete` in `src/lib/constants.ts`),
plus derived states. See `mapDocumentStatus()` in `src/lib/documents/activity.ts`:

| Stored status | Condition | Activity status | Badge label | Colour |
|---|---|---|---|---|
| `draft` | — | `Draft` | Being Prepared | Slate |
| `under_review` | — | `In Review` | Under Review | Blue |
| `active` | `review_date` in the past | `Expired` | Expired | Orange |
| `active` | `acknowledgment_required` | `Needs Signature` | Signature Required | Amber |
| `active` | otherwise | `Approved` | Approved | Emerald |
| `superseded` / `obsolete` | — | *(hidden)* | — | — |
| *(no document)* | required program missing | `Missing` | Document Missing | Red |

Precedence for `active`: **Expired → Needs Signature → Approved**.

---

## Data Sources

- **Constraint:** `db=false`, `files=true` — no direct DB writes and no migration.
- Everything is read through the existing tenant-scoped data layer:
  - `getDocuments(tenantId)`, `getProfiles(tenantId)`, `getChemicals`,
    `getBiosafetyLabs`, `getWasteStreams` — all from `@/lib/data/ehsRepo`
    (RLS-respecting live; in-memory fixtures under `NEXT_PUBLIC_SAFETYIQ_MOCK`).
  - `requiredPrograms()` from `@/lib/ai/programBuilder` to derive the `Missing` list.
- Tenant is resolved server-side via `getEffectiveTenantId()` — never a client-passed
  org id. The server action follows the `exportChemicalSummaries.ts` pattern.

---

## File Map

```
src/
├── components/documents/
│   ├── DocumentActivityPanel.tsx     ← top-level panel ("use client")
│   ├── DocumentStatusSection.tsx     ← per-section table + empty state
│   ├── DocumentActivityRow.tsx       ← single document row
│   └── DocumentStatusBadge.tsx       ← colour-coded status badge + tooltip
├── lib/
│   ├── documents/activity.ts         ← types + pure mapping/grouping logic
│   └── actions/getDocumentActivity.ts← "use server" fetch + group
└── app/(app)/documents/activity/
    └── page.tsx                      ← server component page
test/document-activity.test.ts        ← node-env unit tests
```

> The pure logic and types live in `lib/documents/activity.ts` — **not** in the
> `"use server"` file — because a `"use server"` module may only export async
> functions. Components and tests import types/logic from there.

---

## Security & Permissions

- Data is scoped to the authenticated tenant in the server action (`getEffectiveTenantId`),
  and the underlying repo respects RLS in live mode.
- Only metadata is surfaced (title, status, dates, owner name) — no document content.
- Review/Approve links route to `/documents/[id]`; that page enforces its own access.
- No AI gateway calls — every status is a deterministic projection of stored fields.

---

## Tests

```bash
npm test -- document-activity     # or: npx vitest run test/document-activity.test.ts
```

Covers: status projection for every stored status (incl. Expired/Needs Signature
precedence and hidden superseded/obsolete), section routing, the 30-day Draft window,
`exportCompletedAt` on Approved items, synthetic Missing rows, owner resolution/
fallback, deep-link URLs, and the action returning all five keys in mock mode.

Component rendering is **not** covered by RTL — the repo's Vitest runs in a `node`
environment and does not ship `@testing-library/react` / `jsdom`. Rendering is
verified manually (below).

---

## Known Constraints & Follow-ups

- `Ready to Download` maps to **approved documents** (which the platform can export
  via `docExport.ts`); `exportCompletedAt` is the document's `updated_at`, not a
  separate export-log timestamp. If a real export audit log is later added, point
  this field at it.
- The panel does not auto-refresh; reload to see updated statuses.
- Superseded/obsolete documents are intentionally hidden.
- Sort order within each section is most-recently-updated first.
