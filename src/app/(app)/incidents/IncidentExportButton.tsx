"use client";

import { Download } from "lucide-react";
import { useDemoUser } from "@/lib/context/demo-user";
import type { Incident, Profile } from "@/lib/types";
import {
  buildXls,
  titleBlock,
  kpiBlock,
  sectionRow,
  blankRow,
  theadRow,
  alt,
} from "@/lib/xlsExport";
import type { XlsRow, XlsCell } from "@/lib/xlsExport";
import { OSHA_HOURS_WORKED } from "@/lib/osha";

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function IncidentExportButton({ incidents, profiles, oshaHours = OSHA_HOURS_WORKED }: { incidents: Incident[]; profiles: Profile[]; oshaHours?: number }) {
  const { user } = useDemoUser();
  function handleExport() {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const isoDate = now.toISOString().slice(0, 10);
    const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

    const ytd         = incidents.filter((i) => new Date(i.occurred_at).getFullYear() === 2026);
    const reportable  = incidents.filter((i) => i.regulatory_reportable);
    const medicalTreat = incidents.filter((i) => i.medical_treatment_required);
    const lostTime    = incidents.filter((i) => (i.lost_time_days ?? 0) > 0);
    const open        = incidents.filter((i) => i.status !== "closed");
    const oshaRecordable = incidents.filter(
      (i) => i.regulatory_reportable || i.medical_treatment_required || (i.lost_time_days ?? 0) > 0,
    );
    // TRIR must be computed from OSHA-recordable cases, not all incidents.
    const trirNum     = oshaRecordable.length > 0 ? (oshaRecordable.length / oshaHours) * 200000 : 0;
    const trir        = trirNum.toFixed(2);
    const trirStyle: XlsCell["s"] = trirNum >= 3.0 ? "kpi_red" : trirNum >= 1.5 ? "kpi_amber" : "kpi_grn";

    // ── Sheet 1: Dashboard ────────────────────────────────────────────────────
    const D = 5;

    const severityBreakdown: [string, number, XlsCell["s"]][] = [
      ["Critical", incidents.filter((i) => i.severity === "critical").length, "danger"],
      ["High",     incidents.filter((i) => i.severity === "high").length,     "warn"],
      ["Medium",   incidents.filter((i) => i.severity === "medium").length,   "d1"],
      ["Low",      incidents.filter((i) => i.severity === "low").length,      "d2"],
    ];

    const statusBreakdown: [string, number][] = [
      ["Reported",              incidents.filter((i) => i.status === "reported").length],
      ["Under Investigation",   incidents.filter((i) => i.status === "under_investigation").length],
      ["CAPA Open",             incidents.filter((i) => i.status === "capa_open").length],
      ["Closed",                incidents.filter((i) => i.status === "closed").length],
    ];

    const dashRows: XlsRow[] = [
      ...titleBlock(user.company, "Incident Register", "OSHA 300 Recordkeeping — 29 CFR 1904 · Work-Related Injury & Illness Log", dateStr, D),
      ...kpiBlock([
        { label: "TOTAL ON FILE",    value: incidents.length,  style: "kpi_val" },
        { label: "YTD 2026",         value: ytd.length,        style: ytd.length > 0     ? "kpi_amber" : "kpi_val" },
        { label: "OPEN / ACTIVE",    value: open.length,       style: open.length > 0    ? "kpi_amber" : "kpi_grn" },
        { label: "OSHA REPORTABLE",  value: reportable.length, style: reportable.length > 0 ? "kpi_red" : "kpi_val" },
        { label: "TRIR (2026 YTD)",  value: trir,              style: trirStyle },
      ], D),
      sectionRow("SEVERITY BREAKDOWN", D),
      theadRow(["Severity", "Count", "", "", ""]),
      ...severityBreakdown.map(([label, count, style], i): XlsRow => ({
        cells: [
          { v: label, s: style ?? alt(i) },
          { v: count, s: style ?? alt(i), t: "Number" },
          { v: null },
          { v: null },
          { v: null },
        ] as XlsCell[],
      })),
      blankRow(D),
      sectionRow("STATUS BREAKDOWN", D),
      theadRow(["Status", "Count", "", "", ""]),
      ...statusBreakdown.map(([label, count], i): XlsRow => ({
        cells: [
          { v: label, s: alt(i) },
          { v: count, s: alt(i), t: "Number" },
          { v: null },
          { v: null },
          { v: null },
        ] as XlsCell[],
      })),
      blankRow(D),
      {
        cells: [{ v: `TRIR = (${oshaRecordable.length} recordable cases ÷ ${oshaHours.toLocaleString()} hours worked) × 200,000 = ${trir}  (OSHA benchmark < 3.0 per 100 FTE)`, s: "meta", m: 4 }] as XlsCell[],
        h: 16,
      },
      {
        cells: [{ v: "OSHA 29 CFR 1904 — Employers must record work-related injuries and illnesses meeting recordability criteria.", s: "meta", m: 4 }] as XlsCell[],
        h: 16,
      },
    ];

    // ── Sheet 2: Incident Log ─────────────────────────────────────────────────
    const LOG_COLS = [70, 190, 100, 80, 85, 110, 120, 70, 80, 100, 85];
    const N = 11;

    const logRows: XlsRow[] = [
      ...titleBlock(user.company, "Incident Register", "OSHA 300 Recordkeeping — 29 CFR 1904 · Work-Related Injury & Illness Log", dateStr, N),
      theadRow(["Incident ID", "Title", "Type", "Severity", "Date", "Location", "Reported By", "Lost Days", "Med Tx", "Reg. Reportable", "Status"]),
      ...incidents.map((inc, i): XlsRow => {
        const a = alt(i);
        const sevStyle: XlsCell["s"] =
          inc.severity === "critical" ? "danger" :
          inc.severity === "high" ? "warn" : a;
        const statusStyle: XlsCell["s"] =
          inc.status === "closed"             ? "good" :
          inc.status === "under_investigation" ? "info" : a;
        const cells: XlsCell[] = [
          { v: inc.id,                                                           s: a },
          { v: inc.title,                                                        s: a },
          { v: humanize(inc.incident_type),                                      s: a },
          { v: humanize(inc.severity),                                           s: sevStyle },
          { v: fmtDate(inc.occurred_at),                                         s: a },
          { v: inc.location ?? "—",                                              s: a },
          { v: profileMap[inc.reported_by] ?? inc.reported_by,                   s: a },
          { v: inc.lost_time_days ?? 0,                                          s: (inc.lost_time_days ?? 0) > 0 ? "warn" : a, t: "Number" },
          { v: inc.medical_treatment_required ? "Yes" : "No",                   s: inc.medical_treatment_required ? "warn" : a },
          { v: inc.regulatory_reportable ? "Yes — OSHA" : "No",                 s: inc.regulatory_reportable ? "danger" : a },
          { v: humanize(inc.status),                                             s: statusStyle },
        ];
        return { cells };
      }),
    ];

    // ── Sheet 3: OSHA Recordable ──────────────────────────────────────────────
    const oshaRows: XlsRow[] = [
      ...titleBlock(user.company, "OSHA Recordable Incidents", "OSHA 300 Recordkeeping — 29 CFR 1904 · Work-Related Injury & Illness Log", dateStr, N),
    ];

    if (oshaRecordable.length === 0) {
      oshaRows.push({
        cells: [{ v: "✓ No OSHA recordable incidents on file.", s: "good", m: N - 1 }] as XlsCell[],
      });
    } else {
      oshaRows.push(theadRow(["Incident ID", "Title", "Type", "Severity", "Date", "Location", "Reported By", "Lost Days", "Med Tx", "Reg. Reportable", "Status"]));
      oshaRecordable.forEach((inc, i) => {
        const a = alt(i);
        const sevStyle: XlsCell["s"] =
          inc.severity === "critical" ? "danger" :
          inc.severity === "high" ? "warn" : a;
        const cells: XlsCell[] = [
          { v: inc.id,                                                           s: a },
          { v: inc.title,                                                        s: a },
          { v: humanize(inc.incident_type),                                      s: a },
          { v: humanize(inc.severity),                                           s: sevStyle },
          { v: fmtDate(inc.occurred_at),                                         s: a },
          { v: inc.location ?? "—",                                              s: a },
          { v: profileMap[inc.reported_by] ?? inc.reported_by,                   s: a },
          { v: inc.lost_time_days ?? 0,                                          s: (inc.lost_time_days ?? 0) > 0 ? "warn" : a, t: "Number" },
          { v: inc.medical_treatment_required ? "Yes" : "No",                   s: inc.medical_treatment_required ? "warn" : a },
          { v: inc.regulatory_reportable ? "Yes — OSHA" : "No",                 s: inc.regulatory_reportable ? "danger" : a },
          { v: humanize(inc.status),                                             s: inc.status === "closed" ? "good" : a },
        ];
        oshaRows.push({ cells });
      });
    }

    buildXls({
      filename: `${user.company.split(" ")[0]}-Incident-Register-${isoDate}.xls`,
      sheets: [
        { name: "Dashboard",       cols: Array(D).fill(140), rows: dashRows, freeze: 5 },
        { name: "Incident Log",    cols: LOG_COLS,           rows: logRows,  freeze: 6 },
        { name: "OSHA Recordable", cols: LOG_COLS,           rows: oshaRows, freeze: 6 },
      ],
    });
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      <Download className="h-3.5 w-3.5" />
      Export Register
    </button>
  );
}
