import Link from "next/link";
import { getIncidents, getProfiles, getCapaActions } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import { PageHeader, Stat, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { SeverityBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Severity } from "@/lib/constants";
import { AddIncidentButton } from "./AddIncidentButton";
import { IncidentExportButton } from "./IncidentExportButton";
import { ClipboardList, AlertTriangle } from "lucide-react";

const INCIDENT_STATUS_STYLE: Record<string, string> = {
  reported:              "bg-blue-100 text-blue-700",
  under_investigation:   "bg-amber-100 text-amber-700",
  capa_open:             "bg-orange-100 text-orange-700",
  closed:                "bg-emerald-100 text-emerald-700",
};

const INCIDENT_STATUS_LABEL: Record<string, string> = {
  reported:              "Reported",
  under_investigation:   "Under Investigation",
  capa_open:             "CAPA Open",
  closed:                "Closed",
};

function fmt(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function IncidentsPage() {
  const tenantId = await getEffectiveTenantId();

  const [incidents, profiles, capas] = await Promise.all([
    getIncidents(tenantId),
    getProfiles(tenantId),
    getCapaActions(tenantId),
  ]);

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

  const open              = incidents.filter((i) => i.status !== "closed").length;
  const investigating     = incidents.filter((i) => i.status === "under_investigation").length;
  const regulatory        = incidents.filter((i) => i.regulatory_reportable).length;
  const lostTime          = incidents.filter((i) => (i.lost_time_days ?? 0) > 0).length;

  // ── Monthly trend — last 12 months ────────────────────────────────────────
  const now = new Date();
  const months: { label: string; key: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      key,
      label: d.toLocaleString("en-US", { month: "short" }),
      count: incidents.filter((inc) => inc.occurred_at.startsWith(key)).length,
    });
  }
  const maxMonth = Math.max(...months.map((m) => m.count), 1);
  const slotW = 500 / 12;
  const barW  = Math.max(slotW * 0.65, 8);

  // ── CAPA linkage map ───────────────────────────────────────────────────────
  const capasByIncident: Record<string, { status: string }[]> = {};
  capas.forEach((c) => {
    if (c.source_type === "incident" && c.source_id) {
      if (!capasByIncident[c.source_id]) capasByIncident[c.source_id] = [];
      capasByIncident[c.source_id].push({ status: c.status });
    }
  });

  // ── Type breakdown ─────────────────────────────────────────────────────────
  const byType: Record<string, number> = {};
  incidents.forEach((i) => { byType[i.incident_type ?? "other"] = (byType[i.incident_type ?? "other"] ?? 0) + 1; });
  const typeRows = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxType  = Math.max(...typeRows.map(([, n]) => n), 1);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Incident Reporting"
        subtitle="Near-misses, injuries, chemical spills, and regulatory-reportable events"
        actions={
          <div className="flex gap-2">
            <IncidentExportButton incidents={incidents} profiles={profiles} />
            <AddIncidentButton />
          </div>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total Incidents"      value={incidents.length}  hint="All records"            />
          <Stat label="Open / Investigating" value={open}              hint="Require follow-up"       accent={open > 0 ? "#dc2626" : "#10b981"} />
          <Stat label="Regulatory Reports"   value={regulatory}        hint="Reportable events"       accent={regulatory > 0 ? "#f59e0b" : "#10b981"} />
          <Stat label="Lost-Time Events"     value={lostTime}          hint="Days-away incidents"     accent={lostTime > 0 ? "#dc2626" : "#10b981"} />
        </div>

        {/* Open incidents alert */}
        {investigating > 0 && (
          <div className="mb-5 rounded-xl border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20 p-4">
            <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {investigating} Incident{investigating > 1 ? "s" : ""} Under Investigation
            </div>
            <div className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
              {incidents
                .filter((i) => i.status === "under_investigation")
                .map((i) => i.title)
                .join(" · ")}
            </div>
          </div>
        )}

        {/* Analytics strip */}
        <div className="mb-5 grid grid-cols-2 gap-4">
          {/* Monthly trend chart */}
          <Card>
            <CardHeader title="Incidents — 12-Month Trend" subtitle={`${incidents.length} total on record`} />
            <div className="px-4 pb-4">
              <svg viewBox="0 0 500 70" className="w-full overflow-visible" style={{ height: "80px" }}>
                {months.map((m, i) => {
                  const x  = i * slotW + (slotW - barW) / 2;
                  const barH = maxMonth > 0 ? (m.count / maxMonth) * 44 : 0;
                  const y    = 52 - barH;
                  return (
                    <g key={m.key}>
                      <rect x={x} y={y} width={barW} height={barH + (barH > 0 ? 0 : 0)} rx="3"
                        fill={m.count > 0 ? "#3b82f6" : "#e2e8f0"} />
                      {m.count > 0 && (
                        <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="8" fontWeight="600" fill="#1e40af">
                          {m.count}
                        </text>
                      )}
                      <text x={x + barW / 2} y={67} textAnchor="middle" fontSize="6.5" fill="#94a3b8">
                        {m.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </Card>

          {/* Incident type breakdown */}
          <Card>
            <CardHeader title="Top Incident Types" subtitle="By occurrence count" />
            <div className="px-4 pb-4 space-y-2">
              {typeRows.map(([type, count]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-32 shrink-0 text-[10.5px] capitalize text-slate-500 dark:text-slate-400 truncate">
                    {type.replace(/_/g, " ")}
                  </div>
                  <div className="flex-1 h-3.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-400 transition-all"
                      style={{ width: `${Math.max((count / maxType) * 100, 8)}%` }}
                    />
                  </div>
                  <div className="w-4 text-xs font-bold text-slate-700 dark:text-slate-200 text-right">{count}</div>
                </div>
              ))}
              {typeRows.length === 0 && <div className="text-xs text-slate-400">No incidents.</div>}
            </div>
          </Card>
        </div>

        {/* Incidents table */}
        <Card>
          <CardHeader
            title="Incident Register"
            subtitle={`${incidents.length} total · ${open} open`}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <th className="px-4 py-2.5 text-left">Incident</th>
                  <th className="px-4 py-2.5 text-left">Type</th>
                  <th className="px-4 py-2.5 text-left">Severity</th>
                  <th className="px-4 py-2.5 text-left">Occurred</th>
                  <th className="px-4 py-2.5 text-left">Location</th>
                  <th className="px-4 py-2.5 text-left">Reporter</th>
                  <th className="px-4 py-2.5 text-left">Flags</th>
                  <th className="px-4 py-2.5 text-left">CAPAs</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {incidents.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-4 py-3 max-w-64">
                      <Link href={`/incidents/${i.id}`} className="font-medium text-blue-700 dark:text-blue-400 hover:underline">
                        {i.title}
                      </Link>
                      <div className="mt-0.5 text-xs text-slate-400 line-clamp-1">{i.description}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Pill className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs capitalize">
                        {(i.incident_type ?? "").replace(/_/g, " ")}
                      </Pill>
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={i.severity as Severity} />
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-600 dark:text-slate-300">{fmt(i.occurred_at)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 max-w-32">{i.location ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                      {profileMap[i.reported_by] ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {i.regulatory_reportable && (
                          <Pill className="bg-red-100 text-red-700 text-[10px]">Reportable</Pill>
                        )}
                        {i.medical_treatment_required && (
                          <Pill className="bg-orange-100 text-orange-700 text-[10px]">Medical</Pill>
                        )}
                        {(i.lost_time_days ?? 0) > 0 && (
                          <Pill className="bg-red-100 text-red-700 text-[10px]">
                            {i.lost_time_days}d lost time
                          </Pill>
                        )}
                        {(i.regulatory_reportable || i.medical_treatment_required || (i.lost_time_days ?? 0) > 0) && (
                          <Link
                            href="/osha"
                            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-800 text-white hover:bg-slate-700"
                            title="Log or verify OSHA 300 entry for this incident"
                          >
                            <ClipboardList className="h-2.5 w-2.5" />
                            OSHA 300 →
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const linked = capasByIncident[i.id] ?? [];
                        if (linked.length === 0)
                          return <span className="text-xs text-slate-300">—</span>;
                        const anyOpen = linked.some((c) => c.status !== "closed" && c.status !== "rejected");
                        return (
                          <Pill className={anyOpen ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"}>
                            {linked.length} CAPA{linked.length > 1 ? "s" : ""}
                          </Pill>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <Pill className={INCIDENT_STATUS_STYLE[i.status] ?? "bg-slate-100 text-slate-600"}>
                        {INCIDENT_STATUS_LABEL[i.status] ?? i.status}
                      </Pill>
                    </td>
                  </tr>
                ))}
                {incidents.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState
                        icon={<AlertTriangle className="h-7 w-7" />}
                        title="No incidents recorded"
                        description="Log a safety event, near miss, or regulatory incident to start tracking."
                        action={{ label: "Log First Incident", href: "/incidents" }}
                      />
                    </td>
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
