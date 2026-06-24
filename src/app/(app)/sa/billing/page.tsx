"use client";

import { useState } from "react";
import { DarkPageHeader, DarkCard, DarkCardHeader, Pill } from "@/components/ui/primitives";
import { CreditCard, Building2, TrendingUp, DollarSign, Download, Plus, X } from "lucide-react";
import { MOCK_MODE } from "@/lib/env";

interface Subscription {
  company: string; plan: string; users: number; mrr: number;
  status: string; next_billing: string; start: string;
}

const MOCK_SUBS: Subscription[] = [
  { company: "BioStar Research Inc.",  plan: "Professional", users: 14, mrr: 1400, status: "active", next_billing: "2026-07-01", start: "2026-03-01" },
  { company: "Nexgen Pharma Ltd.",     plan: "Enterprise",   users: 22, mrr: 2850, status: "active", next_billing: "2026-07-01", start: "2025-11-15" },
  { company: "LabCore Diagnostics",    plan: "Starter",      users: 8,  mrr: 590,  status: "active", next_billing: "2026-07-01", start: "2026-05-01" },
  { company: "MedTech Solutions",      plan: "Professional", users: 11, mrr: 1100, status: "trial",  next_billing: "2026-07-10", start: "2026-06-10" },
];

const MOCK_TXN = [
  { company: "Nexgen Pharma Ltd.",    amount: 2850, date: "2026-06-01", type: "Monthly", status: "paid" },
  { company: "BioStar Research Inc.", amount: 1400, date: "2026-06-01", type: "Monthly", status: "paid" },
  { company: "LabCore Diagnostics",   amount: 590,  date: "2026-06-01", type: "Monthly", status: "paid" },
  { company: "MedTech Solutions",     amount: 0,    date: "2026-06-10", type: "Trial start", status: "free" },
  { company: "Nexgen Pharma Ltd.",    amount: 2850, date: "2026-05-01", type: "Monthly", status: "paid" },
  { company: "BioStar Research Inc.", amount: 1400, date: "2026-05-01", type: "Monthly", status: "paid" },
];

const PLANS = [
  { name: "Starter",      price: 590,  users: "up to 10",  features: ["All EHS modules", "50 document storage", "Email support"] },
  { name: "Professional", price: 1100, users: "up to 20",  features: ["All EHS modules", "Unlimited storage", "AI Findings", "Priority support"] },
  { name: "Enterprise",   price: 2850, users: "Unlimited", features: ["Everything in Pro", "SSO/SAML", "Custom onboarding", "Dedicated CSM", "SLA 99.9%"] },
];

const PLAN_MRR: Record<string, number> = { Starter: 590, Professional: 1100, Enterprise: 2850 };

function planColor(p: string) {
  if (p === "Enterprise") return "bg-blue-900/50 text-blue-300";
  if (p === "Professional") return "bg-purple-900/50 text-purple-300";
  return "bg-slate-800 text-slate-400";
}
function statusColor(s: string) {
  if (s === "active" || s === "paid") return "bg-emerald-900/50 text-emerald-300";
  if (s === "trial") return "bg-amber-900/50 text-amber-300";
  if (s === "free") return "bg-slate-800 text-slate-400";
  return "bg-red-900/50 text-red-300";
}

