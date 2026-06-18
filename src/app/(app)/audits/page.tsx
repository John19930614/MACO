import Link from "next/link";
import { getAudits, getAuditFindings, getProfiles } from "@/lib/data/ehsRepo";
import { PageHeader, Stat, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { AuditStatusBadge, SeverityBadge } from "@/components/ui/badges";
import type { Severity } from "@/lib/constants";
import { AddAuditButton } from "./AddAuditButton";

const TYPE_LABEL: Record<string, string> = {
  internal: "Internal", external: "External", regulatory: "Regulatory",
  supplier: "Supplier", system: "System", process: "Process",
};

function fmt(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AuditsPage() {
  const audits   = await getAudits();
  const findings = await getAuditFindings();
  const profiles = await getProfiles();

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

  const scheduled   = audits.filter((a) => a.status === "scheduled").length;
  const inProgress  = audits.filter((a) => a.status === "in_progress").length;
  const completed   = audits.filter((a) => a.status === "completed").length;

  const openFindings = findings.filter((f) => f.status === "open" || f.status === "in_progress");
  const criticalFindings = openFindings.filter(
    (f) => f.severity === "critical" || f.severity === "high",
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Audits & Assessments"
        subtitle="Scheduled inspections, compliance audits, and finding management"
        actions={
          <AddAuditButton />
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total Audits"      value={audits.length}       hint="All audit records" />
          <Stat label="Scheduled"         value={scheduled}           hint="Upcoming"           accent="#2563eb" />
          <Stat label="In Progress"       value={inProgress}          hint="Active"              accent="#f59e0b" />
          <Stat label="Completed"         value={completed}           hint="This cycle"          accent="#10b981" />
        </div>

        {/* Open findings alert */}
        {criticalFindings.length > 0 && (
          <div className="mb-5 rounded-xl border-l-4 border-red-500 bg-red-50 p-4">
            <div className="text-sm font-semibold text-red-900">
              {criticalFindings.length} High-Priority Finding{criticalFindings.length > 1 ? "s" : ""} Require Attention
            </div>
            <div className="mt-0.5 text-xs text-red-700">
              {criticalFindings.map((f) => f.title).join(" · ")}
            </div>
          </div>
        )}

        {/* Audits table */}
        <Card className="mb-5">
          <CardHeader title="Audit Schedule" subtitle={`${audits.length} audits`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Title</th>
                  <th className="px-4 py-2.5 text-left">Type</th>
                  <th className="px-4 py-2.5 text-left">Scheduled</th>
                  <th className="px-4 py-2.5 text-left">Completed</th>
                  <th className="px-4 py-2.5 text-left">Lead Auditor</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {audits.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/audits/${a.id}`} className="font-medium text-blue-700 hover:underline">
                        {a.title}
                      </Link>
                      <div className="mt-0.5 text-xs text-slate-400 line-clamp-1">{a.scope}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Pill className="bg-blue-50 text-blue-700 text-xs">
                        {TYPE_LABEL[a.type] ?? a.type}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-600">{fmt(a.scheduled_date)}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-600">{fmt(a.completed_date)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {a.lead_auditor_id ? (profileMap[a.lead_auditor_id] ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <AuditStatusBadge status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Findings table */}
        <Card>
          <CardHeader
            title="Audit Findings"
            subtitle={`${openFindings.length} open · ${findings.filter((f) => f.status === "closed").length} closed`}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Finding</th>
                  <th className="px-4 py-2.5 text-left">Category</th>
                  <th className="px-4 py-2.5 text-left">Severity</th>
                  <th className="px-4 py-2.5 text-left">Owner</th>
                  <th className="px-4 py-2.5 text-left">Due</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {findings.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{f.title}</div>
                      <div className="mt-0.5 text-xs text-slate-400 line-clamp-1">{f.description}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Pill className="bg-slate-100 text-slate-600 text-xs capitalize">{f.category}</Pill>
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={f.severity as Severity} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {f.owner_id ? (profileMap[f.owner_id] ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-600">{fmt(f.due_date)}</td>
                    <td className="px-4 py-3">
                      <Pill className={
                        f.status === "closed" ? "bg-emerald-100 text-emerald-700" :
                        f.status === "in_progress" ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-600"
                      }>
                        {f.status.replace("_", " ")}
                      </Pill>
                    </td>
                  </tr>
                ))}
                {findings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">No findings recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
