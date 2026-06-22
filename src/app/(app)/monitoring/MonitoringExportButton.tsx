"use client";

import { Download } from "lucide-react";
import { useDemoUser } from "@/lib/context/demo-user";
import type { Equipment } from "@/lib/types";
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

function daysUntil(s: string | null | undefined): number {
  if (!s) return 9999;
  return Math.ceil((new Date(s).getTime() - Date.now()) / 86400000);
}

export function MonitoringExportButton({ equipment }: { equipment: Equipment[] }) {
  const { user } = useDemoUser();
  function handleExport() {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const isoDate = now.toISOString().slice(0, 10);

    const operational  = equipment.filter((e) => e.status === "operational").length;
    const calDue       = equipment.filter((e) => e.status === "calibration_due").length;
    const inspDue      = equipment.filter((e) => e.status === "inspection_due").length;
    const outOfService = equipment.filter((e) => e.status === "out_of_service").length;
    const overdueCal   = equipment.filter((e) => e.next_calibration_date && daysUntil(e.next_calibration_date) < 0).length;
    const overdueInsp  = equipment.filter((e) => e.next_inspection_date && daysUntil(e.next_inspection_date) < 0).length;

    const D = 5;

    // ── Equipment status breakdown ───────────────────────────────────────────────
    const statuses = [...new Set(equipment.map((e) => e.status))].sort();

    // ── Sheet 1: Dashboard ──────────────────────────────────────────────────────
    const dashRows: XlsRow[] = [
      ...titleBlock(
        user.company,
        "Equipment & Calibration Register",
        "OSHA / FDA Equipment Compliance · Calibration & Inspection Records",
        dateStr,
        D,
      ),
      ...kpiBlock([
        { label: "TOTAL EQUIPMENT",  value: equipment.length, style: "kpi_val" },
        { label: "OPERATIONAL",      value: operational,      style: "kpi_grn" },
        { label: "CALIBRATION DUE",  value: calDue,           style: calDue > 0        ? "kpi_amber" : "kpi_val" },
        { label: "INSPECTION DUE",   value: inspDue,          style: inspDue > 0        ? "kpi_amber" : "kpi_val" },
        { label: "OUT OF SERVICE",   value: outOfService,     style: outOfService > 0  ? "kpi_red"   : "kpi_val" },
      ], D),
      sectionRow("EQUIPMENT STATUS BREAKDOWN", D),
      theadRow(["Status", "Count", "", "", ""]),
      ...statuses.map((st, i): XlsRow => ({
        cells: [
          { v: humanize(st), s: alt(i) },
          { v: equipment.filter((e) => e.status === st).length, s: alt(i), t: "Number" },
          { v: null }, { v: null }, { v: null },
        ] as XlsCell[],
      })),
      blankRow(D),
      {
        cells: [{
          v: "OSHA 29 CFR 1910.68 — Emergency equipment must be maintained in operable condition and inspected regularly.",
          s: "info" as StyleId,
          m: D - 1,
        }],
      },
    ];

    // ── Shared register columns ─────────────────────────────────────────────────
    const regCols    = [70, 150, 90, 90, 110, 85, 85, 90, 85, 85, 90, 90];
    const regHeaders = ["ID", "Name", "Type", "Serial #", "Location", "Last Cal", "Next Cal", "Cal Overdue?", "Last Insp", "Next Insp", "Insp Overdue?", "Status"];

    function buildEquipRow(e: Equipment, i: number): XlsRow {
      const a = alt(i);
      const calOverdue  = daysUntil(e.next_calibration_date) < 0 && !!e.next_calibration_date;
      const inspOverdue = daysUntil(e.next_inspection_date) < 0  && !!e.next_inspection_date;

      const calDaysAbs  = calOverdue  ? Math.abs(daysUntil(e.next_calibration_date)) : 0;
      const inspDaysAbs = inspOverdue ? Math.abs(daysUntil(e.next_inspection_date))  : 0;

      const statusSt: StyleId =
        e.status === "operational"      ? "good"
        : e.status === "out_of_service"   ? "danger"
        : (e.status === "calibration_due" || e.status === "inspection_due") ? "warn"
        : a;

      return {
        cells: [
          { v: e.id,                          s: a },
          { v: e.name,                        s: a },
          { v: humanize(e.type),              s: a },
          { v: e.serial_number ?? "—",       s: a },
          { v: e.location,                    s: a },
          { v: fmtDate(e.last_calibration_date), s: a },
          { v: fmtDate(e.next_calibration_date), s: calOverdue ? "danger" : a },
          { v: calOverdue  ? `Yes — ${calDaysAbs}d overdue`  : "No", s: calOverdue  ? "danger" : a },
          { v: fmtDate(e.last_inspection_date),  s: a },
          { v: fmtDate(e.next_inspection_date),  s: inspOverdue ? "danger" : a },
          { v: inspOverdue ? `Yes — ${inspDaysAbs}d overdue` : "No", s: inspOverdue ? "danger" : a },
          { v: humanize(e.status),            s: statusSt },
        ] as XlsCell[],
      };
    }

    // ── Sheet 2: Equipment Register ─────────────────────────────────────────────
    const registerRows: XlsRow[] = [
      theadRow(regHeaders),
      ...equipment.map((e, i) => buildEquipRow(e, i)),
    ];

    // ── Sheet 3: Calibration Due ────────────────────────────────────────────────
    const calDueList = equipment.filter((e) => daysUntil(e.next_calibration_date) <= 30);

    const calDueRows: XlsRow[] = calDueList.length === 0
      ? [{ cells: [{ v: "✓ All equipment calibrations are current.", s: "good" as StyleId }] }]
      : [
          theadRow(regHeaders),
          ...calDueList.map((e, i) => buildEquipRow(e, i)),
        ];

    buildXls({
      filename: `${user.company.split(" ")[0]}-Equipment-Register-${isoDate}.xls`,
      sheets: [
        { name: "Dashboard",         cols: Array(D).fill(140), rows: dashRows },
        { name: "Equipment Register", cols: regCols, rows: registerRows, freeze: 1 },
        { name: "Calibration Due",   cols: regCols, rows: calDueRows,    freeze: calDueList.length > 0 ? 1 : undefined },
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
