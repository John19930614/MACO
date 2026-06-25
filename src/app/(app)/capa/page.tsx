import { getCapaActions, getProfiles } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import { PageHeader, Stat, Card, CardHeader } from "@/components/ui/primitives";
import { AddCapaButton } from "./AddCapaButton";
import { CapaExportButton } from "./CapaExportButton";
import { CapaTable } from "./CapaTable";

export default async function CapaPage() {
  const tenantId = await getEffectiveTenantId();

  const [capas, profiles] = await Promise.all([getCapaActions(tenantId), getProfiles(tenantId)]);

  const open                = capas.filter((c) => c.status === "open").length;
  const inProgress          = capas.filter((c) => c.status === "in_progress").length;
  const overdue             = capas.filter((c) => c.due_date != null && new Date(c.due_date) < new Date() && !["closed", "pending_verification", "rejected"].includes(c.status)).length;
  const pendingVerification = capas.filter((c) => c.status === "pending_verification").length;
  const closed              = capas.filter((c) => c.status === "closed").length;

  // ── Analytics ──────────────────────────────────────────────────────────────
  const now         = new Date();
  const activeCapas = capas.filter((c) => c.status !== "closed" && c.status !== "rejected");
  function ageInDays(createdAt: string) {
    return (now.getTime() - new Date(createdAt).getTime()) / 86400000;
  }
  const agingBuckets = [
    { label: "< 7 days",   bar: "bg-emerald-400", count: activeCapas.filter((c) => ageInDays(c.created_at) < 7).length },
    { label: "7-30 days",  bar: "bg-amber-400",   count: activeCapas.filter((c) => { const d = ageInDays(c.created_at); return d >= 7 && d < 30; }).length },
    { label: "30-90 days", bar: "bg-orange-400",  count: activeCapas.filter((c) => { const d = ageInDays(c.created_at); return d >= 30 && d < 90; }).length },
    { label: "> 90 days",  bar: "bg-red-500",     count: activeCapas.filter((c) => ageInDays(c.created_at) >= 90).length },
  ];
  const maxAgeBucket = Math.max(...agingBuckets.map((b) => b.count), 1);

  const severityRows = [
    { label: "Critical", cls: "bg-red-700 text-white",           count: activeCapas.filter((c) => c.severity === "critical").length },
    { label: "High",     cls: "bg-red-100 text-red-700",         count: activeCapas.filter((c) => c.severity === "high").length },
    { label: "Medium",   cls: "bg-amber-100 text-amber-700",     count: activeCapas.filter((c) => c.severity === "medium").length },
    { label: "Low",      cls: "bg-emerald-100 text-emerald-700", count: activeCapas.filter((c) => c.severity === "low").length },
  ].filter((s) => s.count > 0);

  const corrective  = capas.filter((c) => c.kind === "corrective").length;
  const preventive  = capas.filter((c) => c.kind === "preventive").length;
  const closureRate = capas.length > 0 ? Math.round((closed / capas.length) * 100) : 0;

  // Source breakdown
  const bySource: Record<string, number> = {};
  capas.forEach((c) => { bySource[c.source_type] = (bySource[c.source_type] ?? 0) + 1; });
  const sourceRows = Object.entries(bySource)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ label: key.replace(/_/g, " "), count }));
  const maxSource = Math.max(...sourceRows.map((r) => r.count), 1);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Corrective Actions"
        subtitle="Corrective and preventive actions — audit findings, incidents, AI flags"
        actions={
          <div className="flex gap-2">
            <CapaExportButton capas={capas} profiles={profiles} />
            <AddCapaButton profiles={profiles} />
          </div>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
          <Stat label="Open"           value={open}                hint="Awaiting start"      accent="#2563eb" />
          <Stat label="In Progress"    value={inProgress}          hint="Active actions"       accent="#f59e0b" />
          <Stat label="Overdue"        value={overdue}             hint="Past due date"        accent={overdue > 0 ? "#dc2626" : "#10b981"} />
          <Stat label="Pending Verif." value={pendingVerification} hint="Awaiting sign-off"    accent="#7c3aed" />
          <Stat label="Closed"         value={closed}              hint="Completed & verified" accent="#10b981" />
        </div>

        {/* Overdue alert */}
        {overdue > 0 && (
          <div className="mb-5 rounded-xl border-l-4 border-red-500 bg-red-50 p-4">
            <div className="text-sm font-semibold text-red-900">
              {overdue} Overdue CAPA Action{overdue > 1 ? "s" : ""} — Immediate Attention Required
            </div>
            <div className="mt-0.5 text-xs text-red-700">
              {capas.filter((c) => c.status === "overdue").map((c) => c.title).join(" · ")}
            </div>
          </div>
        )}

        {/* Analytics strip */}
        <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Aging distribution */}
          <Card>
            <CardHeader title="Action Aging" subtitle={`${activeCapas.length} active`} />
            <div className="px-4 pb-4 space-y-2.5">
              {agingBuckets.map((b) => (
                <div key={b.label} className="flex items-center gap-2.5">
                  <div className="w-20 shrink-0 text-[10.5px] text-slate-500">{b.label}</div>
                  <div className="flex-1 h-4 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${b.bar} transition-all`}
                      style={{ width: `${Math.max((b.count / maxAgeBucket) * 100, b.count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  <div className="w-4 text-xs font-bold text-slate-700 text-right">{b.count}</div>
                </div>
              ))}
              {activeCapas.length === 0 && (
                <div className="text-xs text-slate-400">No active actions.</div>
              )}
            </div>
          </Card>

          {/* Severity + kind split */}
          <Card>
            <CardHeader title="Open by Severity" subtitle={`${closureRate}% closure rate`} />
            <div className="px-4 pb-4">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {severityRows.length > 0 ? severityRows.map((s) => (
                  <span key={s.label} className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
                    {s.label} &nbsp;<strong>{s.count}</strong>
                  </span>
                )) : <span className="text-xs text-emerald-600 font-medium">No open actions</span>}
              </div>
              <div className="border-t border-slate-100 pt-2.5 grid grid-cols-2 gap-2 text-center">
                <div>
                  <div className="text-2xl font-black text-orange-600">{corrective}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Corrective</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-blue-600">{preventive}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Preventive</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Source breakdown */}
          <Card>
            <CardHeader title="Actions by Source" subtitle="Where CAPAs originate" />
            <div className="px-4 pb-4 space-y-2.5">
              {sourceRows.map((r) => (
                <div key={r.label} className="flex items-center gap-2.5">
                  <div className="w-28 shrink-0 text-[10.5px] capitalize text-slate-500">{r.label}</div>
                  <div className="flex-1 h-4 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-400 transition-all"
                      style={{ width: `${Math.max((r.count / maxSource) * 100, r.count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  <div className="w-4 text-xs font-bold text-slate-700 text-right">{r.count}</div>
                </div>
              ))}
              {sourceRows.length === 0 && (
                <div className="text-xs text-slate-400">No CAPAs recorded.</div>
              )}
            </div>
          </Card>
        </div>

        {/* Table with filter tabs */}
        <CapaTable capas={capas} profiles={profiles} />
      </div>
    </div>
  );
}

