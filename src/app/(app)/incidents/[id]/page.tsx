import { notFound } from "next/navigation";
import Link from "next/link";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import { getIncidentById, getCapaActions, getProfiles } from "@/lib/data/ehsRepo";
import { Card, CardHeader, Pill } from "@/components/ui/primitives";
import { PrintButton } from "@/components/ui/PrintButton";
import type { PrintReportData } from "@/components/ui/PrintButton";
import { ArrowLeft, AlertTriangle, Clock, MapPin, Activity } from "lucide-react";
import { IncidentRcaPanel } from "./IncidentRcaPanel";
import { EditIncidentForm } from "./EditIncidentForm";
import { CreateCapaButton } from "./CreateCapaButton";
import { getIncidentRegulatoryClocks } from "@/lib/regulatory/read";
import { RegulatoryIncidentReporting } from "./reporting/RegulatoryIncidentReporting";
import { ImmediateResponseChecklist } from "./response-checklist/ImmediateResponseChecklist";
import { CloseIncidentGate } from "./close/CloseIncidentGate";
import { EnvironmentalReleaseInvestigation } from "./environmental-release/EnvironmentalReleaseInvestigation";

function fmt(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function SeverityBadge({ s }: { s: string }) {
  const cls =
    s === "fatality"   ? "bg-black text-white"           :
    s === "critical"   ? "bg-red-700 text-white"          :
    s === "major"      ? "bg-red-100 text-red-700"        :
    s === "serious"    ? "bg-orange-100 text-orange-700"  :
    s === "minor"      ? "bg-yellow-100 text-yellow-700"  :
                         "bg-slate-100 text-slate-600";
  return <Pill className={cls}>{s.charAt(0).toUpperCase() + s.slice(1)}</Pill>;
}

function StatusBadge({ s }: { s: string }) {
  const cls =
    s === "closed"              ? "bg-emerald-100 text-emerald-700" :
    s === "under_investigation" ? "bg-blue-100 text-blue-700"       :
    s === "reported"            ? "bg-amber-100 text-amber-700"     :
    s === "open"                ? "bg-red-100 text-red-700"         :
                                  "bg-slate-100 text-slate-600";
  const label = s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return <Pill className={cls}>{label}</Pill>;
}

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getEffectiveTenantId();

  const [incident, capas, profiles, clocks] = await Promise.all([
    getIncidentById(id),
    getCapaActions(tenantId),
    getProfiles(tenantId),
    getIncidentRegulatoryClocks(id),
  ]);

  if (!incident) notFound();

  const isEnvironmentalRelease = incident.incident_type === "environmental_release";

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));
  const linkedCapas = capas.filter(
    (c) => c.source_type === "incident" && c.source_id === incident.id,
  );

  const oshaFlags = [
    incident.regulatory_reportable && "Regulatory Reportable",
    incident.medical_treatment_required && "Medical Treatment Required",
    (incident.lost_time_days ?? 0) > 0 && `Lost Time (${incident.lost_time_days} days)`,
  ].filter(Boolean) as string[];

  const printData: PrintReportData = {
    reportType: "Incident Report",
    title: incident.title,
    subtitle: `${fmt(incident.occurred_at)}${incident.location ? ` · ${incident.location}` : ""}`,
    meta: `ID: ${incident.id.slice(0, 8)} · Severity: ${incident.severity} · Status: ${incident.status.replace(/_/g, " ")}`,
    sections: [
      {
        heading: "Incident Details",
        rows: [
          { label: "Type",            value: incident.incident_type?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) },
          { label: "Date Occurred",   value: fmt(incident.occurred_at) },
          { label: "Location",        value: incident.location },
          { label: "Severity",        value: incident.severity },
          { label: "Status",          value: incident.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) },
          { label: "Reported By",     value: incident.reported_by ? (profileMap[incident.reported_by] ?? incident.reported_by) : null },
          { label: "Owner",           value: incident.owner_id ? (profileMap[incident.owner_id] ?? incident.owner_id) : null },
          { label: "Date Reported",   value: incident.created_at ? fmt(incident.created_at.slice(0, 10)) : null },
        ],
      },
      ...(incident.description ? [{ heading: "Description", body: incident.description }] : []),
      ...(incident.immediate_actions ? [{ heading: "Immediate Actions Taken", body: incident.immediate_actions }] : []),
      ...(incident.root_cause ? [{ heading: "Root Cause Analysis", body: incident.root_cause }] : []),
      ...((incident.injured_party || incident.injuries_description) ? [{
        heading: "Injury Details",
        rows: [
          { label: "Injured Party",   value: incident.injured_party },
          { label: "Nature",          value: incident.injuries_description },
          { label: "Lost Time",       value: (incident.lost_time_days ?? 0) > 0 ? `${incident.lost_time_days} day(s)` : "None" },
          { label: "Medical Tx",      value: incident.medical_treatment_required ? "Required" : "Not required" },
        ],
      }] : []),
      ...(oshaFlags.length > 0 ? [{ heading: "OSHA & Regulatory Flags", flags: oshaFlags }] : []),
      ...(linkedCapas.length > 0 ? [{
        heading: "Linked CAPAs",
        items: linkedCapas.map((c) => ({
          text: c.title,
          meta: c.due_date ? `Due ${fmt(c.due_date.slice(0, 10))}` : undefined,
          status: c.status.replace(/_/g, " "),
        })),
      }] : []),
    ],
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="iq-scroll flex-1 overflow-y-auto p-5 space-y-5">
        {/* Back nav + title */}
        <div>
          <Link
            href="/incidents"
            className="print:hidden inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Incidents
          </Link>
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-slate-900 leading-tight">{incident.title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {fmt(incident.occurred_at)}
                </span>
                {incident.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {incident.location}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <SeverityBadge s={incident.severity} />
              <StatusBadge s={incident.status} />
              <span className="print:hidden"><PrintButton data={printData} /></span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* Main column */}
          <div className="col-span-2 space-y-5">
            {incident.description && (
              <Card>
                <CardHeader title="Description" />
                <div className="px-4 pb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {incident.description}
                </div>
              </Card>
            )}

            {incident.immediate_actions && (
              <Card>
                <CardHeader title="Immediate Actions Taken" />
                <div className="px-4 pb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {incident.immediate_actions}
                </div>
              </Card>
            )}

            {/* Environmental-release investigation gets its own EPA/state timer set */}
            {isEnvironmentalRelease && (
              <EnvironmentalReleaseInvestigation incidentId={incident.id} clocks={clocks} />
            )}

            {/* Regulatory reporting clocks — the single Reporting Status panel.
                For an environmental-release incident the EPA clocks render in the
                dedicated panel above, so exclude them here to avoid duplicates. */}
            <RegulatoryIncidentReporting
              incidentId={incident.id}
              clocks={isEnvironmentalRelease
                ? clocks.filter((c) => c.jurisdiction !== "epa_environmental_release")
                : clocks}
            />

            {/* Immediate-response checklist */}
            <Card>
              <div className="p-4">
                <ImmediateResponseChecklist incidentId={incident.id} />
              </div>
            </Card>

            {/* AI Root Cause Analysis — always visible, auto-detects incident type */}
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Root Cause Analysis</div>
              <IncidentRcaPanel
                incidentId={incident.id}
                incidentType={incident.incident_type ?? ""}
                title={incident.title}
                description={incident.description ?? ""}
                existingRootCause={incident.root_cause ?? null}
              />
            </div>

            {(incident.injured_party || incident.injuries_description) && (
              <Card>
                <CardHeader title="Injury Details" />
                <div className="px-4 pb-4 space-y-3">
                  {incident.injured_party && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">
                        Injured Party
                      </div>
                      <div className="text-sm text-slate-800">{incident.injured_party}</div>
                    </div>
                  )}
                  {incident.injuries_description && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">
                        Nature of Injuries
                      </div>
                      <div className="text-sm text-slate-700 leading-relaxed">
                        {incident.injuries_description}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">
                        Lost Time
                      </div>
                      <div className="text-sm font-semibold text-slate-800">
                        {(incident.lost_time_days ?? 0) > 0
                          ? `${incident.lost_time_days} day${incident.lost_time_days !== 1 ? "s" : ""}`
                          : "None"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">
                        Medical Treatment
                      </div>
                      <div className="text-sm font-semibold text-slate-800">
                        {incident.medical_treatment_required ? "Required" : "Not required"}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Linked CAPAs */}
            <Card>
              <CardHeader
                title="Linked CAPAs"
                subtitle={
                  linkedCapas.length === 0
                    ? "No CAPAs linked to this incident"
                    : `${linkedCapas.length} corrective action${linkedCapas.length !== 1 ? "s" : ""}`
                }
              />
              <div className="px-4 pb-3">
                <CreateCapaButton incident={incident} />
              </div>
              {linkedCapas.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {linkedCapas.map((c) => (
                    <Link
                      key={c.id}
                      href={`/capa/${c.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-800">{c.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {c.due_date && `Due ${fmt(c.due_date)}`}
                          {c.owner_id && profileMap[c.owner_id] && ` · ${profileMap[c.owner_id]}`}
                        </div>
                      </div>
                      <Pill
                        className={
                          c.status === "closed"               ? "bg-emerald-100 text-emerald-700" :
                          c.status === "in_progress"          ? "bg-blue-100 text-blue-700"       :
                          c.status === "pending_verification" ? "bg-purple-100 text-purple-700"   :
                                                                "bg-amber-100 text-amber-700"
                        }
                      >
                        {c.status.replace(/_/g, " ")}
                      </Pill>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="px-4 pb-4 text-xs text-slate-400">
                  No CAPAs have been linked to this incident yet.
                </div>
              )}
            </Card>
            {/* Edit incident — status change here runs the server-side closure gate */}
            <Card>
              <CardHeader title="Edit incident" subtitle="Update details, status, reviews, and recordability" />
              <div className="px-4 pb-4">
                <EditIncidentForm incident={incident} />
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <Card>
              <CardHeader title="Incident Details" />
              <div className="px-4 pb-4 space-y-3">
                {[
                  {
                    label: "Incident Type",
                    value: incident.incident_type
                      ?.replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase()),
                  },
                  { label: "Date Occurred", value: fmt(incident.occurred_at) },
                  { label: "Location", value: incident.location },
                  {
                    label: "Reported By",
                    value: incident.reported_by
                      ? (profileMap[incident.reported_by] ?? incident.reported_by)
                      : undefined,
                  },
                  {
                    label: "Owner / Investigator",
                    value: incident.owner_id
                      ? (profileMap[incident.owner_id] ?? incident.owner_id)
                      : undefined,
                  },
                ]
                  .filter((f) => f.value)
                  .map((f) => (
                    <div key={f.label}>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {f.label}
                      </div>
                      <div className="mt-0.5 text-sm font-medium text-slate-800">{f.value}</div>
                    </div>
                  ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="OSHA & Regulatory" />
              <div className="px-4 pb-4 space-y-2">
                {oshaFlags.length > 0 ? (
                  oshaFlags.map((flag) => (
                    <div key={flag} className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="text-xs font-medium text-amber-700">{flag}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-emerald-600 font-medium">No regulatory flags</div>
                )}
                {incident.regulatory_report_date && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Reported to Agency
                    </div>
                    <div className="mt-0.5 text-xs text-slate-700">
                      {fmt(incident.regulatory_report_date)}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {incident.status !== "closed" && (
              <Card>
                <CardHeader title="Closing this incident" />
                <div className="px-4 pb-4">
                  <CloseIncidentGate incidentId={incident.id} />
                </div>
              </Card>
            )}

            <Card>
              <CardHeader title="Timeline" />
              <div className="px-4 pb-4 space-y-3">
                {[
                  { label: "Occurred",    value: fmt(incident.occurred_at) },
                  { label: "Reported",    value: incident.created_at ? fmt(incident.created_at.slice(0, 10)) : undefined },
                  { label: "Last Update", value: incident.updated_at ? fmt(incident.updated_at.slice(0, 10)) : undefined },
                ]
                  .filter((f) => f.value)
                  .map((f) => (
                    <div key={f.label} className="flex items-start gap-2">
                      <Activity className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          {f.label}
                        </div>
                        <div className="text-xs font-medium text-slate-700">{f.value}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
