"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Microscope,
  FlaskConical,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Users,
  CalendarDays,
  Activity,
} from "lucide-react";
import { Card, CardHeader, Pill } from "@/components/ui/primitives";
import { EditLabButton } from "../EditLabButton";
import type { BiosafetyLab, BiohazardAgent, Incident } from "@/lib/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function bslColor(bsl: string) {
  if (bsl.startsWith("BSL-3") || bsl.startsWith("BSL-4"))
    return "bg-red-100 text-red-700 border border-red-200";
  if (bsl.startsWith("BSL-2"))
    return "bg-amber-100 text-amber-700 border border-amber-200";
  return "bg-blue-100 text-blue-700";
}

function statusColor(s: string) {
  const map: Record<string, string> = {
    compliant:            "bg-emerald-100 text-emerald-700",
    minor_gap:            "bg-amber-100 text-amber-700",
    major_gap:            "bg-red-100 text-red-700",
    inspection_due:       "bg-orange-100 text-orange-700",
    registered:           "bg-blue-100 text-blue-700",
    review_required:      "bg-amber-100 text-amber-700",
    suspended:            "bg-red-100 text-red-700",
    reported:             "bg-amber-100 text-amber-700",
    under_investigation:  "bg-orange-100 text-orange-700",
    closed:               "bg-emerald-100 text-emerald-700",
  };
  return map[s] ?? "bg-slate-100 text-slate-600";
}

function agentStatusColor(s: string) {
  if (s === "suspended")       return "bg-red-100 text-red-700";
  if (s === "review_required") return "bg-amber-100 text-amber-700";
  return "bg-blue-100 text-blue-700";
}

function incidentSeverityColor(s: string) {
  if (s === "critical") return "bg-red-100 text-red-700";
  if (s === "high")     return "bg-orange-100 text-orange-700";
  if (s === "medium")   return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  lab: BiosafetyLab;
  agents: BiohazardAgent[];
  incidents: Incident[];
}