function AddClientModal({ onClose, onAdd }: { onClose: () => void; onAdd: (s: Subscription) => void }) {
  const [company, setCompany] = useState("");
  const [plan, setPlan]       = useState("Starter");
  const [users, setUsers]     = useState("5");
  const [saving, setSaving]   = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim()) return;
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const nextBilling = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    setTimeout(() => {
      onAdd({ company: company.trim(), plan, users: parseInt(users) || 0, mrr: 0, status: "trial", next_billing: nextBilling, start: today });
      onClose();
    }, 600);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/60 border border-white/8 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div className="text-sm font-bold text-white">Add Client</div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/6"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Company Name <span className="text-red-400">*</span></label>
            <input required value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Pharma Ltd."
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-900/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Plan</label>
              <select value={plan} onChange={e => setPlan(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none">
                <option>Starter</option><option>Professional</option><option>Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Estimated Users</label>
              <input type="number" min="1" value={users} onChange={e => setUsers(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1 border-t border-white/5">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/4">Cancel</button>
            <button type="submit" disabled={saving || !company.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Adding…" : "Add Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ManageModal({ sub, onClose, onSave }: { sub: Subscription; onClose: () => void; onSave: (s: Subscription) => void }) {
  const [plan, setPlan]     = useState(sub.plan);
  const [users, setUsers]   = useState(String(sub.users));
  const [status, setStatus] = useState(sub.status);
  const [saving, setSaving] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      onSave({ ...sub, plan, users: parseInt(users) || sub.users, status, mrr: PLAN_MRR[plan] ?? sub.mrr });
      onClose();
    }, 600);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/60 border border-white/8 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div>
            <div className="text-sm font-bold text-white">Manage Subscription</div>
            <div className="text-xs text-slate-400 mt-0.5">{sub.company}</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/6"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Plan</label>
              <select value={plan} onChange={e => setPlan(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none">
                <option>Starter</option><option>Professional</option><option>Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Users</label>
              <input type="number" min="0" value={users} onChange={e => setUsers(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none">
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="churned">Churned</option>
            </select>
          </div>
          <div className="rounded-lg bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
            MRR after change: <span className="font-bold text-white">${(PLAN_MRR[plan] ?? sub.mrr).toLocaleString()}/mo</span>
          </div>
          <div className="flex justify-end gap-2 pt-1 border-t border-white/5">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/4">Cancel</button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function exportCSV(transactions: typeof MOCK_TXN) {
  const rows = [
    ["Company", "Amount", "Date", "Type", "Status"],
    ...transactions.map(t => [t.company, t.amount > 0 ? `$${t.amount}` : "—", t.date, t.type, t.status]),
  ];
  const csv = rows.map(r => r.join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = "transactions.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function BillingPage() {
  // No billing backend yet — demo data only in MOCK_MODE; empty in production.
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(MOCK_MODE ? MOCK_SUBS : []);
  const [transactions, setTransactions]   = useState<typeof MOCK_TXN>(MOCK_MODE ? MOCK_TXN : []);
  const [showAddClient, setShowAddClient] = useState(false);
  const [managing, setManaging]           = useState<Subscription | null>(null);
  const [toast, setToast]                 = useState("");

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  function handleAddClient(s: Subscription) {
    setSubscriptions(prev => [...prev, s]);
    setTransactions(prev => [{ company: s.company, amount: 0, date: new Date().toISOString().slice(0, 10), type: "Trial start", status: "free" }, ...prev]);
    showToast(`${s.company} added as trial`);
  }

  function handleSave(updated: Subscription) {
    setSubscriptions(prev => prev.map(s => s.company === updated.company ? updated : s));
    showToast(`${updated.company} updated`);
  }

  const totalMrr  = subscriptions.filter(s => s.status === "active").reduce((sum, s) => sum + s.mrr, 0);
  const totalUsers = subscriptions.reduce((sum, s) => sum + s.users, 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {showAddClient && <AddClientModal onClose={() => setShowAddClient(false)} onAdd={handleAddClient} />}
      {managing && <ManageModal sub={managing} onClose={() => setManaging(null)} onSave={handleSave} />}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          ✓ {toast}
        </div>
      )}

      <DarkPageHeader
        title="Billing & Subscriptions"
        subtitle="Client subscription plans, MRR tracking, and transaction history"
        actions={
          <button onClick={() => setShowAddClient(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Add Client
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mb-5 grid grid-cols-4 gap-4">
          {[
            { label: "Monthly Recurring Revenue", value: `$${totalMrr.toLocaleString()}`, sub: "Active subscriptions", color: "text-emerald-400", bg: "bg-emerald-900/20 border-emerald-800/50" },
            { label: "Active Clients", value: String(subscriptions.filter(s => s.status === "active").length), sub: `${subscriptions.filter(s => s.status === "trial").length} on trial`, color: "text-blue-400", bg: "bg-blue-900/20 border-blue-800/50" },
            { label: "Total Users Billed", value: totalUsers.toString(), sub: "Across all plans", color: "text-purple-300", bg: "bg-purple-900/20 border-purple-800/50" },
            { label: "ARR (Projected)", value: `$${(totalMrr * 12).toLocaleString()}`, sub: "Based on current MRR", color: "text-amber-400", bg: "bg-amber-900/20 border-amber-800/50" },
          ].map(s => (
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
              <DarkCardHeader title="Client Subscriptions" subtitle="Active and trial accounts" right={<Building2 className="h-4 w-4 text-slate-400" />} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/5 bg-slate-800/40">
                    <tr>
                      {["Company", "Plan", "Users", "MRR", "Status", "Next Billing", "Actions"].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {subscriptions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                          No subscriptions yet — this view will populate once billing is connected.
                        </td>
                      </tr>
                    )}
                    {subscriptions.map(s => (
                      <tr key={s.company} className="hover:bg-white/4">
                        <td className="px-4 py-2.5 text-xs font-medium text-white">{s.company}</td>
                        <td className="px-4 py-2.5"><Pill className={planColor(s.plan)}>{s.plan}</Pill></td>
                        <td className="px-4 py-2.5 text-xs text-slate-300">{s.users}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 text-sm font-bold text-white">
                            <DollarSign className="h-3 w-3 text-slate-400" />
                            {s.mrr > 0 ? s.mrr.toLocaleString() : "—"}
                          </div>
                        </td>
                        <td className="px-4 py-2.5"><Pill className={statusColor(s.status)}>{s.status}</Pill></td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{s.next_billing}</td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => setManaging(s)} className="text-xs font-semibold text-blue-400 hover:underline">Manage</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DarkCard>

            <DarkCard>
              <DarkCardHeader
                title="Recent Transactions"
                subtitle="Payment history"
                right={
                  <button onClick={() => exportCSV(transactions)} className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:underline">
                    <Download className="h-3 w-3" /> Export
                  </button>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/5 bg-slate-800/40">
                    <tr>
                      {["Company", "Amount", "Date", "Type", "Status"].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                          No transactions yet.
                        </td>
                      </tr>
                    )}
                    {transactions.map((t, i) => (
                      <tr key={i} className="hover:bg-white/4">
                        <td className="px-4 py-2.5 text-xs text-slate-200">{t.company}</td>
                        <td className="px-4 py-2.5 text-xs font-bold text-white">{t.amount > 0 ? `$${t.amount.toLocaleString()}` : "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{t.date}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-300">{t.type}</td>
                        <td className="px-4 py-2.5"><Pill className={statusColor(t.status)}>{t.status}</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DarkCard>
          </div>

          <div className="flex flex-col gap-5">
            <DarkCard>
              <DarkCardHeader title="MRR Breakdown" subtitle="Revenue by plan" right={<TrendingUp className="h-4 w-4 text-emerald-400" />} />
              <div className="p-4 space-y-3">
                {PLANS.map(p => {
                  const clients  = subscriptions.filter(s => s.plan === p.name);
                  const planMrr  = clients.reduce((sum, s) => sum + s.mrr, 0);
                  const pct      = totalMrr ? Math.round((planMrr / totalMrr) * 100) : 0;
                  return (
                    <div key={p.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-200">{p.name}</span>
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
              <DarkCardHeader title="Pricing Plans" subtitle="Available tiers" right={<CreditCard className="h-4 w-4 text-slate-400" />} />
              <div className="divide-y divide-white/5">
                {PLANS.map(p => (
                  <div key={p.name} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <Pill className={planColor(p.name)}>{p.name}</Pill>
                      <span className="text-sm font-bold text-white">${p.price}<span className="text-[11px] font-normal text-slate-400">/mo</span></span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">{p.users} users</div>
                    <ul className="mt-1.5 space-y-0.5">
                      {p.features.map(f => <li key={f} className="text-[11px] text-slate-400">· {f}</li>)}
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
