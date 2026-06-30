"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Chemical } from "@/lib/types";
import { Pill } from "@/components/ui/primitives";
import { getStorageClassName } from "@/lib/chemicalRefData";
import { updateSdsUrl } from "@/lib/actions/ehs";
import { X, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { GhsLabelButton } from "./GhsLabelButton";

// ── Constants ──────────────────────────────────────────────────────────────────

const HIGH_HAZARD_H = ["H350", "H351", "H300", "H310", "H311", "H330", "H331"];

type CategoryKey =
  | "all" | "flammable" | "corrosive" | "toxic" | "oxidizer"
  | "irritant" | "gas" | "biological" | "other";

const CATEGORIES: { key: CategoryKey; label: string; color: string }[] = [
  { key: "all",        label: "All",            color: "bg-slate-600 text-white" },
  { key: "flammable",  label: "Flammable",      color: "bg-amber-500 text-white" },
  { key: "corrosive",  label: "Corrosive",      color: "bg-orange-500 text-white" },
  { key: "toxic",      label: "Toxic",          color: "bg-red-600 text-white" },
  { key: "oxidizer",   label: "Oxidizer",       color: "bg-yellow-500 text-white" },
  { key: "irritant",   label: "Irritant",       color: "bg-lime-600 text-white" },
  { key: "gas",        label: "Compressed Gas", color: "bg-sky-500 text-white" },
  { key: "biological", label: "Biological",     color: "bg-teal-600 text-white" },
  { key: "other",      label: "Other",          color: "bg-slate-400 text-white" },
];

const INACTIVE_CAT = "rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap";
const ACTIVE_CAT   = (color: string) => `rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${color}`;

// ── Helpers ────────────────────────────────────────────────────────────────────

function deriveCategory(c: Chemical): CategoryKey {
  const sc = c.storage_class ?? "";
  if (sc === "FLAMMABLE" || sc === "COMBUSTIBLE") return "flammable";
  if (sc === "CORROSIVE_ACID" || sc === "CORROSIVE_BASE") return "corrosive";
  if (sc === "TOXIC") return "toxic";
  if (sc === "OXIDIZER" || sc === "OXIDIZER_GAS") return "oxidizer";
  if (sc === "IRRITANT") return "irritant";
  if (sc === "COMPRESSED_GAS") return "gas";
  if (sc === "WATER_REACTIVE" || sc === "EXPLOSIVE" || sc === "SEPARATE_REVIEW") return "other";
  // No GHS data → likely biological / low-hazard
  if (!c.ghs_classes || c.ghs_classes.length === 0) return "biological";
  return "other";
}

function sdsStatus(c: Chemical): "on_file" | "expiring" | "expired" | "missing" {
  if (!c.sds_url) return "missing";
  if (!c.sds_expiry) return "on_file";
  const exp = new Date(c.sds_expiry);
  const now = new Date();
  if (exp < now) return "expired";
  if (exp.getTime() - now.getTime() < 90 * 24 * 60 * 60 * 1000) return "expiring";
  return "on_file";
}

function primaryHazard(c: Chemical): string {
  const h = c.hazard_statements;
  if (h.some((x) => x.startsWith("H350") || x.startsWith("H351"))) return "Carcinogen";
  if (h.some((x) => x.startsWith("H300") || x.startsWith("H310") || x.startsWith("H330") || x.startsWith("H331"))) return "Acute Toxic";
  if (h.some((x) => x.startsWith("H271") || x.startsWith("H272"))) return "Oxidizer";
  if (h.some((x) => x.startsWith("H290") || x.startsWith("H314"))) return "Corrosive";
  if (h.some((x) => x.startsWith("H224") || x.startsWith("H225") || x.startsWith("H226"))) return "Flammable";
  if (h.some((x) => x.startsWith("H302") || x.startsWith("H312") || x.startsWith("H332"))) return "Harmful";
  if (h.some((x) => x.startsWith("H280") || x.startsWith("H281"))) return "Compressed Gas";
  if (h.some((x) => x.startsWith("H360") || x.startsWith("H361"))) return "Repro. Hazard";
  if (h.some((x) => x.startsWith("H400") || x.startsWith("H410"))) return "Aquatic Toxic";
  if (h.length === 0) return "Low Hazard";
  return "Hazardous";
}

const HAZARD_COLOR: Record<string, string> = {
  "Carcinogen":    "bg-red-100 text-red-700",
  "Acute Toxic":   "bg-red-100 text-red-700",
  "Oxidizer":      "bg-orange-100 text-orange-700",
  "Corrosive":     "bg-orange-100 text-orange-700",
  "Flammable":     "bg-amber-100 text-amber-700",
  "Harmful":       "bg-yellow-100 text-yellow-700",
  "Compressed Gas":"bg-sky-100 text-sky-700",
  "Repro. Hazard": "bg-purple-100 text-purple-700",
  "Aquatic Toxic": "bg-blue-100 text-blue-700",
  "Low Hazard":    "bg-emerald-50 text-emerald-600",
  "Hazardous":     "bg-slate-100 text-slate-600",
};

const SDS_STYLE = { on_file: "bg-emerald-100 text-emerald-700", expiring: "bg-amber-100 text-amber-700", expired: "bg-red-100 text-red-700", missing: "bg-slate-100 text-slate-500" };
const SDS_LABEL = { on_file: "On File", expiring: "Expiring", expired: "Expired", missing: "Missing" };

// ── Group type ─────────────────────────────────────────────────────────────────

interface ChemGroup {
  key: string;
  name: string;
  cas_number: string | null;
  representative: Chemical;   // first item — used for hazard / SDS display
  items: Chemical[];
  category: CategoryKey;
  hazard: string;
  isHighHazard: boolean;
}

// ── SDS Modal ──────────────────────────────────────────────────────────────────

function SdsModal({ chemical, onClose }: { chemical: Chemical; onClose: () => void }) {
  const [url, setUrl]       = useState(chemical.sds_url ?? "");
  const [expiry, setExpiry] = useState(chemical.sds_expiry?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setSaving(true);
    await updateSdsUrl(chemical.id, url, expiry || null);
    setSaved(true);
    setSaving(false);
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-sm font-bold text-slate-800">Link Safety Data Sheet</div>
            <div className="text-xs text-slate-500 mt-0.5">{chemical.name}</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSave}>
          <div className="space-y-4 px-5 py-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                SDS URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://supplier.com/sds/chemical.pdf"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                SDS Expiry Date <span className="text-slate-300">(optional)</span>
              </label>
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !url.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saved ? "Saved!" : saving ? "Saving…" : "Save SDS Link"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Expanded container rows ────────────────────────────────────────────────────

function ContainerRow({ c, onSdsClick }: { c: Chemical; onSdsClick: (c: Chemical) => void }) {
  const status = sdsStatus(c);
  return (
    <tr className="bg-slate-50/70 border-slate-100">
      <td className="pl-10 pr-4 py-2 text-xs text-slate-600">
        <Link href={`/chemicals/${c.id}`} className="text-blue-600 hover:underline font-medium">
          View record
        </Link>
      </td>
      <td className="px-4 py-2 text-xs text-slate-400 tabular-nums">{c.cas_number ?? "—"}</td>
      <td className="px-4 py-2 text-xs text-slate-700 tabular-nums font-medium whitespace-nowrap">
        {c.quantity} {c.unit}
      </td>
      <td className="px-4 py-2 text-xs text-slate-500 max-w-56">
        <div>{c.storage_location}</div>
        {c.storage_class && (
          <span className="text-[10px] text-slate-400">{getStorageClassName(c.storage_class)}</span>
        )}
      </td>
      <td className="px-4 py-2" colSpan={2}>
        <div className="flex items-center gap-2">
          <Pill className={SDS_STYLE[status]}>{SDS_LABEL[status]}</Pill>
          {c.sds_url && (
            <a href={c.sds_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {(status === "missing" || status === "expired") && (
            <button
              onClick={() => onSdsClick(c)}
              className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
            >
              Link SDS
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-2">
        {c.is_scheduled && <Pill className="bg-orange-100 text-orange-700">Scheduled</Pill>}
      </td>
      <td className="px-4 py-2">
        <GhsLabelButton chemical={c} />
      </td>
    </tr>
  );
}

// ── Group row (parent) ─────────────────────────────────────────────────────────

function GroupRow({
  group,
  expanded,
  onToggle,
  onSdsClick,
}: {
  group: ChemGroup;
  expanded: boolean;
  onToggle: () => void;
  onSdsClick: (c: Chemical) => void;
}) {
  const rep = group.representative;
  const hazard = group.hazard;
  const sdsStatuses = group.items.map(sdsStatus);
  const hasMissing  = sdsStatuses.some((s) => s === "missing" || s === "expired");
  const hasOnFile   = sdsStatuses.some((s) => s === "on_file");
  const overallSds  = hasMissing ? "missing" : hasOnFile ? "on_file" : "expiring";

  return (
    <>
      {/* Parent row */}
      <tr
        className={`cursor-pointer hover:bg-blue-50/40 transition-colors ${expanded ? "bg-blue-50/30" : ""}`}
        onClick={onToggle}
      >
        {/* Expand toggle + name */}
        <td className="px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 text-slate-400">
              {expanded
                ? <ChevronDown className="h-4 w-4 text-blue-500" />
                : <ChevronRight className="h-4 w-4" />}
            </span>
            <div>
              <div className="font-semibold text-slate-800 text-sm leading-snug">{group.name}</div>
              {rep.chemical_formula && (
                <div className="text-xs text-slate-400">{rep.chemical_formula}</div>
              )}
            </div>
          </div>
        </td>

        {/* CAS */}
        <td className="px-4 py-3 text-xs text-slate-500 tabular-nums">{group.cas_number ?? "—"}</td>

        {/* Container count */}
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            {group.items.length} container{group.items.length !== 1 ? "s" : ""}
          </span>
        </td>

        {/* Location summary */}
        <td className="px-4 py-3 text-xs text-slate-500 max-w-48">
          {rep.storage_class && (
            <Pill className="bg-slate-100 text-slate-600 text-[10px]">
              {getStorageClassName(rep.storage_class)}
            </Pill>
          )}
          {group.items.length > 1 && (
            <div className="mt-0.5 text-[10px] text-slate-400">
              {new Set(group.items.map((i) => i.storage_location)).size} location{new Set(group.items.map((i) => i.storage_location)).size !== 1 ? "s" : ""}
            </div>
          )}
        </td>

        {/* Hazard */}
        <td className="px-4 py-3">
          <Pill className={HAZARD_COLOR[hazard] ?? "bg-slate-100 text-slate-600"}>{hazard}</Pill>
        </td>

        {/* SDS summary */}
        <td className="px-4 py-3">
          <Pill className={SDS_STYLE[overallSds]}>{SDS_LABEL[overallSds]}</Pill>
          {hasMissing && hasOnFile && (
            <div className="mt-0.5 text-[10px] text-amber-600">
              {sdsStatuses.filter((s) => s === "missing" || s === "expired").length} missing
            </div>
          )}
        </td>

        {/* Flags */}
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {group.items.some((i) => i.is_scheduled) && (
              <Pill className="bg-orange-100 text-orange-700">Scheduled</Pill>
            )}
            {group.isHighHazard && (
              <Pill className="bg-red-100 text-red-700">High-Hazard</Pill>
            )}
            {!group.isHighHazard && !group.items.some((i) => i.is_scheduled) && (
              <span className="text-xs text-slate-300">—</span>
            )}
          </div>
        </td>

        {/* Label (on representative) */}
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <GhsLabelButton chemical={rep} />
        </td>
      </tr>

      {/* Expanded container rows */}
      {expanded && group.items.map((c) => (
        <ContainerRow key={c.id} c={c} onSdsClick={onSdsClick} />
      ))}

      {/* Subtle separator after collapsed group */}
      {!expanded && (
        <tr className="h-0">
          <td colSpan={8} className="border-b border-slate-100 p-0" />
        </tr>
      )}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ChemicalsTable({ chemicals }: { chemicals: Chemical[] }) {
  const [search, setSearch]         = useState("");
  const [hazardFilter, setHazardFilter] = useState<"all" | "high" | "scheduled">("all");
  const [category, setCategory]     = useState<CategoryKey>("all");
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  const [sdsModal, setSdsModal]     = useState<Chemical | null>(null);

  function toggleGroup(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // Build groups first, then filter
  const groups = useMemo<ChemGroup[]>(() => {
    const map = new Map<string, Chemical[]>();
    for (const c of chemicals) {
      const key = `${c.name.trim().toLowerCase()}||${c.cas_number ?? ""}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.values()).map((items) => {
      const rep = items[0];
      const hazard = primaryHazard(rep);
      return {
        key: `${rep.name.trim().toLowerCase()}||${rep.cas_number ?? ""}`,
        name: rep.name,
        cas_number: rep.cas_number ?? null,
        representative: rep,
        items,
        category: deriveCategory(rep),
        hazard,
        isHighHazard: items.some((c) =>
          c.hazard_statements.some((h) => HIGH_HAZARD_H.some((hh) => h.startsWith(hh)))
        ),
      };
    });
  }, [chemicals]);

  // Category counts
  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { all: groups.length };
    for (const g of groups) {
      counts[g.category] = (counts[g.category] ?? 0) + 1;
    }
    return counts;
  }, [groups]);

  const filtered = useMemo(() => {
    let list = groups;

    // Category filter
    if (category !== "all") list = list.filter((g) => g.category === category);

    // Hazard filter
    if (hazardFilter === "high") list = list.filter((g) => g.isHighHazard);
    if (hazardFilter === "scheduled") list = list.filter((g) => g.items.some((c) => c.is_scheduled));

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.cas_number ?? "").includes(q) ||
          g.items.some(
            (c) =>
              c.storage_location.toLowerCase().includes(q) ||
              (c.supplier ?? "").toLowerCase().includes(q)
          )
      );
    }

    return list;
  }, [groups, category, hazardFilter, search]);

  const totalContainers = filtered.reduce((s, g) => s + g.items.length, 0);

  return (
    <>
      {sdsModal && <SdsModal chemical={sdsModal} onClose={() => setSdsModal(null)} />}

      {/* Category tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-100 px-4 py-3 scrollbar-none">
        {CATEGORIES.filter((cat) => cat.key === "all" || (catCounts[cat.key] ?? 0) > 0).map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={category === cat.key ? ACTIVE_CAT(cat.color) : INACTIVE_CAT}
          >
            {cat.label}
            <span className={`ml-1.5 text-[10px] font-bold ${category === cat.key ? "opacity-80" : "text-slate-400"}`}>
              {catCounts[cat.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search + hazard filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <input
          className="h-8 flex-1 min-w-48 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
          placeholder="Search name, CAS, location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1.5">
          {(["all", "high", "scheduled"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setHazardFilter(v)}
              className={
                hazardFilter === v
                  ? "rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              }
            >
              {v === "all" ? "All" : v === "high" ? "High-Hazard" : "Scheduled"}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400">
          {filtered.length} chemical{filtered.length !== 1 ? "s" : ""} · {totalContainers} container{totalContainers !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5 text-left">Chemical Name</th>
              <th className="px-4 py-2.5 text-left">CAS #</th>
              <th className="px-4 py-2.5 text-left">Containers</th>
              <th className="px-4 py-2.5 text-left">Storage</th>
              <th className="px-4 py-2.5 text-left">Hazard</th>
              <th className="px-4 py-2.5 text-left">SDS</th>
              <th className="px-4 py-2.5 text-left">Flags</th>
              <th className="px-4 py-2.5 text-left">Label</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((group) => (
              <GroupRow
                key={group.key}
                group={group}
                expanded={expanded.has(group.key)}
                onToggle={() => toggleGroup(group.key)}
                onSdsClick={setSdsModal}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                  No chemicals match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