export function LabDetail({ lab, agents, incidents }: Props) {
  const nextInspectionOverdue = isOverdue(lab.next_inspection);

  const statusIcon =
    lab.status === "compliant" ? (
      <ShieldCheck className="h-5 w-5 text-emerald-500" />
    ) : lab.status === "major_gap" ? (
      <AlertTriangle className="h-5 w-5 text-red-500" />
    ) : (
      <Clock className="h-5 w-5 text-amber-500" />
    );

  const riskGroupCounts = ["Risk Group 1", "Risk Group 2", "Risk Group 3", "Risk Group 4"].map(
    (rg) => ({ label: rg, count: agents.filter((a) => a.risk_class === rg).length }),
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <Link
            href="/biosafety"
            className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Biosafety
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <Microscope className="h-5 w-5 text-blue-500 shrink-0" />
            <h1 className="text-lg font-bold text-slate-900">{lab.name}</h1>
            <Pill className={bslColor(lab.bsl_level)}>{lab.bsl_level}</Pill>
            <Pill className={statusColor(lab.status)}>
              {lab.status.replace(/_/g, " ")}
            </Pill>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {lab.lab_code}
            {lab.personnel_count > 0 && (
              <>
                {" "}·{" "}
                <Users className="inline h-3 w-3 mb-0.5" /> {lab.personnel_count} personnel
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <EditLabButton lab={lab} />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="iq-scroll flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-3 gap-5">
          {/* ── Left / Main (2 cols) ── */}
          <div className="col-span-2 flex flex-col gap-5">
            {/* Compliance & Inspection status */}
            <Card>
              <CardHeader
                title="Lab Status"
                subtitle="Inspection schedule and compliance standing"
              />
              <div className="p-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  {
                    label: "Compliance Status",
                    value: lab.status.replace(/_/g, " "),
                    icon: statusIcon,
                    accent:
                      lab.status === "compliant"
                        ? "text-emerald-700"
                        : lab.status === "major_gap"
                        ? "text-red-700"
                        : "text-amber-700",
                  },
                  {
                    label: "Open Findings",
                    value: lab.open_findings > 0 ? `${lab.open_findings}` : "None",
                    icon: <AlertTriangle className={`h-5 w-5 ${lab.open_findings > 0 ? "text-red-400" : "text-emerald-400"}`} />,
                    accent: lab.open_findings > 0 ? "text-red-700" : "text-emerald-700",
                  },
                  {
                    label: "Last Inspection",
                    value: fmtDate(lab.last_inspection),
                    icon: <CalendarDays className="h-5 w-5 text-slate-400" />,
                    accent: "text-slate-700",
                  },
                  {
                    label: "Next Inspection Due",
                    value: fmtDate(lab.next_inspection),
                    icon: <CalendarDays className={`h-5 w-5 ${nextInspectionOverdue ? "text-red-400" : "text-slate-400"}`} />,
                    accent: nextInspectionOverdue ? "text-red-600" : "text-slate-700",
                    sub: nextInspectionOverdue ? "Overdue" : undefined,
                  },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {item.icon}
                      {item.label}
                    </div>
                    <div className={`text-sm font-semibold ${item.accent} capitalize`}>
                      {item.value}
                    </div>
                    {item.sub && (
                      <div className="text-[10px] font-medium text-red-500">{item.sub}</div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Notes */}
            {lab.notes && (
              <Card>
                <CardHeader title="Lab Notes" />
                <div className="px-4 pb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {lab.notes}
                </div>
              </Card>
            )}

            {/* Biohazard Agent Inventory */}
            <Card>
              <CardHeader
                title="Registered Biohazard Agents"
                subtitle={
                  agents.length === 0
                    ? "No agents registered to this lab"
                    : `${agents.length} agent${agents.length !== 1 ? "s" : ""} on file`
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {["Agent", "Risk Class", "Storage Location", "Quantity", "Status"].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {agents.map((agent) => (
                      <tr key={agent.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <FlaskConical className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            <span className="text-xs font-medium text-slate-800">
                              {agent.agent_name}
                            </span>
                          </div>
                          <div className="ml-6 text-[10px] text-slate-400">{agent.agent_code}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Pill className="bg-purple-100 text-purple-700">{agent.risk_class}</Pill>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">
                          {agent.storage_location}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-700">{agent.quantity}</td>
                        <td className="px-4 py-2.5">
                          <Pill className={agentStatusColor(agent.status)}>
                            {agent.status.replace(/_/g, " ")}
                          </Pill>
                        </td>
                      </tr>
                    ))}
                    {agents.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-6 text-center text-xs text-slate-400"
                        >
                          No biohazard agents registered to this lab
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Related incidents */}
            <Card>
              <CardHeader
                title="Related BSL Incidents"
                subtitle={
                  incidents.length === 0
                    ? "No biosafety incidents on record"
                    : `${incidents.length} biosafety event${incidents.length !== 1 ? "s" : ""}`
                }
                right={
                  <Link
                    href="/incidents"
                    className="text-[11px] font-medium text-blue-600 hover:underline"
                  >
                    All incidents →
                  </Link>
                }
              />
              <div className="divide-y divide-slate-50">
                {incidents.slice(0, 8).map((inc) => (
                  <Link
                    key={inc.id}
                    href={`/incidents/${inc.id}`}
                    className="flex items-start justify-between gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-800 leading-snug truncate">
                        {inc.title}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-400">
                        <Activity className="h-3 w-3" />
                        <span>{fmtDate(inc.occurred_at)}</span>
                        {inc.location && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[140px]">{inc.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Pill
                        className={incidentSeverityColor(inc.severity)}
                        style={{ fontSize: "9.5px" }}
                      >
                        {inc.severity}
                      </Pill>
                      <Pill
                        className={statusColor(inc.status)}
                        style={{ fontSize: "9.5px" }}
                      >
                        {inc.status.replace(/_/g, " ")}
                      </Pill>
                    </div>
                  </Link>
                ))}
                {incidents.length === 0 && (
                  <div className="px-4 py-5 text-center text-xs text-slate-400">
                    No biosafety incidents recorded
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* ── Right Sidebar ── */}
          <div className="flex flex-col gap-5">
            {/* Lab details card */}
            <Card>
              <CardHeader title="Lab Details" />
              <div className="px-4 py-3 space-y-3">
                {[
                  { label: "Lab Code",       value: lab.lab_code },
                  { label: "BSL Level",      value: lab.bsl_level },
                  { label: "Personnel",      value: `${lab.personnel_count}` },
                  { label: "Status",         value: lab.status.replace(/_/g, " ") },
                  { label: "Open Findings",  value: `${lab.open_findings}` },
                  { label: "Last Inspection", value: fmtDate(lab.last_inspection) },
                  { label: "Next Due",        value: fmtDate(lab.next_inspection) },
                  { label: "Record Created",  value: fmtDate(lab.created_at.slice(0, 10)) },
                  { label: "Last Updated",    value: fmtDate(lab.updated_at.slice(0, 10)) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {label}
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-slate-800 capitalize">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Agent risk summary */}
            <Card>
              <CardHeader title="Agent Risk Summary" subtitle="By risk group classification" />
              <div className="p-4 space-y-2">
                {riskGroupCounts
                  .filter((rg) => rg.count > 0)
                  .map((rg) => (
                    <div
                      key={rg.label}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-600">{rg.label}</span>
                      <span className="font-semibold text-slate-800">
                        {rg.count} agent{rg.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                {riskGroupCounts.every((rg) => rg.count === 0) && (
                  <div className="text-xs text-slate-400">No agents registered</div>
                )}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-600">Needing Review</span>
                  <span
                    className={`font-semibold ${
                      agents.filter((a) => a.status === "review_required").length > 0
                        ? "text-amber-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {agents.filter((a) => a.status === "review_required").length}
                  </span>
                </div>
              </div>
            </Card>

            {/* Quick links */}
            <Card>
              <CardHeader title="Quick Links" />
              <div className="p-3 space-y-1">
                {[
                  { label: "All BSL Labs",          href: "/biosafety" },
                  { label: "Biohazard Agent Register", href: "/biosafety" },
                  { label: "Log a Biosafety Incident", href: "/incidents" },
                  { label: "SOP Library",            href: "/documents" },
                  { label: "CAPA Actions",           href: "/capa" },
                ].map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-blue-500">→</span>
                    {link.label}
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
