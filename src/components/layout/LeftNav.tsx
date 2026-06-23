"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemoUser, type DemoProfile } from "@/lib/context/demo-user";
import { MOCK_MODE } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import type { ServerUser } from "@/lib/auth/types";

// ── Nav types ─────────────────────────────────────────────────────────────────

type NavItem = {
  href: string;
  label: string;
  description?: string;
  icon: string; // Unicode emoji or symbol
  badge?: string;
  badgeType?: "red" | "info" | "warn";
};
type NavSection = { group: string; items: NavItem[]; gold?: boolean };

// ── Customer nav — matches index.html exactly ──────────────────────────────────

const BASE_COMPANY_NAV: NavSection[] = [
  {
    group: "Overview",
    items: [
      { href: "/dashboard",  label: "Command Center",          description: "Live status & KPIs",             icon: "⊞" },
      { href: "/workspace",  label: "My Workspace",            description: "Tasks & assigned items",         icon: "✓" },
    ],
  },
  {
    group: "Compliance",
    items: [
      { href: "/legal",      label: "Legal Register",          description: "Regulations & obligations",      icon: "⚖" },
      { href: "/risk",       label: "Risk Intelligence",       description: "Risk register & scores",         icon: "▲" },
      { href: "/audits",     label: "Audits & Assessments",    description: "Scheduled audit programs",       icon: "≡" },
      { href: "/capa",       label: "Corrective Actions",      description: "CAPA tracking & closure",        icon: "⚙" },
      { href: "/osha",       label: "OSHA Logs",               description: "300/301 injury & illness logs",  icon: "📋" },
    ],
  },
  {
    group: "Operations",
    items: [
      { href: "/training",   label: "Training & Competency",   description: "Staff training records",         icon: "🎓" },
      { href: "/documents",  label: "Documents & Programs",    description: "SOPs & safety programs",         icon: "📄" },
      { href: "/chemicals",  label: "Chemical Management",     description: "SDS, inventory & exposure",      icon: "⚗" },
      { href: "/biosafety",  label: "Biosafety & Lab Safety",  description: "BSL protocols & cabinets",       icon: "🔬" },
      { href: "/waste",      label: "Waste Management",        description: "Hazardous waste streams",        icon: "♻" },
      { href: "/ergonomics", label: "Ergonomics & MSD",         description: "Workstation & MSD risk controls",icon: "🪑" },
      { href: "/monitoring", label: "Monitoring & Equipment",  description: "Calibration & inspections",      icon: "📡" },
      { href: "/incidents",  label: "Incident Reporting",      description: "Near-miss & injury reports",     icon: "⚠" },
    ],
  },
  {
    group: "Insights",
    items: [
      { href: "/ai",         label: "Amaya AI Assistant",      description: "Ask anything about your EHS",   icon: "🤖" },
      { href: "/reports",    label: "Reports & Analytics",     description: "Dashboards & exports",           icon: "📊" },
    ],
  },
];

const COMPANY_ADMIN_EXTRA: NavSection[] = [
  {
    group: "Admin",
    items: [
      { href: "/team",       label: "Team & Invites",          description: "Members, roster & invites",     icon: "👥" },
      { href: "/settings",   label: "Company Settings",        description: "Users, roles & preferences",    icon: "⚙" },
    ],
  },
];

const FIELD_OFFICER_NAV: NavSection[] = [
  {
    group: "My Work",
    items: [
      { href: "/dashboard",  label: "Command Center",          description: "Live status & KPIs",             icon: "⊞" },
      { href: "/workspace",  label: "My Workspace",            description: "Tasks & assigned items",         icon: "✓" },
      { href: "/incidents",  label: "Incident Reporting",      description: "Near-miss & injury reports",     icon: "⚠" },
      { href: "/ergonomics", label: "Ergonomics & MSD",         description: "Level 1 self-screening",         icon: "🪑" },
      { href: "/training",   label: "Training & Competency",   description: "Staff training records",         icon: "🎓" },
      { href: "/documents",  label: "Documents & Programs",    description: "SOPs & safety programs",         icon: "📄" },
      { href: "/monitoring", label: "Monitoring & Equipment",  description: "Calibration & inspections",      icon: "📡" },
    ],
  },
];

const VIEWER_NAV: NavSection[] = [
  {
    group: "Read-only Access",
    items: [
      { href: "/dashboard",  label: "Command Center",          description: "Live status & KPIs",             icon: "⊞" },
      { href: "/workspace",  label: "My Workspace",            description: "Tasks & assigned items",         icon: "✓" },
      { href: "/reports",    label: "Reports & Analytics",     description: "Dashboards & exports",           icon: "📊" },
      { href: "/documents",  label: "Documents & Programs",    description: "SOPs & safety programs",         icon: "📄" },
    ],
  },
];

