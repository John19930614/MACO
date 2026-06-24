"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Building2, Users, LayoutGrid, Activity,
  CheckCircle2, XCircle, AlertTriangle, Clock, Download,
  Pencil, UserPlus, MapPin, Calendar, Mail, Phone,
  Shield, MoreHorizontal, Globe,
} from "lucide-react";
import { DarkCard, DarkCardHeader, DarkStat, Pill } from "@/components/ui/primitives";
import { EHS_MODULES, MODULE_META } from "@/lib/constants";
import type { EhsModule } from "@/lib/constants";
import { MOCK_MODE } from "@/lib/env";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Company {
  id: string; name: string; industry: string; plan: string;
  users: number; status: string; implStatus: string;
  contact: string; contact_email: string; contact_phone: string;
  mrr: number; created_at: string; hq: string; website: string;
  csm: string; notes: string;
}

interface TenantUser {
  id: string; name: string; email: string; role: string;
  lastActive: string; status: "active" | "inactive" | "pending";
}

interface Site {
  id: string; name: string; location: string; type: string; users: number;
}

interface ActivityEvent {
  ts: string; user: string; action: string; module: string; detail: string;
}

// ── Mock seed data ─────────────────────────────────────────────────────────────

const COMPANIES: Record<string, Company> = {
  "t-001": { id: "t-001", name: "BioStar Research Inc.",  industry: "Pharma / Biotech",  plan: "Professional", users: 12, status: "active",   implStatus: "live",        contact: "Sarah Chen",   contact_email: "s.chen@biostar.com",       contact_phone: "+1 617-555-0182", mrr: 1100, created_at: "2026-01-15", hq: "Cambridge, MA",     website: "biostar-research.com", csm: "Reliance — Alex Kim",    notes: "Flagship pharma client. Go-live completed Jan 15. Waste module onboarded Mar." },
  "t-002": { id: "t-002", name: "NovaChem Solutions",     industry: "Chemical Mfg",      plan: "Enterprise",   users: 34, status: "active",   implStatus: "onboarding",  contact: "James Okafor", contact_email: "j.okafor@novachem.com",    contact_phone: "+1 312-555-0247", mrr: 2850, created_at: "2026-02-01", hq: "Chicago, IL",      website: "novachem.com",         csm: "Reliance — Maria Lopez", notes: "Multi-site enterprise. Onboarding second site in Q3. ERP integration pending." },
  "t-003": { id: "t-003", name: "GenTech Biopharma",      industry: "Biotech",           plan: "Professional", users: 8,  status: "active",   implStatus: "onboarding",  contact: "Mei Tanaka",   contact_email: "m.tanaka@gentech.com",     contact_phone: "+1 858-555-0391", mrr: 1100, created_at: "2026-03-10", hq: "San Diego, CA",    website: "gentechbio.com",       csm: "Reliance — Alex Kim",    notes: "Fast-moving biotech. Requested custom training matrix. Deadline Jun 30." },
  "t-004": { id: "t-004", name: "Meridian Diagnostics",   industry: "Clinical Lab",      plan: "Starter",      users: 5,  status: "active",   implStatus: "data_import", contact: "Tom Brady",    contact_email: "t.brady@meridiandiag.com", contact_phone: "+1 617-555-0429", mrr: 590,  created_at: "2026-04-01", hq: "Boston, MA",       website: "meridiandiag.com",     csm: "Reliance — Sarah Green", notes: "Small clinical lab. Data import in progress. Upgrade to Professional under discussion." },
  "t-005": { id: "t-005", name: "PharmaLink Corp",        industry: "API Manufacturing", plan: "Enterprise",   users: 0,  status: "prospect", implStatus: "prospect",    contact: "Linda Frost",  contact_email: "l.frost@pharmalink.com",   contact_phone: "+1 908-555-0513", mrr: 0,    created_at: "2026-05-20", hq: "Newark, NJ",       website: "pharmalinkcorp.com",   csm: "Reliance — Maria Lopez", notes: "Enterprise prospect. Demo completed. Procurement review in progress. Expected close Q3." },
};

