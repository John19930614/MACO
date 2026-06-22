"use client";

import { useState, useMemo } from "react";
import { DarkPageHeader, DarkCard, Pill } from "@/components/ui/primitives";
import { X, Search } from "lucide-react";

interface Regulation {
  ref: string; title: string; jurisdictions: string[]; category: string; tenants: number;
}

const INITIAL: Regulation[] = [
  { ref: "OSHA 29 CFR 1910.1200", title: "Hazard Communication (HazCom/GHS)",         jurisdictions: ["US Federal"],    category: "chemical",  tenants: 4 },
  { ref: "OSHA 29 CFR 1910.1450", title: "Lab Chemical Hygiene Standard",              jurisdictions: ["US Federal"],    category: "chemical",  tenants: 3 },
  { ref: "OSHA 29 CFR 1910.1048", title: "Formaldehyde Standard",                      jurisdictions: ["US Federal"],    category: "chemical",  tenants: 2 },
  { ref: "EPA 40 CFR 262",        title: "RCRA Hazardous Waste Generator",             jurisdictions: ["US Federal"],    category: "waste",     tenants: 4 },
  { ref: "EPA 40 CFR 302",        title: "CERCLA Hazardous Substance Reporting",       jurisdictions: ["US Federal"],    category: "emergency", tenants: 2 },
  { ref: "CDC/NIH BSG",           title: "Biosafety in Microbiological Labs",          jurisdictions: ["US Federal"],    category: "biosafety", tenants: 3 },
  { ref: "NFPA 30",               title: "Flammable & Combustible Liquids Code",       jurisdictions: ["US Federal"],    category: "fire",      tenants: 4 },
  { ref: "ISO 45001:2018",        title: "OHS Management System",                      jurisdictions: ["International"], category: "general",   tenants: 1 },
  { ref: "EU CLP 1272/2008",      title: "Classification, Labelling, Packaging",       jurisdictions: ["EU"],            category: "chemical",  tenants: 0 },
];

const CAT_STYLE: Record<string, string> = {
  chemical:  "bg-red-900/50 text-red-300",
  waste:     "bg-orange-900/50 text-orange-300",
  emergency: "bg-amber-900/50 text-amber-300",
  biosafety: "bg-purple-900/50 text-purple-300",
  fire:      "bg-orange-900/50 text-orange-300",
  general:   "bg-blue-900/50 text-blue-300",
  training:  "bg-emerald-900/50 text-emerald-300",
  air:       "bg-blue-900/50 text-blue-300",
  water:     "bg-blue-900/50 text-blue-300",
};

const JURISDICTIONS = ["US Federal", "EU", "International", "US State", "UK", "Canada", "Australia"];
const CATEGORIES    = ["chemical", "waste", "emergency", "biosafety", "fire", "general", "training", "air", "water"];
const ALL_CATS      = ["all", ...CATEGORIES];

function AddRegulationModal({ onClose, onAdd }: { onClose: () => void; onAdd: (r: Regulation) => void }) {
  const [ref, setRef]         = useState("");
  const [title, setTitle]     = useState("");
  const [jx, setJx]           = useState("US Federal");
  const [category, setCategory] = useState("chemical");
  const [saving, setSaving]   = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ref.trim() || !title.trim()) return;
    setSaving(true);
    setTimeout(() => {
      onAdd({ ref: ref.trim(), title: title.trim(), jurisdictions: [jx], category, tenants: 0 });
      onClose();
    }, 600);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/60 border border-white/8 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div className="text-sm font-bold text-white">Add Regulation</div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/6"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Regulation Reference <span className="text-red-400">*</span></label>
            <input required value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. OSHA 29 CFR 1910.95"
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm font-mono text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-900/50" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Title <span className="text-red-400">*</span></label>
            <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Occupational Noise Exposure"
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-900/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Jurisdiction</label>
              <select value={jx} onChange={e => setJx(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none">
                {JURISDICTIONS.map(j => <option key={j}>{j}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1 border-t border-white/5">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/4">Cancel</button>
            <button type="submit" disabled={saving || !ref.trim() || !title.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Adding…" : "Add Regulation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SAGlobalLegalPage() {
  const [regulations, setRegulations] = useState<Regulation[]>(INITIAL);
  const [showModal, setShowModal]     = useState(false);
  const [toast, setToast]             = useState("");
  const [search, setSearch]           = useState("");
  const [catFilter, setCatFilter]     = useState("all");
  const [jxFilter, setJxFilter]       = useState("all");

  function handleAdd(r: Regulation) {
    setRegulations(prev => [...prev, r]);
    setToast(`${r.ref} added`);
    setTimeout(() => setToast(""), 3000);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return regulations.filter(r => {
      if (catFilter !== "all" && r.category !== catFilter) return false;
      if (jxFilter !== "all" && !r.jurisdictions.includes(jxFilter)) return false;
      if (q && !`${r.ref} ${r.title}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [regulations, search, catFilter, jxFilter]);

  // Category counts for filter badges
  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { all: regulations.length };
    for (const r of regulations) counts[r.category] = (counts[r.category] ?? 0) + 1;
    return counts;
  }, [regulations]);

  const uniqueJx = useMemo(() => {
    const set = new Set<string>();
    for (const r of regulations) for (const j of r.jurisdictions) set.add(j);
    return Array.from(set).sort();
  }, [regulations]);

  return (
    <div className="flex flex-1 flex-col">
      {showModal && <AddRegulationModal onClose={() => setShowModal(false)} onAdd={handleAdd} />}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          ✓ {toast}
        </div>
      )}
      <DarkPageHeader
        title="Global Legal Register"
        subtitle="Master library of regulations used across all tenants"
        actions={
          <button onClick={() => setShowModal(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            + Add Regulation
          </button>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <DarkCard>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-4 py-3">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by reference or title…"
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 py-1.5 pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-900/50"
              />
            </div>

            {/* Jurisdiction filter */}
            <select
              value={jxFilter}
              onChange={e => setJxFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Jurisdictions</option>
              {uniqueJx.map(j => <option key={j} value={j}>{j}</option>)}
            </select>

            <span className="text-xs text-slate-400">{filtered.length} of {regulations.length} shown</span>
          </div>

          {/* Category filter tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-white/5 px-4 py-2">
            {ALL_CATS.filter(c => c === "all" || catCounts[c]).map(cat => (
              <button
                key={cat}
                onClick={() => setCatFilter(cat)}
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize transition ${
                  catFilter === cat
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800/60 text-slate-400 hover:bg-slate-700/60"
                }`}
              >
                {cat} {catCounts[cat] != null ? `(${catCounts[cat]})` : ""}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Reference</th>
                  <th className="px-4 py-2.5 text-left">Title</th>
                  <th className="px-4 py-2.5 text-left">Category</th>
                  <th className="px-4 py-2.5 text-left">Jurisdictions</th>
                  <th className="px-4 py-2.5 text-center">Tenants</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(r => (
                  <tr key={r.ref} className="hover:bg-white/4">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-200">{r.ref}</td>
                    <td className="px-4 py-3 font-medium text-white max-w-64">{r.title}</td>
                    <td className="px-4 py-3">
                      <Pill className={CAT_STYLE[r.category] ?? "bg-slate-800 text-slate-400"}>{r.category}</Pill>
                    </td>
                    <td className="px-4 py-3">
                      {r.jurisdictions.map(j => <Pill key={j} className="bg-slate-800 text-slate-400 mr-1 text-xs">{j}</Pill>)}
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-200">{r.tenants}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                      No regulations match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DarkCard>
      </div>
    </div>
  );
}
