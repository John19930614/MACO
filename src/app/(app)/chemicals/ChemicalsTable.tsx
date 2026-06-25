"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Chemical } from "@/lib/types";
import { Pill } from "@/components/ui/primitives";
import { updateSdsUrl } from "@/lib/actions/ehs";
import { X, ExternalLink } from "lucide-react";
import { GhsLabelButton } from "./GhsLabelButton";

const HIGH_HAZARD_H = ["H350", "H351", "H300", "H310", "H311", "H330", "H331"];

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
  if (h.some((x) => x.startsWith("H300") || x.startsWith("H310") || x.startsWith("H330") || x.startsWith("H331")))
    return "Acute Toxic";
  if (h.some((x) => x.startsWith("H271") || x.startsWith("H272"))) return "Oxidizer";
  if (h.some((x) => x.startsWith("H290") || x.startsWith("H314"))) return "Corrosive";
  if (h.some((x) => x.startsWith("H224") || x.startsWith("H225") || x.startsWith("H226"))) return "Flammable";
  if (h.some((x) => x.startsWith("H302") || x.startsWith("H312") || x.startsWith("H332"))) return "Harmful";
  if (h.some((x) => x.startsWith("H280") || x.startsWith("H281"))) return "Compressed Gas";
  if (h.some((x) => x.startsWith("H360") || x.startsWith("H361"))) return "Repro. Hazard";
  if (h.some((x) => x.startsWith("H400") || x.startsWith("H410"))) return "Aquatic Toxic";
  return "Hazardous";
}

const HAZARD_COLOR: Record<string, string> = {
  "Carcinogen":      "bg-red-100 text-red-700",
  "Acute Toxic":     "bg-red-100 text-red-700",
  "Oxidizer":        "bg-orange-100 text-orange-700",
  "Corrosive":       "bg-orange-100 text-orange-700",
  "Flammable":       "bg-amber-100 text-amber-700",
  "Harmful":         "bg-yellow-100 text-yellow-700",
  "Compressed Gas":  "bg-sky-100 text-sky-700",
  "Repro. Hazard":   "bg-purple-100 text-purple-700",
  "Aquatic Toxic":   "bg-blue-100 text-blue-700",
  "Hazardous":       "bg-slate-100 text-slate-600",
};

const SDS_STYLE = {
  on_file:  "bg-emerald-100 text-emerald-700",
  expiring: "bg-amber-100 text-amber-700",
  expired:  "bg-red-100 text-red-700",
  missing:  "bg-red-100 text-red-700",
};

const SDS_LABEL = {
  on_file:  "On File",
  expiring: "Expiring",
  expired:  "Expired",
  missing:  "Missing",
};

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
              <p className="mt-1 text-[10.5px] text-slate-400">Paste the supplier SDS URL or your document management link.</p>
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
              <p className="mt-1 text-[10.5px] text-slate-400">Set if the SDS has a review/expiry date (typically 3 years).</p>
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

export function ChemicalsTable({ chemicals }: { chemicals: Chemical[] }) {
  const [search, setSearch]         = useState("");
  const [hazardFilter, setHazardFilter] = useState<"all" | "high" | "scheduled">("all");
  const [sdsModal, setSdsModal]     = useState<Chemical | null>(null);

  const filtered = useMemo(() => {
    let list = chemicals;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.cas_number ?? "").includes(q) ||
          c.storage_location.toLowerCase().includes(q) ||
          (c.supplier ?? "").toLowerCase().includes(q),
      );
    }
    if (hazardFilter === "high") list = list.filter((c) => c.hazard_statements.some((h) => HIGH_HAZARD_H.some((hh) => h.startsWith(hh))));
    if (hazardFilter === "scheduled") list = list.filter((c) => c.is_scheduled);
    return list;
  }, [chemicals, search, hazardFilter]);

  return (
    <>
      {sdsModal && <SdsModal chemical={sdsModal} onClose={() => setSdsModal(null)} />}

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
        <span className="text-xs text-slate-400">{filtered.length} chemical{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5 text-left">Chemical Name</th>
              <th className="px-4 py-2.5 text-left">CAS #</th>
              <th className="px-4 py-2.5 text-left">Qty</th>
              <th className="px-4 py-2.5 text-left">Location</th>
              <th className="px-4 py-2.5 text-left">Hazard</th>
              <th className="px-4 py-2.5 text-left">SDS</th>
              <th className="px-4 py-2.5 text-left">Flags</th>
              <th className="px-4 py-2.5 text-left">Label</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((c) => {
              const status = sdsStatus(c);
              const hazard = primaryHazard(c);
              const isHigh = c.hazard_statements.some((h) => HIGH_HAZARD_H.some((hh) => h.startsWith(hh)));
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/chemicals/${c.id}`} className="font-semibold text-blue-700 hover:underline">
                      {c.name}
                    </Link>
                    {c.chemical_formula && (
                      <div className="text-xs text-slate-400">{c.chemical_formula}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 tabular-nums">{c.cas_number ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {c.quantity} {c.unit}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-48">{c.storage_location}</td>
                  <td className="px-4 py-3">
                    <Pill className={HAZARD_COLOR[hazard] ?? "bg-slate-100 text-slate-600"}>{hazard}</Pill>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Pill className={SDS_STYLE[status]}>{SDS_LABEL[status]}</Pill>
                      {c.sds_url && (
                        <a
                          href={c.sds_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-blue-600"
                          title="Open SDS"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {(status === "missing" || status === "expired") && (
                        <button
                          onClick={() => setSdsModal(c)}
                          className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
                        >
                          Link SDS
                        </button>
                      )}
                    </div>
                    {c.sds_expiry && status === "expiring" && (
                      <div className="mt-0.5 text-[10px] text-amber-600">
                        Exp {new Date(c.sds_expiry).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.is_scheduled && <Pill className="bg-orange-100 text-orange-700">Scheduled</Pill>}
                      {isHigh && !c.is_scheduled && <Pill className="bg-red-100 text-red-700">High-Hazard</Pill>}
                      {c.hazard_statements
                        .filter((h) => HIGH_HAZARD_H.some((hh) => h.startsWith(hh)))
                        .map((h) => (
                          <Pill key={h} className="bg-red-50 text-red-600 border border-red-200 text-[10px]">{h}</Pill>
                        ))}
                      {!c.is_scheduled && !isHigh && status === "on_file" && (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <GhsLabelButton chemical={c}/>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                  No chemicals match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
