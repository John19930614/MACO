"use client";

import { Download } from "lucide-react";
import { useDemoUser } from "@/lib/context/demo-user";
import type { BiosafetyLab, BiohazardAgent, Incident } from "@/lib/types";
import {
  buildXls,
  titleBlock,
  kpiBlock,
  sectionRow,
  blankRow,
  theadRow,
  alt,
  type XlsCell,
  type XlsRow,
  type StyleId,
} from "@/lib/xlsExport";

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function BiosafetyExportButton({
  labs,
  agents,
  incidents,
}: {
  labs: BiosafetyLab[];
  agents: BiohazardAgent[];
  incidents: Incident[];
}) {
  const { user } = useDemoUser();
  function handleExport() {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const isoDate = now.toISOString().slice(0, 10);

    const compliantLabs  = labs.filter((l) => l.status === "compliant").length;
    const inspectionsDue = labs.filter((l) => l.status === "inspection_due").length;
    const reviewRequired = agents.filter((a) => a.status === "review_required").length;
    const openIncidents  = incidents.filter((i) => i.status !== "closed").length;

    const D = 5;

    // ── Lab & agent status breakdowns ────────────────────────────────────────────
    const labStatuses   = [...new Set(labs.map((l) => l.status))].sort();
    const agentStatuses = [...new Set(agents.map((a) => a.status))].sort();

    // ── Sheet 1: Dashboard ──────────────────────────────────────────────────────
    const dashRows: XlsRow[] = [
      ...titleBlock(
        user.company,
        "Biosafety & Lab Safety Register",
        "NIH/CDC BMBL · Biosafety in Microbiological and Biomedical Laboratories",
        dateStr,
        D,
      ),
      ...kpiBlock([
        { label: "BSL LABS",         value: labs.length,      style: "kpi_val" },
        { label: "COMPLIANT LABS",   value: compliantLabs,    style: "kpi_grn" },
        { label: "INSPECTIONS DUE",  value: inspectionsDue,   style: inspectionsDue > 0  ? "kpi_amber" : "kpi_val" },
        { label: "AGENTS",           value: agents.length,    style: "kpi_blu" },
        { label: "REVIEW REQUIRED",  value: reviewRequired,   style: reviewRequired > 0  ? "kpi_red"   : "kpi_val" },
      ], D),
      sectionRow("LAB STATUS BREAKDOWN", D),
      theadRow(["Status", "Count", "", "", ""]),
      ...labStatuses.map((st, i): XlsRow => ({
        cells: [
          { v: humanize(st), s: alt(i) },
          { v: labs.filter((l) => l.status === st).length, s: alt(i), t: "Number" },
          { v: null }, { v: null }, { v: null },
        ] as XlsCell[],
      })),
      blankRow(D),
      sectionRow("AGENT STATUS BREAKDOWN", D),
      theadRow(["Status", "Count", "", "", ""]),
      ...agentStatuses.map((st, i): XlsRow => ({
        cells: [
          { v: humanize(st), s: alt(i) },
          { v: agents.filter((a) => a.status === st).length, s: alt(i), t: "Number" },
          { v: null }, { v: null }, { v: null },
        ] as XlsCell[],
      })),
    ];

    // ── Sheet 2: BSL Laboratories ───────────────────────────────────────────────
    const labCols    = [70, 70, 160, 60, 70, 85, 85, 70, 100, 150];
    const labHeaders = ["Lab ID", "Code", "Lab Name", "BSL", "Personnel", "Last Inspection", "Next Inspection", "Findings", "Status", "Notes"];

    function buildLabRow(l: BiosafetyLab, i: number): XlsRow {
      const a = alt(i);
      const statusSt: StyleId =
        l.status === "compliant"      ? "good"
        : l.status === "inspection_due" ? "warn"
        : (l.status === "minor_gap" || l.status === "major_gap") ? "danger"
        : a;
      const findingsSt: StyleId = l.open_findings > 0 ? "warn" : a;
      const nextInspDays = l.next_inspection
        ? Math.ceil((new Date(l.next_inspection).getTime() - now.getTime()) / 86400000)
        : null;
      const nextInspSt: StyleId = nextInspDays !== null && nextInspDays < 0 ? "danger" : a;

      return {
        cells: [
          { v: l.id,               s: a },
          { v: l.lab_code,         s: a },
          { v: l.name,             s: a },
          { v: l.bsl_level,        s: a },
          { v: l.personnel_count,  s: a, t: "Number" },
          { v: fmtDate(l.last_inspection), s: a },
          { v: fmtDate(l.next_inspection), s: nextInspSt },
          { v: l.open_findings,    s: findingsSt, t: "Number" },
          { v: humanize(l.status), s: statusSt },
          { v: l.notes ?? "—",    s: a },
        ] as XlsCell[],
      };
    }

    const labRows: XlsRow[] = [
      theadRow(labHeaders),
      ...labs.map((l, i) => buildLabRow(l, i)),
    ];

    // ── Sheet 3: Biological Agents ──────────────────────────────────────────────
    const agentCols    = [70, 70, 180, 80, 130, 80, 100, 160];
    const agentHeaders = ["Agent ID", "Code", "Agent Name", "Risk Class", "Location", "Quantity", "Status", "Notes"];

    function buildAgentRow(a: BiohazardAgent, i: number): XlsRow {
      const base = alt(i);
      const isHighRisk = a.risk_class?.includes("3") || a.risk_class?.includes("4");
      const riskSt: StyleId  = isHighRisk ? "warn" : base;
      const statusSt: StyleId =
        a.status === "review_required" ? "warn"
        : a.status === "approved"        ? "good"
        : a.status === "restricted"      ? "danger"
        : base;

      return {
        cells: [
          { v: a.id,               s: base },
          { v: a.agent_code,       s: base },
          { v: a.agent_name,       s: base },
          { v: a.risk_class,       s: riskSt },
          { v: a.storage_location, s: base },
          { v: a.quantity,         s: base },
          { v: humanize(a.status), s: statusSt },
          { v: a.notes ?? "—",    s: base },
        ] as XlsCell[],
      };
    }

    const agentRows: XlsRow[] = [
      theadRow(agentHeaders),
      ...agents.map((a, i) => buildAgentRow(a, i)),
    ];

    buildXls({
      filename: `${user.company.split(" ")[0]}-Biosafety-Register-${isoDate}.xls`,
      sheets: [
        { name: "Dashboard",          cols: Array(D).fill(140), rows: dashRows },
        { name: "BSL Laboratories",   cols: labCols,   rows: labRows,   freeze: 1 },
        { name: "Biological Agents",  cols: agentCols, rows: agentRows, freeze: 1 },
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
