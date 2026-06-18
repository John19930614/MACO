"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";

interface Cmd { label: string; href: string; group: string; keywords?: string }

const COMMANDS: Cmd[] = [
  { label: "New Safety Cell", href: "/cells/new", group: "Actions", keywords: "create add report" },
  { label: "EXP Intake — AI capture", href: "/intake", group: "Actions", keywords: "interview describe convert" },
  { label: "Map", href: "/map", group: "Operate" },
  { label: "Safety Cells", href: "/cells", group: "Operate", keywords: "list" },
  { label: "Control Proof Ledger", href: "/proof", group: "Operate" },
  { label: "Review Queue", href: "/review", group: "Operate", keywords: "approve accept pending ai" },
  { label: "Activity", href: "/activity", group: "Operate", keywords: "audit history feed" },
  { label: "Causality Map", href: "/causality", group: "Operate" },
  { label: "Prevention Web", href: "/prevention", group: "Operate" },
  { label: "Cell Web", href: "/web", group: "Operate", keywords: "linkage graph" },
  { label: "Cell Web 3D", href: "/web3d", group: "Operate", keywords: "immersive three" },
  { label: "Risk Framework", href: "/framework", group: "Operate", keywords: "six objects precursor control failure behavior event learning intelligence" },
  { label: "Risk Dashboard", href: "/dashboard", group: "Operate" },
  { label: "Trends", href: "/trends", group: "Operate", keywords: "analytics charts" },
  { label: "Reports", href: "/reports", group: "Operate", keywords: "export pdf csv" },
  { label: "Data Space", href: "/data", group: "Operate", keywords: "anatomy integrity database" },
  { label: "Gateway Health", href: "/gateway", group: "Operate", keywords: "status links health" },
  { label: "Risk Forecast", href: "/forecast", group: "ARC", keywords: "predict anticipate forecast leading indicator likely fail next pclss" },
  { label: "ARC Method", href: "/arc", group: "ARC" },
  { label: "Human Signal Layer", href: "/arc/hsl", group: "ARC", keywords: "hsl human" },
  { label: "P-CLSS · EXP · VELA", href: "/arc/intelligence", group: "ARC", keywords: "engine vela exp" },
  { label: "GUS Verticals", href: "/arc/verticals", group: "ARC" },
];

export function CommandPalette() {
  const router = useRouter();
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
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return COMMANDS;
    return COMMANDS.filter((c) => `${c.label} ${c.group} ${c.keywords ?? ""}`.toLowerCase().includes(t));
  }, [q]);

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
            placeholder="Search AMAYA… (pages, actions)"
            className="w-full py-3 text-sm outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">esc</kbd>
        </div>
        <div className="amaya-scroll max-h-80 overflow-y-auto py-1">
          {results.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">No matches.</p>}
          {results.map((c, i) => (
            <button
              key={c.href}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(i)}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${i === active ? "bg-[var(--color-pclss)]/10" : ""}`}
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
