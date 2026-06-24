"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DarkPageHeader } from "@/components/ui/primitives";
import { updateTenantImplStage } from "@/lib/actions/sa";
import type { TenantSummary } from "@/lib/types";

// Pipeline stages, in order. `key` matches tenants.impl_status values.
const STAGES = [
  { key: "prospect",    label: "Prospect",    color: "bg-slate-700/60",   headerText: "text-slate-200" },
  { key: "data_import", label: "Data Import", color: "bg-amber-900/50",   headerText: "text-amber-300" },
  { key: "onboarding",  label: "Onboarding",  color: "bg-violet-900/50",  headerText: "text-violet-300" },
  { key: "live",        label: "Live",        color: "bg-emerald-900/50", headerText: "text-emerald-300" },
] as const;

const STAGE_KEYS = STAGES.map((s) => s.key);

// Static onboarding guidance shown per card. Not persisted — reference only.
const STAGE_CHECKLIST: Record<string, string[]> = {
  prospect:    ["Demo scheduled", "Scope & pricing agreed", "Contract signed"],
  data_import: ["Document request list sent", "Chemical inventory imported", "Legal register imported", "Training records imported"],
  onboarding:  ["Modules configured", "P-Engine trained on tenant data", "User accounts created", "Acceptance testing"],
  live:        ["All modules live", "Team trained", "P-Engine running", "QBR scheduled"],
};

function stageOf(t: TenantSummary): string {
  const s = (t.impl_status ?? "").toLowerCase();
  return STAGE_KEYS.includes(s as (typeof STAGE_KEYS)[number]) ? s : "prospect";
}

function fmtDate(d: string | null) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d.slice(0, 10);
  }
}

function Card({ tenant, onMove, busy }: { tenant: TenantSummary; onMove: (stage: string) => void; busy: boolean }) {
  const stage = stageOf(tenant);
  const checks = STAGE_CHECKLIST[stage] ?? [];
  const created = fmtDate(tenant.created_at);
  const completed = fmtDate(tenant.onboarding_completed_at);

  return (
    <div className="rounded-xl border border-white/8 bg-slate-900/60 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-white">{tenant.name}</div>
        {stage === "live" && (
          <span className="shrink-0 rounded-full bg-emerald-900/50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-300">LIVE</span>
        )}
      </div>
      <div className="mt-0.5 text-xs text-slate-400">
        {tenant.sector || "—"}{tenant.country ? ` · ${tenant.country}` : ""}
      </div>
      {stage === "live" && completed ? (
        <div className="mt-1 text-[11px] text-slate-400">📅 Live since {completed}</div>
      ) : created ? (
        <div className="mt-1 text-[11px] text-slate-400">🎯 Added {created}</div>
      ) : null}

      {checks.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Onboarding steps (guidance)</div>
          <ul className="space-y-0.5">
            {checks.map((c) => (
              <li key={c} className="flex items-start gap-1 text-[11px] text-slate-400">
                <span className="mt-0.5 shrink-0">○</span><span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-2.5 border-t border-white/5 pt-2">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Move to stage</label>
        <select
          value={stage}
          disabled={busy}
          onChange={(e) => onMove(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-2 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none disabled:opacity-50">
          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
    </div>
  );
}

export default function ImplClient({ tenants }: { tenants: TenantSummary[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError]   = useState("");

  async function move(tenantId: string, stage: string) {
    setBusyId(tenantId);
    setError("");
    const res = await updateTenantImplStage(tenantId, stage);
    setBusyId(null);
    if (!res.ok) { setError(res.error || "Failed to move tenant."); return; }
    router.refresh();
  }

  const byStage = (key: string) => tenants.filter((t) => stageOf(t) === key);

  const totalClients = tenants.length;
  const liveClients  = byStage("live").length;
  const inProgress   = tenants.filter((t) => { const s = stageOf(t); return s !== "prospect" && s !== "live"; }).length;
  const prospects    = byStage("prospect").length;

  return (
    <div className="flex flex-1 flex-col">
      <DarkPageHeader
        title="Implementation Tracker"
        subtitle="Client onboarding pipeline — live tenants grouped by stage"
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-800/50 bg-red-900/30 px-3 py-2 text-xs text-red-300">{error}</div>
        )}

        {/* Stats bar */}
        <div className="mb-5 grid grid-cols-3 gap-4 sm:grid-cols-5">
          {[
            { label: "Total Clients", value: totalClients, color: "text-white" },
            { label: "Live",          value: liveClients,  color: "text-emerald-400" },
            { label: "In Progress",   value: inProgress,   color: "text-blue-400" },
            { label: "Prospect",      value: prospects,    color: "text-slate-400" },
            { label: "Stages",        value: STAGES.length, color: "text-violet-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/8 bg-slate-900/60 px-3 py-2.5 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{s.label}</div>
              <div className={`mt-1 text-2xl font-black ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Kanban board */}
        <div className="flex gap-4 overflow-x-auto pb-2">
          {STAGES.map((col) => {
            const items = byStage(col.key);
            return (
              <div key={col.key} className="min-w-60 flex-1">
                <div className={`mb-3 flex items-center justify-between rounded-lg px-3 py-1.5 ${col.color}`}>
                  <span className={`text-xs font-bold uppercase tracking-wide ${col.headerText}`}>{col.label}</span>
                  <span className={`rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold ${col.headerText}`}>{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map((t) => (
                    <Card key={t.id} tenant={t} busy={busyId === t.id} onMove={(stage) => move(t.id, stage)} />
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-xl border border-dashed border-white/8 p-4 text-center text-xs text-slate-400">
                      No clients in this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