const USERS: Record<string, TenantUser[]> = {
  "t-001": [
    { id: "u-101", name: "Sarah Chen",    email: "s.chen@biostar.com",     role: "EHS Manager",          lastActive: "2026-06-22", status: "active"  },
    { id: "u-102", name: "Dr. Mike Park", email: "m.park@biostar.com",     role: "Lab Director",         lastActive: "2026-06-21", status: "active"  },
    { id: "u-103", name: "Rachel Torres", email: "r.torres@biostar.com",   role: "Safety Officer",       lastActive: "2026-06-20", status: "active"  },
    { id: "u-104", name: "Kai Huang",     email: "k.huang@biostar.com",    role: "QA Lead",              lastActive: "2026-06-19", status: "active"  },
    { id: "u-105", name: "Ben Mitchell",  email: "b.mitchell@biostar.com", role: "Research Scientist",   lastActive: "2026-06-18", status: "active"  },
    { id: "u-106", name: "Aisha Patel",   email: "a.patel@biostar.com",    role: "Compliance Coord.",    lastActive: "2026-06-15", status: "active"  },
    { id: "u-107", name: "Tom Walsh",     email: "t.walsh@biostar.com",    role: "Facilities Manager",   lastActive: "2026-06-10", status: "active"  },
    { id: "u-108", name: "Nina Chow",     email: "n.chow@biostar.com",     role: "Lab Technician",       lastActive: "2026-06-08", status: "active"  },
    { id: "u-109", name: "Carlos Ruiz",   email: "c.ruiz@biostar.com",     role: "IT Administrator",     lastActive: "2026-05-30", status: "inactive"},
    { id: "u-110", name: "Priya Shah",    email: "p.shah@biostar.com",     role: "Senior Chemist",       lastActive: "2026-06-22", status: "active"  },
    { id: "u-111", name: "David Lee",     email: "d.lee@biostar.com",      role: "Lab Supervisor",       lastActive: "2026-06-21", status: "active"  },
    { id: "u-112", name: "Emma Wilson",   email: "e.wilson@biostar.com",   role: "Training Coordinator", lastActive: "2026-06-17", status: "active"  },
  ],
  "t-002": [
    { id: "u-201", name: "James Okafor",  email: "j.okafor@novachem.com",  role: "EHS Director",         lastActive: "2026-06-22", status: "active"  },
    { id: "u-202", name: "Diane Park",    email: "d.park@novachem.com",    role: "HSE Manager",          lastActive: "2026-06-22", status: "active"  },
    { id: "u-203", name: "Ryan Torres",   email: "r.torres@novachem.com",  role: "Chemical Engineer",    lastActive: "2026-06-21", status: "active"  },
    { id: "u-204", name: "Fatima Al-Amin",email: "f.alamin@novachem.com",  role: "QA Supervisor",        lastActive: "2026-06-20", status: "active"  },
    { id: "u-205", name: "Lars Svensson", email: "l.svensson@novachem.com",role: "Process Safety Lead",  lastActive: "2026-06-19", status: "active"  },
    { id: "u-206", name: "Mei Yong",      email: "m.yong@novachem.com",    role: "Compliance Officer",   lastActive: "2026-06-18", status: "active"  },
    { id: "u-207", name: "Javier Reyes",  email: "j.reyes@novachem.com",   role: "Facilities Lead",      lastActive: "2026-06-15", status: "active"  },
    { id: "u-208", name: "Claire Dubois", email: "c.dubois@novachem.com",  role: "Regulatory Affairs",   lastActive: "2026-06-14", status: "active"  },
  ],
  "t-003": [
    { id: "u-301", name: "Mei Tanaka",    email: "m.tanaka@gentech.com",   role: "EHS Manager",          lastActive: "2026-06-22", status: "active"  },
    { id: "u-302", name: "Dr. Sam Ellis", email: "s.ellis@gentech.com",    role: "Principal Scientist",  lastActive: "2026-06-21", status: "active"  },
    { id: "u-303", name: "Zoe Kim",       email: "z.kim@gentech.com",      role: "Lab Safety Officer",   lastActive: "2026-06-20", status: "active"  },
    { id: "u-304", name: "Marcus Webb",   email: "m.webb@gentech.com",     role: "QA Associate",         lastActive: "2026-06-10", status: "active"  },
    { id: "u-305", name: "Layla Hassan",  email: "l.hassan@gentech.com",   role: "Research Associate",   lastActive: "2026-06-05", status: "inactive"},
    { id: "u-306", name: "Finn O'Brien",  email: "f.obrien@gentech.com",   role: "Lab Technician",       lastActive: "2026-06-22", status: "active"  },
    { id: "u-307", name: "Anya Patel",    email: "a.patel@gentech.com",    role: "Compliance Analyst",   lastActive: "2026-06-19", status: "pending" },
    { id: "u-308", name: "Jerome Clark",  email: "j.clark@gentech.com",    role: "IT Admin",             lastActive: "2026-06-18", status: "active"  },
  ],
  "t-004": [
    { id: "u-401", name: "Tom Brady",     email: "t.brady@meridiandiag.com",role: "Lab Director",        lastActive: "2026-06-22", status: "active"  },
    { id: "u-402", name: "Helen Ford",    email: "h.ford@meridiandiag.com", role: "EHS Coordinator",     lastActive: "2026-06-20", status: "active"  },
    { id: "u-403", name: "Raj Nair",      email: "r.nair@meridiandiag.com", role: "QC Analyst",          lastActive: "2026-06-18", status: "active"  },
    { id: "u-404", name: "Sara Moon",     email: "s.moon@meridiandiag.com", role: "Lab Technician",      lastActive: "2026-06-12", status: "active"  },
    { id: "u-405", name: "Luis Vargas",   email: "l.vargas@meridiandiag.com",role: "IT Support",         lastActive: "2026-06-01", status: "pending" },
  ],
  "t-005": [],
};

