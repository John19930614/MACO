import Link from "next/link";
import { Microscope, AlertTriangle, ShieldCheck, FileText, FlaskConical, Biohazard, CheckSquare, Clock, Plus } from "lucide-react";
import { PageHeader, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { getBiosafetyLabs, getBiohazardAgents, getBiosafetyIncidents, getChemicals, getCapaActions } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import { RegisterLabButton } from "./RegisterLabButton";
import { AddAgentButton } from "./AddAgentButton";
import { EditLabButton } from "./EditLabButton";
import { EditAgentButton } from "./EditAgentButton";
import { BiosafetyExportButton } from "./BiosafetyExportButton";

function statusColor(s: string) {
  const map: Record<string, string> = {
    compliant:        "bg-emerald-100 text-emerald-700",
    minor_gap:        "bg-amber-100 text-amber-700",
    major_gap:        "bg-red-100 text-red-700",
    inspection_due:   "bg-orange-100 text-orange-700",
    registered:       "bg-blue-100 text-blue-700",
    review_required:  "bg-amber-100 text-amber-700",
    suspended:        "bg-red-100 text-red-700",
    investigated:     "bg-blue-100 text-blue-700",
    closed:           "bg-emerald-100 text-emerald-700",
    capa_open:        "bg-orange-100 text-orange-700",
    reported:         "bg-amber-100 text-amber-700",
    under_investigation: "bg-orange-100 text-orange-700",
  };
  return map[s] ?? "bg-slate-100 text-slate-600";
}

function bslColor(bsl: string) {
  if (bsl.startsWith("BSL-3")) return "bg-red-100 text-red-700 border border-red-200";
  if (bsl.startsWith("BSL-2")) return "bg-amber-100 text-amber-700 border border-amber-200";
  return "bg-blue-100 text-blue-700";
}

function severityColor(s: string) {
  if (s === "critical") return "bg-red-100 text-red-700";
  if (s === "high")     return "bg-orange-100 text-orange-700";
  if (s === "medium")   return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function incidentDisplayType(incident_type: string, title: string): string {
  if (incident_type === "medical_treatment" || title.toLowerCase().includes("needle")) return "Needle Stick / Sharps";
  if (incident_type === "environmental_spill") return "Spill";
  if (incident_type === "near_miss") return "PPE / Protocol Deviation";
  return incident_type.replace(/_/g, " ");
}

export default async function BiosafetyPage() {
  const tenantId = await getEffectiveTenantId();

  const [labs, agents, bslIncidents, chemicals, allCapas] = await Promise.all([
    getBiosafetyLabs(tenantId),
    getBiohazardAgents(tenantId),
    getBiosafetyIncidents(tenantId),
    getChemicals(tenantId),
    getCapaActions(tenantId),
  ]);

  const inspectionsDue = labs.filter((l) => l.status === "inspection_due").length;
  const openBslIncidents = bslIncidents.filter(
    (i) => i.status === "reported" || i.status === "under_investigation"
  ).length;
  const reviewRequired = agents.filter((a) => a.status === "review_required").length;

  // Derive compliance checklist items from live data
  const labsWithFindings = labs.filter((l) => l.open_findings > 0);
  const allCompliant     = labs.length > 0 && labs.every((l) => l.status === "compliant");
  const inspectionOverdue = labs.some((l) => l.next_inspection && new Date(l.next_inspection) < new Date());
  const highHazardChems  = chemicals.filter(
    (c) => c.is_scheduled || c.hazard_statements.some((h) => ["H350","H331","H330","H311","H310","H300","H351"].some((hh) => h.startsWith(hh)))
  );
  const openBslCapas = allCapas.filter(
    (c) => (c.source_type === "audit_finding" || c.source_type === "incident") &&
           (c.status === "open" || c.status === "in_progress" || c.status === "overdue")
  );

  const COMPLIANCE_ITEMS = [
    {
      label: "Lab Inspection Schedule",
      status: inspectionOverdue ? "Overdue — action required" : inspectionsDue > 0 ? `${inspectionsDue} inspection${inspectionsDue > 1 ? "s" : ""} due` : "All labs current",
      ok: inspectionOverdue ? false : inspectionsDue > 0 ? null : true,
    },
    {
      label: "Biological Agent Register",
      status: reviewRequired > 0 ? `${reviewRequired} agent${reviewRequired > 1 ? "s" : ""} need review` : `${agents.length} agents registered`,
      ok: reviewRequired > 0 ? null : true,
    },
    {
      label: "Open BSL Findings",
      status: labsWithFindings.length > 0 ? `${labsWithFindings.map((l) => l.name).join(", ")}` : "No open findings",
      ok: labsWithFindings.length > 0 ? false : true,
    },
    {
      label: "Open Incident Investigations",
      status: openBslIncidents > 0 ? `${openBslIncidents} investigation${openBslIncidents > 1 ? "s" : ""} in progress` : "None open",
      ok: openBslIncidents > 0 ? false : true,
    },
    {
      label: "Lab Safety CAPAs",
      status: openBslCapas.length > 0 ? `${openBslCapas.length} open corrective action${openBslCapas.length > 1 ? "s" : ""}` : "All actions closed",
      ok: openBslCapas.length > 0 ? null : true,
    },
    {
      label: "High-Hazard Chemicals in Labs",
      status: highHazardChems.length > 0 ? `${highHazardChems.length} high-hazard chemical${highHazardChems.length > 1 ? "s" : ""} on file` : "No high-hazard chemicals",
      ok: highHazardChems.length > 0 ? null : true,
    },
    {
      label: "Overall Lab Compliance",
      status: allCompliant ? "All labs compliant" : `${labs.filter((l) => l.status !== "compliant").length} non-compliant lab${labs.filter((l) => l.status !== "compliant").length > 1 ? "s" : ""}`,
      ok: allCompliant,
    },
  ];

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <PageHeader
        title="Biosafety & Lab Safety"
        subtitle="Biological agent inventory, BSL classifications, lab inspections, and containment compliance"
        actions={
          <div className="flex items-center gap-2">
            <BiosafetyExportButton labs={labs} agents={agents} incidents={bslIncidents} />
            <Link
              href="/documents"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" />
              SOP Library
            </Link>
            <Link
              href="/incidents"
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Log Incident
            </Link>
          </div>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-5">
        {/* KPI strip */}
        <div className="mb-5 grid grid-cols-4 gap-4">
          {[
            { label: "BSL Labs Registered", value: labs.length,         sub: labs.map((l) => l.bsl_level).filter((v, i, a) => a.indexOf(v) === i).join(", "), color: "text-blue-700",   bg: "bg-blue-50 border-blue-100",     icon: Microscope   },
            { label: "Biohazard Agents",    value: agents.length,        sub: reviewRequired > 0 ? `${reviewRequired} needing review` : "All registered",                                 color: "text-amber-700", bg: "bg-amber-50 border-amber-100",   icon: Biohazard    },
            { label: "Inspections Due",     value: inspectionsDue,       sub: inspectionsDue > 0 ? "Immediate attention required" : "All labs current",                                   color: "text-orange-700",bg: "bg-orange-50 border-orange-100", icon: Clock        },
            { label: "Open BSL Incidents",  value: openBslIncidents,     sub: openBslIncidents > 0 ? "Investigation in progress" : "No open incidents",                                   color: "text-red-700",   bg: "bg-red-50 border-red-100",       icon: AlertTriangle},
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{s.label}</div>
                    <div className={`mt-1 text-3xl font-extrabold ${s.color}`}>{s.value}</div>
                    <div className="mt-0.5 text-[10.5px] text-slate-400">{s.sub}</div>
                  </div>
                  <Icon className={`h-6 w-6 ${s.color} opacity-40`} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* Left / center columns */}
          <div className="col-span-2 flex flex-col gap-5">
            {/* Lab Registrations */}
            <Card>
              <CardHeader
                title="Registered BSL Laboratories"
                subtitle="Inspection status and compliance for each registered lab"
                right={<RegisterLabButton />}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {["Lab / Location", "BSL", "Personnel", "Last Inspection", "Next Due", "Status", ""].map((h, i) => (
                        <th key={h || `col-${i}`} className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {labs.map((lab) => (
                      <tr key={lab.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-slate-800 text-xs">{lab.name}</div>
                          <div className="text-[10px] text-slate-400">{lab.lab_code} · {lab.open_findings > 0 ? `${lab.open_findings} open finding${lab.open_findings > 1 ? "s" : ""}` : "No open findings"}</div>
                        </td>
                        <td className="px-4 py-2.5"><Pill className={bslColor(lab.bsl_level)}>{lab.bsl_level}</Pill></td>
                        <td className="px-4 py-2.5 text-xs text-slate-700">{lab.personnel_count}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{fmtDate(lab.last_inspection)}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{fmtDate(lab.next_inspection)}</td>
                        <td className="px-4 py-2.5"><Pill className={statusColor(lab.status)}>{lab.status.replace(/_/g, " ")}</Pill></td>
                        <td className="px-4 py-2.5 text-right"><EditLabButton lab={lab} /></td>
                      </tr>
                    ))}
                    {labs.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-6 text-center text-xs text-slate-400">No labs registered</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Biohazard inventory */}
            <Card>
              <CardHeader
                title="Biological Agent Inventory"
                subtitle="Registered biohazardous materials and storage locations"
                right={<AddAgentButton />}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {["Agent", "Risk Class", "Storage Location", "Quantity", "Status", ""].map((h, i) => (
                        <th key={h || `col-${i}`} className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {agents.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <FlaskConical className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-xs font-medium text-slate-800">{item.agent_name}</span>
                          </div>
                          <div className="ml-6 text-[10px] text-slate-400">{item.agent_code}</div>
                        </td>
                        <td className="px-4 py-2.5"><Pill className="bg-purple-100 text-purple-700">{item.risk_class}</Pill></td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{item.storage_location}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-700">{item.quantity}</td>
                        <td className="px-4 py-2.5"><Pill className={statusColor(item.status)}>{item.status.replace(/_/g, " ")}</Pill></td>
                        <td className="px-4 py-2.5 text-right"><EditAgentButton agent={item} /></td>
                      </tr>
                    ))}
                    {agents.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-400">No agents registered</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-5">
            {/* Compliance summary — live derived */}
            <Card>
              <CardHeader title="Biosafety Compliance" subtitle="Derived from live program data" />
              <div className="p-4 space-y-3">
                {COMPLIANCE_ITEMS.map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    {item.ok === true  && <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />}
                    {item.ok === false && <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />}
                    {item.ok === null  && <Clock className="h-4 w-4 shrink-0 text-amber-500" />}
                    <div className="flex-1 text-xs text-slate-700">{item.label}</div>
                    <div className={`text-[11px] font-semibold ${item.ok === true ? "text-emerald-600" : item.ok === false ? "text-red-600" : "text-amber-600"}`}>
                      {item.status}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* High-hazard chemicals cross-reference */}
            {highHazardChems.length > 0 && (
              <Card>
                <CardHeader
                  title="High-Hazard Chemicals"
                  subtitle="Chemicals requiring BSL-level controls"
                  right={
                    <Link href="/chemicals" className="text-[11px] font-medium text-blue-600 hover:underline">
                      View all →
                    </Link>
                  }
                />
                <div className="divide-y divide-slate-50">
                  {highHazardChems.slice(0, 5).map((c) => (
                    <Link key={c.id} href={`/chemicals/${c.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors">
                      <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-800 truncate">{c.name}</div>
                        <div className="text-[10px] text-slate-400">{c.storage_location ?? "—"} · {c.cas_number ?? "No CAS"}</div>
                      </div>
                      <Pill className={c.is_scheduled ? "bg-red-100 text-red-700 text-[10px]" : "bg-amber-100 text-amber-700 text-[10px]"}>
                        {c.is_scheduled ? "Scheduled" : "High-Hazard"}
                      </Pill>
                    </Link>
                  ))}
                  {highHazardChems.length > 5 && (
                    <div className="px-3 py-2 text-[11px] text-slate-400">
                      +{highHazardChems.length - 5} more · <Link href="/chemicals" className="text-blue-600 hover:underline">View all</Link>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Recent BSL incidents */}
            <Card>
              <CardHeader
                title="Recent BSL Incidents"
                subtitle={`${bslIncidents.length} biosafety event${bslIncidents.length !== 1 ? "s" : ""}`}
                right={
                  <Link href="/incidents" className="text-xs font-medium text-blue-600 hover:underline">
                    All incidents →
                  </Link>
                }
              />
              <div className="divide-y divide-slate-50">
                {bslIncidents.slice(0, 5).map((inc) => (
                  <Link key={inc.id} href={`/incidents/${inc.id}`} className="block px-3 py-2.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-medium text-slate-800 leading-snug">
                        {incidentDisplayType(inc.incident_type, inc.title)}
                      </div>
                      <Pill className={severityColor(inc.severity)} style={{ fontSize: "9.5px" }}>{inc.severity}</Pill>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10.5px] text-slate-400">
                      <span className="truncate max-w-[120px]">{inc.location}</span>
                      <span>·</span>
                      <span>{fmtDate(inc.occurred_at)}</span>
                    </div>
                    <Pill className={`mt-1 ${statusColor(inc.status)}`} style={{ fontSize: "9.5px" }}>{inc.status.replace(/_/g, " ")}</Pill>
                  </Link>
                ))}
                {bslIncidents.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-slate-400">No biosafety incidents recorded</div>
                )}
              </div>
            </Card>

            {/* Quick stats */}
            <Card>
              <CardHeader title="Agent Risk Summary" subtitle="By risk group classification" />
              <div className="p-4 space-y-2">
                {["Risk Group 1", "Risk Group 2", "Risk Group 3"].map((rg) => {
                  const count = agents.filter((a) => a.risk_class === rg).length;
                  return (
                    <div key={rg} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{rg}</span>
                      <span className="font-semibold text-slate-800">{count} agent{count !== 1 ? "s" : ""}</span>
                    </div>
                  );
                })}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-600">Review Required</span>
                  <span className={`font-semibold ${reviewRequired > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {reviewRequired}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
