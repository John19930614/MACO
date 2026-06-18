import { Pill } from "./primitives";
import { cn } from "@/lib/utils";
import type {
  RiskLevel,
  CapaStatus,
  AuditStatus,
  ComplianceStatus,
  ReviewStatus,
  Severity,
} from "@/lib/constants";

// ── Risk level ─────────────────────────────────────────────────────────────

const RISK_LEVEL_STYLE: Record<RiskLevel, string> = {
  negligible: "bg-slate-100 text-slate-500",
  low:        "bg-emerald-100 text-emerald-700",
  medium:     "bg-amber-100 text-amber-700",
  high:       "bg-orange-100 text-orange-700",
  extreme:    "bg-red-100 text-red-700 iq-pulse",
};

const RISK_LEVEL_DOT: Record<RiskLevel, string> = {
  negligible: "#94a3b8",
  low:        "#10b981",
  medium:     "#f59e0b",
  high:       "#f97316",
  extreme:    "#dc2626",
};

export function RiskLevelBadge({ level }: { level: RiskLevel }) {
  return (
    <Pill className={cn(RISK_LEVEL_STYLE[level])}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: RISK_LEVEL_DOT[level] }} />
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </Pill>
  );
}

// ── CAPA status ────────────────────────────────────────────────────────────

const CAPA_STATUS_STYLE: Record<CapaStatus, string> = {
  open:                 "bg-blue-100 text-blue-700",
  in_progress:          "bg-amber-100 text-amber-700",
  overdue:              "bg-red-100 text-red-700",
  pending_verification: "bg-purple-100 text-purple-700",
  closed:               "bg-emerald-100 text-emerald-700",
  rejected:             "bg-slate-100 text-slate-600",
};

const CAPA_STATUS_LABEL: Record<CapaStatus, string> = {
  open:                 "Open",
  in_progress:          "In Progress",
  overdue:              "Overdue",
  pending_verification: "Pending Verification",
  closed:               "Closed",
  rejected:             "Rejected",
};

export function CapaStatusBadge({ status }: { status: CapaStatus }) {
  return <Pill className={CAPA_STATUS_STYLE[status]}>{CAPA_STATUS_LABEL[status]}</Pill>;
}

// ── Audit status ───────────────────────────────────────────────────────────

const AUDIT_STATUS_STYLE: Record<AuditStatus, string> = {
  scheduled:   "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed:   "bg-emerald-100 text-emerald-700",
  cancelled:   "bg-slate-100 text-slate-400",
};

export function AuditStatusBadge({ status }: { status: AuditStatus }) {
  const label = status.replace("_", " ");
  return (
    <Pill className={AUDIT_STATUS_STYLE[status]}>
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </Pill>
  );
}

// ── Compliance status ──────────────────────────────────────────────────────

const COMPLIANCE_STATUS_STYLE: Record<ComplianceStatus, string> = {
  compliant:      "bg-emerald-100 text-emerald-700",
  minor_gap:      "bg-amber-100 text-amber-700",
  major_gap:      "bg-orange-100 text-orange-700",
  non_compliant:  "bg-red-100 text-red-700",
  not_assessed:   "bg-slate-100 text-slate-600",
  not_applicable: "bg-slate-100 text-slate-400",
};

const COMPLIANCE_STATUS_LABEL: Record<ComplianceStatus, string> = {
  compliant:      "Compliant",
  minor_gap:      "Minor Gap",
  major_gap:      "Major Gap",
  non_compliant:  "Non-Compliant",
  not_assessed:   "Not Assessed",
  not_applicable: "N/A",
};

export function ComplianceStatusBadge({ status }: { status: ComplianceStatus }) {
  return (
    <Pill className={COMPLIANCE_STATUS_STYLE[status]}>
      {COMPLIANCE_STATUS_LABEL[status]}
    </Pill>
  );
}

// ── AI review status ───────────────────────────────────────────────────────

const REVIEW_STATUS_STYLE: Record<ReviewStatus, string> = {
  pending:  "border border-dashed border-violet-400 bg-violet-50 text-violet-700",
  accepted: "bg-emerald-100 text-emerald-700",
  edited:   "bg-blue-100 text-blue-700",
  rejected: "bg-slate-100 text-slate-500",
  archived: "bg-slate-100 text-slate-400",
};

const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  pending:  "AI · Pending Review",
  accepted: "Accepted",
  edited:   "Edited & Accepted",
  rejected: "Rejected",
  archived: "Archived",
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return <Pill className={REVIEW_STATUS_STYLE[status]}>{REVIEW_STATUS_LABEL[status]}</Pill>;
}

// ── Severity badge (human-assigned: low/medium/high/critical) ─────────────

const SEVERITY_STYLE: Record<Severity, string> = {
  low:      "bg-emerald-100 text-emerald-700",
  medium:   "bg-amber-100 text-amber-700",
  high:     "bg-red-100 text-red-700",
  critical: "bg-red-700 text-red-50 iq-pulse",
};

const SEVERITY_DOT: Record<Severity, string> = {
  low:      "#10b981",
  medium:   "#f59e0b",
  high:     "#ef4444",
  critical: "#7f1d1d",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Pill className={cn(SEVERITY_STYLE[severity])}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEVERITY_DOT[severity] }} />
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </Pill>
  );
}
