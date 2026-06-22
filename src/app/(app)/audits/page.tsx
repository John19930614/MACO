import Link from "next/link";
import { getAudits, getAuditFindings, getProfiles } from "@/lib/data/ehsRepo";
import { getServerTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import { PageHeader, Stat, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { AuditStatusBadge, SeverityBadge } from "@/components/ui/badges";
import type { Severity } from "@/lib/constants";
import { AddAuditButton } from "./AddAuditButton";
import { AuditsExportButton } from "./AuditsExportButton";
import { CreateCapaFromFindingButton } from "./CreateCapaFromFindingButton";
import { TemplateEditButton } from "./TemplateEditButton";
import { FileText } from "lucide-react";

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
  if (!s) return "\u2014";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AuditsPage() {
  const tenantId = (await getServerTenantId()) ?? MOCK_TENANT_ID;

  const audits   = await getAudits(tenantId);
  const findings = await getAuditFindings(tenantId);
  const profiles = await getProfiles(tenantId);

  const profileMap  = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));
  const auditTitleMap = Object.fromEntries(audits.map((a) => [a.id, a.title]));

  const scheduled   = audits.filter((a) => a.status === "scheduled").length;
  const inProgress  = audits.filter((a) => a.status === "in_progress").length;
  const completed   = audits.filter((a) => a.status === "completed").length;

  const openFindings = findings.filter((f) => f.status === "open" || f.status === "in_progress");
  const criticalFindings = openFindings.filter(
    (f) => f.severity === "critical" || f.severity === "high",
  );

  // â"€â"€ Analytics â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const completionRate = audits.length > 0 ? Math.round((completed / audits.length) * 100) : 0;

  const byCategory: Record<string, number> = {};
  findings.forEach((f) => { byCategory[f.category] = (byCategory[f.category] ?? 0) + 1; });
  const categoryRows = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
  const maxCat = Math.max(...categoryRows.map((r) => r.count), 1);

  const severityRows = [
    { label: "Critical", cls: "bg-red-700 text-white",           count: findings.filter((f) => f.severity === "critical").length },
    { label: "High",     cls: "bg-red-100 text-red-700",         count: findings.filter((f) => f.severity === "high").length },
    { label: "Medium",   cls: "bg-amber-100 text-amber-700",     count: findings.filter((f) => f.severity === "medium").length },
    { label: "Low",      cls: "bg-emerald-100 text-emerald-700", count: findings.filter((f) => f.severity === "low").length },
  ].filter((s) => s.count > 0);

  // Average days from scheduled to completed
  const completedAudits = audits.filter((a) => a.completed_date && a.scheduled_date);
  const avgDays = completedAudits.length > 0
    ? Math.round(
        completedAudits.reduce((sum, a) => {
          const diff = new Date(a.completed_date!).getTime() - new Date(a.scheduled_date!).getTime();
          return sum + diff / 86400000;
        }, 0) / completedAudits.length,
      )
    : null;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Audits & Assessments"
        subtitle="Scheduled inspections, compliance audits, and finding management"
        actions={
          <div className="flex gap-2">
            <AuditsExportButton audits={audits} findings={findings} profiles={profiles} />
            <AddAuditButton />
          </div>
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

        {/* Analytics strip */}
        <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Completion rate */}
          <Card>
            <CardHeader title="Audit Completion" subtitle={`${completionRate}% completed this cycle`} />
            <div className="px-4 pb-4 space-y-3">
              <div className="flex items-end gap-3">
                <div className="text-4xl font-black text-blue-600">{completionRate}%</div>
                <div className="mb-1 text-xs text-slate-400">{completed}/{audits.length} audits</div>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${completionRate}%` }} />
              </div>
              {avgDays !== null && (
                <div className="text-xs text-slate-500">
                  Avg {avgDays}d scheduled → complete
                </div>
              )}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {[
                  { label: "Scheduled",    val: scheduled,  cls: "bg-blue-50 text-blue-700" },
                  { label: "In Progress",  val: inProgress, cls: "bg-amber-50 text-amber-700" },
                  { label: "Completed",    val: completed,  cls: "bg-emerald-50 text-emerald-700" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-lg p-2 text-center ${s.cls}`}>
                    <div className="text-lg font-black">{s.val}</div>
                    <div className="text-[9px] font-semibold">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Findings by category */}
          <Card>
            <CardHeader title="Findings by Category" subtitle={`${findings.length} total findings`} />
            <div className="px-4 pb-4 space-y-2">
              {categoryRows.slice(0, 5).map((r) => (
                <div key={r.label} className="flex items-center gap-2">
                  <div className="w-24 shrink-0 text-[10px] capitalize text-slate-500 truncate">{r.label}</div>
                  <div className="flex-1 h-3.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-400 transition-all"
                      style={{ width: `${Math.max((r.count / maxCat) * 100, r.count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  <div className="w-4 text-xs font-bold text-slate-700 text-right">{r.count}</div>
                </div>
              ))}
              {categoryRows.length === 0 && <div className="text-xs text-slate-400">No findings.</div>}
            </div>
          </Card>

          {/* Findings severity */}
          <Card>
            <CardHeader title="Findings by Severity" subtitle={`${openFindings.length} open findings`} />
            <div className="px-4 pb-4">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {severityRows.map((s) => (
                  <span key={s.label} className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
                    {s.label} <strong className="ml-1">{s.count}</strong>
                  </span>
                ))}
                {severityRows.length === 0 && (
                  <span className="text-xs text-emerald-600 font-medium">No findings</span>
                )}
              </div>
              <div className="border-t border-slate-100 pt-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Open vs Closed</div>
                <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
                  <div
                    className="h-full bg-amber-400 transition-all"
                    style={{ width: `${findings.length > 0 ? (openFindings.length / findings.length) * 100 : 0}%` }}
                  />
                  <div className="flex-1 h-full bg-emerald-400" />
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                  <span>{openFindings.length} open</span>
                  <span>{findings.filter(f => f.status === "closed").length} closed</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

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
                      <Pill className={`text-xs ${TYPE_COLOR[a.type] ?? "bg-slate-100 text-slate-600"}`}>
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
                  <th className="px-4 py-2.5 text-left">Audit</th>
                  <th className="px-4 py-2.5 text-left">Category</th>
                  <th className="px-4 py-2.5 text-left">Severity</th>
                  <th className="px-4 py-2.5 text-left">Owner</th>
                  <th className="px-4 py-2.5 text-left">Due</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {findings.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{f.title}</div>
                      <div className="mt-0.5 text-xs text-slate-400 line-clamp-1">{f.description}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-40">
                      <span className="line-clamp-2">{auditTitleMap[f.audit_id] ?? "—"}</span>
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
                    <td className="px-4 py-3">
                      {f.status !== "closed" && <CreateCapaFromFindingButton finding={f} />}
                    </td>
                  </tr>
                ))}
                {findings.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">No findings recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        {/* Audit Templates */}
        <Card className="mt-5">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-800">Audit Templates</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">Built-in checklists auto-selected by audit type ? Custom templates via Reliance configuration</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
            {[
              { type: "internal",   label: "Internal",    sections: 5, items: 26, desc: "General site safety and EHS management system",   color: "bg-blue-100 text-blue-700" },
              { type: "regulatory", label: "Regulatory",  sections: 6, items: 31, desc: "OSHA inspection readiness ? HazCom, Lab, Waste",   color: "bg-red-100 text-red-700" },
              { type: "biosafety",  label: "Biosafety",   sections: 5, items: 25, desc: "BSL-1/BSL-2 biological safety and containment",     color: "bg-emerald-100 text-emerald-700" },
              { type: "chemical",   label: "Chemical",    sections: 5, items: 27, desc: "Chemical storage, SDS, and handling controls",      color: "bg-orange-100 text-orange-700" },
              { type: "waste",      label: "Waste",       sections: 4, items: 21, desc: "Hazardous waste accumulation and disposal",         color: "bg-amber-100 text-amber-700" },
              { type: "supplier",   label: "Supplier",    sections: 4, items: 19, desc: "Vendor and contractor EHS qualification",           color: "bg-violet-100 text-violet-700" },
              { type: "system",     label: "System",      sections: 4, items: 20, desc: "EHS management system and program review",          color: "bg-teal-100 text-teal-700" },
              { type: "process",    label: "Process",     sections: 4, items: 22, desc: "Operational process hazard and safety review",      color: "bg-slate-100 text-slate-700" },
            ].map((t) => (
              <div key={t.type} className="bg-white p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.color}`}>{t.label}</span>
                  <TemplateEditButton />
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">{t.desc}</p>
                <div className="mt-auto flex gap-3 text-[10px] text-slate-400">
                  <span><strong className="text-slate-600">{t.sections}</strong> sections</span>
                  <span><strong className="text-slate-600">{t.items}</strong> items</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

