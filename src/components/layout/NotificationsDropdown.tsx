"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, X, AlertTriangle, ShieldAlert, TrendingUp, CheckCheck } from "lucide-react";

export interface NotifItem {
  id: string;
  type: "capa" | "incident" | "risk";
  title: string;
  href: string;
  tag: string;
  severity: "critical" | "high" | "medium";
  date: string;
}

const TYPE_ICON = {
  capa:     ShieldAlert,
  incident: AlertTriangle,
  risk:     TrendingUp,
};

const SEV_COLOR: Record<NotifItem["severity"], string> = {
  critical: "text-red-600 bg-red-50",
  high:     "text-orange-600 bg-orange-50",
  medium:   "text-amber-600 bg-amber-50",
};

const TAG_COLOR: Record<string, string> = {
  "CAPA Overdue": "bg-red-100 text-red-700",
  "Due Soon":     "bg-amber-100 text-amber-700",
  "High Severity":"bg-orange-100 text-orange-700",
  "Critical":     "bg-red-100 text-red-700",
  "High Risk":    "bg-purple-100 text-purple-700",
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationsDropdown({
  count,
  items,
}: {
  count: number;
  items: NotifItem[];
}) {
  const [open, setOpen]           = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const panelRef                  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const visible     = items.filter((i) => !dismissed.has(i.id));
  const activeCount = Math.max(0, count - dismissed.size);

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative flex h-[34px] w-[34px] items-center justify-center rounded-lg border transition ${
          open
            ? "border-blue-300 bg-blue-50 text-blue-600"
            : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        }`}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[9px] font-bold text-white">
            {activeCount > 9 ? "9+" : activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[42px] z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-bold text-slate-800">Notifications</span>
            {visible.length > 0 && (
              <button
                onClick={() => setDismissed(new Set(items.map((i) => i.id)))}
                className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-600"
              >
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          {/* Item list */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-50">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                <CheckCheck className="h-6 w-6 text-emerald-400" />
                <span className="text-sm">All caught up!</span>
              </div>
            ) : (
              visible.map((item) => {
                const Icon    = TYPE_ICON[item.type];
                const sevCls  = SEV_COLOR[item.severity];
                const tagCls  = TAG_COLOR[item.tag] ?? "bg-slate-100 text-slate-600";
                return (
                  <div key={item.id} className="group flex items-start gap-3 px-4 py-3 hover:bg-slate-50/60">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${sevCls}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="min-w-0 flex-1"
                    >
                      <div className="text-[12px] font-medium leading-snug text-slate-800 line-clamp-2">
                        {item.title}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${tagCls}`}>
                          {item.tag}
                        </span>
                        <span className="text-[10px] text-slate-400">{fmtDate(item.date)}</span>
                      </div>
                    </Link>
                    <button
                      onClick={() => setDismissed((d) => new Set([...d, item.id]))}
                      className="mt-0.5 shrink-0 rounded p-0.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-500"
                      aria-label="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {visible.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2.5">
              <Link
                href="/workspace"
                onClick={() => setOpen(false)}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
              >
                View all in My Workspace →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
