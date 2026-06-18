import Link from "next/link";
import { getIncidents, getProfiles } from "@/lib/data/ehsRepo";
import { PageHeader, Stat, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { SeverityBadge } from "@/components/ui/badges";
import type { Severity } from "@/lib/constants";
import { AddIncidentButton } from "./AddIncidentButton";

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
  const incidents = await getIncidents();
  const profiles  = await getProfiles();

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

  const open              = incidents.filter((i) => i.status !== "closed").length;
  const investigating     = incidents.filter((i) => i.status === "under_investigation").length;
  const regulatory        = incidents.filter((i) => i.regulatory_reportable).length;
  const lostTime          = incidents.filter((i) => (i.lost_time_days ?? 0) > 0).length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Incident Reporting"
        subtitle="Near-misses, injuries, chemical spills, and regulatory-reportable events"
        actions={
          <AddIncidentButton />
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
          <div className="mb-5 rounded-xl border-l-4 border-amber-500 bg-amber-50 p-4">
            <div className="text-sm font-semibold text-amber-900">
              {investigating} Incident{investigating > 1 ? "s" : ""} Under Investigation
            </div>
            <div className="mt-0.5 text-xs text-amber-700">
              {incidents
                .filter((i) => i.status === "under_investigation")
                .map((i) => i.title)
                .join(" · ")}
            </div>
          </div>
        )}

        {/* Incidents table */}
        <Card>
          <CardHeader
            title="Incident Register"
            subtitle={`${incidents.length} total · ${open} open`}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Incident</th>
                  <th className="px-4 py-2.5 text-left">Type</th>
                  <th className="px-4 py-2.5 text-left">Severity</th>
                  <th className="px-4 py-2.5 text-left">Occurred</th>
                  <th className="px-4 py-2.5 text-left">Location</th>
                  <th className="px-4 py-2.5 text-left">Reporter</th>
                  <th className="px-4 py-2.5 text-left">Flags</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {incidents.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 max-w-64">
                      <Link href={`/incidents/${i.id}`} className="font-medium text-blue-700 hover:underline">
                        {i.title}
                      </Link>
                      <div className="mt-0.5 text-xs text-slate-400 line-clamp-1">{i.description}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Pill className="bg-slate-100 text-slate-600 text-xs capitalize">
                        {(i.incident_type ?? "").replace(/_/g, " ")}
                      </Pill>
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={i.severity as Severity} />
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-600">{fmt(i.occurred_at)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-32">{i.location ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
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
                      </div>
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
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                      No incidents recorded.
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
