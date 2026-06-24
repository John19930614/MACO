"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { DarkPageHeader, DarkCard, DarkCardHeader, Pill, DarkStat } from "@/components/ui/primitives";
import { Modal, Field, Input, Select as FormSelect, SubmitRow } from "@/components/modals/Modal";
import { createClient } from "@/lib/supabase/client";
import { MOCK_MODE } from "@/lib/env";
import {
  Search, Download, Building2, Users, Rocket, TrendingUp,
  Pencil, Trash2, ChevronUp, ChevronDown, ExternalLink,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Company {
  id: string;
  name: string;
  industry: string;
  plan: string;
  users: number;
  status: string;      // active | prospect | churned | archived
  implStatus: string;  // live | onboarding | data_import | prospect
  contact: string;
  contact_email: string;
  mrr: number;
  created_at: string;
}

type SortKey = "name" | "plan" | "users" | "status" | "implStatus" | "created_at";

// ── Mock seed data (demo only — never used as a live fallback) ──────────────────

const MOCK_COMPANIES: Company[] = [
  { id: "t-001", name: "BioStar Research Inc.",  industry: "Pharma / Biotech",  plan: "Professional", users: 12, status: "active",   implStatus: "live",        contact: "Sarah Chen",    contact_email: "s.chen@biostar.com",        mrr: 1100, created_at: "2026-01-15" },
  { id: "t-002", name: "NovaChem Solutions",     industry: "Chemical Mfg",      plan: "Enterprise",   users: 34, status: "active",   implStatus: "onboarding",  contact: "James Okafor",  contact_email: "j.okafor@novachem.com",     mrr: 2850, created_at: "2026-02-01" },
  { id: "t-003", name: "GenTech Biopharma",      industry: "Biotech",           plan: "Professional", users: 8,  status: "active",   implStatus: "onboarding",  contact: "Mei Tanaka",    contact_email: "m.tanaka@gentech.com",      mrr: 1100, created_at: "2026-03-10" },
  { id: "t-004", name: "Meridian Diagnostics",   industry: "Clinical Lab",      plan: "Starter",      users: 5,  status: "active",   implStatus: "data_import", contact: "Tom Brady",     contact_email: "t.brady@meridiandiag.com",  mrr: 590,  created_at: "2026-04-01" },
  { id: "t-005", name: "PharmaLink Corp",        industry: "API Manufacturing", plan: "Enterprise",   users: 0,  status: "prospect", implStatus: "prospect",    contact: "Linda Frost",   contact_email: "l.frost@pharmalink.com",    mrr: 0,    created_at: "2026-05-20" },
];

// ── Style maps ────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  active:   "bg-emerald-900/50 text-emerald-300",
  prospect: "bg-blue-900/50 text-blue-300",
  churned:  "bg-red-900/50 text-red-300",
  archived: "bg-slate-800 text-slate-400",
};

const IMPL_STYLE: Record<string, string> = {
  live:        "bg-emerald-900/50 text-emerald-300",
  onboarding:  "bg-amber-900/50 text-amber-300",
  data_import: "bg-blue-900/50 text-blue-300",
  prospect:    "bg-slate-800 text-slate-400",
};

const IMPL_ORDER: Record<string, number> = { live: 0, onboarding: 1, data_import: 2, prospect: 3 };
const IMPL_STEPS = ["prospect", "data_import", "onboarding", "live"] as const;

const PLAN_MRR: Record<string, number> = { Starter: 590, Professional: 1100, Enterprise: 2850 };

// ── Helpers ───────────────────────────────────────────────────────────────────

function sortList(list: Company[], key: SortKey, dir: "asc" | "desc"): Company[] {
  return [...list].sort((a, b) => {
    let cmp = 0;
    if (key === "users")      cmp = a.users - b.users;
    else if (key === "implStatus") cmp = (IMPL_ORDER[a.implStatus] ?? 99) - (IMPL_ORDER[b.implStatus] ?? 99);
    else                      cmp = String(a[key]).localeCompare(String(b[key]));
    return dir === "asc" ? cmp : -cmp;
  });
}

