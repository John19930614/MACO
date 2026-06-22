import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, ClipboardCheck } from "lucide-react";
import { getAuditById, getProfiles, getAuditFindings } from "@/lib/data/ehsRepo";
import { Pill } from "@/components/ui/primitives";
import { AuditStatusBadge } from "@/components/ui/badges";
import { AuditConductForm } from "./AuditConductForm";
import { AuditReportButton } from "./AuditReportButton";
import { getServerTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID, MOCK_TENANTS_ALL } from "@/lib/data/mock";

const TYPE_LABEL: Record<string, string> = {
  internal: "Internal", external: "External", regulatory: "Regulatory",
  supplier: "Supplier", system: "System", process: "Process",
};

const TYPE_COLOR: Record<string, string> = {
  internal:   "bg-blue-100 text-blue-700",
  external:   "bg-violet-100 text-violet-700",
  regulatory: "bg-red-100 text-red-700",
  supplier:   "bg-amber-100 text-amber-700",
  system:     "bg-teal-100 text-teal-700",
  process:    "bg-orange-100 text-orange-700",
};

function fmt(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = (await getServerTenantId()) ?? MOCK_TENANT_ID;
  const tenantName = MOCK_TENANTS_ALL.find((t) => t.id === tenantId)?.name ?? "Your Company";
  const [audit, profiles, findings] = await Promise.all([
    getAuditById(id),
    getProfiles(tenantId),
    getAuditFindings(tenantId),
  ]);
  if (!audit) notFound();

  const auditFindings = findings.filter((f) => f.audit_id === audit.id);
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4 print:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link
              href="/audits"
              className="mt-0.5 flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
            <AuditReportButton
              audit={audit}
              findings={auditFindings}
              profileMap={profileMap}
              tenantName={tenantName}
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-slate-900">{audit.title}</h1>
                <AuditStatusBadge status={audit.status} />
                <Pill className={TYPE_COLOR[audit.type] ?? "bg-slate-100 text-slate-600"}>
                  {TYPE_LABEL[audit.type] ?? audit.type}
                </Pill>
              </div>
              <div className="mt-1 flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Scheduled: {fmt(audit.scheduled_date)}
                </span>
                {audit.completed_date && (
                  <span className="flex items-center gap-1">
                    <ClipboardCheck className="h-3 w-3 text-emerald-500" />
                    Completed: {fmt(audit.completed_date)}
                  </span>
                )}
                {audit.scope && (
                  <span className="text-slate-400 italic line-clamp-1 max-w-xs">{audit.scope}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print-only header */}
      <div className="print-only px-8 pt-6 pb-4 border-b-2 border-black">
        <div className="text-xl font-extrabold">{audit.title}</div>
        <div className="text-sm text-slate-600">{tenantName} · SafetyIQ · {TYPE_LABEL[audit.type]} Audit · Scheduled: {fmt(audit.scheduled_date)}</div>
        {audit.scope && <div className="text-xs text-slate-500 mt-0.5">Scope: {audit.scope}</div>}
      </div>

      <div className="iq-scroll flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6">
          {/* Prior findings for this audit */}
          {auditFindings.length > 0 && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 print:hidden">
              <div className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">
                Prior Findings ({auditFindings.length})
              </div>
              <div className="space-y-1">
                {auditFindings.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 text-xs text-amber-800">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      f.severity === "critical" ? "bg-red-600" :
                      f.severity === "high" ? "bg-orange-500" :
                      f.severity === "medium" ? "bg-amber-500" : "bg-slate-400"
                    }`} />
                    {f.title}
                    <span className="ml-auto capitalize text-amber-600">{f.status.replace("_", " ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* The conduct form */}
          <AuditConductForm audit={audit} profiles={profiles} />
        </div>
      </div>
    </div>
  );
}