// ── Reliance Internal nav ──────────────────────────────────────────────────────

const SA_NAV: NavSection[] = [
  {
    group: "🔒 Reliance Internal",
    gold: true,
    items: [
      { href: "/sa/modules",     label: "Module Control Panel",    description: "Enable / disable EHS modules",  icon: "🔌" },
      { href: "/sa/companies",   label: "Companies & Tenants",     description: "Manage client accounts",        icon: "🏢" },
      { href: "/sa/impl",        label: "Implementation Tracker",  description: "Onboarding progress",           icon: "🚀" },
      { href: "/sa/globallegal", label: "Global Legal Register",   description: "Multi-jurisdiction library",    icon: "🌍" },
      { href: "/sa/templates",   label: "Template Library",        description: "Shared content templates",      icon: "📋" },
      { href: "/sa/ai",          label: "AI Model Configuration",  description: "Prompt & model tuning",         icon: "🧠" },
      { href: "/sa/gateway",     label: "AI Gateway — EHS Validation", description: "3-gate EHS data validation + Nothing Missed", icon: "🔎" },
      { href: "/sa/guardrails",  label: "Guardrails",              description: "AI autonomy & risk rules",      icon: "🛡" },
      { href: "/sa/predictive",  label: "Predictive Model",        description: "Predictive engine settings",    icon: "📈" },
      { href: "/sa/imports",     label: "Data Imports",            description: "Bulk data ingestion",           icon: "📥" },
      { href: "/sa/analytics",   label: "Analytics & Insights",    description: "Platform-wide metrics",         icon: "📊" },
      { href: "/sa/support",     label: "Support & QA",            description: "Tickets & QA checks",          icon: "🛠" },
      { href: "/sa/history",     label: "Build History",           description: "Deployment & version log",      icon: "📜" },
      { href: "/sa/security",    label: "Security & System",       description: "Audit log & access controls",   icon: "🔐" },
      { href: "/sa/billing",     label: "Billing & Subscriptions", description: "Plans & invoicing",             icon: "💳" },
    ],
  },
  {
    group: "Operate",
    items: [
      { href: "/arc/map",        label: "Site Map",                description: "Facility & location hierarchy", icon: "🗺" },
      { href: "/cells",          label: "Safety Cells",            description: "Cell network overview",         icon: "⬡" },
      { href: "/arc/proof",      label: "Control Proof Ledger",    description: "Evidence & attestations",       icon: "🛡" },
      { href: "/arc/review",     label: "Review Queue",            description: "Pending approvals",             icon: "📥" },
      { href: "/arc/activity",   label: "Activity",                description: "Recent platform actions",       icon: "🕐" },
      { href: "/arc/causality",  label: "Causality & Prevention",  description: "Causal chains & prevention paths", icon: "🕸" },
      { href: "/arc/graph",      label: "Cell Web 3D",             description: "3D cell network graph",         icon: "◎" },
      { href: "/arc/framework",  label: "Risk Framework",          description: "Framework configuration",       icon: "⬛" },
      { href: "/arc/rdash",      label: "Risk Dashboard",          description: "Risk KPIs & trends",            icon: "📊" },
      { href: "/arc/trends",     label: "Trends",                  description: "Historical trend analysis",     icon: "📈" },
      { href: "/arc/reports",    label: "Reports",                 description: "ARC report generation",         icon: "📄" },
      { href: "/arc/data",       label: "Data Space",              description: "Raw data exploration",          icon: "🗄" },
      { href: "/arc/gateway",    label: "Gateway Health",          description: "Integration status",            icon: "⚡", badge: "live", badgeType: "info" },
      { href: "/sa/wiring",     label: "Signal Wiring Board",     description: "Live system connection map",     icon: "⬡" },
    ],
  },
  {
    group: "ARC — Adaptive Risk Continuum",
    items: [
      { href: "/arc/forecast",      label: "Risk Forecast",        description: "Predictive risk outlook",       icon: "🎯" },
      { href: "/arc/intake",        label: "EXP Intake",           description: "Experience capture form",       icon: "✨" },
      { href: "/arc/method",        label: "ARC Method",           description: "Methodology reference",         icon: "🔀" },
      { href: "/arc/hsl",           label: "Human Signal Layer",   description: "Behavioral & sentiment signals",icon: "💓" },
      { href: "/arc/intelligence",  label: "P-CLSS · EXP · VELA", description: "Intelligence modules",          icon: "🧬" },
      { href: "/arc/verticals",     label: "GUS Verticals",        description: "Industry vertical configs",     icon: "📦" },
    ],
  },
];