function exportCSV(data: Company[]) {
  const headers = ["Company", "Industry", "Plan", "Users", "Status", "Implementation", "Contact", "Email", "MRR", "Created"];
  const rows = data.map(c => [
    c.name, c.industry, c.plan, c.users, c.status,
    c.implStatus.replace(/_/g, " "), c.contact, c.contact_email, c.mrr, c.created_at,
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = "companies.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ImplProgress({ status }: { status: string }) {
  const idx = IMPL_STEPS.indexOf(status as typeof IMPL_STEPS[number]);
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {IMPL_STEPS.map((_, i) => (
          <div key={i} className={`h-1.5 w-3 rounded-sm ${i <= idx ? "bg-blue-400" : "bg-slate-700/60"}`} />
        ))}
      </div>
      <Pill className={IMPL_STYLE[status] ?? "bg-slate-800 text-slate-400"}>
        {status.replace(/_/g, " ")}
      </Pill>
    </div>
  );
}

function SortTh({
  col, label, sortKey, sortDir, onSort, center = false,
}: {
  col: SortKey; label: string; sortKey: SortKey; sortDir: "asc" | "desc";
  onSort: (c: SortKey) => void; center?: boolean;
}) {
  const active = sortKey === col;
  const Arrow  = active && sortDir === "desc" ? ChevronDown : ChevronUp;
  return (
    <th
      className={`cursor-pointer select-none px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 hover:text-slate-200 ${center ? "text-center" : "text-left"}`}
      onClick={() => onSort(col)}
    >
      <span className={`inline-flex items-center gap-1 ${center ? "justify-center w-full" : ""}`}>
        {label}
        <Arrow className={`h-3 w-3 ${active ? "text-blue-400" : "text-slate-700/60"}`} />
      </span>
    </th>
  );
}

function CompanyModal({
  company, onClose, onSave,
}: {
  company?: Company | null;
  onClose: () => void;
  onSave: (c: Company) => void;
}) {
  const editing = Boolean(company);
  const [name,       setName]       = useState(company?.name ?? "");
  const [industry,   setIndustry]   = useState(company?.industry ?? "");
  const [plan,       setPlan]       = useState(company?.plan ?? "Starter");
  const [status,     setStatus]     = useState(company?.status ?? "prospect");
  const [implStatus, setImplStatus] = useState(company?.implStatus ?? "prospect");
  const [contact,    setContact]    = useState(company?.contact ?? "");
  const [email,      setEmail]      = useState(company?.contact_email ?? "");
  const [users,      setUsers]      = useState(String(company?.users ?? 0));
  const [saving,     setSaving]     = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !industry.trim()) return;
    setSaving(true);
    setTimeout(() => {
      onSave({
        id:            company?.id ?? `t-${Date.now()}`,
        name:          name.trim(),
        industry:      industry.trim(),
        plan,
        users:         parseInt(users) || 0,
        status,
        implStatus,
        contact:       contact.trim(),
        contact_email: email.trim(),
        mrr:           PLAN_MRR[plan] ?? 0,
        created_at:    company?.created_at ?? new Date().toISOString().slice(0, 10),
      });
      onClose();
    }, 600);
  }

  return (
    <Modal open onClose={onClose} title={editing ? `Edit — ${company!.name}` : "Add Company"} width="max-w-lg">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company Name" required>
              <Input required value={name} onChange={e => setName(e.target.value)} placeholder="Acme Biotech Inc." />
            </Field>
            <Field label="Industry" required>
              <Input required value={industry} onChange={e => setIndustry(e.target.value)} placeholder="Pharma / Biotech" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Plan">
              <FormSelect value={plan} onChange={e => setPlan(e.target.value)}>
                <option>Starter</option>
                <option>Professional</option>
                <option>Enterprise</option>
              </FormSelect>
            </Field>
            <Field label="Status">
              <FormSelect value={status} onChange={e => setStatus(e.target.value)}>
                <option value="prospect">Prospect</option>
                <option value="active">Active</option>
                <option value="churned">Churned</option>
              </FormSelect>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Implementation Stage">
              <FormSelect value={implStatus} onChange={e => setImplStatus(e.target.value)}>
                <option value="prospect">Prospect</option>
                <option value="data_import">Data Import</option>
                <option value="onboarding">Onboarding</option>
                <option value="live">Live</option>
              </FormSelect>
            </Field>
            <Field label="Active Users">
              <Input type="number" min="0" value={users} onChange={e => setUsers(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Primary Contact">
              <Input value={contact} onChange={e => setContact(e.target.value)} placeholder="Jane Smith" />
            </Field>
            <Field label="Contact Email">
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@company.com" />
            </Field>
          </div>
        </div>
        <SubmitRow onClose={onClose} submitting={saving} />
      </form>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SACompaniesPage() {
  // Live mode starts empty and is filled from the real `tenants` table below.
  // Mock mode seeds the demo fixtures so the screen is explorable offline.
  const [companies,    setCompanies]    = useState<Company[]>(MOCK_MODE ? MOCK_COMPANIES : []);
  const [editing,      setEditing]      = useState<Company | null>(null);
  const [addingNew,    setAddingNew]    = useState(false);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey,      setSortKey]      = useState<SortKey>("name");
  const [sortDir,      setSortDir]      = useState<"asc" | "desc">("asc");
  const [toast,        setToast]        = useState("");

  // Load real tenants from Supabase in live mode. Mock mode keeps the fixtures.
  useEffect(() => {
    const sb = createClient();
    if (!sb) return;
    sb.from("tenants")
      .select("id, name, slug, sector, active, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        // Live mode: always reflect the real table (even when empty → empty state).
        if (error || !data) return;
        setCompanies(data.map(t => ({
          id:            t.id,
          name:          t.name,
          industry:      t.sector,
          plan:          "Professional",
          users:         0,
          status:        t.active ? "active" : "churned",
          implStatus:    "live",
          contact:       "",
          contact_email: "",
          mrr:           0,
          created_at:    String(t.created_at).slice(0, 10),
        })));
      });
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function handleSave(c: Company) {
    setCompanies(prev =>
      prev.some(x => x.id === c.id) ? prev.map(x => x.id === c.id ? c : x) : [...prev, c]
    );
    showToast(editing ? `${c.name} updated` : `${c.name} added`);
  }

  function handleArchive(id: string) {
    const c = companies.find(x => x.id === id);
    if (!c) return;
    if (!confirm(`Archive "${c.name}"? It will be hidden from the active list.`)) return;
    setCompanies(prev => prev.map(x => x.id === id ? { ...x, status: "archived" } : x));
    showToast(`${c.name} archived`);
  }

  function handleRestore(id: string) {
    const c = companies.find(x => x.id === id);
    if (!c) return;
    setCompanies(prev => prev.map(x => x.id === id ? { ...x, status: "prospect" } : x));
    showToast(`${c.name} restored`);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  // ── Derived stats ────────────────────────────────────────────────────────────

  const active     = companies.filter(c => c.status === "active").length;
  const prospect   = companies.filter(c => c.status === "prospect").length;
  const live       = companies.filter(c => c.implStatus === "live" && c.status !== "archived").length;
  const totalUsers = companies.filter(c => c.status === "active").reduce((s, c) => s + c.users, 0);

  const archived = companies.filter(c => c.status === "archived");

  const filtered = useMemo(() => {
    let list = companies.filter(c => c.status !== "archived");
    if (statusFilter !== "all") list = list.filter(c => c.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        c.contact.toLowerCase().includes(q) ||
        c.contact_email.toLowerCase().includes(q)
      );
    }
    return sortList(list, sortKey, sortDir);
  }, [companies, search, statusFilter, sortKey, sortDir]);

  const sortProps = { sortKey, sortDir, onSort: toggleSort };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col">
      {(editing || addingNew) && (
        <CompanyModal
          company={editing}
          onClose={() => { setEditing(null); setAddingNew(false); }}
          onSave={c => { handleSave(c); setEditing(null); setAddingNew(false); }}
        />
      )}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          ✓ {toast}
        </div>
      )}

      <DarkPageHeader
        title="Companies & Tenants"
        subtitle="All client organisations using SafetyIQ"
        actions={
          <button
            onClick={() => setAddingNew(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Add Company
          </button>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* Stat cards */}
        <div className="mb-5 grid grid-cols-4 gap-4">
          <DarkStat label="Active Tenants"   value={active}     strip="#10b981" icon={<Building2 className="h-5 w-5" />} />
          <DarkStat label="Prospects"        value={prospect}   strip="#3b82f6" accent="#3b82f6" icon={<TrendingUp className="h-5 w-5" />} />
          <DarkStat label="Live on Platform" value={live}       strip="#10b981" accent="#10b981" icon={<Rocket className="h-5 w-5" />} />
          <DarkStat label="Total Users"      value={totalUsers} strip="#8b5cf6" accent="#8b5cf6" icon={<Users className="h-5 w-5" />} />
        </div>

        <DarkCard>
          <DarkCardHeader
            title="Client Organisations"
            subtitle={`${filtered.length} of ${companies.filter(c => c.status !== "archived").length} shown`}
            right={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="h-8 w-40 rounded-lg border border-white/10 bg-slate-800/60 pl-7 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-900/50"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="h-8 rounded-lg border border-white/10 bg-slate-800/60 px-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="prospect">Prospect</option>
                  <option value="churned">Churned</option>
                </select>
                <button
                  onClick={() => exportCSV(filtered)}
                  className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-slate-800/60 px-2.5 text-xs font-medium text-slate-300 hover:bg-white/6"
                >
                  <Download className="h-3 w-3" /> Export
                </button>
              </div>
            }
          />

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/5 bg-slate-800/40">
                <tr>
                  <SortTh col="name"       label="Company"        {...sortProps} />
                  <SortTh col="plan"       label="Plan"           {...sortProps} />
                  <SortTh col="users"      label="Users"          {...sortProps} center />
                  <SortTh col="status"     label="Status"         {...sortProps} />
                  <SortTh col="implStatus" label="Implementation" {...sortProps} />
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">Contact</th>
                  <SortTh col="created_at" label="Onboarded"      {...sortProps} />
                  <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                      No companies match your filters.
                    </td>
                  </tr>
                )}
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-white/4">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{c.name}</div>
                      <div className="text-[11px] text-slate-400">{c.industry}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Pill className={
                        c.plan === "Enterprise"   ? "bg-blue-900/50 text-blue-300"   :
                        c.plan === "Professional" ? "bg-purple-900/50 text-purple-300" :
                        "bg-slate-800 text-slate-400"
                      }>{c.plan}</Pill>
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-200">{c.users}</td>
                    <td className="px-4 py-3">
                      <Pill className={STATUS_STYLE[c.status] ?? "bg-slate-800 text-slate-400"}>{c.status}</Pill>
                    </td>
                    <td className="px-4 py-3">
                      <ImplProgress status={c.implStatus} />
                    </td>
                    <td className="px-4 py-3">
                      {c.contact ? (
                        <>
                          <div className="text-xs font-medium text-slate-200">{c.contact}</div>
                          {c.contact_email && <div className="text-[11px] text-slate-400">{c.contact_email}</div>}
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{c.created_at}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/sa/companies/${c.id}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-blue-900/40 hover:text-blue-300"
                          title="View dashboard"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => setEditing(c)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-blue-900/40 hover:text-blue-300"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleArchive(c.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-900/40 hover:text-red-300"
                          title="Archive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {archived.length > 0 && (
            <div className="border-t border-white/5 px-4 py-3">
              <button
                onClick={() => setShowArchived(v => !v)}
                className="text-[11px] text-slate-400 hover:text-slate-200"
              >
                {showArchived ? "Hide archived ↑" : `${archived.length} archived — show ↓`}
              </button>
              {showArchived && (
                <div className="mt-2 space-y-1">
                  {archived.map(c => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg bg-slate-900/40 px-3 py-2 opacity-75">
                      <div>
                        <span className="text-xs text-slate-400 line-through">{c.name}</span>
                        <span className="ml-2 text-[11px] text-slate-400">{c.industry}</span>
                      </div>
                      <button
                        onClick={() => handleRestore(c.id)}
                        className="text-[11px] font-medium text-blue-400 hover:underline"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DarkCard>
      </div>
    </div>
  );
}
