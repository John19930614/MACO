"use client";

import type { ReactNode } from "react";
import Link from "next/link";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-xs text-slate-400 dark:text-slate-500">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          {action.href ? (
            <Link
              href={action.href}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
