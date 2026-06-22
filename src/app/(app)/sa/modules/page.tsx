"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Power, AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronUp,
  Shield, RefreshCw,
} from "lucide-react";
import { EHS_MODULES, MODULE_META } from "@/lib/constants";
import type { EhsModule } from "@/lib/constants";
import { useDemoUser } from "@/lib/context/demo-user";

interface ModuleState {
  enabled: boolean;
  maintenanceNote: string;
  disabledAt: string | null;
  disabledBy: string;
}

const MODULE_PATH: Record<EhsModule, string> = {
  incidents:  "/incidents",
  capa:       "/capa",
  risk:       "/risk",
  legal:      "/legal",
  audits:     "/audits",
  training:   "/training",
  documents:  "/documents",
  chemical:   "/chemicals",
  waste:      "/waste",
  equipment:  "/equipment",
};

function fmtTs(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function ModuleControlPage() {
  const { user } = useDemoUser();
  const [states, setStates] = useState<Record<string, ModuleState> | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    const res = await fetch("/api/platform/modules");
    const data: Record<string, ModuleState> = await res.json();
    setStates(data);
    const n: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) n[k] = v.maintenanceNote;
    setNotes(n);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(mod: EhsModule) {
    if (!states) return;
    setSaving(mod);
    const current = states[mod];
    const next = !current.enabled;
    const res = await fetch("/api/platform/modules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module: mod,
        enabled: next,
        maintenanceNote: notes[mod] ?? "",
        disabledBy: user.display_name,
      }),
    });
    const updated: ModuleState = await res.json();
    setStates((prev) => ({ ...prev!, [mod]: updated }));
    setSaving(null);
    // Auto-expand note field when disabling
    if (!next) setExpanded(mod);
  }

  async function saveNote(mod: EhsModule) {
    if (!states) return;
    setSaving(mod);
    const res = await fetch("/api/platform/modules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module: mod,
        enabled: states[mod].enabled,
        maintenanceNote: notes[mod] ?? "",
        disabledBy: user.display_name,
      }),
    });
    const updated: ModuleState = await res.json();
    setStates((prev) => ({ ...prev!, [mod]: updated }));
    setSaving(null);
  }

  const disabledCount = states
    ? Object.values(states).filter((s) => !s.enabled).length
    : 0;

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="shrink-0 border-b border-white/8 bg-slate-950/80 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-400" />
              <h1 className="text-lg font-bold text-white">Module Control Panel</h1>
            </div>
            <p className="mt-0.5 text-sm text-slate-400">
              Disable EHS modules for maintenance — affected tenants see a maintenance screen until you re-enable.
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-white/20 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {/* Status bar */}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-slate-400">{10 - disabledCount} online</span>
          </div>
          {disabledCount > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-semibold text-amber-400">{disabledCount} in maintenance</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-slate-600">
            <Clock className="h-3 w-3" />
            Refreshed {fmtTs(lastRefresh.toISOString())}
          </div>
        </div>
      </div>

      {/* Module grid */}
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {!states ? (
          <div className="flex items-center justify-center py-24 text-slate-500">
            Loading module states…
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {EHS_MODULES.map((mod) => {
              const meta = MODULE_META[mod];
              const state = states[mod] ?? { enabled: true, maintenanceNote: "", disabledAt: null, disabledBy: "" };
              const isExpanded = expanded === mod;
              const isSaving = saving === mod;
              const isOnline = state.enabled;

              return (
                <div
                  key={mod}
                  className={`rounded-xl border transition ${
                    isOnline
                      ? "border-white/8 bg-slate-900/60"
                      : "border-amber-500/30 bg-amber-950/20"
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-start gap-3 p-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${
                        isOnline ? "bg-slate-800" : "bg-amber-900/40"
                      }`}
                    >
                      {meta.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">{meta.label}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            isOnline
                              ? "bg-emerald-900/50 text-emerald-400"
                              : "bg-amber-900/50 text-amber-400"
                          }`}
                        >
                          {isOnline ? "Online" : "Offline"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 leading-snug">{meta.description}</p>
                      {!isOnline && state.disabledAt && (
                        <p className="mt-1 text-[10px] text-amber-500">
                          Offline since {fmtTs(state.disabledAt)}
                          {state.disabledBy ? ` · by ${state.disabledBy}` : ""}
                        </p>
                      )}
                    </div>

                    {/* Toggle switch */}
                    <button
                      type="button"
                      onClick={() => toggle(mod)}
                      disabled={isSaving}
                      title={isOnline ? "Disable module" : "Re-enable module"}
                      className={`relative shrink-0 h-6 w-11 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 ${
                        isOnline ? "bg-emerald-500" : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          isOnline ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Maintenance note (shown when disabled or expanded) */}
                  {(!isOnline || isExpanded) && (
                    <div className="border-t border-white/8 px-4 pb-4 pt-3">
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Maintenance note <span className="text-slate-600">(shown to users)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={notes[mod] ?? ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [mod]: e.target.value }))}
                        placeholder="e.g. Scheduled maintenance — back online by 3 PM today."
                        className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:border-blue-500/60 focus:outline-none resize-none"
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <a
                          href={MODULE_PATH[mod]}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-blue-400 hover:underline"
                        >
                          View live page →
                        </a>
                        <button
                          type="button"
                          onClick={() => saveNote(mod)}
                          disabled={isSaving}
                          className="rounded-lg bg-blue-600/80 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
                        >
                          {isSaving ? "Saving…" : "Save note"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expand/collapse for online modules */}
                  {isOnline && (
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : mod)}
                      className="flex w-full items-center justify-center gap-1 border-t border-white/8 py-1.5 text-[10px] text-slate-600 transition hover:text-slate-400"
                    >
                      {isExpanded ? (
                        <><ChevronUp className="h-3 w-3" /> Hide note</>
                      ) : (
                        <><ChevronDown className="h-3 w-3" /> Set maintenance note</>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 rounded-xl border border-white/8 bg-slate-900/40 p-4 text-xs text-slate-500">
          <div className="mb-2 flex items-center gap-1.5 font-semibold uppercase tracking-wide text-slate-400">
            <Power className="h-3.5 w-3.5" /> How module control works
          </div>
          <ul className="space-y-1">
            <li>• Toggling a module <strong className="text-slate-300">offline</strong> immediately shows a maintenance screen to all users who navigate to that module — no restart needed.</li>
            <li>• The <strong className="text-slate-300">maintenance note</strong> you set appears on that screen so users know what to expect.</li>
            <li>• Toggling it back <strong className="text-slate-300">online</strong> restores the module instantly.</li>
            <li>• Module state is stored server-side and survives across browsers and sessions.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
