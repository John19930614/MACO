"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";
import { useDemoUser } from "@/lib/context/demo-user";

interface Cmd { label: string; href: string; group: string; keywords?: string }

const NAV_COMMANDS: Cmd[] = [
  { label: "Dashboard",               href: "/dashboard",  group: "Navigate", keywords: "home overview command center" },
  { label: "My Workspace",            href: "/workspace",  group: "Navigate", keywords: "tasks assignments my" },
  { label: "Incident Reporting",      href: "/incidents",  group: "Navigate", keywords: "report accident near miss injury" },
  { label: "CAPA Management",         href: "/capa",       group: "Navigate", keywords: "corrective preventive action" },
  { label: "Audits & Assessments",    href: "/audits",     group: "Navigate", keywords: "inspection findings audit" },
  { label: "Legal Register",          href: "/legal",      group: "Navigate", keywords: "regulation compliance requirement law" },
  { label: "Risk Intelligence",       href: "/risk",       group: "Navigate", keywords: "risk assessment hazard" },
  { label: "Training & Competency",   href: "/training",   group: "Navigate", keywords: "course certificate competency" },
  { label: "Documents & Programs",    href: "/documents",  group: "Navigate", keywords: "document policy procedure SOP" },
  { label: "Chemical Management",     href: "/chemicals",  group: "Navigate", keywords: "chemical SDS hazmat inventory" },
  { label: "Biosafety & Lab Safety",  href: "/biosafety",  group: "Navigate", keywords: "lab biosafety containment" },
  { label: "Waste Management",        href: "/waste",      group: "Navigate", keywords: "waste disposal hazardous" },
  { label: "Monitoring & Equipment",  href: "/monitoring", group: "Navigate", keywords: "equipment calibration inspection" },
  { label: "OSHA Logs",               href: "/osha",       group: "Navigate", keywords: "300 301 osha recordable log" },
  { label: "Reports & Analytics",     href: "/reports",    group: "Navigate", keywords: "report export csv analytics" },
  { label: "AI Assistant",            href: "/ai",         group: "Navigate", keywords: "ai findings predictive intelligence" },
  { label: "Settings",                href: "/settings",   group: "Navigate", keywords: "account preferences tenant config" },
];

const SA_COMMANDS: Cmd[] = [
  { label: "Companies & Tenants",     href: "/sa/companies",  group: "SA Admin", keywords: "tenant client onboard" },
  { label: "AI Gateway & Validation", href: "/sa/gateway",    group: "SA Admin", keywords: "gateway validation health reject" },
  { label: "Predictive Model",        href: "/sa/predictive", group: "SA Admin", keywords: "predict model ml" },
  { label: "Global Legal Register",   href: "/sa/globallegal",group: "SA Admin", keywords: "global regulation law template" },
  { label: "Analytics & Insights",    href: "/sa/analytics",  group: "SA Admin", keywords: "analytics platform insights" },
  { label: "Implementation Tracker",  href: "/sa/impl",       group: "SA Admin", keywords: "kanban deploy rollout" },
  { label: "Support & QA",            href: "/sa/support",    group: "SA Admin", keywords: "support ticket qa" },
  { label: "Billing & Subscriptions", href: "/sa/billing",    group: "SA Admin", keywords: "billing mrr subscription revenue" },
  { label: "Security & Audit Log",    href: "/sa/security",   group: "SA Admin", keywords: "security audit log access" },
  { label: "Data Imports",            href: "/sa/imports",    group: "SA Admin", keywords: "import csv upload migrate" },
  { label: "Platform History",        href: "/sa/history",    group: "SA Admin", keywords: "changelog build release version" },
];

export function CommandPalette() {
  const router       = useRouter();
  const { user }     = useDemoUser();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const COMMANDS = useMemo(
    () => [...NAV_COMMANDS, ...(user.is_reliance ? SA_COMMANDS : [])],
    [user.is_reliance],
  );

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return COMMANDS;
    return COMMANDS.filter((c) => `${c.label} ${c.group} ${c.keywords ?? ""}`.toLowerCase().includes(t));
  }, [q, COMMANDS]);

  function go(i: number) {
    const c = results[i];
    if (!c) return;
    setOpen(false);
    router.push(c.href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh] print:hidden" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); go(active); }
            }}
            placeholder="Search SafetyIQ… (pages, modules)"
            className="w-full py-3 text-sm outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">esc</kbd>
        </div>
        <div className="iq-scroll max-h-80 overflow-y-auto py-1">
          {results.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">No matches.</p>}
          {results.map((c, i) => (
            <button
              key={c.href}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(i)}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition ${i === active ? "bg-blue-50" : "hover:bg-slate-50"}`}
            >
              <span className="text-slate-700">{c.label}</span>
              <span className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">{c.group}</span>
                {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-slate-400" />}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
