import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, User, AlertTriangle } from "lucide-react";
import { getCapaById, getProfiles, getAuditFindings, getIncidents } from "@/lib/data/ehsRepo";
import { CapaStatusBadge, SeverityBadge } from "@/components/ui/badges";
import { Pill } from "@/components/ui/primitives";
import type { Severity } from "@/lib/constants";
import { EditCapaForm } from "./EditCapaForm";
import { PrintButton } from "@/components/ui/PrintButton";
import type { PrintReportData } from "@/components/ui/PrintButton";
import { getServerTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";

const SOURCE_LABEL: Record<string, string> = {
  audit_finding:     "Audit Finding",
  incident:          "Incident",
  legal_requirement: "Legal Requirement",
  risk_assessment:   "Risk Assessment",
  ai_finding:        "AI Finding",
  manual:            "Manual",
};

const SOURCE_COLOR: Record<string, string> = {
  audit_finding:     "bg-amber-100 text-amber-700",
  incident:          "bg-red-100 text-red-700",
  legal_requirement: "bg-blue-100 text-blue-700",
  risk_assessment:   "bg-orange-100 text-orange-700",
  ai_finding:        "bg-violet-100 text-violet-700",
  manual:            "bg-slate-100 text-slate-600",
};

function fmt(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(s: string | null, status: string): boolean {
  if (!s || status === "closed") return false;
  return new Date(s) < new Date();
}

export default async function CapaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = (await getServerTenantId()) ?? MOCK_TENANT_ID;
  const [capa, profiles, findings, incidents] = await Promise.all([
    getCapaById(id),
    getProfiles(tenantId),
    getAuditFindings(tenantId),
    getIncidents(tenantId),
  ]);
  if (!capa) notFound();

  const overdue = isOverdue(capa.due_date, capa.status);
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));
  const ownerName = capa.owner_id ? (profileMap[capa.owner_id] ?? "—") : "Unassigned";

  // Resolve source name
  let sourceName: string | null = null;
  if (capa.source_type === "audit_finding" && capa.source_id) {
    const f = findings.find((f) => f.id === capa.source_id);
    if (f) sourceName = f.title;
  } else if (capa.source_type === "incident" && capa.source_id) {
    const inc = incidents.find((i) => i.id === capa.source_id);
    if (inc) sourceName = inc.title;
  }

  const printData: PrintReportData = {
    reportType: "CAPA Report",
    title: capa.title,
    subtitle: `${capa.kind === "corrective" ? "Corrective" : "Preventive"} Action · Owner: ${ownerName}`,
    meta: `ID: ${capa.id.slice(0, 8)} · Status: ${capa.status.replace(/_/g, " ")} · Source: ${SOURCE_LABEL[capa.source_type] ?? capa.source_type}`,
    sections: [
      {
        heading: "CAPA Details",
        rows: [
          { label: "Kind",       value: capa.kind === "corrective" ? "Corrective Action" : "Preventive Action" },
          { label: "Severity",   value: capa.severity },
          { label: "Status",     value: capa.status.replace(/_/g, " ") },
          { label: "Owner",      value: ownerName },
          { label: "Due Date",   value: capa.due_date ? fmt(capa.due_date) : "No due date set" },
          { label: "Source",     value: SOURCE_LABEL[capa.source_type] ?? capa.source_type },
          { label: "Created",    value: fmt(capa.created_at) },
          ...(capa.closed_at ? [{ label: "Closed", value: fmt(capa.closed_at) }] : []),
        ],
      },
      ...(sourceName ? [{ heading: "Originated From", body: `${SOURCE_LABEL[capa.source_type]}: ${sourceName}` }] : []),
      ...(capa.description ? [{ heading: "Description / Actions Being Taken", body: capa.description }] : []),
      ...(capa.root_cause ? [{ heading: "Root Cause Analysis", body: capa.root_cause }] : []),
      ...(capa.verification_method ? [{ heading: "Verification Method", body: capa.verification_method }] : []),
      ...(capa.closure_note ? [{ heading: "Closure Record", body: capa.closure_note + (capa.closed_with_evidence ? "\n\nEvidence on file: Yes" : "") }] : []),
      ...(overdue ? [{ heading: "Alerts", flags: [`This CAPA was due ${fmt(capa.due_date!)} and is currently overdue`] }] : []),
    ],
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link
              href="/capa"
              className="print:hidden mt-0.5 flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-slate-900">{capa.title}</h1>
                <CapaStatusBadge status={capa.status} />
                <Pill className={capa.kind === "corrective" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}>
                  {capa.kind === "corrective" ? "Corrective" : "Preventive"}
                </Pill>
                <SeverityBadge severity={capa.severity as Severity} />
              </div>
              <div className="mt-1 flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {ownerName}
                </span>
                {capa.due_date && (
                  <span className={`flex items-center gap-1 ${overdue ? "font-semibold text-red-600" : ""}`}>
                    <Calendar className="h-3 w-3" />
                    Due: {fmt(capa.due_date)}
                    {overdue && " — OVERDUE"}
                  </span>
                )}
                <Pill className={SOURCE_COLOR[capa.source_type] ?? "bg-slate-100 text-slate-600"}>
                  {SOURCE_LABEL[capa.source_type] ?? capa.source_type}
                </Pill>
              </div>
            </div>
          </div>
          <span className="print:hidden"><PrintButton data={printData} /></span>
        </div>
      </div>

      <div className="iq-scroll flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6 space-y-5">
          {/* Overdue alert */}
          {overdue && (
            <div className="rounded-xl border-l-4 border-red-500 bg-red-50 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-red-900">This CAPA is overdue</div>
                <div className="text-xs text-red-700 mt-0.5">Due date was {fmt(capa.due_date)} — update the status or due date below.</div>
              </div>
            </div>
          )}

          {/* Source context */}
          {sourceName && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wide text-amber-600 mb-1">
                Originated From — {SOURCE_LABEL[capa.source_type]}
              </div>
              <div className="text-sm font-medium text-amber-900">{sourceName}</div>
            </div>
          )}

          {/* Workflow form */}
          <EditCapaForm capa={capa} profiles={profiles} />
        </div>
      </div>
    </div>
  );
}
