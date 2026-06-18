"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemoUser, DEMO_USERS, type DemoProfile } from "@/lib/context/demo-user";
import { useState } from "react";

// ── Nav types ─────────────────────────────────────────────────────────────────

type NavItem = {
  href: string;
  label: string;
  icon: string; // Unicode emoji or symbol
  badge?: string;
  badgeType?: "red" | "info" | "warn";
};
type NavSection = { group: string; items: NavItem[]; gold?: boolean };

// ── Customer nav — matches index.html exactly ──────────────────────────────────

const COMPANY_NAV: NavSection[] = [
  {
    group: "Overview",
    items: [
      { href: "/dashboard",  label: "Command Center",          icon: "⊞", badge: "!", badgeType: "warn" },
      { href: "/workspace",  label: "My Workspace",            icon: "✓", badge: "7" },
    ],
  },
  {
    group: "Compliance",
    items: [
      { href: "/legal",      label: "Legal Register",          icon: "⚖" },
      { href: "/risk",       label: "Risk Intelligence",       icon: "▲", badge: "3" },
      { href: "/audits",     label: "Audits & Assessments",    icon: "≡" },
      { href: "/capa",       label: "Corrective Actions",      icon: "⚙", badge: "5" },
    ],
  },
  {
    group: "Operations",
    items: [
      { href: "/training",   label: "Training & Competency",   icon: "🎓" },
      { href: "/documents",  label: "Documents & Programs",    icon: "📄" },
      { href: "/chemicals",  label: "Chemical Management",     icon: "⚗" },
      { href: "/biosafety",  label: "Biosafety & Lab Safety",  icon: "🔬" },
      { href: "/waste",      label: "Waste Management",        icon: "♻" },
      { href: "/monitoring", label: "Monitoring & Equipment",  icon: "📡" },
      { href: "/incidents",  label: "Incident Reporting",      icon: "⚠" },
    ],
  },
  {
    group: "Insights",
    items: [
      { href: "/ai",         label: "AI Findings",             icon: "🧠" },
      { href: "/reports",    label: "Reports & Analytics",     icon: "📊" },
    ],
  },
];

const COMPANY_ADMIN_EXTRA: NavSection[] = [
  {
    group: "Admin",
    items: [
      { href: "/settings",   label: "Company Settings",        icon: "⚙" },
    ],
  },
];

const FIELD_OFFICER_NAV: NavSection[] = [
  {
    group: "My Work",
    items: [
      { href: "/dashboard",  label: "Command Center",          icon: "⊞" },
      { href: "/workspace",  label: "My Workspace",            icon: "✓", badge: "7" },
      { href: "/incidents",  label: "Incident Reporting",      icon: "⚠" },
      { href: "/training",   label: "Training & Competency",   icon: "🎓" },
      { href: "/documents",  label: "Documents & Programs",    icon: "📄" },
      { href: "/monitoring", label: "Monitoring & Equipment",  icon: "📡" },
    ],
  },
];

const VIEWER_NAV: NavSection[] = [
  {
    group: "Read-only Access",
    items: [
      { href: "/dashboard",  label: "Command Center",          icon: "⊞" },
      { href: "/workspace",  label: "My Workspace",            icon: "✓" },
      { href: "/reports",    label: "Reports & Analytics",     icon: "📊" },
      { href: "/documents",  label: "Documents & Programs",    icon: "📄" },
    ],
  },
];

// ── Reliance Internal nav — single section, matches index.html ─────────────────

const SA_NAV: NavSection[] = [
  {
    group: "🔒 Reliance Internal",
    gold: true,
    items: [
      { href: "/sa/companies",   label: "Companies & Tenants",     icon: "🏢", badge: "24", badgeType: "info" },
      { href: "/sa/impl",        label: "Implementation Tracker",  icon: "🚀" },
      { href: "/sa/globallegal", label: "Global Legal Register",   icon: "🌍" },
      { href: "/sa/templates",   label: "Template Library",        icon: "📋" },
      { href: "/sa/ai",          label: "AI Model Configuration",  icon: "🧠" },
      { href: "/gateway",        label: "AI Gateway & Validation", icon: "🔒", badge: "live", badgeType: "info" },
      { href: "/sa/imports",     label: "Data Imports",            icon: "📥" },
      { href: "/sa/analytics",   label: "Analytics & Insights",    icon: "📊" },
      { href: "/sa/support",     label: "Support & QA",            icon: "🛠", badge: "7" },
      { href: "/sa/history",     label: "Build History",           icon: "📜" },
      { href: "/sa/security",    label: "Security & System",       icon: "🔐" },
      { href: "/sa/billing",     label: "Billing & Subscriptions", icon: "💳" },
    ],
  },
];

function getNav(user: DemoProfile): NavSection[] {
  if (user.is_reliance) return SA_NAV;
  if (user.role === "viewer") return VIEWER_NAV;
  if (user.role === "field_officer") return FIELD_OFFICER_NAV;
  if (user.role === "admin") return [...COMPANY_NAV, ...COMPANY_ADMIN_EXTRA];
  return COMPANY_NAV;
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

// ── Demo user switcher ─────────────────────────────────────────────────────────

function DemoSwitcher() {
  const { user, setUser } = useDemoUser();
  const [open, setOpen] = useState(false);
  const initials = user.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  return (
    <div className="relative border-t border-white/[0.07] mt-2 px-3.5 py-3.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-[9px] bg-white/[0.07] px-2.5 py-2 transition hover:bg-white/10"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-[11px] font-extrabold text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-[12px] font-bold text-white">{user.display_name}</div>
          <div className="text-[10px] text-white/40">{getRoleBadge(user)}</div>
        </div>
        <ChevronDown className={cn("h-3 w-3 shrink-0 text-white/30 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-1 overflow-hidden rounded-xl border border-white/10 bg-[#0f1e2e] shadow-2xl">
          <div className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-white/25">
            Demo — Switch User
          </div>
          {DEMO_USERS.map((u) => {
            const ini = u.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2);
            return (
              <button
                key={u.id}
                onClick={() => { setUser(u); setOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-white/8",
                  u.id === user.id ? "bg-blue-600/25 text-white" : "text-white/60",
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-[10px] font-bold">
                  {ini}
                </span>
                <span className="flex-1 truncate text-[12px]">{u.display_name}</span>
                <span className="shrink-0 text-[9.5px] text-white/30">{getRoleBadge(u)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main LeftNav ───────────────────────────────────────────────────────────────

export function LeftNav() {
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
                    "mx-2 mt-0.5 flex items-center gap-2.5 rounded-lg px-3 py-[8px] text-[13px] font-medium transition-colors",
                    active
                      ? "bg-blue-600 font-semibold text-white shadow-[0_2px_8px_rgba(37,99,235,0.4)]"
                      : "text-white/58 hover:bg-[#2a4060] hover:text-white/90",
                  )}
                >
                  <span className="w-[18px] shrink-0 text-center text-[15px] leading-none">
                    {item.icon}
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <Badge text={item.badge} type={item.badgeType ?? "red"} />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <DemoSwitcher />
    </nav>
  );
}
