"use client";

import { useState } from "react";
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { SdsReviewModal } from "./SdsReviewModal";
import type { SdsDocument } from "@/lib/types";

const STATUS_META: Record<SdsDocument["approval_status"], { label: string; cls: string; icon: React.ReactNode }> = {
  draft:        { label: "Uploading",       cls: "bg-slate-100 text-slate-600",   icon: <Clock className="h-3 w-3" /> },
  ai_extracted: { label: "Awaiting Review", cls: "bg-amber-100 text-amber-700",   icon: <AlertCircle className="h-3 w-3" /> },
  in_review:    { label: "In Review",       cls: "bg-blue-100 text-blue-700",     icon: <Clock className="h-3 w-3" /> },
  approved:     { label: "Approved",        cls: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="h-3 w-3" /> },
  rejected:     { label: "Rejected",        cls: "bg-red-100 text-red-700",       icon: <XCircle className="h-3 w-3" /> },
};

const AI_STATUS_META: Record<SdsDocument["ai_extraction_status"], { label: string; cls: string }> = {
  pending:    { label: "Pending",    cls: "text-slate-400" },
  processing: { label: "Processing", cls: "text-violet-600 animate-pulse" },
  completed:  { label: "Extracted",  cls: "text-emerald-600" },
  failed:     { label: "Failed",     cls: "text-red-600" },
};

interface Props { docs: SdsDocument[] }

export function SdsQueue({ docs }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [reviewing, setReviewing] = useState<SdsDocument | null>(null);

  const pending = docs.filter((d) => d.approval_status === "ai_extracted" || d.approval_status === "in_review").length;

  if (docs.length === 0) return null;

  return (
    <>
      <div className="mb-5 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <FileText className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-800">SDS Review Queue</span>
            <span className="text-xs text-slate-400">{docs.length} document{docs.length !== 1 ? "s" : ""}</span>
            {pending > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {pending} awaiting review
              </span>
            )}
          </div>
          {collapsed ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
        </button>

        {!collapsed && (
          <div className="border-t border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">File</th>
                  <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">Product</th>
                  <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">Confidence</th>
                  <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">AI Status</th>
                  <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">Approval</th>
                  <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">Uploaded</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {docs.map((doc) => {
                  const sm = STATUS_META[doc.approval_status];
                  const am = AI_STATUS_META[doc.ai_extraction_status];
                  const conf = doc.ai_confidence_score;
                  const confColor = conf == null ? "text-slate-300"
                    : conf >= 80 ? "text-emerald-600 font-semibold"
                    : conf >= 60 ? "text-amber-600 font-semibold"
                    : "text-red-600 font-semibold";

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="max-w-[160px] truncate px-4 py-2.5 text-xs text-slate-700" title={doc.file_name}>
                        {doc.file_name}
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-2.5 text-xs text-slate-700">
                        {doc.product_identifier ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <span className={confColor}>
                          {conf != null ? `${conf}%` : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs ${am.cls}`}>{am.label}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sm.cls}`}>
                          {sm.icon}{sm.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">
                        {new Date(doc.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-2.5">
                        {(doc.approval_status === "ai_extracted" || doc.approval_status === "in_review") && (
                          <button
                            onClick={() => setReviewing(doc)}
                            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            Review
                          </button>
                        )}
                        {doc.approval_status === "approved" && (
                          <span className="text-xs text-emerald-600 font-medium">Added to inventory</span>
                        )}
                        {doc.approval_status === "rejected" && (
                          <span className="text-xs text-slate-400">Rejected</span>
                        )}
                        {doc.approval_status === "draft" && (
                          <span className="text-xs text-slate-400 animate-pulse">Processing…</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {reviewing && (
        <SdsReviewModal
          doc={reviewing}
          open={true}
          onClose={() => setReviewing(null)}
        />
      )}
    </>
  );
}
