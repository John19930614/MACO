"use client";

// Styled .xlsx report generator — the right format for list/register reports
// that need sorting and filtering. Builds on the app's dependency-free OOXML
// engine (xlsExport): branded title block, KPI tiles, and a frozen, color-headed,
// auto-sized data table.

import { buildXls, titleBlock, kpiBlock, sectionRow, theadRow, alt, type XlsRow, type XlsCell } from "@/lib/xlsExport";

export type CellValue = string | number | boolean | null | undefined;

export interface XlsxReportSpec {
  title: string;
  description: string;
  headers: string[];
  rows: CellValue[][];
  summary?: [string, string | number][];
  companyName: string;
  fileName: string;
}

export function downloadReportXlsx(spec: XlsxReportSpec): void {
  const nCols = spec.headers.length;
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const kpis = (spec.summary ?? []).slice(0, 5).map(([label, value]) => ({ label: label.toUpperCase(), value }));

  const rows: XlsRow[] = [
    ...titleBlock(spec.companyName, spec.title, spec.description, dateStr, nCols),
    ...(kpis.length ? kpiBlock(kpis, nCols) : []),
    sectionRow("DETAIL", nCols),
    theadRow(spec.headers),
    ...spec.rows.map((r, i): XlsRow => ({
      cells: r.map((c): XlsCell => ({
        v: c == null ? null : typeof c === "number" ? c : String(c),
        s: alt(i),
        t: typeof c === "number" ? "Number" : "String",
      })),
    })),
  ];

  // Auto-size each column from its longest cell (clamped to a sane range).
  const cols = spec.headers.map((h, ci) => {
    let max = h.length;
    for (const r of spec.rows) {
      const cell = r[ci];
      const len = cell == null ? 0 : String(cell).length;
      if (len > max) max = len;
    }
    return Math.min(Math.max(max * 6 + 16, 60), 320);
  });

  const freeze = 5 + (kpis.length ? 3 : 0) + 2; // title(5) + kpi(3) + section(1) + thead(1)
  buildXls({ filename: spec.fileName, sheets: [{ name: "Report", cols, rows, freeze }] });
}

function sheetName(name: string, fallback: string): string {
  const clean = name.replace(/[\\/?*[\]:]/g, "").trim().slice(0, 31);
  return clean || fallback;
}

// Multi-sheet workbook (one sheet per section) — used for the audit binder.
export function downloadMultiSheetXlsx(opts: {
  fileName: string;
  companyName: string;
  sections: { name: string; headers: string[]; rows: CellValue[][] }[];
}): void {
  const sheets = opts.sections.map((sec, idx) => {
    const nCols = sec.headers.length;
    const rows: XlsRow[] = [
      sectionRow(`${opts.companyName} · ${sec.name}`, nCols),
      theadRow(sec.headers),
      ...(sec.rows.length
        ? sec.rows.map((r, i): XlsRow => ({
            cells: r.map((c): XlsCell => ({
              v: c == null ? null : typeof c === "number" ? c : String(c),
              s: alt(i),
              t: typeof c === "number" ? "Number" : "String",
            })),
          }))
        : [{ cells: [{ v: "No records.", s: "meta" as const, m: Math.max(0, nCols - 1) }] }]),
    ];
    const cols = sec.headers.map((h, ci) => {
      let max = h.length;
      for (const r of sec.rows) {
        const cell = r[ci];
        const len = cell == null ? 0 : String(cell).length;
        if (len > max) max = len;
      }
      return Math.min(Math.max(max * 6 + 16, 60), 320);
    });
    return { name: sheetName(sec.name, `Sheet ${idx + 1}`), cols, rows, freeze: 2 };
  });
  buildXls({ filename: opts.fileName, sheets });
}
