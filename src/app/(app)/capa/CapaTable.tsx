"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useDemoUser } from "@/lib/context/demo-user";
import type { CapaAction, Profile } from "@/lib/types";

const SOURCE_ROUTE: Record<string, (id: string | null) => string | null> = {
  audit_finding:     (id) => id ? `/audits` : null,
  incident:          (id) => id ? `/incidents/${id}` : null,
  legal_requirement: (id) => id ? `/legal/${id}` : null,
  risk_assessment:   (id) => id ? `/risk/${id}` : null,
  ai_finding:        ()   => `/risk`,
  manual:            ()   => null,
};
import { Pill } from "@/components/ui/primitives";
import { CapaStatusBadge, SeverityBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClipboardCheck } from "lucide-react";
import type { Severity } from "@/lib/constants";

const SOURCE_LABEL: Record<string, string> = {
  audit_finding:     "Audit",
  incident:          "Incident",
  legal_requirement: "Legal",
  risk_assessment:   "Risk",
  ai_finding:        "AI Finding",
  manual:            "Manual",
};

const TABS = [
  { key: "all",                  label: "All" },
  { key: "my_actions",           label: "My Actions" },
  { key: "open",                 label: "Open" },
  { key: "in_progress",         label: "In Progress" },
  { key: "overdue",             label: "Overdue" },
  { key: "pending_verification", label: "Pending Verification" },
  { key: "closed",              label: "Closed" },
] as const;

type TabKey = typeof TABS[number]["key"];

function fmt(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(s: string | null, status: string): boolean {
  if (!s || status === "closed") return false;
  return new Date(s) < new Date();
}

export function CapaTable({ capas, profiles }: { capas: CapaAction[]; profiles: Profile[] }) {
  const { user } = useDemoUser();
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: capas.length,
      my_actions: capas.filter((ca) => ca.owner_id === user.id).length,
    };
    for (const tab of TABS) {
      if (tab.key !== "all" && tab.key !== "my_actions")
        c[tab.key] = capas.filter((ca) => ca.status === tab.key).length;
    }
    return c;
  }, [capas, user.id]);

  const filtered = useMemo(() => {
    if (activeTab === "all") return capas;
    if (activeTab === "my_actions") return capas.filter((c) => c.owner_id === user.id);
    return capas.filter((c) => c.status === activeTab);
  }, [capas, activeTab, user.id]);

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
      {/* Filter tabs */}
      <div className="flex items-center gap-0 border-b border-slate-100 dark:border-slate-700 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count    = counts[tab.key] ?? 0;
          const isDanger = tab.key === "overdue" && count > 0;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-700 dark:text-blue-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  isActive
                    ? isDanger ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : isDanger ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <th className="px-4 py-2.5 text-left">Action</th>
              <th className="px-4 py-2.5 text-left">Kind</th>
              <th className="px-4 py-2.5 text-left">Severity</th>
              <th className="px-4 py-2.5 text-left">Source</th>
              <th className="px-4 py-2.5 text-left">Owner</th>
              <th className="px-4 py-2.5 text-left">Due Date</th>
              <th className="px-4 py-2.5 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={<ClipboardCheck className="h-7 w-7" />}
                    title={`No ${activeTab === "all" ? "CAPA" : activeTab.replace("_", " ")} actions`}
                    description="Create a corrective or preventive action to track and close findings."
                    action={{ label: "Create CAPA", href: "/capa" }}
                  />
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const overdue = isOverdue(c.due_date, c.status);
                return (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-4 py-3 max-w-64">
                      <Link href={`/capa/${c.id}`} className="font-medium text-blue-700 dark:text-blue-400 hover:underline">
                        {c.title}
                      </Link>
                      {c.root_cause && (
                        <div className="mt-0.5 text-xs text-slate-400 line-clamp-1">
                          Root cause: {c.root_cause}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Pill className={c.kind === "corrective" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}>
                        {c.kind === "corrective" ? "Corrective" : "Preventive"}
                      </Pill>
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={c.severity as Severity} />
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const route = SOURCE_ROUTE[c.source_type]?.(c.source_id);
                        const label = SOURCE_LABEL[c.source_type] ?? c.source_type;
                        return route ? (
                          <Link href={route}>
                            <Pill className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer">
                              {label} →
                            </Pill>
                          </Link>
                        ) : (
                          <Pill className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs">{label}</Pill>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                      {c.owner_id ? (profileMap[c.owner_id] ?? "—") : <span className="text-slate-300 dark:text-slate-500">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums">
                      <span className={overdue ? "font-semibold text-red-600" : "text-slate-600 dark:text-slate-300"}>
                        {fmt(c.due_date)}
                        {overdue && " ⚠"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <CapaStatusBadge status={c.status} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-50 dark:border-slate-700 px-4 py-2 text-[11px] text-slate-400">
        Showing {filtered.length} of {capas.length} CAPA actions
      </div>
    </div>
  );
}
