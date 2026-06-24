"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DarkPageHeader, DarkCard, Pill } from "@/components/ui/primitives";
import { X, Search, Trash2 } from "lucide-react";
import { addGlobalLegal, deleteGlobalLegal } from "@/lib/actions/sa";
import type { GlobalLegalItem } from "@/lib/types";

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

function AddRegulationModal({ onClose, onAdded }: { onClose: () => void; onAdded: (ref: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const res = await addGlobalLegal(null, fd);
    setSaving(false);
    if (res.ok) {
      onAdded((fd.get("regulation_ref") as string) || "Regulation");
      onClose();
    } else {
      setError(res.error || "Failed to add regulation.");
    }
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
            <input required name="regulation_ref" placeholder="e.g. OSHA 29 CFR 1910.95"
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm font-mono text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-900/50" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Title <span className="text-red-400">*</span></label>
            <input required name="title" placeholder="Occupational Noise Exposure"
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-900/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Jurisdiction</label>
              <select name="jurisdiction" defaultValue="US Federal"
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none">
                {JURISDICTIONS.map(j => <option key={j}>{j}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Category</label>
              <select name="category" defaultValue="chemical"
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Description</label>
            <textarea name="description" rows={2} placeholder="Short summary of the requirement (optional)"
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-900/50" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Applies To</label>
            <input name="applies_to" placeholder="Comma-separated, e.g. labs, manufacturing, warehouses"
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-900/50" />
            <div className="mt-1 text-[10.5px] text-slate-500">Separate sectors/groups with commas.</div>
          </div>
          {error && <div className="rounded-lg bg-red-900/40 border border-red-800/50 px-3 py-2 text-xs text-red-300">{error}</div>}
          <div className="flex justify-end gap-2 pt-1 border-t border-white/5">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/4">Cancel</button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Adding…" : "Add Regulation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function GlobalLegalClient({ items }: { items: GlobalLegalItem[] }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast]         = useState("");
  const [search, setSearch]       = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [jxFilter, setJxFilter]   = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleDelete(item: GlobalLegalItem) {
    if (!confirm(`Delete "${item.regulation_ref}" from the global register?`)) return;
    setDeletingId(item.id);
    const res = await deleteGlobalLegal(item.id);
    setDeletingId(null);
    if (res.ok) {
      flash(`${item.regulation_ref} removed`);
      router.refresh();
    } else {
      flash(res.error || "Delete failed");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(r => {
      if (catFilter !== "all" && r.category !== catFilter) return false;
      if (jxFilter !== "all" && r.jurisdiction !== jxFilter) return false;
      if (q && !`${r.regulation_ref} ${r.title}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, catFilter, jxFilter]);

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const r of items) counts[r.category] = (counts[r.category] ?? 0) + 1;
    return counts;
  }, [items]);

  const uniqueJx = useMemo(() => {
    const set = new Set<string>();
    for (const r of items) if (r.jurisdiction) set.add(r.jurisdiction);
    return Array.from(set).sort();
  }, [items]);

  return (
    <div className="flex flex-1 flex-col">
      {showModal && <AddRegulationModal onClose={() => setShowModal(false)} onAdded={(ref) => { flash(`${ref} added`); router.refresh(); }} />}
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
            <div className="relative flex-1 min-w-48">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by reference or title…"
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 py-1.5 pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-900/50"
              />
            </div>

            <select
              value={jxFilter}
              onChange={e => setJxFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Jurisdictions</option>
              {uniqueJx.map(j => <option key={j} value={j}>{j}</option>)}
            </select>

            <span className="text-xs text-slate-400">{filtered.length} of {items.length} shown</span>
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
                  <th className="px-4 py-2.5 text-left">Jurisdiction</th>
                  <th className="px-4 py-2.5 text-left">Applies To</th>
                  <th className="px-4 py-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-white/4">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-200">{r.regulation_ref}</td>
                    <td className="px-4 py-3 font-medium text-white max-w-64">{r.title}</td>
                    <td className="px-4 py-3">
                      <Pill className={CAT_STYLE[r.category] ?? "bg-slate-800 text-slate-400"}>{r.category}</Pill>
                    </td>
                    <td className="px-4 py-3">
                      <Pill className="bg-slate-800 text-slate-400 text-xs">{r.jurisdiction || "—"}</Pill>
                    </td>
                    <td className="px-4 py-3">
                      {r.applies_to.length
                        ? r.applies_to.map(a => <Pill key={a} className="bg-slate-800 text-slate-400 mr-1 text-xs">{a}</Pill>)
                        : <span className="text-xs text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(r)}
                        disabled={deletingId === r.id}
                        title="Delete regulation"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-900/40 hover:text-red-300 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                      {items.length === 0
                        ? "No regulations in the global register yet. Add one with the button above."
                        : "No regulations match the current filters."}
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