const SITES: Record<string, Site[]> = {
  "t-001": [
    { id: "s-101", name: "Cambridge HQ",        location: "Cambridge, MA",        type: "Research Campus", users: 12 },
  ],
  "t-002": [
    { id: "s-201", name: "Chicago Headquarters", location: "Chicago, IL",          type: "Corporate HQ",    users: 22 },
    { id: "s-202", name: "Joliet Manufacturing", location: "Joliet, IL",           type: "Manufacturing",   users: 12 },
  ],
  "t-003": [
    { id: "s-301", name: "San Diego Research",   location: "San Diego, CA",        type: "Research Facility",users: 8 },
  ],
  "t-004": [
    { id: "s-401", name: "Boston Clinical Lab",  location: "Boston, MA",           type: "Clinical Lab",    users: 5 },
  ],
  "t-005": [],
};

const ACTIVITY: Record<string, ActivityEvent[]> = {
  "t-001": [
    { ts: "2026-06-22 09:14", user: "Sarah Chen",    action: "Closed CAPA",            module: "CAPA",       detail: "CAP-2026-041 marked complete with evidence upload" },
    { ts: "2026-06-22 08:55", user: "Priya Shah",    action: "SDS viewed",             module: "Chemical",   detail: "Chloroform SDS accessed — Lab A" },
    { ts: "2026-06-21 16:30", user: "Emma Wilson",   action: "Training completed",     module: "Training",   detail: "Hazardous Waste Handler — Score 94%" },
    { ts: "2026-06-21 14:12", user: "Rachel Torres", action: "Inspection submitted",   module: "Waste",      detail: "Weekly SAA inspection — Lab A · Passed" },
    { ts: "2026-06-20 11:05", user: "David Lee",     action: "Document acknowledged",  module: "Documents",  detail: "Chemical Hygiene Plan v3.1 — acknowledged" },
    { ts: "2026-06-20 09:22", user: "Sarah Chen",    action: "Risk updated",           module: "Risk",       detail: "Lab A Solvent Storage — residual risk reduced to 8" },
    { ts: "2026-06-19 15:48", user: "Kai Huang",     action: "Audit finding added",    module: "Audits",     detail: "Internal audit Q2 — 2 minor findings logged" },
    { ts: "2026-06-18 13:00", user: "Mike Park",     action: "Incident reported",      module: "Incidents",  detail: "Near miss — minor chemical splash, Lab B bench" },
    { ts: "2026-06-17 10:30", user: "Emma Wilson",   action: "Training assigned",      module: "Training",   detail: "Spill Response refresher assigned to 4 users" },
    { ts: "2026-06-16 09:00", user: "Sarah Chen",    action: "Report exported",        module: "Waste",      detail: "Monthly waste summary PDF downloaded" },
  ],
  "t-002": [
    { ts: "2026-06-22 10:01", user: "James Okafor",  action: "CAPA created",           module: "CAPA",       detail: "CAP-NOV-088 — chemical storage deviation, Site 1" },
    { ts: "2026-06-22 09:44", user: "Diane Park",    action: "Inspection submitted",   module: "Audits",     detail: "Weekly HSE walk — Joliet site · 1 finding" },
    { ts: "2026-06-21 14:20", user: "Ryan Torres",   action: "Chemical added",         module: "Chemical",   detail: "Methyl Ethyl Ketone — 500 L tank registered" },
    { ts: "2026-06-20 11:15", user: "Fatima Al-Amin",action: "Document published",     module: "Documents",  detail: "Emergency Response Plan v2.0 published to all staff" },
    { ts: "2026-06-19 16:05", user: "Lars Svensson", action: "Risk review completed",  module: "Risk",       detail: "Process safety review Q2 — 18 items assessed" },
    { ts: "2026-06-18 09:30", user: "James Okafor",  action: "User invited",           module: "Platform",   detail: "3 new users invited — Joliet site" },
    { ts: "2026-06-17 14:50", user: "Mei Yong",      action: "Compliance task closed", module: "Legal",      detail: "OSHA 300 log updated for Q2" },
    { ts: "2026-06-16 10:20", user: "Claire Dubois", action: "Regulatory check",       module: "Legal",      detail: "EPA TRI threshold check — 2 chemicals flagged" },
  ],
  "t-003": [
    { ts: "2026-06-22 08:30", user: "Mei Tanaka",    action: "CAPA created",           module: "CAPA",       detail: "CAP-GT-019 — SDS library gap — 3 missing" },
    { ts: "2026-06-21 15:10", user: "Zoe Kim",       action: "Inspection submitted",   module: "Audits",     detail: "Lab safety walkthrough — Passed" },
    { ts: "2026-06-20 11:40", user: "Finn O'Brien",  action: "Training completed",     module: "Training",   detail: "Biosafety Level 2 — Score 88%" },
    { ts: "2026-06-19 09:55", user: "Mei Tanaka",    action: "Incident reported",      module: "Incidents",  detail: "Sharps injury — right hand — first aid only" },
    { ts: "2026-06-18 14:00", user: "Marcus Webb",   action: "Chemical reviewed",      module: "Chemical",   detail: "Quarterly inventory review — 42 chemicals confirmed" },
    { ts: "2026-06-17 10:15", user: "Anya Patel",    action: "Account activated",      module: "Platform",   detail: "New user Anya Patel — Compliance Analyst" },
  ],
  "t-004": [
    { ts: "2026-06-22 09:00", user: "Tom Brady",     action: "Data import progress",   module: "Platform",   detail: "Chemical inventory batch 2 — 84 records imported" },
    { ts: "2026-06-20 14:30", user: "Helen Ford",    action: "Training completed",     module: "Training",   detail: "Lab Safety Fundamentals — Score 91%" },
    { ts: "2026-06-18 11:00", user: "Raj Nair",      action: "Risk created",           module: "Risk",       detail: "Centrifuge hazard assessment — risk score 12" },
    { ts: "2026-06-15 10:45", user: "Tom Brady",     action: "Data import started",    module: "Platform",   detail: "Chemical inventory import — batch 1 complete" },
    { ts: "2026-06-10 09:30", user: "Tom Brady",     action: "Account created",        module: "Platform",   detail: "Tenant provisioned — Starter plan activated" },
  ],
  "t-005": [
    { ts: "2026-05-28 14:00", user: "Maria Lopez",   action: "Demo delivered",         module: "Platform",   detail: "Full platform demo — Linda Frost + 3 stakeholders" },
    { ts: "2026-05-20 11:30", user: "Maria Lopez",   action: "Prospect created",       module: "Platform",   detail: "PharmaLink Corp added as Enterprise prospect" },
  ],
};

