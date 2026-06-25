"use client";

import { BarChart3, PieChart, FileText, Presentation, Sheet } from "lucide-react";
import { useTransition } from "react";
import { useDemoUser } from "@/lib/context/demo-user";
import { oshaRate } from "@/lib/osha";
import { saveReport } from "@/lib/actions/ehs";
import { downloadReportPptx, type ReportChart } from "@/lib/reports/pptx";
import { downloadReportXlsx } from "@/lib/reports/xlsx";
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

// ── Report data specs (one per report; rendered to PowerPoint or Excel) ───────

interface ReportData {
  title: string;
  description: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  summary: [string, string | number][];
  fileBase: string;
  accent: string;
  chart?: ReportChart;
}

export function QuickReportsPanel({ capas, incidents, oshaCases, trainingRecs, courseMap, profileMap, legal, chemicals, moduleScores }: Props) {
  const { user } = useDemoUser();
  const co = user.company;
  const firstWord = co.split(" ")[0] || "SafetyIQ";
  const [, startTransition] = useTransition();

  void chemicals; // reserved for future chemical-inventory report

  function complianceData(): ReportData {
    const sorted = [...moduleScores].sort((a, b) => b.score - a.score);
    const overall = sorted.length ? Math.round(sorted.reduce((s, m) => s + m.score, 0) / sorted.length) : 0;
    const atRisk = sorted.filter((m) => m.score < 70).length;
    const passing = sorted.filter((m) => m.score >= 85).length;
    return {
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
      fileBase: "Compliance-Scorecard",
      accent: "2563EB",
      chart: {
        type: "bar",
        title: "Compliance Score by Module",
        labels: sorted.map((m) => (m.module.length > 16 ? m.module.slice(0, 15) + "…" : m.module)),
        series: [{ name: "Score %", values: sorted.map((m) => m.score) }],
      },
    };
  }

  function capaData(): ReportData {
    const now = new Date();
    const open = capas.filter((c) => !["closed", "pending_verification"].includes(c.status));
    const overdue = capas.filter((c) => c.due_date && new Date(c.due_date) < now && !["closed", "pending_verification"].includes(c.status));
    const closed = capas.filter((c) => c.status === "closed" || c.status === "pending_verification");
    return {
      title: "CAPA Status Report",
      description: "Corrective and Preventive Actions — current status and aging",
      headers: ["Title", "Status", "Type", "Severity", "Source Module", "Assigned To", "Due Date", "Days Open", "Created Date"],
      rows: capas.map((c) => {
        const daysOpen = Math.floor((now.getTime() - new Date(c.created_at).getTime()) / 86400000);
        return [
          c.title, humanize(c.status), c.kind === "corrective" ? "Corrective" : "Preventive",
          humanize(c.severity), humanize(c.source_type ?? "manual"), c.owner_id ?? "Unassigned",
          c.due_date ? fmtDate(c.due_date) : "No deadline",
          c.status === "closed" ? "Closed" : `${daysOpen} days`, fmtDate(c.created_at),
        ];
      }),
      summary: [
        ["Total CAPAs", capas.length],
        ["Open / In Progress", open.length],
        ["Overdue", overdue.length],
        ["Closed / Verified", closed.length],
        ["Corrective", capas.filter((c) => c.kind === "corrective").length],
        ["Critical / High", capas.filter((c) => c.severity === "critical" || c.severity === "high").length],
      ],
      fileBase: "CAPA-Status-Report",
      accent: "EA580C",
      chart: {
        type: "doughnut",
        title: "CAPA Status Distribution",
        labels: ["Open (on time)", "Overdue", "Closed / Verified"],
        series: [{ name: "CAPAs", values: [Math.max(0, open.length - overdue.length), overdue.length, closed.length] }],
      },
    };
  }

  function incidentData(): ReportData {
    const now = new Date();
    const ytd = incidents.filter((i) => new Date(i.occurred_at).getFullYear() === now.getFullYear());
    const regulatory = incidents.filter((i) => i.regulatory_reportable);
    const lostTime = incidents.filter((i) => (i.lost_time_days ?? 0) > 0);
    const totalLostDays = incidents.reduce((s, i) => s + (i.lost_time_days ?? 0), 0);
    return {
      title: "Incident Analysis Report",
      description: "Work-related incidents, near-misses, and regulatory events",
      headers: ["Incident Title", "Date", "Severity", "Incident Type", "Status", "Location", "Reporter", "Regulatory Reportable", "Medical Treatment", "Lost Time (Days)", "Description"],
      rows: ytd.map((i) => [
        i.title, fmtDate(i.occurred_at), humanize(i.severity ?? ""), humanize(i.incident_type ?? ""),
        humanize(i.status), i.location ?? "—", profileMap[i.reported_by] ?? i.reported_by ?? "—",
        i.regulatory_reportable ? "Yes — Report Required" : "No", i.medical_treatment_required ? "Yes" : "No",
        i.lost_time_days ?? 0, i.description ?? "—",
      ]),
      summary: [
        ["Incidents YTD", ytd.length],
        ["Under Investigation", ytd.filter((i) => i.status !== "closed").length],
        ["Regulatory Reportable", regulatory.length],
        ["Lost-Time Events", lostTime.length],
        ["Total Lost Days", totalLostDays],
        ["TRIR (per 100 FTE)", oshaRate(oshaCases.length)],
      ],
      fileBase: "Incident-Analysis",
      accent: "DC2626",
      chart: {
        type: "bar",
        title: "Incidents by Severity (YTD)",
        labels: ["Critical", "High", "Medium", "Low"],
        series: [{ name: "Incidents", values: [
          ytd.filter((i) => i.severity === "critical").length,
          ytd.filter((i) => i.severity === "high").length,
          ytd.filter((i) => i.severity === "medium").length,
          ytd.filter((i) => i.severity === "low").length,
        ] }],
      },
    };
  }

  function trainingData(): ReportData {
    const now = new Date();
    const passed = trainingRecs.filter((r) => r.passed).length;
    const failed = trainingRecs.filter((r) => !r.passed).length;
    const expiringSoon = trainingRecs.filter((r) => {
      if (!r.expiry_date) return false;
      const days = (new Date(r.expiry_date).getTime() - now.getTime()) / 86400000;
      return days >= 0 && days <= 30;
    });
    const expired = trainingRecs.filter((r) => r.expiry_date && new Date(r.expiry_date) < now);
    return {
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
          profileMap[r.profile_id] ?? r.profile_id, courseMap[r.course_id] ?? r.course_id,
          fmtDate(r.completed_date), r.expiry_date ? fmtDate(r.expiry_date) : "No expiry",
          certStatus, r.score != null ? `${r.score}%` : "N/A", humanize(r.delivery_method), r.passed ? "Passed" : "Failed",
        ];
      }),
      summary: [
        ["Total Training Records", trainingRecs.length],
        ["Passed", passed],
        ["Failed", failed],
        ["Pass Rate", trainingRecs.length > 0 ? `${Math.round((passed / trainingRecs.length) * 100)}%` : "—"],
        ["Expiring ≤ 30 Days", expiringSoon.length],
        ["Expired — Action Req.", expired.length],
      ],
      fileBase: "Training-Report",
      accent: "10B981",
      chart: {
        type: "doughnut",
        title: "Training Pass / Fail",
        labels: ["Passed", "Failed"],
        series: [{ name: "Records", values: [passed, failed] }],
      },
    };
  }

  function regulatoryData(): ReportData {
    const all = legal;
    const gaps = all.filter((l) => l.status !== "compliant" && l.status !== "not_applicable");
    const majorGaps = gaps.filter((l) => l.status === "major_gap" || l.status === "non_compliant");
    const upcoming = all.filter((l) => {
      const days = (new Date(l.next_review_date).getTime() - new Date().getTime()) / 86400000;
      return days >= 0 && days <= 90;
    });
    return {
      title: "Regulatory Gap Analysis",
      description: "Legal and regulatory compliance obligations — gap status and review schedule",
      headers: ["Regulation Reference", "Title", "Category", "Jurisdiction", "Compliance Status", "Owner", "Next Review Date", "Days to Review", "Gap Severity"],
      rows: all.map((l) => {
        const daysToReview = Math.ceil((new Date(l.next_review_date).getTime() - new Date().getTime()) / 86400000);
        return [
          l.regulation_ref, l.title, humanize(l.category), l.jurisdiction, humanize(l.status),
          l.owner_id ?? "Unassigned", fmtDate(l.next_review_date),
          daysToReview > 0 ? `${daysToReview} days` : "OVERDUE",
          l.status === "non_compliant" ? "CRITICAL" : l.status === "major_gap" ? "HIGH" : l.status === "minor_gap" ? "MEDIUM" : "—",
        ];
      }),
      summary: [
        ["Total Obligations", all.length],
        ["Fully Compliant", all.filter((l) => l.status === "compliant").length],
        ["Minor Gaps", gaps.filter((l) => l.status === "minor_gap").length],
        ["Major / Non-Compliant", majorGaps.length],
        ["Reviews Due ≤ 90 Days", upcoming.length],
        ["Overdue Reviews", all.filter((l) => new Date(l.next_review_date) < new Date()).length],
      ],
      fileBase: "Regulatory-Gap-Analysis",
      accent: "7C3AED",
      chart: {
        type: "bar",
        title: "Regulatory Obligations by Status",
        labels: ["Compliant", "Minor Gap", "Major / Non-Compliant", "N/A"],
        series: [{ name: "Obligations", values: [
          all.filter((l) => l.status === "compliant").length,
          all.filter((l) => l.status === "minor_gap").length,
          majorGaps.length,
          all.filter((l) => l.status === "not_applicable").length,
        ] }],
      },
    };
  }

  function persist(type: string, label: string, rows: number) {
    startTransition(async () => {
      await saveReport({ name: label, report_type: type, metadata: { rows } });
    });
  }

  async function exportPptx(d: ReportData, type: string, label: string) {
    await downloadReportPptx({
      title: d.title, description: d.description, headers: d.headers, rows: d.rows,
      summary: d.summary, companyName: co, accent: d.accent, chart: d.chart,
      fileName: `${firstWord}-${d.fileBase}.pptx`,
    });
    persist(type, label, d.rows.length);
  }

  function exportExcel(d: ReportData, type: string, label: string) {
    downloadReportXlsx({
      title: d.title, description: d.description, headers: d.headers, rows: d.rows,
      summary: d.summary, companyName: co, fileName: `${firstWord}-${d.fileBase}.xlsx`,
    });
    persist(type, label, d.rows.length);
  }

  const REPORTS: { label: string; type: string; icon: typeof BarChart3; color: string; data: () => ReportData }[] = [
    { label: "Compliance Scorecard",    type: "Compliance", icon: BarChart3, color: "bg-blue-50 text-blue-600",    data: complianceData },
    { label: "CAPA Status Report",      type: "CAPA",       icon: FileText,  color: "bg-orange-50 text-orange-600", data: capaData },
    { label: "Incident Analysis",       type: "Incidents",  icon: BarChart3, color: "bg-red-50 text-red-600",       data: incidentData },
    { label: "Training & Competency",   type: "Training",   icon: PieChart,  color: "bg-green-50 text-green-600",   data: trainingData },
    { label: "Regulatory Gap Analysis", type: "Regulatory", icon: FileText,  color: "bg-purple-50 text-purple-600", data: regulatoryData },
  ];

  return (
    <div className="p-3 space-y-1.5">
      <div className="mb-1 px-1 text-[10.5px] text-slate-400">
        Download a branded <span className="font-semibold text-slate-500">PowerPoint</span> deck for presenting, or a formatted <span className="font-semibold text-slate-500">Excel</span> workbook for sortable list/register data.
      </div>
      {REPORTS.map((r) => {
        const Icon = r.icon;
        return (
          <div key={r.label} className="flex items-center gap-2.5 rounded-lg border border-slate-100 px-3 py-2">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${r.color}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <span className="flex-1 truncate text-xs font-medium text-slate-700">{r.label}</span>
            <button
              type="button"
              onClick={() => exportPptx(r.data(), r.type, r.label)}
              title="Download a professional PowerPoint deck"
              className="flex shrink-0 items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-blue-700"
            >
              <Presentation className="h-3 w-3" /> PowerPoint
            </button>
            <button
              type="button"
              onClick={() => exportExcel(r.data(), r.type, r.label)}
              title="Download a formatted Excel workbook (sortable list data)"
              className="flex shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100"
            >
              <Sheet className="h-3 w-3" /> Excel
            </button>
          </div>
        );
      })}
    </div>
  );
}
