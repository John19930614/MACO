import { FileEdit, Search, CheckCircle2, AlertTriangle, Clock, PenLine } from "lucide-react";
import type { DocActivityStatus } from "@/lib/documents/activity";

// Plain-language label, colour, tooltip hint, and icon for each activity status.
// Palette matches the rest of the Documents module (emerald / amber / red / slate).
const STATUS_CONFIG: Record<
  DocActivityStatus,
  { label: string; classes: string; hint: string; Icon: typeof FileEdit }
> = {
  Draft: {
    label: "Being Prepared",
    classes: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    hint: "This document is still being prepared and hasn't been submitted yet.",
    Icon: FileEdit,
  },
  "In Review": {
    label: "Under Review",
    classes: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    hint: "This document is currently being reviewed. No action needed from you right now.",
    Icon: Search,
  },
  Approved: {
    label: "Approved",
    classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    hint: "This document has been reviewed and approved. You're all set.",
    Icon: CheckCircle2,
  },
  Missing: {
    label: "Document Missing",
    classes: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    hint: "We couldn't find this document. Please create it or contact your administrator.",
    Icon: AlertTriangle,
  },
  Expired: {
    label: "Expired",
    classes: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    hint: "This document is out of date. Please review and re-approve it to stay compliant.",
    Icon: Clock,
  },
  "Needs Signature": {
    label: "Signature Required",
    classes: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    hint: "This document is waiting for a signature before it can move forward.",
    Icon: PenLine,
  },
};

export function DocumentStatusBadge({ status }: { status: DocActivityStatus }) {
  const { label, classes, hint, Icon } = STATUS_CONFIG[status];
  return (
    <span
      title={hint}
      aria-label={`Status: ${label}. ${hint}`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}
