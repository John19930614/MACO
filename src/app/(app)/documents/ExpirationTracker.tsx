"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Calendar, Eye } from "lucide-react";
import type { Document, Profile } from "@/lib/types";

function fmt(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(s: string): number {
  return Math.ceil((new Date(s).getTime() - Date.now()) / 86400000);
}

const CATEGORY_LABEL: Record<string, string> = {
  sop: "SOP", policy: "Policy", procedure: "Procedure",
  form: "Form", permit: "Permit", msds: "SDS",
  plan: "Plan", guideline: "Guideline", emergency: "Emergency",
};

interface Bucket {
  key: string;
  label: string;
  description: string;
  labelColor: string;
  headerBg: string;
  borderColor: string;
  daysFn: (d: number) => boolean;
  dayChipFn: (d: number) => string;
}

const BUCKETS: Bucket[] = [
  {
    key: "overdue",
    label: "Critical — Review Overdue",
    description: "These documents have passed their scheduled review date and require immediate attention.",
    labelColor: "text-red-700",
    headerBg: "bg-red-50",
    borderColor: "border-red-200",
    daysFn: (d) => d < 0,
    dayChipFn: (d) => `bg-red-100 text-red-700`,
  },
  {
    key: "7d",
    label: "Urgent — Review Due Within 7 Days",
    description: "Initiate the review process immediately to avoid a compliance gap.",
    labelColor: "text-orange-700",
    headerBg: "bg-orange-50",
    borderColor: "border-orange-200",
    daysFn: (d) => d >= 0 && d <= 7,
    dayChipFn: () => `bg-orange-100 text-orange-700`,
  },
  {
    key: "30d",
    label: "Warning — Review Due Within 30 Days",
    description: "Schedule the review now to stay on track.",
    labelColor: "text-amber-700",
    headerBg: "bg-amber-50",
    borderColor: "border-amber-200",
    daysFn: (d) => d > 7 && d <= 30,
    dayChipFn: () => `bg-amber-100 text-amber-700`,
  },
  {
    key: "90d",
    label: "Advisory — Review Due Within 90 Days",
    description: "Plan ahead — the review window opens soon.",
    labelColor: "text-yellow-700",
    headerBg: "bg-yellow-50",
    borderColor: "border-yellow-200",
    daysFn: (d) => d > 30 && d <= 90,
    dayChipFn: () => `bg-yellow-100 text-yellow-700`,
  },
  {
    key: "current",
    label: "Current — On Schedule",
    description: "Review date is more than 90 days away.",
    labelColor: "text-emerald-700",
    headerBg: "bg-emerald-50",
    borderColor: "border-emerald-200",
    daysFn: (d) => d > 90,
    dayChipFn: () => `bg-emerald-100 text-emerald-700`,
  },
];

export function ExpirationTracker({
  docs,
  profiles,
}: {
  docs: Document[];
  profiles: Profile[];
}) {
  const [scheduled, setScheduled] = useState<Set<string>>(new Set());
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

  const activeDocs = docs.filter((d) => d.status === "active");

  const buckets = BUCKETS.map((b) => ({
    ...b,
    docs: activeDocs
      .filter((d) => b.daysFn(daysUntil(d.review_date)))
      .sort((a, z) => daysUntil(a.review_date) - daysUntil(z.review_date)),
  })).filter((b) => b.docs.length > 0);

  const overdueCount = activeDocs.filter((d) => daysUntil(d.review_date) < 0).length;
  const urgentCount  = activeDocs.filter((d) => { const d_ = daysUntil(d.review_date); return d_ >= 0 && d_ <= 7; }).length;

  return (
    <div className="space-y-5">
      {(overdueCount + urgentCount) > 0 && (
        <div className="rounded-xl border-l-4 border-red-500 bg-red-50 p-4">
          <div className="text-sm font-semibold text-red-900">
            {overdueCount > 0 && `${overdueCount} document${overdueCount !== 1 ? "s" : ""} overdue for review`}
            {overdueCount > 0 && urgentCount > 0 && " · "}
            {urgentCount > 0 && `${urgentCount} due within 7 days`}
          </div>
          <p className="mt-0.5 text-xs text-red-700">
            Documents past their review date represent a regulatory compliance gap. Schedule reviews immediately.
          </p>
        </div>
      )}

      {buckets.length === 0 && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-14 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
          <div className="text-sm font-semibold text-emerald-700">All Documents On Schedule</div>
          <div className="mt-1 text-xs text-emerald-600">No reviews due within 90 days.</div>
        </div>
      )}

      {buckets.map((bucket) => (
        <div key={bucket.key} className={`overflow-hidden rounded-2xl border ${bucket.borderColor}`}>
          <div className={`${bucket.headerBg} border-b ${bucket.borderColor} px-5 py-3.5`}>
            <span className={`text-sm font-semibold ${bucket.labelColor}`}>{bucket.label}</span>
            <span className="ml-2 text-xs text-slate-400">
              {bucket.docs.length} document{bucket.docs.length !== 1 ? "s" : ""}
            </span>
            <p className="mt-0.5 text-xs text-slate-500">{bucket.description}</p>
          </div>
          <div className="overflow-x-auto bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2.5 text-left">Document</th>
                  <th className="px-4 py-2.5 text-left">Category</th>
                  <th className="px-4 py-2.5 text-left">Version</th>
                  <th className="px-4 py-2.5 text-left">Review Date</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Owner</th>
                  <th className="px-4 py-2.5 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {bucket.docs.map((doc) => {
                  const days = daysUntil(doc.review_date);
                  const isScheduled = scheduled.has(doc.id);
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          {doc.title}
                        </Link>
                        {doc.acknowledgment_required && (
                          <div className="text-[10px] font-medium text-indigo-500">Ack. required</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {CATEGORY_LABEL[doc.category] ?? doc.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{doc.version}</td>
                      <td className="px-4 py-3 text-xs tabular-nums">
                        <span className={
                          days < 0 ? "font-semibold text-red-600" :
                          days <= 7 ? "font-semibold text-orange-600" :
                          days <= 30 ? "font-semibold text-amber-600" :
                          "text-slate-600"
                        }>
                          {fmt(doc.review_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${bucket.dayChipFn(days)}`}>
                          {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {doc.owner_id ? (profileMap[doc.owner_id] ?? "—") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setScheduled((prev) => new Set([...prev, doc.id]))}
                            disabled={isScheduled}
                            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                              isScheduled
                                ? "cursor-default bg-emerald-50 text-emerald-700"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                            }`}
                          >
                            {isScheduled ? (
                              <><CheckCircle2 className="h-3 w-3" /> Scheduled</>
                            ) : (
                              <><Calendar className="h-3 w-3" /> Schedule Review</>
                            )}
                          </button>
                          <Link
                            href={`/documents/${doc.id}`}
                            className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
                          >
                            <Eye className="h-3 w-3" /> View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
