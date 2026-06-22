"use client";

import { Download } from "lucide-react";
import { useDemoUser } from "@/lib/context/demo-user";
import type { WasteStream } from "@/lib/types";
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

export function WasteExportButton({ streams }: { streams: WasteStream[] }) {
  const { user } = useDemoUser();
  function handleExport() {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const isoDate = now.toISOString().slice(0, 10);

    const hazardous  = streams.filter((s) => s.classification === "hazardous");
    const pending    = streams.filter((s) => s.status === "pending" || s.status === "pending_pickup" || s.status === "accumulating");
    const manifested = streams.filter((s) => s.manifest_number);
    const noManifest = hazardous.filter((s) => !s.manifest_number && s.status !== "disposed");
    const overLimit  = streams.filter((s) => s.regulatory_limit && s.quantity > s.regulatory_limit);

    const D = 5;

    // ── Classification breakdown ────────────────────────────────────────────────
    const classifications = [...new Set(streams.map((s) => s.classification))].sort();
    const statuses        = [...new Set(streams.map((s) => s.status))].sort();

    // ── Sheet 1: Dashboard ──────────────────────────────────────────────────────
    const dashRows: XlsRow[] = [
      ...titleBlock(
        user.company,
        "Waste Management Register",
        "EPA 40 CFR Part 262 / California HW Regulations · Hazardous Waste Manifest Log",
        dateStr,
        D,
      ),
      ...kpiBlock([
        { label: "TOTAL STREAMS",      value: streams.length,    style: "kpi_val" },
        { label: "HAZARDOUS",          value: hazardous.length,  style: hazardous.length > 0  ? "kpi_red"   : "kpi_val" },
        { label: "AWAITING DISPOSAL",  value: pending.length,    style: pending.length > 0    ? "kpi_amber" : "kpi_val" },
        { label: "EXCEEDING LIMIT",    value: overLimit.length,  style: overLimit.length > 0  ? "kpi_red"   : "kpi_val" },
        { label: "MANIFESTED",         value: manifested.length, style: manifested.length > 0 ? "kpi_grn"   : "kpi_val" },
      ], D),
      sectionRow("CLASSIFICATION BREAKDOWN", D),
      theadRow(["Classification", "Count", "", "", ""]),
      ...classifications.map((cls, i): XlsRow => ({
        cells: [
          { v: humanize(cls), s: cls === "hazardous" ? "danger" : alt(i) },
          { v: streams.filter((s) => s.classification === cls).length, s: cls === "hazardous" ? "danger" : alt(i), t: "Number" },
          { v: null }, { v: null }, { v: null },
        ] as XlsCell[],
      })),
      blankRow(D),
      sectionRow("STATUS BREAKDOWN", D),
      theadRow(["Status", "Count", "", "", ""]),
      ...statuses.map((st, i): XlsRow => ({
        cells: [
          { v: humanize(st), s: alt(i) },
          { v: streams.filter((s) => s.status === st).length, s: alt(i), t: "Number" },
          { v: null }, { v: null }, { v: null },
        ] as XlsCell[],
      })),
      blankRow(D),
      {
        cells: [{
          v: "EPA 40 CFR 262.17 — Small Quantity Generators may accumulate hazardous waste on-site for up to 270 days.",
          s: "info" as StyleId,
          m: D - 1,
        }],
      },
    ];

    // ── Shared register columns ─────────────────────────────────────────────────
    const regCols    = [80, 160, 80, 100, 70, 50, 120, 120, 100, 85, 90];
    const regHeaders = ["Stream ID", "Waste Name", "EPA Code", "Classification", "Qty", "Unit", "Method", "Contractor", "Manifest #", "Disposal Date", "Status"];

    function buildWasteRow(s: WasteStream, i: number): XlsRow {
      const a = alt(i);
      const isHaz    = s.classification === "hazardous";
      const isOver   = !!(s.regulatory_limit && s.quantity > s.regulatory_limit);
      const noMani   = isHaz && !s.manifest_number && s.status !== "disposed";
      const statusSt: StyleId = s.status === "disposed" ? "good"
        : (s.status === "pending" || s.status === "accumulating") ? "warn"
        : a;

      return {
        cells: [
          { v: s.id,                               s: a },
          { v: s.waste_name,                       s: a },
          { v: s.waste_code ?? "—",               s: a },
          { v: humanize(s.classification),         s: isHaz ? "danger" : a },
          { v: s.quantity,                         s: isOver ? "danger" : a, t: "Number" },
          { v: s.unit,                             s: a },
          { v: humanize(s.disposal_method),        s: a },
          { v: s.disposal_contractor ?? "—",      s: a },
          { v: noMani ? "Pending" : (s.manifest_number ?? "—"), s: noMani ? "warn" : a },
          { v: fmtDate(s.disposal_date),           s: a },
          { v: humanize(s.status),                 s: statusSt },
        ] as XlsCell[],
      };
    }

    // ── Sheet 2: Waste Register ─────────────────────────────────────────────────
    const registerRows: XlsRow[] = [
      theadRow(regHeaders),
      ...streams.map((s, i) => buildWasteRow(s, i)),
    ];

    // ── Sheet 3: Hazardous Waste ────────────────────────────────────────────────
    const hazRows: XlsRow[] = hazardous.length === 0
      ? [{ cells: [{ v: "✓ No hazardous waste streams on file.", s: "good" as StyleId }] }]
      : [
          theadRow(regHeaders),
          ...hazardous.map((s, i) => buildWasteRow(s, i)),
        ];

    buildXls({
      filename: `${user.company.split(" ")[0]}-Waste-Register-${isoDate}.xls`,
      sheets: [
        { name: "Dashboard",      cols: Array(D).fill(140),   rows: dashRows },
        { name: "Waste Register", cols: regCols, rows: registerRows, freeze: 1 },
        { name: "Hazardous Waste", cols: regCols, rows: hazRows,     freeze: hazardous.length > 0 ? 1 : undefined },
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
