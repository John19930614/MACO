"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/dev-command", label: "Overview", exact: true },
  { href: "/admin/dev-command/tasks", label: "Tasks" },
  { href: "/admin/dev-command/agents", label: "AI Team" },
  { href: "/admin/dev-command/approvals", label: "Approvals" },
  { href: "/admin/dev-command/audit-log", label: "Activity Log" },
  { href: "/admin/dev-command/settings", label: "Settings" },
];

/** Horizontal tab nav for the Command Center, scrollable on narrow screens. */
export function DevCommandNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-6">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition",
              active
                ? "border-blue-600 text-blue-700 dark:text-blue-300"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