// ── Module access per plan ────────────────────────────────────────────────────

function defaultModules(plan: string): Record<string, boolean> {
  const all = Object.fromEntries(EHS_MODULES.map(m => [m, false]));
  const starter      = ["incidents", "training", "documents", "risk"];
  const professional = [...starter, "capa", "audits", "chemical"];
  const enterprise   = EHS_MODULES as readonly string[];
  const enabled = plan === "Enterprise" ? enterprise : plan === "Professional" ? professional : starter;
  enabled.forEach(m => { all[m] = true; });
  return all;
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  active:   "bg-emerald-900/50 text-emerald-300",
  prospect: "bg-blue-900/50 text-blue-300",
  churned:  "bg-red-900/50 text-red-300",
  archived: "bg-slate-800 text-slate-400",
};

const IMPL_STEPS = ["prospect", "data_import", "onboarding", "live"] as const;
const IMPL_LABELS: Record<string, string> = {
  prospect: "Prospect", data_import: "Data Import", onboarding: "Onboarding", live: "Live",
};

const USER_STATUS_STYLE: Record<string, string> = {
  active:   "bg-emerald-900/50 text-emerald-300",
  inactive: "bg-slate-800 text-slate-400",
  pending:  "bg-amber-900/50 text-amber-300",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysSince(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TabButton({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
        active
          ? "border-blue-400 text-white"
          : "border-transparent text-slate-400 hover:text-slate-200"
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  // No live per-tenant detail backend yet — demo records only render in mock mode.
  const company = MOCK_MODE ? (COMPANIES[id] ?? COMPANIES["t-001"]) : undefined;
  const users   = MOCK_MODE ? (USERS[id]    ?? []) : [];
  const sites   = MOCK_MODE ? (SITES[id]    ?? []) : [];
  const events  = MOCK_MODE ? (ACTIVITY[id] ?? []) : [];

  const [tab,     setTab]     = useState<"overview" | "users" | "modules" | "activity">("overview");
  const [modules, setModules] = useState<Record<string, boolean>>(defaultModules(company?.plan ?? "Starter"));
  const [toast,   setToast]   = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function toggleModule(mod: string) {
    setModules(prev => {
      const next = { ...prev, [mod]: !prev[mod] };
      showToast(`${MODULE_META[mod as EhsModule]?.label ?? mod} ${next[mod] ? "enabled" : "disabled"} for ${company?.name ?? "this tenant"}`);
      return next;
    });
  }

  if (!company) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-950 text-center text-slate-400">
        <Building2 className="h-8 w-8 text-slate-600" />
        <div className="text-sm">Per-tenant detail isn’t available in live mode yet.</div>
        <Link href="/sa/companies" className="text-xs text-blue-400 hover:underline">← Back to Companies &amp; Tenants</Link>
      </div>
    );
  }

  const enabledCount  = Object.values(modules).filter(Boolean).length;
  const implIdx       = IMPL_STEPS.indexOf(company.implStatus as typeof IMPL_STEPS[number]);
  const activeUsers   = users.filter(u => u.status === "active").length;

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          ✓ {toast}
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 border-b border-white/8 bg-slate-950/80 px-6 py-4">
        <Link
          href="/sa/companies"
          className="mb-3 flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Companies &amp; Tenants
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-2xl">
              <Building2 className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-white">{company.name}</h1>
                <Pill className={
                  company.plan === "Enterprise"   ? "bg-blue-900/50 text-blue-300"     :
                  company.plan === "Professional" ? "bg-purple-900/50 text-purple-300" :
                  "bg-slate-800 text-slate-400"
                }>
                  {company.plan}
                </Pill>
                <Pill className={STATUS_STYLE[company.status] ?? "bg-slate-800 text-slate-400"}>
                  {company.status}
                </Pill>
              </div>
              <p className="mt-0.5 text-sm text-slate-400">{company.industry} · {company.hq}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => alert(`Edit company record for ${company.name}`)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/6"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              onClick={() => alert(`Download account package for ${company.name}`)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/6"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mt-4 flex border-b border-white/8">
          <TabButton label="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
          <TabButton label="Users"    active={tab === "users"}    onClick={() => setTab("users")}    count={users.length} />
          <TabButton label="Modules"  active={tab === "modules"}  onClick={() => setTab("modules")}  count={enabledCount} />
          <TabButton label="Activity" active={tab === "activity"} onClick={() => setTab("activity")} count={events.length} />
        </div>
      </div>

      {/* Content */}
      <div className="iq-scroll flex-1 overflow-y-auto p-6">

        {/* ── Overview ── */}
        {tab === "overview" && (
          <div className="space-y-5">
            {/* KPI stats */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <DarkStat label="Active Users"    value={activeUsers}              strip="#10b981" accent="#10b981" icon={<Users className="h-5 w-5" />} />
              <DarkStat label="Enabled Modules" value={enabledCount}             strip="#3b82f6" accent="#3b82f6" icon={<LayoutGrid className="h-5 w-5" />} />
              <DarkStat label="Monthly MRR"     value={company.mrr ? `$${company.mrr.toLocaleString()}` : "—"} strip="#8b5cf6" accent="#8b5cf6" icon={<Activity className="h-5 w-5" />} />
              <DarkStat label="Days on Platform" value={daysSince(company.created_at)} strip="#f59e0b" accent="#f59e0b" icon={<Calendar className="h-5 w-5" />} />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Implementation stage */}
              <DarkCard>
                <DarkCardHeader title="Implementation Status" subtitle="Onboarding stage and progress" />
                <div className="px-5 pb-5">
                  <div className="flex items-center gap-2 mb-4">
                    {IMPL_STEPS.map((step, i) => {
                      const done    = i <= implIdx;
                      const current = i === implIdx;
                      return (
                        <div key={step} className="flex flex-1 flex-col items-center gap-1">
                          <div className={`h-2 w-full rounded-full ${done ? "bg-blue-500" : "bg-slate-800"}`} />
                          <span className={`text-[10px] font-medium ${current ? "text-blue-300" : done ? "text-slate-300" : "text-slate-600"}`}>
                            {IMPL_LABELS[step]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {company.notes && (
                    <div className="rounded-lg border border-white/8 bg-slate-900/60 px-3 py-2.5 text-xs text-slate-400">
                      {company.notes}
                    </div>
                  )}
                </div>
              </DarkCard>

              {/* Account info */}
              <DarkCard>
                <DarkCardHeader title="Account Info" subtitle="Contact, CSM, and platform details" />
                <div className="divide-y divide-white/5 px-5 pb-2">
                  {[
                    { label: "Primary Contact", value: company.contact,         icon: <Users className="h-3.5 w-3.5" /> },
                    { label: "Email",            value: company.contact_email,   icon: <Mail className="h-3.5 w-3.5" />  },
                    { label: "Phone",            value: company.contact_phone,   icon: <Phone className="h-3.5 w-3.5" /> },
                    { label: "Headquarters",     value: company.hq,              icon: <MapPin className="h-3.5 w-3.5" /> },
                    { label: "Website",          value: company.website,         icon: <Globe className="h-3.5 w-3.5" />  },
                    { label: "Customer Success", value: company.csm,             icon: <Shield className="h-3.5 w-3.5" /> },
                    { label: "Onboarded",        value: fmtDate(company.created_at), icon: <Calendar className="h-3.5 w-3.5" /> },
                  ].map(row => (
                    <div key={row.label} className="flex items-center gap-3 py-2.5">
                      <span className="text-slate-500">{row.icon}</span>
                      <span className="w-32 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{row.label}</span>
                      <span className="text-xs text-slate-300 truncate">{row.value || "—"}</span>
                    </div>
                  ))}
                </div>
              </DarkCard>
            </div>

            {/* Sites */}
            <DarkCard>
              <DarkCardHeader
                title="Sites"
                subtitle={`${sites.length} registered site${sites.length !== 1 ? "s" : ""}`}
                right={
                  <button
                    onClick={() => alert("Add site coming soon")}
                    className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-white/6"
                  >
                    + Add Site
                  </button>
                }
              />
              {sites.length === 0 ? (
                <p className="px-5 pb-5 text-xs text-slate-500">No sites provisioned — add a site once onboarding begins.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {sites.map(s => (
                    <div key={s.id} className="flex items-center gap-4 px-5 py-3">
                      <MapPin className="h-4 w-4 shrink-0 text-slate-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">{s.name}</div>
                        <div className="text-[11px] text-slate-400">{s.location} · {s.type}</div>
                      </div>
                      <span className="text-xs text-slate-400">{s.users} users</span>
                    </div>
                  ))}
                </div>
              )}
            </DarkCard>
          </div>
        )}

        {/* ── Users ── */}
        {tab === "users" && (
          <div className="space-y-4">
            <DarkCard>
              <DarkCardHeader
                title="Users"
                subtitle={`${activeUsers} active · ${users.filter(u => u.status === "pending").length} pending · ${users.filter(u => u.status === "inactive").length} inactive`}
                right={
                  <button
                    onClick={() => alert(`Invite a new user to ${company.name}`)}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Invite User
                  </button>
                }
              />
              {users.length === 0 ? (
                <div className="px-5 pb-8 pt-4 text-center text-sm text-slate-500">
                  No users provisioned yet.
                  {company.status === "prospect" && " Account is in prospect stage — users are added during onboarding."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-white/5 bg-slate-800/40">
                      <tr>
                        {["Name", "Email", "Role", "Last Active", "Status", ""].map(h => (
                          <th key={h} className={`px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 ${h === "" ? "text-right" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-white/4">
                          <td className="px-4 py-3 font-medium text-white">{u.name}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{u.email}</td>
                          <td className="px-4 py-3 text-xs text-slate-300">{u.role}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(u.lastActive)}</td>
                          <td className="px-4 py-3">
                            <Pill className={USER_STATUS_STYLE[u.status]}>{u.status}</Pill>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => alert(`Manage user ${u.name}`)}
                              className="rounded-lg p-1 text-slate-500 hover:bg-white/6 hover:text-slate-300"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {users.length > 0 && company.users > users.length && (
                <div className="border-t border-white/5 px-5 py-3 text-[11px] text-slate-500">
                  Showing {users.length} of {company.users} users — full roster available in export.
                </div>
              )}
            </DarkCard>
          </div>
        )}

        {/* ── Modules ── */}
        {tab === "modules" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/8 bg-slate-900/40 px-4 py-3 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">Module Access — {company.name}</span>
              {" · "}
              Controls which EHS modules this tenant can access. Platform-level maintenance toggles (Module Control Panel) override these settings.
              {" "}{company.plan === "Starter" ? "Starter plan includes 4 core modules." : company.plan === "Professional" ? "Professional plan includes 7 modules." : "Enterprise plan includes all 10 modules."}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {EHS_MODULES.map((mod) => {
                const meta    = MODULE_META[mod];
                const enabled = modules[mod] ?? false;
                return (
                  <div
                    key={mod}
                    className={`rounded-xl border transition ${
                      enabled ? "border-white/8 bg-slate-900/60" : "border-slate-800/60 bg-slate-900/30"
                    }`}
                  >
                    <div className="flex items-start gap-3 p-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${enabled ? "bg-slate-800" : "bg-slate-900"}`}>
                        {meta.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${enabled ? "text-white" : "text-slate-500"} truncate`}>{meta.label}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            enabled ? "bg-emerald-900/50 text-emerald-400" : "bg-slate-800 text-slate-500"
                          }`}>
                            {enabled ? "On" : "Off"}
                          </span>
                        </div>
                        <p className={`mt-0.5 text-xs leading-snug ${enabled ? "text-slate-500" : "text-slate-600"}`}>{meta.description}</p>
                      </div>
                      {/* Toggle */}
                      <button
                        type="button"
                        onClick={() => toggleModule(mod)}
                        title={enabled ? "Disable for this tenant" : "Enable for this tenant"}
                        className={`relative shrink-0 h-6 w-11 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                          enabled ? "bg-emerald-500" : "bg-slate-700"
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-white/8 bg-slate-900/40 p-4 text-xs text-slate-500">
              <div className="mb-1 font-semibold text-slate-400">{enabledCount} of {EHS_MODULES.length} modules enabled</div>
              Changes take effect immediately for all users at {company.name}. Disabled modules show a &ldquo;Not included in your plan&rdquo; screen.
            </div>
          </div>
        )}

        {/* ── Activity ── */}
        {tab === "activity" && (
          <div className="space-y-4">
            <DarkCard>
              <DarkCardHeader
                title="Recent Activity"
                subtitle={`Last ${events.length} events for ${company.name}`}
                right={
                  <button
                    onClick={() => alert("Export full activity log")}
                    className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-white/6"
                  >
                    <Download className="h-3 w-3" /> Export
                  </button>
                }
              />
              {events.length === 0 ? (
                <div className="px-5 pb-8 pt-4 text-center text-sm text-slate-500">No activity recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-white/5 bg-slate-800/40">
                      <tr>
                        {["Timestamp", "User", "Action", "Module", "Detail"].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {events.map((e, i) => (
                        <tr key={i} className="hover:bg-white/4">
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">{e.ts}</td>
                          <td className="px-4 py-3 text-xs font-medium text-slate-300 whitespace-nowrap">{e.user}</td>
                          <td className="px-4 py-3 text-xs text-slate-300">{e.action}</td>
                          <td className="px-4 py-3">
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">{e.module}</span>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-slate-500">{e.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DarkCard>
          </div>
        )}

      </div>
    </div>
  );
}
