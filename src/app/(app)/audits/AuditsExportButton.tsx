"use client";

import { Download } from "lucide-react";
import { useDemoUser } from "@/lib/context/demo-user";
import type { Audit, AuditFinding, Profile } from "@/lib/types";
import {
  buildXls,
  titleBlock,
  kpiBlock,
  sectionRow,
  blankRow,
  theadRow,
  alt,
} from "@/lib/xlsExport";
import type { XlsCell, XlsRow, StyleId } from "@/lib/xlsExport";

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function severityStyle(sev: string): StyleId {
  if (sev === "critical") return "danger";
  if (sev === "high")     return "warn";
  if (sev === "medium")   return "info";
  return "good";
}

const SCHEDULE_COLS  = [70, 200, 100, 120, 85, 85, 120, 100, 150];
const FINDINGS_COLS  = [70, 180, 180, 100, 90, 110, 85, 90, 80];
const D = 5;

export function AuditsExportButton({
  audits,
  findings,
  profiles,
}: {
  audits: Audit[];
  findings: AuditFinding[];
  profiles: Profile[];
}) {
  const { user } = useDemoUser();
  function handleExport() {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const isoDate = now.toISOString().slice(0, 10);
    const profileMap    = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));
    const auditTitleMap = Object.fromEntries(audits.map((a) => [a.id, a.title]));

    const completed        = audits.filter((a) => a.status === "completed").length;
    const inProgress       = audits.filter((a) => a.status === "in_progress").length;
    const openFindings     = findings.filter((f) => f.status !== "closed").length;
    const criticalFindings = findings.filter((f) => f.severity === "critical" || f.severity === "high").length;

    // ── Sheet 1: Dashboard ──────────────────────────────────────────────────────

    const auditStatusBreakdown: [string, number, StyleId][] = [
      ["Completed",   completed,                                                    "good"],
      ["In Progress", inProgress,                                                   "info"],
      ["Scheduled",   audits.filter((a) => a.status === "scheduled").length,        "d1"],
      ["Cancelled",   audits.filter((a) => a.status === "cancelled").length,        "warn"],
    ];

    const findingsSevBreakdown: [string, number, StyleId][] = [
      ["Critical", findings.filter((f) => f.severity === "critical").length, "danger"],
      ["High",     findings.filter((f) => f.severity === "high").length,     "warn"],
      ["Medium",   findings.filter((f) => f.severity === "medium").length,   "info"],
      ["Low",      findings.filter((f) => f.severity === "low").length,      "good"],
    ];

    const dashRows: XlsRow[] = [
      ...titleBlock(
        user.company,
        "Audit & Assessment Register",
        "ISO 45001:2018 Clause 9.2 — Internal Audit Programme",
        dateStr,
        D,
      ),
      ...kpiBlock(
        [
          { label: "TOTAL AUDITS",     value: audits.length,      style: "kpi_val" },
          { label: "COMPLETED",        value: completed,           style: "kpi_grn" },
          { label: "IN PROGRESS",      value: inProgress,          style: inProgress > 0       ? "kpi_blu"   : "kpi_val" },
          { label: "OPEN FINDINGS",    value: openFindings,        style: openFindings > 0     ? "kpi_amber" : "kpi_val" },
          { label: "CRITICAL / HIGH",  value: criticalFindings,    style: criticalFindings > 0 ? "kpi_red"   : "kpi_val" },
        ],
        D,
      ),
      sectionRow("AUDIT STATUS", D),
      theadRow(["Status", "Count", "", "", ""]),
      ...auditStatusBreakdown.map(([lbl, cnt, sty]): XlsRow => ({
        cells: [
          { v: lbl, s: sty },
          { v: cnt, s: sty, t: "Number" },
          { v: null },
          { v: null },
          { v: null },
        ] as XlsCell[],
      })),
      blankRow(D),
      sectionRow("FINDINGS BY SEVERITY", D),
      theadRow(["Severity", "Count", "", "", ""]),
      ...findingsSevBreakdown.map(([lbl, cnt, sty]): XlsRow => ({
        cells: [
          { v: lbl, s: sty },
          { v: cnt, s: sty, t: "Number" },
          { v: null },
          { v: null },
          { v: null },
        ] as XlsCell[],
      })),
      blankRow(D),
      {
        cells: [
          {
            v: "ISO 45001:2018 Clause 9.2.2 — The internal audit programme shall be planned, established, implemented and maintained, taking into account the OH&S importance of the processes concerned and the results of previous audits.",
            s: "meta",
            m: D - 1,
          },
        ] as XlsCell[],
      },
    ];

    // ── Sheet 2: Audit Schedule ─────────────────────────────────────────────────

    const scheduleRows: XlsRow[] = [
      ...titleBlock(
        user.company,
        "Audit Schedule",
        "ISO 45001:2018 Clause 9.2 — Internal Audit Programme",
        dateStr,
        9,
      ),
      theadRow(["Audit ID", "Title", "Type", "Scope", "Scheduled", "Completed", "Lead Auditor", "Status", "Notes"]),
      ...audits.map((a, i): XlsRow => {
        let rowStyle: StyleId = alt(i);
        if (a.status === "completed")  rowStyle = "good";
        else if (a.status === "in_progress") rowStyle = "info";

        return {
          cells: [
            { v: a.id,                                                                   s: rowStyle },
            { v: a.title,                                                                s: rowStyle },
            { v: humanize(a.type),                                                       s: rowStyle },
            { v: a.scope ?? "—",                                                         s: rowStyle },
            { v: fmtDate(a.scheduled_date),                                              s: rowStyle },
            { v: fmtDate(a.completed_date),                                              s: rowStyle },
            { v: a.lead_auditor_id ? (profileMap[a.lead_auditor_id] ?? "—") : "Unassigned", s: rowStyle },
            { v: humanize(a.status),                                                     s: rowStyle },
            { v: a.notes ?? "—",                                                         s: rowStyle },
          ] as XlsCell[],
        };
      }),
    ];

    // ── Sheet 3: Audit Findings ─────────────────────────────────────────────────

    const findingsRows: XlsRow[] = [
      ...titleBlock(
        user.company,
        "Audit Findings",
        "ISO 45001:2018 Clause 9.2 — Internal Audit Programme",
        dateStr,
        9,
      ),
      theadRow(["Finding ID", "Audit", "Title", "Category", "Severity", "Owner", "Due Date", "Status", "CAPA Required"]),
      ...findings.map((f, i): XlsRow => {
        const sevStyle: StyleId = severityStyle(f.severity);
        const statusStyle: StyleId = f.status === "closed" ? "good" : alt(i);
        const capaStyle: StyleId = f.capa_required ? "info" : alt(i);

        return {
          cells: [
            { v: f.id,                                                                    s: alt(i) },
            { v: auditTitleMap[f.audit_id] ?? "—",                                       s: alt(i) },
            { v: f.title,                                                                 s: alt(i) },
            { v: humanize(f.category),                                                    s: alt(i) },
            { v: humanize(f.severity),                                                    s: sevStyle },
            { v: f.owner_id ? (profileMap[f.owner_id] ?? "—") : "Unassigned",            s: alt(i) },
            { v: fmtDate(f.due_date),                                                     s: alt(i) },
            { v: humanize(f.status),                                                      s: statusStyle },
            { v: f.capa_required ? "Yes" : "No",                                          s: capaStyle },
          ] as XlsCell[],
        };
      }),
    ];

    buildXls({
      filename: `${user.company.split(" ")[0]}-Audit-Register-${isoDate}.xls`,
      sheets: [
        { name: "Dashboard",      cols: Array(D).fill(140), rows: dashRows },
        { name: "Audit Schedule", cols: SCHEDULE_COLS,       rows: scheduleRows, freeze: 6 },
        { name: "Audit Findings", cols: FINDINGS_COLS,       rows: findingsRows, freeze: 6 },
      ],
    });
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      <Download className="h-3.5 w-3.5" />
      Export Audits
    </button>
  );
}
