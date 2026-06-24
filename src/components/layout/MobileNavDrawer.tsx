"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useDemoUser } from "@/lib/context/demo-user";
import { canCoordinate, type Role } from "@/lib/constants";

type NavItem = { href: string; label: string; icon: string };
type NavSection = { group: string; items: NavItem[] };

const BASE_NAV: NavSection[] = [
  {
    group: "Overview",
    items: [
      { href: "/dashboard",  label: "Command Center",        icon: "⊞" },
      { href: "/workspace",  label: "My Workspace",          icon: "✓" },
    ],
  },
  {
    group: "Compliance",
    items: [
      { href: "/legal",      label: "Legal Register",        icon: "⚖" },
      { href: "/risk",       label: "Risk Intelligence",     icon: "▲" },
      { href: "/audits",     label: "Audits & Assessments",  icon: "≡" },
      { href: "/capa",       label: "Corrective Actions",    icon: "⚙" },
      { href: "/osha",       label: "OSHA Logs",             icon: "📋" },
    ],
  },
  {
    group: "Operations",
    items: [
      { href: "/training",   label: "Training & Competency", icon: "🎓" },
      { href: "/documents",  label: "Documents & Programs",  icon: "📄" },
      { href: "/chemicals",  label: "Chemical Management",   icon: "⚗" },
      { href: "/biosafety",  label: "Biosafety & Lab Safety",icon: "🔬" },
      { href: "/waste",      label: "Waste Management",      icon: "♻" },
      { href: "/ergonomics", label: "Ergonomics & MSD",      icon: "🪑" },
      { href: "/monitoring", label: "Monitoring & Equipment",icon: "📡" },
      { href: "/incidents",  label: "Incident Reporting",    icon: "⚠" },
    ],
  },
  {
    group: "Insights",
    items: [
      { href: "/ai",         label: "SafetyIQ AI Assistant", icon: "🤖" },
      { href: "/reports",    label: "Reports & Analytics",   icon: "📊" },
    ],
  },
];

const ADMIN_SECTION: NavSection = {
  group: "Admin",
  items: [
    { href: "/team",     label: "Team & Invites",   icon: "👥" },
    { href: "/settings", label: "Company Settings", icon: "⚙" },
  ],
};

// Compact Reliance / superadmin nav so internal users get a usable mobile menu.
const SA_NAV: NavSection[] = [
  {
    group: "🔒 Reliance Internal",
    items: [
      { href: "/sa/modules",     label: "Module Control Panel",   icon: "🔌" },
      { href: "/sa/companies",   label: "Companies & Tenants",    icon: "🏢" },
      { href: "/sa/impl",        label: "Implementation Tracker", icon: "🚀" },
      { href: "/sa/globallegal", label: "Global Legal Register",  icon: "🌍" },
      { href: "/sa/templates",   label: "Template Library",       icon: "📋" },
      { href: "/sa/ai",          label: "AI Model Configuration", icon: "🧠" },
      { href: "/sa/analytics",   label: "Analytics & Insights",   icon: "📊" },
      { href: "/sa/security",    label: "Security & System",      icon: "🔐" },
      { href: "/sa/billing",     label: "Billing & Subscriptions",icon: "💳" },
    ],
  },
  {
    group: "Operate",
    items: [
      { href: "/arc/map",      label: "Site Map",       icon: "🗺" },
      { href: "/cells",        label: "Safety Cells",   icon: "⬡" },
      { href: "/arc/review",   label: "Review Queue",   icon: "📥" },
      { href: "/arc/forecast", label: "Risk Forecast",  icon: "🎯" },
    ],
  },
];

const FIELD_NAV: NavSection[] = [
  {
    group: "My Work",
    items: [
      { href: "/dashboard",  label: "Command Center",        icon: "⊞" },
      { href: "/workspace",  label: "My Workspace",          icon: "✓" },
      { href: "/incidents",  label: "Incident Reporting",    icon: "⚠" },
      { href: "/training",   label: "Training & Competency", icon: "🎓" },
      { href: "/documents",  label: "Documents & Programs",  icon: "📄" },
    ],
  },
];

const VIEWER_NAV: NavSection[] = [
  {
    group: "Read-only Access",
    items: [
      { href: "/dashboard",  label: "Command Center",        icon: "⊞" },
      { href: "/workspace",  label: "My Workspace",          icon: "✓" },
      { href: "/reports",    label: "Reports & Analytics",   icon: "📊" },
      { href: "/documents",  label: "Documents & Programs",  icon: "📄" },
    ],
  },
];

const FIELD_ROLES: readonly Role[] = ["field_officer", "contributor"];

function getNav(role: string, isReliance: boolean): NavSection[] {
  // Reliance / superadmin users get their internal SA nav on mobile too.
  if (isReliance) return SA_NAV;
  const r = role as Role;
  if (r === "viewer") return VIEWER_NAV;
  if (FIELD_ROLES.includes(r)) return FIELD_NAV;
  // Management roles mirror desktop: full company nav INCLUDING the Admin section.
  if (canCoordinate(r)) return [...BASE_NAV, ADMIN_SECTION];
  return BASE_NAV;
}

export function MobileNavDrawer() {
  const [open, setOpen] = useState(false);
  const { user } = useDemoUser();
  const pathname = usePathname();
  const sections = getNav(user.role, user.is_reliance);

  useEffect(() => {
    function onOpen() { setOpen(true); }
    window.addEventListener("open-mobile-nav", onOpen);
    return () => window.removeEventListener("open-mobile-nav", onOpen);
  }, []);

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 md:hidden"
        onClick={() => setOpen(false)}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#1a2d42] text-slate-200 shadow-2xl md:hidden">
        {/* Header */}
        <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-white/10 px-4">
          <div className="flex items-center gap-2">
            <div className="text-[16px] font-extrabold tracking-tight text-white">SafetyIQ</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {sections.map((section) => (
            <div key={section.group} className="mb-4">
              <div className="mb-1 px-3 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                {section.group}
              </div>
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? "bg-blue-600 font-semibold text-white shadow"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="shrink-0 border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {user.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-white">{user.display_name}</div>
              <div className="truncate text-[10px] uppercase tracking-wide text-slate-500">{user.job_title}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
