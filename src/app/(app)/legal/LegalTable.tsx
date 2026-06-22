"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import type { LegalRequirement, Profile } from "@/lib/types";
import { Pill } from "@/components/ui/primitives";
import { ComplianceStatusBadge } from "@/components/ui/badges";
import type { ComplianceStatus } from "@/lib/constants";
import { updateLegalEvidence } from "@/lib/actions/ehs";
import { Paperclip, Check } from "lucide-react";

function EvidenceCell({ requirementId, evidenceUrl }: { requirementId: string; evidenceUrl: string | null }) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl]         = useState(evidenceUrl ?? "");
  const [saved, setSaved]     = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSave() {
    setPending(true);
    await updateLegalEvidence(requirementId, url);
    setSaved(true);
    setEditing(false);
    setPending(false);
    setTimeout(() => setSaved(false), 3000);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="h-7 w-36 rounded border border-slate-200 px-2 text-xs focus:border-blue-400 focus:outline-none"
        />
        <button
          onClick={handleSave}
          disabled={pending}
          className="flex items-center gap-0.5 rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Check className="h-2.5 w-2.5" />
          {pending ? "…" : "Save"}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-200"
        >
          ✕
        </button>
      </div>
    );
  }

  if (saved || evidenceUrl) {
    return (
      <div className="flex items-center gap-1.5">
        {evidenceUrl && (
          <a
            href={evidenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
          >
            View ↗
          </a>
        )}
        <button
          onClick={() => setEditing(true)}
          className="text-[10px] text-slate-400 hover:text-slate-600 underline"
        >
          {saved ? "Saved ✓" : "Edit"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
    >
      <Paperclip className="h-3 w-3" />
      Link Evidence
    </button>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  chemical:   "Chemical",
  training:   "Training",
  emergency:  "Emergency",
  waste:      "Waste",
  air:        "Air",
  water:      "Water",
  biosafety:  "Biosafety",
  general:    "General",
};

const STATUS_OPTIONS: Array<{ value: "" | ComplianceStatus; label: string }> = [
  { value: "",               label: "All Status"       },
  { value: "compliant",      label: "Compliant"        },
  { value: "minor_gap",      label: "Minor Gap"        },
  { value: "major_gap",      label: "Major Gap"        },
  { value: "non_compliant",  label: "Non-Compliant"    },
  { value: "not_assessed",   label: "Not Assessed"     },
];

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isDue(s: string) {
  return new Date(s) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

export function LegalTable({
  requirements,
  profiles,
}: {
  requirements: LegalRequirement[];
  profiles: Profile[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ComplianceStatus>("");

  const profileMap = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, p.display_name])),
    [profiles],
  );

  const filtered = useMemo(() => {
    let list = requirements;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.regulation_ref.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.jurisdiction.toLowerCase().includes(q),
      );
    }
    if (statusFilter) {
      list = list.filter((r) => r.status === statusFilter);
    }
    return list;
  }, [requirements, search, statusFilter]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <input
          className="h-8 flex-1 min-w-48 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
          placeholder="Search regulation, title, category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-8 rounded-lg border border-slate-200 px-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | ComplianceStatus)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400">{filtered.length} requirement{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5 text-left">Regulation</th>
              <th className="px-4 py-2.5 text-left">Title</th>
              <th className="px-4 py-2.5 text-left">Category</th>
              <th className="px-4 py-2.5 text-left">Jurisdiction</th>
              <th className="px-4 py-2.5 text-left">Owner</th>
              <th className="px-4 py-2.5 text-left">Next Review</th>
              <th className="px-4 py-2.5 text-left">Status</th>
              <th className="px-4 py-2.5 text-left">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((r) => {
              const due = isDue(r.next_review_date);
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs font-semibold text-slate-700">{r.regulation_ref}</div>
                  </td>
                  <td className="px-4 py-3 max-w-72">
                    <Link href={`/legal/${r.id}`} className="font-medium text-blue-600 hover:underline">{r.title}</Link>
                    {r.compliance_notes && (
                      <div className="mt-0.5 text-xs text-slate-400 line-clamp-1">{r.compliance_notes}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Pill className="bg-slate-100 text-slate-600">
                      {CATEGORY_LABEL[r.category] ?? r.category}
                    </Pill>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{r.jurisdiction}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {r.owner_id ? (profileMap[r.owner_id] ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums">
                    <span className={due ? "font-semibold text-red-600" : "text-slate-600"}>
                      {formatDate(r.next_review_date)}
                    </span>
                    {due && (
                      <div className="text-[10px] font-medium text-red-500">Due soon</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ComplianceStatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    <EvidenceCell requirementId={r.id} evidenceUrl={r.evidence_url} />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                  No requirements match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
