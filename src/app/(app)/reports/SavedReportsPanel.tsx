"use client";

import { FileText, Download } from "lucide-react";
import { useDemoUser } from "@/lib/context/demo-user";
import { Pill } from "@/components/ui/primitives";
import { oshaRate } from "@/lib/osha";
import type { CapaAction, Incident, OshaCase, TrainingRecord, Chemical } from "@/lib/types";

interface ModuleScore {
  module: string;
  score: number;
  trend: string;
  delta: string;
  openIssues: number;
  issueLabel: string;
}

interface Props {
  reports: Array<{ name: string; type: string; generated: string; pages: number }>;
  capas: CapaAction[];
  incidents: Incident[];
  oshaCases: OshaCase[];
  trainingRecs: TrainingRecord[];
  chemicals: Chemical[];
  moduleScores: ModuleScore[];
  courseMap: Record<string, string>;
  profileMap: Record<string, string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date((d.includes("T") ? d : d + "T00:00:00")).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function humanize(s: string | null | undefined): string {
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function esc(v: string | number | boolean | null | undefined): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function buildReport(opts: {
  title: string;
  description: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  summary?: [string, string | number][];
  companyName: string;
}): string {
  const now = new Date();
  const generated = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const year = now.getFullYear();

  const headerBlock = [
    [esc(opts.companyName), esc("EHS Compliance Documentation")],
    [esc(opts.title), esc(opts.description)],
    [esc("SafetyIQ · Reliance Predictive Safety Technologies"), ""],
    [esc("Generated:"), esc(generated)],
    [esc("Reporting Period:"), esc(`Calendar Year ${year}`)],
    [esc("Total Records:"), esc(String(opts.rows.length))],
    ["", ""],
  ].map((r) => r.join(","));

  const dataRows = [
    opts.headers.map(esc).join(","),
    ...opts.rows.map((r) => r.map(esc).join(",")),
  ];

  const summaryRows: string[] = [];
  if (opts.summary?.length) {
    summaryRows.push("", [esc("── SUMMARY ──"), ""].join(","));
    for (const [label, val] of opts.summary) {
      summaryRows.push([esc(label), esc(String(val))].join(","));
    }
  }

  return "﻿" + [...headerBlock, ...dataRows, ...summaryRows].join("\n");
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Export functions ──────────────────────────────────────────────────────────

function exportComplianceSummary(moduleScores: ModuleScore[], companyName: string) {
  const sorted  = [...moduleScores].sort((a, b) => b.score - a.score);
  const overall = Math.round(sorted.reduce((s, m) => s + m.score, 0) / sorted.length);
  const atRisk  = sorted.filter((m) => m.score < 70).length;
  const passing = sorted.filter((m) => m.score >= 85).length;

  const csv = buildReport({
    title: "EHS Compliance Scorecard",
    description: "Module-by-module compliance assessment with open issue counts",
    headers: ["EHS Module", "Compliance Score", "Trend", "Change (MoM)", "Open Issues", "Issue Category", "Priority"],
    rows: sorted.map((m) => [
      m.module, `${m.score}%`, humanize(m.trend), m.delta, m.openIssues, humanize(m.issueLabel),
      m.score < 70 ? "HIGH — Immediate Action" : m.score < 85 ? "MEDIUM — Monitor" : "LOW — Compliant",
    ]),
    summary: [
      ["Overall Compliance Score", `${overall}%`],
      ["Modules Passing (≥85%)", passing],
      ["Modules At Risk (<70%)", atRisk],
      ["Total Open Issues", moduleScores.reduce((s, m) => s + m.openIssues, 0)],
    ],
    companyName,
  });
  downloadCSV(`${companyName.split(" ")[0]}-Compliance-Scorecard.csv`, csv);
}

function exportChemicalInventory(chemicals: Chemical[], companyName: string) {
  const isoDate    = new Date().toISOString().slice(0, 10);
  const active     = chemicals.filter((c) => c.status === "active").length;
  const scheduled  = chemicals.filter((c) => c.is_scheduled).length;
  const missingSds = chemicals.filter((c) => c.status === "active" && !c.sds_url).length;

  const csv = buildReport({
    title: "Chemical Inventory Audit Report",
    description: "Full chemical inventory with GHS classifications and SDS compliance status",
    headers: [
      "Chemical Name", "CAS Number", "Quantity", "Unit", "Storage Location",
      "GHS Hazard Statements", "OSHA Scheduled?", "SDS On File", "SDS Expiry", "Status",
    ],
    rows: chemicals.map((c) => [
      c.name,
      c.cas_number ?? "—",
      c.quantity ?? "",
      c.unit ?? "",
      c.storage_location,
      c.hazard_statements.slice(0, 4).join("; "),
      c.is_scheduled ? `Yes — ${c.schedule_ref ?? "Controlled Substance"}` : "No",
      c.sds_url ? "On file" : "Missing — Action Required",
      c.sds_expiry ? fmtDate(c.sds_expiry) : "No expiry date",
      humanize(c.status),
    ]),
    summary: [
      ["Total Chemicals", chemicals.length],
      ["Active Chemicals", active],
      ["OSHA Scheduled Substances", scheduled],
      ["Missing SDS — Action Required", missingSds],
      ["OSHA 29 CFR 1910.1200 — HazCom requires current SDS for all hazardous chemicals, accessible to employees during work shifts.", ""],
    ],
    companyName,
  });
  downloadCSV(`${companyName.split(" ")[0]}-Chemical-Inventory-${isoDate}.csv`, csv);
}

function exportCapaStatus(capas: CapaAction[], companyName: string) {
  const now     = new Date();
  const isoDate = now.toISOString().slice(0, 10);
  const open    = capas.filter((c) => !["closed", "pending_verification"].includes(c.status));
  const overdue = capas.filter((c) => c.due_date && new Date(c.due_date) < now && !["closed", "pending_verification"].includes(c.status));
  const closed  = capas.filter((c) => c.status === "closed" || c.status === "pending_verification");

  const csv = buildReport({
    title: "CAPA Status Report",
    description: "Corrective and Preventive Actions — current status and aging",
    headers: ["Title", "Status", "Type", "Severity", "Source Module", "Assigned To", "Due Date", "Days Open", "Created Date"],
    rows: capas.map((c) => {
      const daysOpen = Math.floor((now.getTime() - new Date(c.created_at).getTime()) / 86400000);
      return [
        c.title,
        humanize(c.status),
        c.kind === "corrective" ? "Corrective" : "Preventive",
        humanize(c.severity),
        humanize(c.source_type ?? "manual"),
        c.owner_id ?? "Unassigned",
        c.due_date ? fmtDate(c.due_date) : "No deadline",
        c.status === "closed" ? "Closed" : `${daysOpen} days`,
        fmtDate(c.created_at),
      ];
    }),
    summary: [
      ["Total CAPAs", capas.length],
      ["Open / In Progress", open.length],
      ["Overdue", overdue.length],
      ["Closed / Pending Verification", closed.length],
      ["Corrective Actions", capas.filter((c) => c.kind === "corrective").length],
      ["Preventive Actions", capas.filter((c) => c.kind === "preventive").length],
      ["Critical / High Severity", capas.filter((c) => c.severity === "critical" || c.severity === "high").length],
    ],
    companyName,
  });
  downloadCSV(`${companyName.split(" ")[0]}-CAPA-Status-Report-${isoDate}.csv`, csv);
}

function exportTrainingReport(
  trainingRecs: TrainingRecord[],
  courseMap: Record<string, string>,
  profileMap: Record<string, string>,
  companyName: string,
) {
  const now     = new Date();
  const isoDate = now.toISOString().slice(0, 10);
  const passed  = trainingRecs.filter((r) => r.passed).length;
  const failed  = trainingRecs.filter((r) => !r.passed).length;
  const expiringSoon = trainingRecs.filter((r) => {
    if (!r.expiry_date) return false;
    const days = (new Date(r.expiry_date).getTime() - now.getTime()) / 86400000;
    return days >= 0 && days <= 30;
  });
  const expired = trainingRecs.filter((r) => r.expiry_date && new Date(r.expiry_date) < now);

  const csv = buildReport({
    title: "Training Completion & Competency Report",
    description: "Employee training records, certifications, and expiry status",
    headers: ["Employee Name", "Training Course", "Completed Date", "Expiry Date", "Certification Status", "Score (%)", "Delivery Method", "Result"],
    rows: trainingRecs.map((r) => {
      const expiryDate = r.expiry_date ? new Date(r.expiry_date) : null;
      let certStatus = "Current";
      if (!r.passed) certStatus = "Failed";
      else if (expiryDate && expiryDate < now) certStatus = "EXPIRED — Renewal Required";
      else if (expiryDate) {
        const daysLeft = (expiryDate.getTime() - now.getTime()) / 86400000;
        if (daysLeft <= 30) certStatus = `Expiring in ${Math.ceil(daysLeft)} days`;
      }
      return [
        profileMap[r.profile_id] ?? r.profile_id,
        courseMap[r.course_id] ?? r.course_id,
        fmtDate(r.completed_date),
        r.expiry_date ? fmtDate(r.expiry_date) : "No expiry",
        certStatus,
        r.score != null ? `${r.score}%` : "N/A",
        humanize(r.delivery_method),
        r.passed ? "Passed" : "Failed",
      ];
    }),
    summary: [
      ["Total Training Records", trainingRecs.length],
      ["Passed", passed],
      ["Failed", failed],
      ["Pass Rate", trainingRecs.length > 0 ? `${Math.round((passed / trainingRecs.length) * 100)}%` : "—"],
      ["Expiring Within 30 Days", expiringSoon.length],
      ["Expired — Action Required", expired.length],
    ],
    companyName,
  });
  downloadCSV(`${companyName.split(" ")[0]}-Training-Report-${isoDate}.csv`, csv);
}

function exportIncidentAnalysis(incidents: Incident[], oshaCases: OshaCase[], companyName: string) {
  const now     = new Date();
  const isoDate = now.toISOString().slice(0, 10);
  const ytd         = incidents.filter((i) => new Date(i.occurred_at).getFullYear() === now.getFullYear());
  const regulatory  = incidents.filter((i) => i.regulatory_reportable);
  const lostTime    = incidents.filter((i) => (i.lost_time_days ?? 0) > 0);
  const totalLostDays = incidents.reduce((s, i) => s + (i.lost_time_days ?? 0), 0);

  const csv = buildReport({
    title: "Incident Analysis Report",
    description: "Work-related incidents, near-misses, and regulatory events",
    headers: [
      "Incident Title", "Date", "Severity", "Incident Type", "Status",
      "Location", "Regulatory Reportable", "Medical Treatment", "Lost Time (Days)", "Description",
    ],
    rows: ytd.map((i) => [
      i.title,
      fmtDate(i.occurred_at),
      humanize(i.severity ?? ""),
      humanize(i.incident_type ?? ""),
      humanize(i.status),
      i.location ?? "—",
      i.regulatory_reportable ? "Yes — Report Required" : "No",
      i.medical_treatment_required ? "Yes" : "No",
      i.lost_time_days ?? 0,
      i.description ?? "—",
    ]),
    summary: [
      ["Incidents YTD", ytd.length],
      ["Open / Under Investigation", ytd.filter((i) => i.status !== "closed").length],
      ["Regulatory Reportable", regulatory.length],
      ["Lost-Time Events", lostTime.length],
      ["Total Lost Days", totalLostDays],
      ["TRIR (per 100 FTE)", oshaRate(oshaCases.length)],
      ["Incident Rate (all incidents, per 100 FTE)", oshaRate(ytd.length)],
    ],
    companyName,
  });
  downloadCSV(`${companyName.split(" ")[0]}-Incident-Analysis-${isoDate}.csv`, csv);
}

// ── Badge colors ──────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  Compliance: "bg-blue-100 text-blue-700",
  Chemical:   "bg-amber-100 text-amber-700",
  CAPA:       "bg-orange-100 text-orange-700",
  Training:   "bg-green-100 text-green-700",
  Incidents:  "bg-red-100 text-red-700",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SavedReportsPanel({
  reports, capas, incidents, oshaCases, trainingRecs, chemicals, moduleScores, courseMap, profileMap,
}: Props) {
  const { user } = useDemoUser();
  function handleDownload(type: string) {
    const co = user.company;
    switch (type) {
      case "Compliance": exportComplianceSummary(moduleScores, co); break;
      case "Chemical":   exportChemicalInventory(chemicals, co); break;
      case "CAPA":       exportCapaStatus(capas, co); break;
      case "Training":   exportTrainingReport(trainingRecs, courseMap, profileMap, co); break;
      case "Incidents":  exportIncidentAnalysis(incidents, oshaCases, co); break;
    }
  }

  return (
    <div className="divide-y divide-slate-50">
      {reports.map((r) => (
        <div key={r.name} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-50/60">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-medium text-slate-800 leading-snug">{r.name}</div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Pill className={TYPE_COLOR[r.type] ?? "bg-slate-100 text-slate-600"} style={{ fontSize: "9.5px" }}>
                {r.type}
              </Pill>
              <span className="text-[10px] text-slate-400">{r.generated} · {r.pages}p</span>
            </div>
          </div>
          <button
            onClick={() => handleDownload(r.type)}
            title={`Download ${r.type} report as CSV`}
            className="shrink-0 text-slate-300 transition-colors hover:text-blue-500"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
