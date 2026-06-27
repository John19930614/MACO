import type { ReactNode } from "react";
import Link from "next/link";
import { Inbox, Loader2, AlertTriangle } from "lucide-react";

/**
 * Empty / loading / error state cards for the Dev Command Center.
 * Each is a self-contained card so any panel can drop one in when it has no
 * data, is loading, or hit a problem. Plain-English copy throughout.
 */

export function EmptyStateCard({
  title = "Nothing here yet",
  description,
  icon,
  action,
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-800/50">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-slate-400 dark:text-slate-500">{description}</p>
      )}
      {action && (
        <Link
          href={action.href}
          className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function LoadingStateCard({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-800/50">
      <Loader2 className="mb-3 h-6 w-6 animate-spin text-blue-500" />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

export function ErrorStateCard({
  title = "Something went wrong",
  description = "We couldn't load this just now. Try again in a moment.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center dark:border-red-900 dark:bg-red-950/40">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-500 dark:bg-red-900/50 dark:text-red-300">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-red-700 dark:text-red-300">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-red-500 dark:text-red-400">{description}</p>
    </div>
  );
}
