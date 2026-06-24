"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DarkPageHeader, DarkCard, DarkCardHeader, Pill } from "@/components/ui/primitives";
import { CreditCard, Building2, TrendingUp, DollarSign, Plus, X, Lock } from "lucide-react";
import { upsertSubscription } from "@/lib/actions/sa";
import type { Subscription, TenantSummary } from "@/lib/types";

// Static pricing config (not persisted — reference tiers only).
const PLANS = [
  { name: "starter",      label: "Starter",      price: 590,  users: "up to 10",  features: ["All EHS modules", "50 document storage", "Email support"] },
  { name: "professional", label: "Professional", price: 1100, users: "up to 20",  features: ["All EHS modules", "Unlimited storage", "AI Findings", "Priority support"] },
  { name: "enterprise",   label: "Enterprise",   price: 2850, users: "Unlimited", features: ["Everything in Pro", "SSO/SAML", "Custom onboarding", "Dedicated CSM", "SLA 99.9%"] },
] as const;

function planLabel(p: string) {
  return PLANS.find((x) => x.name === p)?.label ?? p;
}
function planColor(p: string) {
  if (p === "enterprise") return "bg-blue-900/50 text-blue-300";
  if (p === "professional") return "bg-purple-900/50 text-purple-300";
  return "bg-slate-800 text-slate-400";
}
function statusColor(s: string) {
  if (s === "active") return "bg-emerald-900/50 text-emerald-300";
  if (s === "trial") return "bg-amber-900/50 text-amber-300";
  if (s === "suspended") return "bg-orange-900/50 text-orange-300";
  return "bg-red-900/50 text-red-300";
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return d.slice(0, 10);
}

interface SubModalProps {
  sub: Subscription | null; // null = create
  tenants: TenantSummary[];
  onClose: () => void;
  onSaved: () => void;
}

