"use client";

import { BarChart3, PieChart, FileText, Download } from "lucide-react";
import { useTransition } from "react";
import { useDemoUser } from "@/lib/context/demo-user";
import { oshaRate } from "@/lib/osha";
import { saveReport } from "@/lib/actions/ehs";
import type { CapaAction, Incident, OshaCase, TrainingRecord, LegalRequirement, Chemical } from "@/lib/types";

interface ModuleScore {
  module: string;
  score: number;
  trend: string;
  delta: string;
  openIssues: number;
  issueLabel: string;
}

interface Props {
  capas: CapaAction[];
  incidents: Incident[];
  oshaCases: OshaCase[];
  trainingRecs: TrainingRecord[];
  courseMap: Record<string, string>;
  profileMap: Record<string, string>;
  legal: LegalRequirement[];
  chemicals: Chemical[];
  moduleScores: ModuleScore[];
}

// ── Formatting helpers ────────────────────────────────────────────────────────

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

// Builds a polished CSV with a document header block, data table, and optional summary section.
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

  // ﻿ BOM ensures Excel opens UTF-8 CSV correctly
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

export function QuickReportsPanel({ capas, incidents, oshaCases, trainingRecs, courseMap, profileMap, legal, chemicals, moduleScores }: Props) {
  const { user } = useDemoUser();

  function exportComplianceSummary() {
    const sorted = [...moduleScores].sort((a, b) => b.score - a.score);
    const overall = Math.round(sorted.reduce((s, m) => s + m.score, 0) / sorted.length);
    const atRisk = sorted.filter((m) => m.score < 70).length;
    const passing = sorted.filter((m) => m.score >= 85).length;

    const csv = buildReport({
      title: "EHS Compliance Scorecard",
      description: "Module-by-module compliance assessment with open issue counts",
      headers: ["EHS Module", "Compliance Score", "Trend", "Change (MoM)", "Open Issues", "Issue Category", "Priority"],
      rows: sorted.map((m) => [
        m.module,
        `${m.score}%`,
        humanize(m.trend),
        m.delta,
        m.openIssues,
        humanize(m.issueLabel),
        m.score < 70 ? "HIGH — Immediate Action" : m.score < 85 ? "MEDIUM — Monitor" : "LOW — Compliant",
      ]),
      summary: [
        ["Overall Compliance Score", `${overall}%`],
        ["Modules Passing (≥85%)", passing],
        ["Modules At Risk (<70%)", atRisk],
        ["Total Open Issues", moduleScores.reduce((s, m) => s + m.openIssues, 0)],
      ],
      companyName: user.company,
    });
    downloadCSV(`${user.company.split(" ")[0]}-Compliance-Scorecard.csv`, csv);
  }

  function exportCapaStatus() {
    const now = new Date();
    const open = capas.filter((c) => !["closed", "pending_verification"].includes(c.status));
    const overdue = capas.filter((c) => c.due_date && new Date(c.due_date) < now && !["closed", "pending_verification"].includes(c.status));
    const closed = capas.filter((c) => c.status === "closed" || c.status === "pending_verification");

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
      companyName: user.company,
    });
    downloadCSV(`${user.company.split(" ")[0]}-CAPA-Status-Report.csv`, csv);
  }

  function exportIncidentAnalysis() {
    const now = new Date();
    const ytd = incidents.filter((i) => new Date(i.occurred_at).getFullYear() === now.getFullYear());
    const regulatory = incidents.filter((i) => i.regulatory_reportable);
    const lostTime = incidents.filter((i) => (i.lost_time_days ?? 0) > 0);
    const totalLostDays = incidents.reduce((s, i) => s + (i.lost_time_days ?? 0), 0);

    const csv = buildReport({
      title: "Incident Analysis Report",
      description: "Work-related incidents, near-misses, and regulatory events",
      headers: ["Incident Title", "Date", "Severity", "Incident Type", "Status", "Location", "Reporter", "Regulatory Reportable", "Medical Treatment", "Lost Time (Days)", "Description"],
      rows: ytd.map((i) => [
        i.title,
        fmtDate(i.occurred_at),
        humanize(i.severity ?? ""),
        humanize(i.incident_type ?? ""),
        humanize(i.status),
        i.location ?? "—",
        profileMap[i.reported_by] ?? i.reported_by ?? "—",
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
        ["Critical/High Severity", ytd.filter((i) => i.severity === "critical" || i.severity === "high").length],
        ["TRIR (per 100 FTE)", oshaRate(oshaCases.length)],
        ["Incident Rate (all incidents, per 100 FTE)", oshaRate(ytd.length)],
      ],
      companyName: user.company,
    });
    downloadCSV(`${user.company.split(" ")[0]}-Incident-Analysis.csv`, csv);
  }

  function exportTrainingReport() {
    const passed = trainingRecs.filter((r) => r.passed).length;
    const failed = trainingRecs.filter((r) => !r.passed).length;
    const now = new Date();
    const expiringSoon = trainingRecs.filter((r) => {
      if (!r.expiry_date) return false;
      const days = (new Date(r.expiry_date).getTime() - now.getTime()) / 86400000;
      return days >= 0 && days <= 30;
    });
    const expired = trainingRecs.filter((r) => {
      if (!r.expiry_date) return false;
      return new Date(r.expiry_date) < now;
    });

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
      companyName: user.company,
    });
    downloadCSV(`${user.company.split(" ")[0]}-Training-Report.csv`, csv);
  }

  function exportRegulatoryGap() {
    const all = legal;
    const gaps = all.filter((l) => l.status !== "compliant" && l.status !== "not_applicable");
    const majorGaps = gaps.filter((l) => l.status === "major_gap" || l.status === "non_compliant");
    const upcoming = all.filter((l) => {
      const days = (new Date(l.next_review_date).getTime() - new Date().getTime()) / 86400000;
      return days >= 0 && days <= 90;
    });

    const csv = buildReport({
      title: "Regulatory Gap Analysis",
      description: "Legal and regulatory compliance obligations — gap status and review schedule",
      headers: ["Regulation Reference", "Title", "Category", "Jurisdiction", "Compliance Status", "Owner", "Next Review Date", "Days to Review", "Gap Severity"],
      rows: all.map((l) => {
        const daysToReview = Math.ceil((new Date(l.next_review_date).getTime() - new Date().getTime()) / 86400000);
        return [
          l.regulation_ref,
          l.title,
          humanize(l.category),
          l.jurisdiction,
          humanize(l.status),
          l.owner_id ?? "Unassigned",
          fmtDate(l.next_review_date),
          daysToReview > 0 ? `${daysToReview} days` : "OVERDUE",
          l.status === "non_compliant" ? "CRITICAL" : l.status === "major_gap" ? "HIGH" : l.status === "minor_gap" ? "MEDIUM" : "—",
        ];
      }),
      summary: [
        ["Total Obligations Tracked", all.length],
        ["Fully Compliant", all.filter((l) => l.status === "compliant").length],
        ["Minor Gaps", gaps.filter((l) => l.status === "minor_gap").length],
        ["Major Gaps / Non-Compliant", majorGaps.length],
        ["Reviews Due in Next 90 Days", upcoming.length],
        ["Overdue Reviews", all.filter((l) => new Date(l.next_review_date) < new Date()).length],
      ],
      companyName: user.company,
    });
    downloadCSV(`${user.company.split(" ")[0]}-Regulatory-Gap-Analysis.csv`, csv);
  }

  const [, startTransition] = useTransition();

  const REPORTS = [
    { label: "Compliance Scorecard",    type: "Compliance", icon: BarChart3, color: "bg-blue-50 text-blue-600",    fn: exportComplianceSummary },
    { label: "CAPA Status Report",      type: "CAPA",       icon: FileText,  color: "bg-orange-50 text-orange-600", fn: exportCapaStatus },
    { label: "Incident Analysis",       type: "Incidents",  icon: BarChart3, color: "bg-red-50 text-red-600",       fn: exportIncidentAnalysis },
    { label: "Training & Competency",   type: "Training",   icon: PieChart,  color: "bg-green-50 text-green-600",   fn: exportTrainingReport },
    { label: "Regulatory Gap Analysis", type: "Regulatory", icon: FileText,  color: "bg-purple-50 text-purple-600", fn: exportRegulatoryGap },
  ];

  return (
    <div className="p-3 space-y-1.5">
      {REPORTS.map((r) => {
        const Icon = r.icon;
        return (
          <button
            key={r.label}
            onClick={() => {
              r.fn();
              startTransition(async () => {
                await saveReport({ name: r.label, report_type: r.type });
              });
            }}
            className="flex w-full items-center gap-2.5 rounded-lg border border-slate-100 px-3 py-2 text-left transition hover:bg-slate-50"
          >
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${r.color}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <span className="flex-1 text-xs font-medium text-slate-700">{r.label}</span>
            <Download className="h-3.5 w-3.5 text-slate-300" />
          </button>
        );
      })}
    </div>
  );
}
