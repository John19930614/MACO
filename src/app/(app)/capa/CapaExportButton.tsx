"use client";

import { Download } from "lucide-react";
import { useDemoUser } from "@/lib/context/demo-user";
import type { CapaAction, Profile } from "@/lib/types";
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

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const SOURCE_LABEL: Record<string, string> = {
  audit_finding:     "Audit Finding",
  incident:          "Incident Report",
  legal_requirement: "Legal Requirement",
  risk_assessment:   "Risk Assessment",
  ai_finding:        "AI / P-Engine Finding",
  manual:            "Manual Entry",
};

export function CapaExportButton({ capas, profiles }: { capas: CapaAction[]; profiles: Profile[] }) {
  const { user } = useDemoUser();
  function handleExport() {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const isoDate = now.toISOString().slice(0, 10);
    const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

    const open        = capas.filter((c) => c.status === "open" || c.status === "in_progress").length;
    const overdue     = capas.filter((c) => c.due_date && new Date(c.due_date) < now && c.status !== "closed").length;
    const closed      = capas.filter((c) => c.status === "closed").length;
    const highCrit    = capas.filter((c) => c.severity === "high" || c.severity === "critical").length;
    const overdueCapas = capas.filter((c) => c.due_date && new Date(c.due_date) < now && c.status !== "closed");

    // ── Sheet 1: Dashboard ────────────────────────────────────────────────────
    const D = 5;

    const statusBreakdown: [string, number][] = [
      ["Open",                 capas.filter((c) => c.status === "open").length],
      ["In Progress",          capas.filter((c) => c.status === "in_progress").length],
      ["Overdue",              overdue],
      ["Pending Verification", capas.filter((c) => c.status === "pending_verification").length],
      ["Closed",               closed],
    ];

    const sourceBreakdown: [string, number][] = [
      ["Audit Finding",        capas.filter((c) => c.source_type === "audit_finding").length],
      ["Incident Report",      capas.filter((c) => c.source_type === "incident").length],
      ["Legal Requirement",    capas.filter((c) => c.source_type === "legal_requirement").length],
      ["Risk Assessment",      capas.filter((c) => c.source_type === "risk_assessment").length],
      ["AI / P-Engine Finding",capas.filter((c) => c.source_type === "ai_finding").length],
      ["Manual Entry",         capas.filter((c) => c.source_type === "manual").length],
    ];

    const dashRows: XlsRow[] = [
      ...titleBlock(user.company, "CAPA Register", "ISO 45001:2018 Clause 10.2 — Corrective & Preventive Actions", dateStr, D),
      ...kpiBlock([
        { label: "TOTAL CAPAs",        value: capas.length,                                         style: "kpi_val" },
        { label: "OPEN / IN PROGRESS", value: open,         style: open > 0     ? "kpi_amber" : "kpi_val" },
        { label: "OVERDUE",            value: overdue,      style: overdue > 0  ? "kpi_red"   : "kpi_val" },
        { label: "HIGH / CRITICAL",    value: highCrit,     style: highCrit > 0 ? "kpi_amber" : "kpi_val" },
        { label: "CLOSED",             value: closed,       style: closed > 0   ? "kpi_grn"   : "kpi_val" },
      ], D),
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
      sectionRow("SOURCE BREAKDOWN", D),
      theadRow(["Source", "Count", "", "", ""]),
      ...sourceBreakdown.map(([label, count], i): XlsRow => ({
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
        cells: [{ v: "ISO 45001:2018 Clause 10.2 — Organizations shall react to nonconformities and take corrective action.", s: "meta", m: 4 }] as XlsCell[],
        h: 16,
      },
    ];

    // ── Sheet 2: CAPA Register ────────────────────────────────────────────────
    const REG_COLS = [70, 220, 80, 80, 130, 110, 90, 100, 80, 80];
    const N = 10;

    const registerRows: XlsRow[] = [
      ...titleBlock(user.company, "CAPA Register", "ISO 45001:2018 Clause 10.2 — Corrective & Preventive Actions", dateStr, N),
      theadRow(["CAPA ID", "Title", "Kind", "Severity", "Source", "Owner", "Due Date", "Status", "Created", "Closed"]),
      ...capas.map((c, i): XlsRow => {
        const a = alt(i);
        const isOverdue = !!(c.due_date && new Date(c.due_date) < now && c.status !== "closed");
        const sevStyle: XlsCell["s"] = c.severity === "critical" ? "danger" : c.severity === "high" ? "warn" : a;
        const statusStyle: XlsCell["s"] = c.status === "closed" ? "good" : isOverdue ? "danger" : c.status === "in_progress" ? "info" : a;
        const dueDateVal = c.due_date ? fmtDate(c.due_date) + (isOverdue ? " ⚠" : "") : "—";
        const cells: XlsCell[] = [
          { v: c.id,                                                            s: a },
          { v: c.title,                                                         s: a },
          { v: c.kind === "corrective" ? "Corrective" : "Preventive",          s: a },
          { v: humanize(c.severity),                                            s: sevStyle },
          { v: SOURCE_LABEL[c.source_type] ?? humanize(c.source_type),         s: a },
          { v: c.owner_id ? (profileMap[c.owner_id] ?? "—") : "Unassigned",    s: a },
          { v: dueDateVal,                                                      s: isOverdue ? "danger" : a },
          { v: humanize(c.status),                                              s: statusStyle },
          { v: fmtDate(c.created_at),                                           s: a },
          { v: c.closed_at ? fmtDate(c.closed_at) : "—",                       s: c.closed_at ? "good" : a },
        ];
        return { cells };
      }),
    ];

    // ── Sheet 3: Overdue CAPAs ────────────────────────────────────────────────
    const overdueRows: XlsRow[] = [
      ...titleBlock(user.company, "Overdue CAPAs", "ISO 45001:2018 Clause 10.2 — Corrective & Preventive Actions", dateStr, N),
    ];

    if (overdueCapas.length === 0) {
      overdueRows.push({
        cells: [{ v: "✓ No overdue CAPAs — all actions are within their due dates.", s: "good", m: N - 1 }] as XlsCell[],
      });
    } else {
      overdueRows.push(theadRow(["CAPA ID", "Title", "Kind", "Severity", "Source", "Owner", "Due Date", "Status", "Created", "Closed"]));
      overdueCapas.forEach((c, i) => {
        const a = alt(i);
        const cells: XlsCell[] = [
          { v: c.id,                                                            s: "danger" },
          { v: c.title,                                                         s: "danger" },
          { v: c.kind === "corrective" ? "Corrective" : "Preventive",          s: a },
          { v: humanize(c.severity),                                            s: "danger" },
          { v: SOURCE_LABEL[c.source_type] ?? humanize(c.source_type),         s: a },
          { v: c.owner_id ? (profileMap[c.owner_id] ?? "—") : "Unassigned",    s: a },
          { v: c.due_date ? fmtDate(c.due_date) + " ⚠" : "—",                 s: "danger" },
          { v: humanize(c.status),                                              s: "danger" },
          { v: fmtDate(c.created_at),                                           s: a },
          { v: c.closed_at ? fmtDate(c.closed_at) : "—",                       s: a },
        ];
        overdueRows.push({ cells });
      });
    }

    buildXls({
      filename: `${user.company.split(" ")[0]}-CAPA-Register-${isoDate}.xls`,
      sheets: [
        { name: "Dashboard",    cols: Array(D).fill(140), rows: dashRows,     freeze: 5 },
        { name: "CAPA Register", cols: REG_COLS,          rows: registerRows, freeze: 6 },
        { name: "Overdue CAPAs", cols: REG_COLS,          rows: overdueRows,  freeze: 6 },
      ],
    });
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      <Download className="h-3.5 w-3.5" />
      Export CAPA Register
    </button>
  );
}
