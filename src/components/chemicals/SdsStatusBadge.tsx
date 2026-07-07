"use client";

import { AlertTriangle, CheckCircle2, HelpCircle, Clock } from "lucide-react";
import { getSdsStatus, type SdsStatusInput, type SdsStatusResult } from "@/lib/sds/sdsStatus";

// Icon + text badge — never relies on color alone, so it stays readable for
// colorblind users and in grayscale print/Excel export.
export function SdsStatusPill({ result }: { result: SdsStatusResult }) {
  const { status, label, colorClass } = result;

  const Icon = status === "overdue" ? AlertTriangle
    : status === "missing" ? HelpCircle
    : status === "due_soon" ? Clock
    : CheckCircle2;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap ${colorClass}`}
      role="status"
      aria-label={label}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

export function SdsStatusBadge({ sdsUrl, reviewDueDate }: SdsStatusInput) {
  return <SdsStatusPill result={getSdsStatus({ sdsUrl, reviewDueDate })} />;
}
