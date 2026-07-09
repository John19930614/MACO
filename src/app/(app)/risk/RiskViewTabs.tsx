"use client";

import { useState, type ReactNode } from "react";
import { List, Grid3x3 } from "lucide-react";
import type { RiskAssessment } from "@/lib/types";
import { RiskMatrix } from "@/components/risk/RiskMatrix";

interface RiskViewTabsProps {
  /** The existing List View content (analytics strip + risk dashboard), rendered on the server. */
  children: ReactNode;
  /** Same tenant-scoped assessments already loaded for List View — reused for the Matrix, no new fetch. */
  assessments: RiskAssessment[];
}

/**
 * Client-side toggle between the existing "List View" (default) and the new
 * "Matrix View". Switching is purely client-side — no reload, no new data
 * fetch: the Matrix reuses the assessments already loaded for the page.
 */
export function RiskViewTabs({ children, assessments }: RiskViewTabsProps) {
  const [activeView, setActiveView] = useState<"list" | "matrix">("list");

  const tab = (view: "list" | "matrix", label: string, icon: ReactNode) => (
    <button
      role="tab"
      aria-selected={activeView === view}
      onClick={() => setActiveView(view)}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        activeView === view
          ? "border-blue-300 bg-blue-600 text-white"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-800 dark:hover:text-slate-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Risk view" className="flex items-center gap-2">
        {tab("list", "List View", <List className="h-3.5 w-3.5" />)}
        {tab("matrix", "Matrix View", <Grid3x3 className="h-3.5 w-3.5" />)}
      </div>

      {/* Keep List View mounted (hidden) so its client state — the dashboard's
          own tab selection, scroll — survives a round-trip to the Matrix. */}
      <div className={activeView === "list" ? "" : "hidden"}>{children}</div>
      {activeView === "matrix" && <RiskMatrix riskAssessments={assessments} />}
    </div>
  );
}
