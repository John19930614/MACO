"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Wrench } from "lucide-react";
import { MODULE_META } from "@/lib/constants";
import type { EhsModule } from "@/lib/constants";

interface ModuleState {
  enabled: boolean;
  maintenanceNote: string;
  disabledAt: string | null;
  disabledBy: string;
}

// Map URL path segments to module keys
const PATH_TO_MODULE: Record<string, EhsModule> = {
  incidents:  "incidents",
  capa:       "capa",
  risk:       "risk",
  legal:      "legal",
  audits:     "audits",
  training:   "training",
  documents:  "documents",
  chemicals:  "chemical",
  waste:      "waste",
  equipment:  "equipment",
};

function pathToModuleKey(pathname: string): EhsModule | null {
  const segment = pathname.split("/").filter(Boolean)[0];
  return PATH_TO_MODULE[segment] ?? null;
}

export function ModuleGateClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [states, setStates] = useState<Record<string, ModuleState> | null>(null);

  const moduleKey = pathToModuleKey(pathname);

  useEffect(() => {
    // Only fetch if we're on a module page
    if (!moduleKey) return;
    fetch("/api/platform/modules")
      .then((r) => r.json())
      .then(setStates)
      .catch(() => {}); // fail open — never block users due to fetch failure
  }, [moduleKey, pathname]);

  // If not a module page, or states not loaded yet, render normally
  if (!moduleKey || !states) return <>{children}</>;

  const state = states[moduleKey];
  if (!state || state.enabled) return <>{children}</>;

  // Module is offline — show maintenance screen
  const meta = MODULE_META[moduleKey];

  return (
    <div className="flex h-full flex-col items-center justify-center bg-slate-50 px-6 dark:bg-slate-950">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-100 text-5xl dark:bg-amber-900/30">
          {meta.icon}
        </div>

        {/* Maintenance badge */}
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
          <Wrench className="h-3.5 w-3.5" />
          Temporarily Offline
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          {meta.label}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          This module is currently undergoing maintenance and is temporarily unavailable.
        </p>

        {/* Maintenance note from SA admin */}
        {state.maintenanceNote && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-left dark:border-amber-800/40 dark:bg-amber-900/20">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-500">
              <AlertTriangle className="h-3 w-3" />
              From your platform team
            </div>
            <p className="text-sm text-amber-800 dark:text-amber-300">{state.maintenanceNote}</p>
          </div>
        )}

        {/* Timestamp */}
        {state.disabledAt && (
          <p className="mt-4 text-xs text-slate-400 dark:text-slate-600">
            Offline since{" "}
            {new Date(state.disabledAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}

        <p className="mt-6 text-xs text-slate-400 dark:text-slate-600">
          Contact your EHS platform administrator for updates.
        </p>
      </div>
    </div>
  );
}
