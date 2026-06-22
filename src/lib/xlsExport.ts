/**
 * Pure-JS SpreadsheetML (.xls) generator — no npm dependencies required.
 * Produces styled multi-sheet Excel workbooks (bold headers, colour-coded cells,
 * frozen rows, KPI blocks) that open natively in Excel, Google Sheets, and
 * LibreOffice Calc.
 */

const xmlEsc = (v: unknown): string => {
  if (v == null) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

// ── Style token type ──────────────────────────────────────────────────────────

export type StyleId =
  | "h1" | "h2" | "meta"
  | "section"
  | "kpi_lbl" | "kpi_val" | "kpi_red" | "kpi_amber" | "kpi_grn" | "kpi_blu"
  | "thead"
  | "d1" | "d2"
  | "danger" | "warn" | "good" | "info"
  | "lbl" | "bold" | "blank";

// ── Cell / row / sheet types ──────────────────────────────────────────────────

export interface XlsCell {
  v: string | number | null;
  s?: StyleId;
  t?: "String" | "Number";
  m?: number; // MergeAcross — spans m additional columns to the right
}

export type CellInput = XlsCell | string | number | null;

export interface XlsRow {
  cells: CellInput[];
  h?: number; // row height in points
}

export interface XlsSheet {
  name: string;
  cols?: number[]; // column widths in points
  rows: XlsRow[];
  freeze?: number; // freeze top N rows
}

export interface XlsWorkbook {
  filename: string;
  sheets: XlsSheet[];
}

// ── Cell normalisation ────────────────────────────────────────────────────────

function norm(c: CellInput): XlsCell {
  if (c === null || c === undefined) return { v: null };
  if (typeof c === "string" || typeof c === "number") return { v: c };
  return c;
}

// ── XML generation ────────────────────────────────────────────────────────────

function cellXml(c: CellInput): string {
  const { v, s, t, m } = norm(c);
  const style = s ? ` ss:StyleID="${s}"` : "";
  const merge = m && m > 0 ? ` ss:MergeAcross="${m}"` : "";
  const type = t ?? (typeof v === "number" ? "Number" : "String");
  return `<Cell${style}${merge}><Data ss:Type="${type}">${xmlEsc(v)}</Data></Cell>`;
}

function rowXml(r: XlsRow): string {
  const h = r.h ? ` ss:Height="${r.h}"` : "";
  return `<Row${h}>${r.cells.map(cellXml).join("")}</Row>`;
}

function sheetXml(s: XlsSheet): string {
  const cols = (s.cols ?? []).map((w) => `<Column ss:Width="${w}"/>`).join("");
  const rows = s.rows.map(rowXml).join("");
  let opts = "";
  if (s.freeze && s.freeze > 0) {
    opts = `<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>${s.freeze}</SplitHorizontal><TopRowBottomPane>${s.freeze}</TopRowBottomPane></WorksheetOptions>`;
  }
  return `<Worksheet ss:Name="${xmlEsc(s.name)}"><Table>${cols}${rows}</Table>${opts}</Worksheet>`;
}

// ── Style definitions ─────────────────────────────────────────────────────────

const STYLES = `<Styles>
<Style ss:ID="Default"><Alignment ss:Vertical="Center"/><Font ss:Name="Calibri" ss:Size="10" ss:Color="#1e293b"/></Style>
<Style ss:ID="h1"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:Name="Calibri" ss:Size="15" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1e3a5f" ss:Pattern="Solid"/></Style>
<Style ss:ID="h2"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:Name="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#334155" ss:Pattern="Solid"/></Style>
<Style ss:ID="meta"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:Name="Calibri" ss:Size="9" ss:Color="#64748b"/><Interior ss:Color="#f8fafc" ss:Pattern="Solid"/></Style>
<Style ss:ID="section"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:Name="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#334155"/><Interior ss:Color="#e2e8f0" ss:Pattern="Solid"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/></Borders></Style>
<Style ss:ID="kpi_lbl"><Alignment ss:Horizontal="Center" ss:Vertical="Bottom"/><Font ss:Name="Calibri" ss:Size="8" ss:Bold="1" ss:Color="#64748b"/><Interior ss:Color="#f1f5f9" ss:Pattern="Solid"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/></Borders></Style>
<Style ss:ID="kpi_val"><Alignment ss:Horizontal="Center" ss:Vertical="Top"/><Font ss:Name="Calibri" ss:Size="26" ss:Bold="1" ss:Color="#0f172a"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#e2e8f0"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/></Borders></Style>
<Style ss:ID="kpi_red"><Alignment ss:Horizontal="Center" ss:Vertical="Top"/><Font ss:Name="Calibri" ss:Size="26" ss:Bold="1" ss:Color="#dc2626"/><Interior ss:Color="#fef2f2" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#fca5a5"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#fca5a5"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#fca5a5"/></Borders></Style>
<Style ss:ID="kpi_amber"><Alignment ss:Horizontal="Center" ss:Vertical="Top"/><Font ss:Name="Calibri" ss:Size="26" ss:Bold="1" ss:Color="#b45309"/><Interior ss:Color="#fffbeb" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#fcd34d"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#fcd34d"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#fcd34d"/></Borders></Style>
<Style ss:ID="kpi_grn"><Alignment ss:Horizontal="Center" ss:Vertical="Top"/><Font ss:Name="Calibri" ss:Size="26" ss:Bold="1" ss:Color="#15803d"/><Interior ss:Color="#f0fdf4" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#86efac"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#86efac"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#86efac"/></Borders></Style>
<Style ss:ID="kpi_blu"><Alignment ss:Horizontal="Center" ss:Vertical="Top"/><Font ss:Name="Calibri" ss:Size="26" ss:Bold="1" ss:Color="#1d4ed8"/><Interior ss:Color="#eff6ff" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#93c5fd"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#93c5fd"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#93c5fd"/></Borders></Style>
<Style ss:ID="thead"><Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/><Font ss:Name="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#475569" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1e293b"/></Borders></Style>
<Style ss:ID="d1"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:Name="Calibri" ss:Size="9" ss:Color="#1e293b"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/></Borders></Style>
<Style ss:ID="d2"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:Name="Calibri" ss:Size="9" ss:Color="#1e293b"/><Interior ss:Color="#f8fafc" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/></Borders></Style>
<Style ss:ID="danger"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:Name="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#991b1b"/><Interior ss:Color="#fee2e2" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#fca5a5"/></Borders></Style>
<Style ss:ID="warn"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:Name="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#92400e"/><Interior ss:Color="#fef3c7" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#fcd34d"/></Borders></Style>
<Style ss:ID="good"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:Name="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#166534"/><Interior ss:Color="#dcfce7" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#86efac"/></Borders></Style>
<Style ss:ID="info"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:Name="Calibri" ss:Size="9" ss:Color="#1e40af"/><Interior ss:Color="#eff6ff" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#bfdbfe"/></Borders></Style>
<Style ss:ID="lbl"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:Name="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#475569"/><Interior ss:Color="#f1f5f9" ss:Pattern="Solid"/></Style>
<Style ss:ID="bold"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:Name="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#0f172a"/></Style>
<Style ss:ID="blank"><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
</Styles>`;

// ── Helper row builders ───────────────────────────────────────────────────────

/** 5-row title block used at the top of every sheet. */
export function titleBlock(
  company: string,
  report: string,
  ref: string,
  date: string,
  nCols: number,
): XlsRow[] {
  const m = Math.max(0, nCols - 1);
  return [
    { cells: [{ v: `${company}  ·  ${report}`, s: "h1", m }], h: 34 },
    { cells: [{ v: ref, s: "h2", m }], h: 20 },
    { cells: [{ v: "SafetyIQ EHS Platform  ·  Reliance Predictive Safety Technologies", s: "h2", m }], h: 18 },
    { cells: [{ v: `Generated: ${date}`, s: "meta", m }], h: 16 },
    { cells: [{ v: null, s: "blank", m }], h: 6 },
  ];
}

export interface KpiDef {
  label: string;
  value: string | number;
  style?: StyleId;
}

/** Label row + large-value row + spacer for KPI scorecard. */
export function kpiBlock(kpis: KpiDef[], nCols: number): XlsRow[] {
  const pad = Math.max(0, nCols - kpis.length);
  const blanks: XlsCell[] = Array(pad).fill({ v: null, s: "blank" as StyleId });
  return [
    { cells: [...kpis.map((k): XlsCell => ({ v: k.label, s: "kpi_lbl" })), ...blanks], h: 26 },
    {
      cells: [
        ...kpis.map((k): XlsCell => ({
          v: k.value,
          s: k.style ?? "kpi_val",
          t: typeof k.value === "number" ? "Number" : "String",
        })),
        ...blanks,
      ],
      h: 52,
    },
    { cells: [{ v: null, s: "blank", m: Math.max(0, nCols - 1) }], h: 10 },
  ];
}

/** Full-width section divider row. */
export function sectionRow(title: string, nCols: number): XlsRow {
  return { cells: [{ v: title, s: "section", m: Math.max(0, nCols - 1) }], h: 20 };
}

/** Blank spacer row. */
export function blankRow(nCols = 1): XlsRow {
  return { cells: [{ v: null, s: "blank", m: Math.max(0, nCols - 1) }], h: 8 };
}

/** Column-header row with dark-background bold text. */
export function theadRow(headers: string[], h = 28): XlsRow {
  return { cells: headers.map((hdr): XlsCell => ({ v: hdr, s: "thead" })), h };
}

/** Return "d1" or "d2" for alternating row colouring. */
export function alt(i: number): StyleId {
  return i % 2 === 0 ? "d1" : "d2";
}

// ── Main download function ────────────────────────────────────────────────────

export function buildXls(wb: XlsWorkbook): void {
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ` +
    `xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:x="urn:schemas-microsoft-com:office:excel" ` +
    `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    `<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">` +
    `<Author>SafetyIQ · Reliance Predictive Safety Technologies</Author>` +
    `<Title>${xmlEsc(wb.filename)}</Title>` +
    `</DocumentProperties>` +
    STYLES +
    wb.sheets.map(sheetXml).join("") +
    `</Workbook>`;

  const blob = new Blob(["﻿" + xml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = wb.filename;
  a.click();
  URL.revokeObjectURL(url);
}