function getNav(user: DemoProfile): NavSection[] {
  if (user.is_reliance) return SA_NAV;
  if (user.role === "viewer") return VIEWER_NAV;
  if (user.role === "field_officer") return FIELD_OFFICER_NAV;
  if (user.role === "admin") return [...BASE_COMPANY_NAV, ...COMPANY_ADMIN_EXTRA];
  return BASE_COMPANY_NAV;
}

function getRoleBadge(user: DemoProfile): string {
  if (user.is_reliance) return "Platform Admin";
  const map: Record<string, string> = {
    admin:           "Company Admin",
    ehs_manager:     "EHS Manager",
    ehs_coordinator: "EHS Coordinator",
    field_officer:   "Field Officer",
    viewer:          "Viewer",
  };
  return map[user.role] ?? user.role;
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function Badge({ text, type = "red" }: { text: string; type?: "red" | "info" | "warn" }) {
  const bg =
    type === "info" ? "bg-blue-600"
    : type === "warn" ? "bg-amber-500"
    : "bg-red-500";
  return (
    <span className={`ml-auto flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-px text-[9.5px] font-extrabold text-white ${bg}`}>
      {text}
    </span>
  );
}

// ── User panel (sign out only — no switching) ─────────────────────────────────

function UserPanel({ serverUser }: { serverUser?: ServerUser | null }) {
  const { user: demoUser } = useDemoUser();
  const router = useRouter();

  const displayName = serverUser?.display_name ?? demoUser.display_name;
  const roleLabel   = serverUser?.job_title ?? getRoleBadge(demoUser);
  const initials    = displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  async function signOut() {
    if (!MOCK_MODE) {
      const supabase = createClient();
      if (supabase) await supabase.auth.signOut();
    }
    document.cookie = "maco-mock-tenant=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "maco-mock-profile=; path=/; max-age=0; SameSite=Lax";
    localStorage.removeItem("maco-logged-in");
    localStorage.removeItem("maco-demo-user");
    router.push("/login");
  }

  return (
    <div className="border-t border-white/[0.07] mt-2 px-3.5 py-3.5">
      <div className="flex items-center gap-2.5 rounded-[9px] bg-white/[0.07] px-2.5 py-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-[11px] font-extrabold text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-bold text-white">{displayName}</div>
          <div className="text-[10px] text-white/40">{roleLabel}</div>
        </div>
        <button
          onClick={signOut}
          title="Sign out"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/25 transition hover:text-red-400 hover:bg-red-400/10"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Main LeftNav ───────────────────────────────────────────────────────────────

interface LeftNavProps {
  openCapas?: number;
  openRisks?: number;
  pendingTasks?: number;
  serverUser?: ServerUser | null;
}

export function LeftNav({ openCapas = 0, openRisks = 0, pendingTasks = 0, serverUser }: LeftNavProps) {
  const { user } = useDemoUser();
  const pathname = usePathname();
  const sections = getNav(user);

  return (
    <nav className="flex h-full w-60 shrink-0 flex-col bg-[#1a2d42] text-slate-200 print:hidden">
      <div className="iq-scroll flex-1 overflow-y-auto pb-2 pt-2">
        {sections.map((section) => (
          <div key={section.group}>
            <div
              className="px-3.5 pb-1 pt-5 text-[10px] font-bold uppercase tracking-[1.2px]"
              style={{ color: section.gold ? "rgba(253,224,71,0.6)" : "rgba(255,255,255,0.32)" }}
            >
              {section.group}
            </div>
            {section.items.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "mx-2 mt-0.5 flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium transition-colors",
                    active
                      ? "bg-blue-600 font-semibold text-white shadow-[0_2px_8px_rgba(37,99,235,0.4)]"
                      : "text-white/58 hover:bg-[#2a4060] hover:text-white/90",
                  )}
                >
                  <span className="w-[18px] shrink-0 text-center text-[15px] leading-none">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate leading-tight">{item.label}</span>
                    {item.description && (
                      <span className={cn(
                        "block truncate text-[10px] font-normal leading-tight mt-[1px]",
                        active ? "text-white/60" : "text-white/30",
                      )}>
                        {item.description}
                      </span>
                    )}
                  </span>
                  {item.badge && (
                    <Badge text={item.badge} type={item.badgeType ?? "red"} />
                  )}
                  {item.href === "/workspace"  && pendingTasks > 0  && <Badge text={String(pendingTasks)} />}
                  {item.href === "/capa"       && openCapas > 0     && <Badge text={String(openCapas)} />}
                  {item.href === "/risk"       && openRisks > 0     && <Badge text={String(openRisks)} />}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <UserPanel serverUser={serverUser} />
    </nav>
  );
}
