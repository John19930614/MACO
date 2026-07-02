"use client";

import { FileText, Search, CheckCircle2, AlertTriangle, Package, RefreshCw } from "lucide-react";
import { DocumentStatusSection } from "./DocumentStatusSection";
import type { DocumentActivityData } from "@/lib/documents/activity";

interface DocumentActivityPanelProps {
  data: DocumentActivityData;
  lastRefreshed?: string; // ISO date string
  error?: string;
}

export function DocumentActivityPanel({ data, lastRefreshed, error }: DocumentActivityPanelProps) {
  if (error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20"
      >
        <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-500" aria-hidden="true" />
        <div>
          <h2 className="font-semibold text-red-800 dark:text-red-300">Unable to load documents</h2>
          <p className="mt-1 text-sm text-red-700 dark:text-red-400">
            There was a problem fetching document activity. Please refresh or contact support if the
            issue persists.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Recently Created", count: data.recentlyGenerated.length, Icon: FileText, color: "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700", tint: "text-slate-500" },
    { label: "Being Reviewed", count: data.underReview.length, Icon: Search, color: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800", tint: "text-blue-500" },
    { label: "Waiting for Approval", count: data.outstandingApprovals.length, Icon: CheckCircle2, color: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800", tint: "text-amber-500" },
    { label: "Missing Paperwork", count: data.missingDocuments.length, Icon: AlertTriangle, color: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800", tint: "text-red-500" },
    { label: "Ready to Download", count: data.completedExports.length, Icon: Package, color: "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800", tint: "text-emerald-500" },
  ];

  return (
    <div>
      {/* Panel Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Document Activity</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Here&apos;s a snapshot of all your documents and what needs attention.
          </p>
        </div>
        {lastRefreshed && (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Last refreshed:{" "}
            <time dateTime={lastRefreshed}>{new Date(lastRefreshed).toLocaleTimeString()}</time>
          </span>
        )}
      </div>

      {/* Stat Summary Cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(({ label, count, Icon, color, tint }) => (
          <div key={label} className={`flex flex-col items-start gap-1 rounded-xl border p-4 shadow-sm ${color}`}>
            <Icon className={`h-6 w-6 ${tint}`} aria-hidden="true" />
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{count}</span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Five Document Sections */}
      <DocumentStatusSection
        title="Recently Created"
        description="Documents created in the last 30 days."
        items={data.recentlyGenerated}
        emptyMessage="No documents created recently. They'll appear here once generated."
        quickLinkHref="/documents"
        quickLinkLabel="View All Recent"
      />

      <DocumentStatusSection
        title="Currently Being Reviewed"
        description="These documents have been submitted and are being reviewed right now."
        items={data.underReview}
        emptyMessage="No documents are currently under review."
        quickLinkHref="/documents?view=tracker"
        quickLinkLabel="Open Review Queue"
      />

      <DocumentStatusSection
        title="Waiting for Approval"
        description="These documents are waiting to be approved. Review them to keep things moving."
        items={data.outstandingApprovals}
        emptyMessage="No documents are waiting for approval."
        quickLinkHref="/documents"
        quickLinkLabel="Go to Approvals"
      />

      <DocumentStatusSection
        title="Missing Paperwork"
        description="We noticed some required documents are missing. Take action to avoid delays."
        items={data.missingDocuments}
        emptyMessage="No missing documents. Everything looks good!"
        quickLinkHref="/documents"
        quickLinkLabel="Resolve Missing"
        quickLinkVariant="destructive-outline"
      />

      <DocumentStatusSection
        title="Ready to Download"
        description="These documents have been approved and are ready for you to download."
        items={data.completedExports}
        emptyMessage="No completed exports yet. Approved documents will appear here."
        quickLinkHref="/documents"
        quickLinkLabel="Download History"
      />
    </div>
  );
}
