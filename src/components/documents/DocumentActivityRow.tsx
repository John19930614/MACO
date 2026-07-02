import Link from "next/link";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import type { DocumentActivityItem } from "@/lib/documents/activity";

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
}

export function DocumentActivityRow({ item }: { item: DocumentActivityItem }) {
  const showReview = item.status === "In Review";
  const showApprove = item.status === "Needs Signature" || item.status === "In Review";

  return (
    <tr className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
      {/* Document Name */}
      <td className="px-4 py-3">
        <Link
          href={item.detailUrl}
          className="rounded font-medium text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-blue-400"
        >
          {item.title}
        </Link>
      </td>

      {/* Program */}
      <td className="hidden px-4 py-3 text-sm text-slate-600 md:table-cell dark:text-slate-300">
        {item.program}
      </td>

      {/* Owner */}
      <td className="hidden px-4 py-3 text-sm text-slate-600 md:table-cell dark:text-slate-300">
        {item.owner}
      </td>

      {/* Last Updated */}
      <td className="hidden px-4 py-3 text-sm text-slate-500 md:table-cell dark:text-slate-400">
        <time dateTime={item.updatedAt}>{relativeDate(item.updatedAt)}</time>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <DocumentStatusBadge status={item.status} />
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={item.detailUrl}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            aria-label={`Open document: ${item.title}`}
          >
            Open
          </Link>
          {showReview && (
            <Link
              href={item.reviewUrl}
              className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
              aria-label={`Go to review for: ${item.title}`}
            >
              Review
            </Link>
          )}
          {showApprove && (
            <Link
              href={item.approveUrl}
              className="text-sm font-medium text-amber-700 hover:underline dark:text-amber-400"
              aria-label={`Approve: ${item.title}`}
            >
              Approve
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}
