import Link from "next/link";
import { DocumentActivityRow } from "./DocumentActivityRow";
import type { DocumentActivityItem } from "@/lib/documents/activity";

interface DocumentStatusSectionProps {
  title: string;
  description?: string;
  items: DocumentActivityItem[];
  emptyMessage?: string;
  quickLinkHref?: string;
  quickLinkLabel?: string;
  quickLinkVariant?: "ghost" | "destructive-outline";
}

export function DocumentStatusSection({
  title,
  description,
  items,
  emptyMessage = "Nothing here yet. Documents will appear once they're created.",
  quickLinkHref,
  quickLinkLabel,
  quickLinkVariant = "ghost",
}: DocumentStatusSectionProps) {
  const anchor = `section-${title.replace(/\s+/g, "-").toLowerCase()}`;
  const quickLinkClasses =
    quickLinkVariant === "destructive-outline"
      ? "rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
      : "rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

  return (
    <section className="mb-8" aria-labelledby={anchor}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 id={anchor} className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
          {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
        {quickLinkHref && quickLinkLabel && (
          <Link href={quickLinkHref} className={quickLinkClasses}>
            {quickLinkLabel}
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center dark:border-slate-700 dark:bg-slate-800/50">
          <p className="text-sm text-slate-400 dark:text-slate-500">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 dark:bg-slate-900/40 dark:text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Document Name</th>
                <th className="hidden px-4 py-2.5 md:table-cell">Program</th>
                <th className="hidden px-4 py-2.5 md:table-cell">Owner</th>
                <th className="hidden px-4 py-2.5 md:table-cell">Last Updated</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {items.map((item) => (
                <DocumentActivityRow key={item.id} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
