// Document Activity — pure types + grouping logic for the Documents & Programs
// activity panel. No I/O, no session, no "use server" — kept separate from the
// server action (getDocumentActivity.ts) so this logic is unit-testable and so the
// "use server" module can export only its async action (a Next.js requirement).

import type { Document } from "@/lib/types";

// The six plain-language states surfaced in the panel. Distinct from the storage-level
// `DocumentStatus` enum in constants.ts (draft/active/under_review/…) — this is the
// user-facing projection of it, plus the derived Missing / Expired / Needs Signature
// states that don't map 1:1 to a stored column.
export type DocActivityStatus =
  | "Draft"
  | "In Review"
  | "Approved"
  | "Missing"
  | "Expired"
  | "Needs Signature";

export interface DocumentActivityItem {
  id: string;
  title: string;
  status: DocActivityStatus;
  program: string;
  owner: string;
  updatedAt: string; // ISO date string
  reviewUrl: string;
  approveUrl: string;
  detailUrl: string;
  exportCompletedAt?: string; // ISO date string — populated for Ready-to-Download items only
}

export interface DocumentActivityData {
  recentlyGenerated: DocumentActivityItem[];
  underReview: DocumentActivityItem[];
  outstandingApprovals: DocumentActivityItem[];
  missingDocuments: DocumentActivityItem[];
  completedExports: DocumentActivityItem[];
}

export interface GetDocumentActivityResult {
  success: boolean;
  data?: DocumentActivityData;
  error?: string;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Projects a stored document's status onto the six user-facing states.
 * Pure and deterministic (takes `now` explicitly) so it can be unit-tested.
 * Historical states (superseded / obsolete) return null — they aren't surfaced.
 */
export function mapDocumentStatus(doc: Document, now: number): DocActivityStatus | null {
  switch (doc.status) {
    case "draft":
      return "Draft";
    case "under_review":
      return "In Review";
    case "active": {
      // An active document past its review date is out of compliance ("Expired").
      if (doc.review_date && new Date(doc.review_date).getTime() < now) return "Expired";
      // Active but still awaiting team sign-off surfaces as "Needs Signature".
      if (doc.acknowledgment_required) return "Needs Signature";
      // Otherwise it's fully approved and available to export/download.
      return "Approved";
    }
    default:
      // superseded / obsolete — not shown in the activity panel.
      return null;
  }
}

/**
 * Builds a DocumentActivityItem from a stored document.
 * Review/approve both route to the document detail page (the edit/review surface);
 * there is no separate approval route in the current app.
 */
function toItem(doc: Document, status: DocActivityStatus, ownerName: string): DocumentActivityItem {
  const detailUrl = `/documents/${doc.id}`;
  return {
    id: doc.id,
    title: doc.title,
    status,
    program: doc.regulation_ref ?? doc.category,
    owner: ownerName,
    updatedAt: doc.updated_at,
    reviewUrl: detailUrl,
    approveUrl: detailUrl,
    detailUrl,
    // "Ready to Download" == an approved document. We surface when it reached that
    // state (updated_at) as the export-ready timestamp.
    exportCompletedAt: status === "Approved" ? doc.updated_at : undefined,
  };
}

/**
 * Pure grouping core — turns the raw data layer inputs into the five panel sections.
 * Exported for unit testing (no I/O, no session, deterministic given `now`).
 */
export function groupDocumentActivity(
  docs: Document[],
  missingTitles: { title: string; regulation: string }[],
  ownerNameById: Record<string, string>,
  now: number
): DocumentActivityData {
  const recentlyGenerated: DocumentActivityItem[] = [];
  const underReview: DocumentActivityItem[] = [];
  const outstandingApprovals: DocumentActivityItem[] = [];
  const missingDocuments: DocumentActivityItem[] = [];
  const completedExports: DocumentActivityItem[] = [];

  for (const doc of docs) {
    const status = mapDocumentStatus(doc, now);
    if (!status) continue; // superseded / obsolete
    const owner = doc.owner_id ? (ownerNameById[doc.owner_id] ?? "Unassigned") : "Unassigned";
    const item = toItem(doc, status, owner);

    switch (status) {
      case "Draft":
        // "Recently Created" = drafts touched in the last 30 days.
        if (now - new Date(doc.updated_at).getTime() <= THIRTY_DAYS_MS) recentlyGenerated.push(item);
        break;
      case "In Review":
        underReview.push(item);
        break;
      case "Needs Signature":
        outstandingApprovals.push(item);
        break;
      case "Expired":
        missingDocuments.push(item);
        break;
      case "Approved":
        completedExports.push(item);
        break;
    }
  }

  // Required EHS programs the tenant has no document for → synthetic "Missing" rows.
  const nowIso = new Date(now).toISOString();
  for (const m of missingTitles) {
    missingDocuments.push({
      id: `missing-${m.regulation}`,
      title: m.title,
      status: "Missing",
      program: m.regulation,
      owner: "Unassigned",
      updatedAt: nowIso,
      // No document exists yet — send the user to the Documents page where the
      // AI Program Builder can author it.
      reviewUrl: "/documents",
      approveUrl: "/documents",
      detailUrl: "/documents",
    });
  }

  // Most-recently-updated first within each section.
  const byUpdatedDesc = (a: DocumentActivityItem, b: DocumentActivityItem) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  recentlyGenerated.sort(byUpdatedDesc);
  underReview.sort(byUpdatedDesc);
  outstandingApprovals.sort(byUpdatedDesc);
  completedExports.sort(byUpdatedDesc);

  return { recentlyGenerated, underReview, outstandingApprovals, missingDocuments, completedExports };
}
