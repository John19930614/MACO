"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Building2, Users, LayoutGrid, Activity,
  Pencil, MapPin, Calendar, Shield, Globe, X,
} from "lucide-react";
import { DarkCard, DarkCardHeader, DarkStat, Pill } from "@/components/ui/primitives";
import { EHS_MODULES, MODULE_META } from "@/lib/constants";
import { updateTenantImplStage, upsertSubscription } from "@/lib/actions/sa";
import type { TenantDetail } from "@/lib/types";

// ── Style / label helpers ──────────────────────────────────────────────────────

const IMPL_STEPS = ["prospect", "data_import", "onboarding", "live"] as const;
const IMPL_LABELS: Record<string, string> = {
  prospect: "Prospect", data_import: "Data Import", onboarding: "Onboarding", live: "Live",
};

const PLAN_STYLE: Record<string, string> = {
  enterprise:   "bg-blue-900/50 text-blue-300",
  professional: "bg-purple-900/50 text-purple-300",
  starter:      "bg-slate-800 text-slate-400",
};

const ROLE_STYLE: Record<string, string> = {
  admin:   "bg-blue-900/50 text-blue-300",
  manager: "bg-purple-900/50 text-purple-300",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysSince(d: string | null | undefined) {
  if (!d) return 0;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function titleCase(s: string) {
  return s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Module access is derived from the subscription plan — there is no per-tenant
// module backend yet, so this is shown read-only and honestly labelled.
function modulesForPlan(plan: string | null | undefined): Set<string> {
  const p = (plan ?? "starter").toLowerCase();
  const starter = ["incidents", "training", "documents", "risk"];
  const professional = [...starter, "capa", "audits", "chemical"];
  const enabled =
    p === "enterprise" ? (EHS_MODULES as readonly string[]) :
    p === "professional" ? professional :
    starter;
  return new Set(enabled);
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function TabButton({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
        active ? "border-blue-400 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-blue-900/60 text-blue-300" : "bg-slate-800 text-slate-500"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Subscription edit modal ─────────────────────────────────────────────────────

function SubscriptionModal({
  detail,
  onClose,
  onSaved,
}: {
  detail: TenantDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const sub = detail.subscription;
  const [plan, setPlan]     = useState(sub?.plan ?? "starter");
  const [status, setStatus] = useState(sub?.status ?? "active");
  const [mrr, setMrr]       = useState(String(sub?.mrr ?? 0));
  const [seats, setSeats]   = useState(String(sub?.seats ?? 0));
  const [renews, setRenews] = useState(sub?.renews_at ? sub.renews_at.slice(0, 10) : "");
  const [notes, setNotes]   = useState(sub?.notes ?? "");
  const [error, setError]   = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const fd = new FormData();
    if (sub?.id) fd.set("id", sub.id);
    fd.set("tenant_id", detail.tenant.id);
    fd.set("plan", plan);
    fd.set("status", status);
    fd.set("mrr", mrr);
    fd.set("seats", seats);
    if (renews) fd.set("renews_at", renews);
    fd.set("notes", notes);
    startTransition(async () => {
      const res = await upsertSubscription(undefined, fd);
      if (res?.ok) {
        onSaved();
        onClose();
      } else {
        setError(res?.error ?? "Failed to save subscription.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/8 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div>
            <div className="text-sm font-bold text-white">{sub ? "Edit Subscription" : "Add Subscription"}</div>
            <div className="mt-0.5 text-xs text-slate-400">{detail.tenant.name}</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/6"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Plan</label>
              <select value={plan} onChange={(e) => setPlan(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none">
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none">
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="churned">Churned</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">MRR ($/mo)</label>
              <input type="number" min="0" value={mrr} onChange={(e) => setMrr(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Seats</label>
              <input type="number" min="0" value={seats} onChange={(e) => setSeats(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Renews At</label>
            <input type="date" value={renews} onChange={(e) => setRenews(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none" />
          </div>
          {error && <div className="rounded-lg border border-red-800/50 bg-red-900/30 px-3 py-2 text-xs text-red-300">{error}</div>}
          <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/4">Cancel</button>
            <button type="submit" disabled={pending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function CompanyDetailClient({ detail }: { detail: TenantDetail }) {
  const router = useRouter();
  const { tenant, profiles, subscription, counts } = detail;

  const [tab, setTab]           = useState<"overview" | "users" | "modules" | "activity">("overview");
  const [editingSub, setEditingSub] = useState(false);
  const [stageError, setStageError] = useState("");
  const [pending, startTransition]  = useTransition();

  const implStatus = tenant.impl_status ?? "prospect";
  const implIdx    = IMPL_STEPS.indexOf(implStatus as typeof IMPL_STEPS[number]);
  const planKey    = (subscription?.plan ?? "starter").toLowerCase();
  const enabledModules = modulesForPlan(subscription?.plan);
  const enabledCount   = enabledModules.size;
  const activeUsers    = profiles.filter((p) => p.active).length;

  function setStage(stage: string) {
    setStageError("");
    startTransition(async () => {
      const res = await updateTenantImplStage(tenant.id, stage);
      if (res?.ok) router.refresh();
      else setStageError(res?.error ?? "Failed to update stage.");
    });
  }

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      {editingSub && (
        <SubscriptionModal detail={detail} onClose={() => setEditingSub(false)} onSaved={() => router.refresh()} />
      )}

      {/* Header */}
      <div className="shrink-0 border-b border-white/8 bg-slate-950/80 px-6 py-4">
        <Link href="/sa/companies" className="mb-3 flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-200">
          <ArrowLeft className="h-3.5 w-3.5" /> Companies &amp; Tenants
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-800">
              <Building2 className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-white">{tenant.name}</h1>
                {subscription && (
                  <Pill className={PLAN_STYLE[planKey] ?? "bg-slate-800 text-slate-400"}>{titleCase(subscription.plan)}</Pill>
                )}
                <Pill className="bg-slate-800 text-slate-300">{IMPL_LABELS[implStatus] ?? titleCase(implStatus)}</Pill>
              </div>
              <p className="mt-0.5 text-sm text-slate-400">
                {[tenant.sector, tenant.country].filter(Boolean).join(" · ") || "Sector / country not set"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setEditingSub(true)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/6"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit Subscription
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mt-4 flex border-b border-white/8">
          <TabButton label="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
          <TabButton label="Users"    active={tab === "users"}    onClick={() => setTab("users")}    count={profiles.length} />
          <TabButton label="Modules"  active={tab === "modules"}  onClick={() => setTab("modules")}  count={enabledCount} />
          <TabButton label="Activity" active={tab === "activity"} onClick={() => setTab("activity")} />
        </div>
      </div>

      {/* Content */}
      <div className="iq-scroll flex-1 overflow-y-auto p-6">

        {/* ── Overview ── */}
        {tab === "overview" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <DarkStat label="Users"           value={profiles.length}                                           strip="#10b981" accent="#10b981" icon={<Users className="h-5 w-5" />} />
              <DarkStat label="Enabled Modules" value={enabledCount}                                              strip="#3b82f6" accent="#3b82f6" icon={<LayoutGrid className="h-5 w-5" />} />
              <DarkStat label="Monthly MRR"     value={subscription?.mrr ? `$${subscription.mrr.toLocaleString()}` : "—"} strip="#8b5cf6" accent="#8b5cf6" icon={<Activity className="h-5 w-5" />} />
              <DarkStat label="Days on Platform" value={daysSince(tenant.created_at)}                             strip="#f59e0b" accent="#f59e0b" icon={<Calendar className="h-5 w-5" />} />
            </div>

            {/* Record counts */}
            <DarkCard>
              <DarkCardHeader title="Data Footprint" subtitle="Live record counts for this tenant" />
              <div className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-5">
                {[
                  { label: "Chemicals",  value: counts.chemicals ?? 0 },
                  { label: "Incidents",  value: counts.incidents ?? 0 },
                  { label: "CAPA",       value: counts.capa_records ?? 0 },
                  { label: "Audits",     value: counts.audits ?? 0 },
                  { label: "Training",   value: counts.training_records ?? 0 },
                ].map((c) => (
                  <div key={c.label} className="bg-slate-900/60 px-4 py-4 text-center">
                    <div className="text-2xl font-black text-white">{c.value}</div>
                    <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</div>
                  </div>
                ))}
              </div>
            </DarkCard>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Implementation stage */}
              <DarkCard>
                <DarkCardHeader title="Implementation Status" subtitle="Onboarding stage — click a stage to update" />
                <div className="px-5 pb-5">
                  <div className="mb-4 flex items-center gap-2">
                    {IMPL_STEPS.map((step, i) => {
                      const done    = i <= implIdx;
                      const current = i === implIdx;
                      return (
                        <button
                          key={step}
                          type="button"
                          disabled={pending}
                          onClick={() => setStage(step)}
                          title={`Set stage to ${IMPL_LABELS[step]}`}
                          className="flex flex-1 flex-col items-center gap-1 disabled:opacity-60"
                        >
                          <div className={`h-2 w-full rounded-full transition-colors ${done ? "bg-blue-500" : "bg-slate-800 hover:bg-slate-700"}`} />
                          <span className={`text-[10px] font-medium ${current ? "text-blue-300" : done ? "text-slate-300" : "text-slate-600"}`}>
                            {IMPL_LABELS[step]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {stageError && (
                    <div className="rounded-lg border border-red-800/50 bg-red-900/30 px-3 py-2 text-xs text-red-300">{stageError}</div>
                  )}
                </div>
              </DarkCard>

              {/* Account info */}
              <DarkCard>
                <DarkCardHeader
                  title="Account Info"
                  subtitle="Subscription and platform details"
                  right={
                    <button
                      onClick={() => setEditingSub(true)}
                      className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-white/6"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  }
                />
                <div className="divide-y divide-white/5 px-5 pb-2">
                  {[
                    { label: "Plan",            value: subscription ? titleCase(subscription.plan) : "No subscription", icon: <Shield className="h-3.5 w-3.5" /> },
                    { label: "Status",          value: subscription ? titleCase(subscription.status) : "—",            icon: <Activity className="h-3.5 w-3.5" /> },
                    { label: "MRR",             value: subscription?.mrr ? `$${subscription.mrr.toLocaleString()}/mo` : "—", icon: <Activity className="h-3.5 w-3.5" /> },
                    { label: "Seats",           value: subscription?.seats ? String(subscription.seats) : "—",         icon: <Users className="h-3.5 w-3.5" /> },
                    { label: "Renews",          value: fmtDate(subscription?.renews_at),                              icon: <Calendar className="h-3.5 w-3.5" /> },
                    { label: "Sector",          value: tenant.sector || "—",                                          icon: <Globe className="h-3.5 w-3.5" /> },
                    { label: "Country",         value: tenant.country || "—",                                         icon: <MapPin className="h-3.5 w-3.5" /> },
                    { label: "Onboarded",       value: fmtDate(tenant.created_at),                                    icon: <Calendar className="h-3.5 w-3.5" /> },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-3 py-2.5">
                      <span className="text-slate-500">{row.icon}</span>
                      <span className="w-32 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{row.label}</span>
                      <span className="truncate text-xs text-slate-300">{row.value || "—"}</span>
                    </div>
                  ))}
                  {subscription?.notes && (
                    <div className="py-2.5 text-xs text-slate-400">{subscription.notes}</div>
                  )}
                </div>
              </DarkCard>
            </div>
          </div>
        )}

        {/* ── Users ── */}
        {tab === "users" && (
          <div className="space-y-4">
            <DarkCard>
              <DarkCardHeader
                title="Users"
                subtitle={`${profiles.length} profile${profiles.length !== 1 ? "s" : ""} · ${activeUsers} active`}
              />
              {profiles.length === 0 ? (
                <div className="px-5 pb-8 pt-4 text-center text-sm text-slate-500">
                  No users provisioned yet — users are added during onboarding.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-white/5 bg-slate-800/40">
                      <tr>
                        {["Name", "Role", "Job Title", "Department", "Status"].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {profiles.map((u) => (
                        <tr key={u.id} className="hover:bg-white/4">
                          <td className="px-4 py-3 font-medium text-white">{u.display_name}</td>
                          <td className="px-4 py-3">
                            <Pill className={ROLE_STYLE[u.role] ?? "bg-slate-800 text-slate-400"}>{titleCase(u.role)}</Pill>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-300">{u.job_title || "—"}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{u.department || "—"}</td>
                          <td className="px-4 py-3">
                            <Pill className={u.active ? "bg-emerald-900/50 text-emerald-300" : "bg-slate-800 text-slate-400"}>
                              {u.active ? "active" : "inactive"}
                            </Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DarkCard>
          </div>
        )}

        {/* ── Modules ── */}
        {tab === "modules" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/8 bg-slate-900/40 px-4 py-3 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">Module Access — {tenant.name}</span>
              {" · "}
              Access is derived from the {subscription ? titleCase(subscription.plan) : "current"} plan.
              Per-tenant module overrides aren&apos;t available yet; platform-wide maintenance toggles live in the Module Control Panel.
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {EHS_MODULES.map((mod) => {
                const meta    = MODULE_META[mod];
                const enabled = enabledModules.has(mod);
                return (
                  <div key={mod} className={`rounded-xl border transition ${enabled ? "border-white/8 bg-slate-900/60" : "border-slate-800/60 bg-slate-900/30"}`}>
                    <div className="flex items-start gap-3 p-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${enabled ? "bg-slate-800" : "bg-slate-900"}`}>
                        {meta.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`truncate text-sm font-semibold ${enabled ? "text-white" : "text-slate-500"}`}>{meta.label}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${enabled ? "bg-emerald-900/50 text-emerald-400" : "bg-slate-800 text-slate-500"}`}>
                            {enabled ? "On" : "Off"}
                          </span>
                        </div>
                        <p className={`mt-0.5 text-xs leading-snug ${enabled ? "text-slate-500" : "text-slate-600"}`}>{meta.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-white/8 bg-slate-900/40 p-4 text-xs text-slate-500">
              <div className="mb-1 font-semibold text-slate-400">{enabledCount} of {EHS_MODULES.length} modules included in plan</div>
              Change the plan via Edit Subscription to adjust module access.
            </div>
          </div>
        )}

        {/* ── Activity ── */}
        {tab === "activity" && (
          <DarkCard>
            <DarkCardHeader title="Recent Activity" subtitle="Tenant activity feed" />
            <div className="px-5 pb-10 pt-6 text-center">
              <Activity className="mx-auto mb-3 h-8 w-8 text-slate-600" />
              <div className="text-sm text-slate-400">No activity log available yet.</div>
              <div className="mt-1 text-xs text-slate-500">A per-tenant audit/activity feed hasn&apos;t been wired into the platform console.</div>
            </div>
          </DarkCard>
        )}

      </div>
    </div>
  );
}
