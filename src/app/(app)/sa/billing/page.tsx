import { PageHeader, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { CreditCard, Building2, TrendingUp, DollarSign, Download, Plus } from "lucide-react";

const SUBSCRIPTIONS = [
  { company: "BioStar Research Inc.",  plan: "Professional", users: 14, mrr: 1400, status: "active",    next_billing: "2026-07-01", start: "2026-03-01" },
  { company: "Nexgen Pharma Ltd.",     plan: "Enterprise",   users: 22, mrr: 2850, status: "active",    next_billing: "2026-07-01", start: "2025-11-15" },
  { company: "LabCore Diagnostics",    plan: "Starter",      users: 8,  mrr: 590,  status: "active",    next_billing: "2026-07-01", start: "2026-05-01" },
  { company: "MedTech Solutions",      plan: "Professional", users: 11, mrr: 1100, status: "trial",     next_billing: "2026-07-10", start: "2026-06-10" },
];

const RECENT_TRANSACTIONS = [
  { company: "Nexgen Pharma Ltd.",    amount: 2850, date: "2026-06-01", type: "Monthly",       status: "paid" },
  { company: "BioStar Research Inc.", amount: 1400, date: "2026-06-01", type: "Monthly",       status: "paid" },
  { company: "LabCore Diagnostics",   amount: 590,  date: "2026-06-01", type: "Monthly",       status: "paid" },
  { company: "MedTech Solutions",     amount: 0,    date: "2026-06-10", type: "Trial start",   status: "free" },
  { company: "Nexgen Pharma Ltd.",    amount: 2850, date: "2026-05-01", type: "Monthly",       status: "paid" },
  { company: "BioStar Research Inc.", amount: 1400, date: "2026-05-01", type: "Monthly",       status: "paid" },
];

const PLANS = [
  { name: "Starter",       price: 590,  users: "up to 10", features: ["All EHS modules", "50 document storage", "Email support"] },
  { name: "Professional",  price: 1100, users: "up to 20", features: ["All EHS modules", "Unlimited storage", "AI Findings", "Priority support"] },
  { name: "Enterprise",    price: 2850, users: "Unlimited", features: ["Everything in Pro", "SSO/SAML", "Custom onboarding", "Dedicated CSM", "SLA 99.9%"] },
];

function planColor(p: string) {
  if (p === "Enterprise") return "bg-blue-100 text-blue-700";
  if (p === "Professional") return "bg-purple-100 text-purple-700";
  return "bg-slate-100 text-slate-600";
}

function statusColor(s: string) {
  if (s === "active") return "bg-emerald-100 text-emerald-700";
  if (s === "trial")  return "bg-amber-100 text-amber-700";
  if (s === "paid")   return "bg-emerald-100 text-emerald-700";
  if (s === "free")   return "bg-slate-100 text-slate-500";
  return "bg-red-100 text-red-700";
}

export default function BillingPage() {
  const totalMrr = SUBSCRIPTIONS.filter(s => s.status === "active").reduce((sum, s) => sum + s.mrr, 0);
  const totalUsers = SUBSCRIPTIONS.reduce((sum, s) => sum + s.users, 0);

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <PageHeader
        title="Billing & Subscriptions"
        subtitle="Client subscription plans, MRR tracking, and transaction history"
        actions={
          <button className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            Add Client
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-4 gap-4">
          {[
            { label: "Monthly Recurring Revenue", value: `$${totalMrr.toLocaleString()}`, sub: "+$590 from LabCore", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
            { label: "Active Clients",            value: "3",     sub: "1 on trial",           color: "text-blue-700",    bg: "bg-blue-50 border-blue-100" },
            { label: "Total Users Billed",        value: totalUsers.toString(), sub: "Across all plans", color: "text-purple-700", bg: "bg-purple-50 border-purple-100" },
            { label: "ARR (Projected)",           value: `$${(totalMrr * 12).toLocaleString()}`, sub: "Based on current MRR", color: "text-amber-700", bg: "bg-amber-50 border-amber-100" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{s.label}</div>
              <div className={`mt-1 text-2xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="mt-0.5 text-[10.5px] text-slate-400">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 flex flex-col gap-5">
            {/* Subscription table */}
            <Card>
              <CardHeader title="Client Subscriptions" subtitle="Active and trial accounts" right={<Building2 className="h-4 w-4 text-slate-400" />} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {["Company", "Plan", "Users", "MRR", "Status", "Next Billing", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {SUBSCRIPTIONS.map((s) => (
                      <tr key={s.company} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 text-xs font-medium text-slate-800">{s.company}</td>
                        <td className="px-4 py-2.5"><Pill className={planColor(s.plan)}>{s.plan}</Pill></td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{s.users}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 text-sm font-bold text-slate-800">
                            <DollarSign className="h-3 w-3 text-slate-400" />
                            {s.mrr.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 py-2.5"><Pill className={statusColor(s.status)}>{s.status}</Pill></td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{s.next_billing}</td>
                        <td className="px-4 py-2.5">
                          <button className="text-xs font-semibold text-blue-600 hover:underline">Manage</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Transactions */}
            <Card>
              <CardHeader
                title="Recent Transactions"
                subtitle="Payment history"
                right={
                  <button className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                    <Download className="h-3 w-3" /> Export
                  </button>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {["Company", "Amount", "Date", "Type", "Status"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {RECENT_TRANSACTIONS.map((t, i) => (
                      <tr key={i} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 text-xs text-slate-700">{t.company}</td>
                        <td className="px-4 py-2.5 text-xs font-bold text-slate-800">
                          {t.amount > 0 ? `$${t.amount.toLocaleString()}` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{t.date}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{t.type}</td>
                        <td className="px-4 py-2.5"><Pill className={statusColor(t.status)}>{t.status}</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Plans + MRR */}
          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader title="MRR Breakdown" subtitle="Revenue by plan" right={<TrendingUp className="h-4 w-4 text-emerald-500" />} />
              <div className="p-4 space-y-3">
                {PLANS.map((p) => {
                  const clients = SUBSCRIPTIONS.filter((s) => s.plan === p.name);
                  const planMrr = clients.reduce((sum, s) => sum + s.mrr, 0);
                  const pct = totalMrr ? Math.round((planMrr / totalMrr) * 100) : 0;
                  return (
                    <div key={p.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-700">{p.name}</span>
                        <span className="text-xs font-bold text-slate-800">${planMrr.toLocaleString()}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400">{clients.length} client{clients.length !== 1 ? "s" : ""} · {pct}% of MRR</div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <CardHeader title="Pricing Plans" subtitle="Available tiers" right={<CreditCard className="h-4 w-4 text-slate-400" />} />
              <div className="divide-y divide-slate-50">
                {PLANS.map((p) => (
                  <div key={p.name} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <Pill className={planColor(p.name)}>{p.name}</Pill>
                      <span className="text-sm font-bold text-slate-800">${p.price}<span className="text-[10px] font-normal text-slate-400">/mo</span></span>
                    </div>
                    <div className="mt-1 text-[10.5px] text-slate-400">{p.users} users</div>
                    <ul className="mt-1.5 space-y-0.5">
                      {p.features.map((f) => (
                        <li key={f} className="text-[10.5px] text-slate-500">· {f}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
