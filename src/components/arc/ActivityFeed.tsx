"use client";

import { GitCommitHorizontal } from "lucide-react";
import { relativeTime } from "@/lib/utils";
import type { AuditEntry } from "@/lib/types";

const ACTION_TONE: Record<string, string> = {
  create:        "bg-emerald-100 text-emerald-700",
  update:        "bg-blue-100 text-blue-700",
  status_change: "bg-amber-100 text-amber-700",
  accept:        "bg-emerald-100 text-emerald-700",
  reject:        "bg-red-100 text-red-700",
  comment:       "bg-violet-100 text-violet-700",
};

function tone(action: string): string {
  const key = Object.keys(ACTION_TONE).find((k) => action.includes(k));
  return key ? ACTION_TONE[key] : "bg-slate-100 text-slate-500";
}

export function ActivityFeed({ entries }: { entries: AuditEntry[] }) {
  return (
    <div className="iq-scroll flex-1 overflow-y-auto p-6">
      <ol className="relative mx-auto max-w-3xl border-l border-slate-200 pl-6">
        {entries.map((e) => (
          <li key={e.id} className="mb-4">
            <span className="absolute -left-[7px] mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm">
              <GitCommitHorizontal className="h-3.5 w-3.5 text-slate-400" />
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{e.actor_id}</span>
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${tone(e.action)}`}>
                {e.action.replace(/[._]/g, " ")}
              </span>
              <span className="text-xs text-slate-500">on {e.entity.replace(/_/g, " ")}</span>
              <span className="ml-auto text-[11px] text-slate-400">{relativeTime(e.created_at)}</span>
            </div>
            {e.reason && <p className="mt-0.5 text-xs text-slate-500">{e.reason}</p>}
          </li>
        ))}
        {entries.length === 0 && (
          <li className="text-sm text-slate-400">No activity yet.</li>
        )}
      </ol>
    </div>
  );
}