function SubscriptionModal({ sub, tenants, onClose, onSaved }: SubModalProps) {
  const [tenantId, setTenantId] = useState(sub?.tenant_id ?? (tenants[0]?.id ?? ""));
  const [plan, setPlan]         = useState(sub?.plan ?? "starter");
  const [status, setStatus]     = useState(sub?.status ?? "active");
  const [mrr, setMrr]           = useState(String(sub?.mrr ?? PLANS.find((p) => p.name === (sub?.plan ?? "starter"))?.price ?? 0));
  const [seats, setSeats]       = useState(String(sub?.seats ?? 0));
  const [renewsAt, setRenewsAt] = useState(sub?.renews_at?.slice(0, 10) ?? "");
  const [notes, setNotes]       = useState(sub?.notes ?? "");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) { setError("Pick a tenant."); return; }
    setSaving(true);
    setError("");
    const fd = new FormData();
    if (sub) fd.set("id", sub.id);
    fd.set("tenant_id", tenantId);
    fd.set("plan", plan);
    fd.set("status", status);
    fd.set("mrr", mrr);
    fd.set("seats", seats);
    if (renewsAt) fd.set("renews_at", renewsAt);
    if (notes.trim()) fd.set("notes", notes.trim());
    const res = await upsertSubscription(undefined, fd);
    setSaving(false);
    if (!res.ok) { setError(res.error || "Save failed."); return; }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/90 border border-white/8 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div className="text-sm font-bold text-white">{sub ? "Edit Subscription" : "Add Subscription"}</div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/6"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Tenant <span className="text-red-400">*</span></label>
            <select required value={tenantId} onChange={(e) => setTenantId(e.target.value)} disabled={!!sub}
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none disabled:opacity-60">
              {tenants.length === 0 && <option value="">No tenants found</option>}
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Plan</label>
              <select value={plan} onChange={(e) => {
                  setPlan(e.target.value);
                  const p = PLANS.find((x) => x.name === e.target.value);
                  if (p) setMrr(String(p.price));
                }}
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none">
                {PLANS.map((p) => <option key={p.name} value={p.name}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none">
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="suspended">Suspended</option>
                <option value="churned">Churned</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">MRR ($/mo)</label>
              <input type="number" min="0" value={mrr} onChange={(e) => setMrr(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Seats</label>
              <input type="number" min="0" value={seats} onChange={(e) => setSeats(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Renews At</label>
            <input type="date" value={renewsAt} onChange={(e) => setRenewsAt(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
              placeholder="Internal ledger notes…" />
          </div>
          {error && <div className="rounded-lg bg-red-900/30 border border-red-800/50 px-3 py-2 text-xs text-red-300">{error}</div>}
          <div className="flex justify-end gap-2 pt-1 border-t border-white/5">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/4">Cancel</button>
            <button type="submit" disabled={saving || !tenantId}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : sub ? "Save Changes" : "Add Subscription"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface BillingClientProps {
  subscriptions: Subscription[];
  tenants: TenantSummary[];
}

export default function BillingClient({ subscriptions, tenants }: BillingClientProps) {
  const router = useRouter();
  const [showAdd, setShowAdd]   = useState(false);
  const [editing, setEditing]   = useState<Subscription | null>(null);

  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name ?? id;

  const totalMrr   = subscriptions.filter((s) => s.status === "active").reduce((sum, s) => sum + s.mrr, 0);
  const activeCount = subscriptions.filter((s) => s.status === "active").length;
  const trialCount  = subscriptions.filter((s) => s.status === "trial").length;
  const totalSeats  = subscriptions.reduce((sum, s) => sum + s.seats, 0);

  function refresh() { router.refresh(); }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {showAdd && <SubscriptionModal sub={null} tenants={tenants} onClose={() => setShowAdd(false)} onSaved={refresh} />}
      {editing && <SubscriptionModal sub={editing} tenants={tenants} onClose={() => setEditing(null)} onSaved={refresh} />}

      <DarkPageHeader
        title="Billing & Subscriptions"
        subtitle="Manual subscription ledger — MRR/ARR tracking. No payment integration."
        actions={
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Add Subscription
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-800/40 bg-amber-900/15 px-3 py-2 text-[11px] text-amber-300">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Manual ledger — figures are entered by hand. There is no Stripe/payment integration; no real charges are made.
        </div>

        <div className="mb-5 grid grid-cols-4 gap-4">
          {[
            { label: "Monthly Recurring Revenue", value: `$${totalMrr.toLocaleString()}`, sub: "Active subscriptions", color: "text-emerald-400", bg: "bg-emerald-900/20 border-emerald-800/50" },
            { label: "Active Clients", value: String(activeCount), sub: `${trialCount} on trial`, color: "text-blue-400", bg: "bg-blue-900/20 border-blue-800/50" },
            { label: "Total Seats", value: totalSeats.toString(), sub: "Across all plans", color: "text-purple-300", bg: "bg-purple-900/20 border-purple-800/50" },
            { label: "ARR (Projected)", value: `$${(totalMrr * 12).toLocaleString()}`, sub: "Based on current MRR", color: "text-amber-400", bg: "bg-amber-900/20 border-amber-800/50" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{s.label}</div>
              <div className={`mt-1 text-2xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="mt-0.5 text-[11px] text-slate-400">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 flex flex-col gap-5">
            <DarkCard>
              <DarkCardHeader title="Client Subscriptions" subtitle="Manual ledger entries" right={<Building2 className="h-4 w-4 text-slate-400" />} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/5 bg-slate-800/40">
                    <tr>
                      {["Company", "Plan", "Seats", "MRR", "Status", "Renews", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {subscriptions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                          No subscriptions in the ledger yet — add one with the button above.
                        </td>
                      </tr>
                    )}
                    {subscriptions.map((s) => (
                      <tr key={s.id} className="hover:bg-white/4">
                        <td className="px-4 py-2.5 text-xs font-medium text-white">{tenantName(s.tenant_id)}</td>
                        <td className="px-4 py-2.5"><Pill className={planColor(s.plan)}>{planLabel(s.plan)}</Pill></td>
                        <td className="px-4 py-2.5 text-xs text-slate-300">{s.seats}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 text-sm font-bold text-white">
                            <DollarSign className="h-3 w-3 text-slate-400" />
                            {s.mrr > 0 ? s.mrr.toLocaleString() : "—"}
                          </div>
                        </td>
                        <td className="px-4 py-2.5"><Pill className={statusColor(s.status)}>{s.status}</Pill></td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{fmtDate(s.renews_at)}</td>
                        <td className="px-4 py-2.5 flex items-center gap-3">
                          <button onClick={() => setEditing(s)} className="text-xs font-semibold text-blue-400 hover:underline">Edit</button>
                          <button
                            disabled
                            title="Manual ledger — no payment integration"
                            className="cursor-not-allowed text-xs font-semibold text-slate-600">
                            Charge
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DarkCard>

            <DarkCard>
              <DarkCardHeader title="Invoicing" subtitle="Not connected" right={<CreditCard className="h-4 w-4 text-slate-400" />} />
              <div className="px-4 py-8 text-center">
                <Lock className="mx-auto mb-2 h-6 w-6 text-slate-500" />
                <div className="text-sm font-semibold text-slate-300">No payment integration</div>
                <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
                  This screen is a manual subscription ledger for internal MRR tracking. Charges and
                  invoices are not issued from here — wire a payment provider (e.g. Stripe) to enable them.
                </p>
                <button disabled title="Manual ledger — no payment integration"
                  className="mt-3 cursor-not-allowed rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-slate-600">
                  Generate Invoice
                </button>
              </div>
            </DarkCard>
          </div>

          <div className="flex flex-col gap-5">
            <DarkCard>
              <DarkCardHeader title="MRR Breakdown" subtitle="Revenue by plan" right={<TrendingUp className="h-4 w-4 text-emerald-400" />} />
              <div className="p-4 space-y-3">
                {PLANS.map((p) => {
                  const clients = subscriptions.filter((s) => s.plan === p.name);
                  const planMrr = clients.reduce((sum, s) => sum + s.mrr, 0);
                  const pct     = totalMrr ? Math.round((planMrr / totalMrr) * 100) : 0;
                  return (
                    <div key={p.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-200">{p.label}</span>
                        <span className="text-xs font-bold text-white">${planMrr.toLocaleString()}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-800/60">
                        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">{clients.length} client{clients.length !== 1 ? "s" : ""} · {pct}% of MRR</div>
                    </div>
                  );
                })}
              </div>
            </DarkCard>

            <DarkCard>
              <DarkCardHeader title="Pricing Plans" subtitle="Reference tiers (config)" right={<CreditCard className="h-4 w-4 text-slate-400" />} />
              <div className="divide-y divide-white/5">
                {PLANS.map((p) => (
                  <div key={p.name} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <Pill className={planColor(p.name)}>{p.label}</Pill>
                      <span className="text-sm font-bold text-white">${p.price}<span className="text-[11px] font-normal text-slate-400">/mo</span></span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">{p.users} users</div>
                    <ul className="mt-1.5 space-y-0.5">
                      {p.features.map((f) => <li key={f} className="text-[11px] text-slate-400">· {f}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </DarkCard>
          </div>
        </div>
      </div>
    </div>
  );
}
