/**
 * Dependency-free real .xlsx (OOXML) generator. Produces multi-sheet workbooks
 * with styled headers, colour-coded cells, frozen rows, KPI blocks, merged cells
 * and column widths that open natively — with NO "format/extension mismatch"
 * warning — in Excel, Excel 365, Google Sheets and LibreOffice Calc.
 *
 * Public API (titleBlock/kpiBlock/sectionRow/blankRow/theadRow/alt/buildXls) is
 * unchanged from the previous SpreadsheetML version, so all callers keep working.
 */

const xmlEsc = (v: unknown): string => {
  if (v == null) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

function norm(c: CellInput): XlsCell {
  if (c === null || c === undefined) return { v: null };
  if (typeof c === "string" || typeof c === "number") return { v: c };
  return c;
}

// ── Style specs → OOXML style parts ─────────────────────────────────────────────

interface Align { h?: "Left" | "Center" | "Right"; v?: "Top" | "Center" | "Bottom"; wrap?: boolean }
interface Side { pos: "left" | "right" | "top" | "bottom"; color: string }
interface StyleSpec {
  sz?: number; bold?: boolean; color?: string; // font
  fill?: string;                                // solid fill RRGGBB
  align?: Align;
  borders?: Side[];
}

// RRGGBB → ARGB
const argb = (hex: string) => "FF" + hex.replace("#", "").toUpperCase();

const STYLE_SPECS: Record<StyleId, StyleSpec> = {
  h1:    { sz: 15, bold: true, color: "FFFFFF", fill: "1E3A5F", align: { h: "Left", v: "Center" } },
  h2:    { sz: 10, bold: true, color: "FFFFFF", fill: "334155", align: { h: "Left", v: "Center" } },
  meta:  { sz: 9, color: "64748B", fill: "F8FAFC", align: { h: "Left", v: "Center" } },
  section: { sz: 9, bold: true, color: "334155", fill: "E2E8F0", align: { h: "Left", v: "Center" },
    borders: [{ pos: "top", color: "94A3B8" }, { pos: "bottom", color: "94A3B8" }] },
  kpi_lbl: { sz: 8, bold: true, color: "64748B", fill: "F1F5F9", align: { h: "Center", v: "Bottom" },
    borders: [{ pos: "top", color: "CBD5E1" }, { pos: "left", color: "CBD5E1" }, { pos: "right", color: "CBD5E1" }] },
  kpi_val: { sz: 26, bold: true, color: "0F172A", align: { h: "Center", v: "Top" },
    borders: [{ pos: "bottom", color: "E2E8F0" }, { pos: "left", color: "CBD5E1" }, { pos: "right", color: "CBD5E1" }] },
  kpi_red: { sz: 26, bold: true, color: "DC2626", fill: "FEF2F2", align: { h: "Center", v: "Top" },
    borders: [{ pos: "bottom", color: "FCA5A5" }, { pos: "left", color: "FCA5A5" }, { pos: "right", color: "FCA5A5" }] },
  kpi_amber: { sz: 26, bold: true, color: "B45309", fill: "FFFBEB", align: { h: "Center", v: "Top" },
    borders: [{ pos: "bottom", color: "FCD34D" }, { pos: "left", color: "FCD34D" }, { pos: "right", color: "FCD34D" }] },
  kpi_grn: { sz: 26, bold: true, color: "15803D", fill: "F0FDF4", align: { h: "Center", v: "Top" },
    borders: [{ pos: "bottom", color: "86EFAC" }, { pos: "left", color: "86EFAC" }, { pos: "right", color: "86EFAC" }] },
  kpi_blu: { sz: 26, bold: true, color: "1D4ED8", fill: "EFF6FF", align: { h: "Center", v: "Top" },
    borders: [{ pos: "bottom", color: "93C5FD" }, { pos: "left", color: "93C5FD" }, { pos: "right", color: "93C5FD" }] },
  thead: { sz: 9, bold: true, color: "FFFFFF", fill: "475569", align: { h: "Left", v: "Center", wrap: true },
    borders: [{ pos: "bottom", color: "1E293B" }] },
  d1: { sz: 9, color: "1E293B", fill: "FFFFFF", align: { h: "Left", v: "Center" }, borders: [{ pos: "bottom", color: "F1F5F9" }] },
  d2: { sz: 9, color: "1E293B", fill: "F8FAFC", align: { h: "Left", v: "Center" }, borders: [{ pos: "bottom", color: "F1F5F9" }] },
  danger: { sz: 9, bold: true, color: "991B1B", fill: "FEE2E2", align: { h: "Left", v: "Center" }, borders: [{ pos: "bottom", color: "FCA5A5" }] },
  warn: { sz: 9, bold: true, color: "92400E", fill: "FEF3C7", align: { h: "Left", v: "Center" }, borders: [{ pos: "bottom", color: "FCD34D" }] },
  good: { sz: 9, bold: true, color: "166534", fill: "DCFCE7", align: { h: "Left", v: "Center" }, borders: [{ pos: "bottom", color: "86EFAC" }] },
  info: { sz: 9, color: "1E40AF", fill: "EFF6FF", align: { h: "Left", v: "Center" }, borders: [{ pos: "bottom", color: "BFDBFE" }] },
  lbl: { sz: 9, bold: true, color: "475569", fill: "F1F5F9", align: { h: "Left", v: "Center" } },
  bold: { sz: 9, bold: true, color: "0F172A", align: { h: "Left", v: "Center" } },
  blank: { fill: "FFFFFF" },
};

const STYLE_ORDER = Object.keys(STYLE_SPECS) as StyleId[];

/** Build styles.xml and a StyleId → cellXf-index map (index 0 = default). */
function buildStyles(): { xml: string; xfIndex: Record<StyleId, number> } {
  const fonts: string[] = [`<font><sz val="10"/><name val="Calibri"/><color rgb="FF1E293B"/></font>`];
  const fontKey = new Map<string, number>();
  const fills: string[] = [`<fill><patternFill patternType="none"/></fill>`, `<fill><patternFill patternType="gray125"/></fill>`];
  const fillKey = new Map<string, number>();
  const borders: string[] = [`<border><left/><right/><top/><bottom/><diagonal/></border>`];
  const borderKey = new Map<string, number>();

  const fontIdx = (sp: StyleSpec) => {
    const key = `${sp.sz ?? 10}|${sp.bold ? 1 : 0}|${sp.color ?? "1E293B"}`;
    if (fontKey.has(key)) return fontKey.get(key)!;
    const xml = `<font><sz val="${sp.sz ?? 10}"/>${sp.bold ? "<b/>" : ""}<name val="Calibri"/><color rgb="${argb(sp.color ?? "1E293B")}"/></font>`;
    fonts.push(xml); const i = fonts.length - 1; fontKey.set(key, i); return i;
  };
  const fillIdx = (sp: StyleSpec) => {
    if (!sp.fill) return 0;
    const key = sp.fill;
    if (fillKey.has(key)) return fillKey.get(key)!;
    const xml = `<fill><patternFill patternType="solid"><fgColor rgb="${argb(sp.fill)}"/><bgColor indexed="64"/></patternFill></fill>`;
    fills.push(xml); const i = fills.length - 1; fillKey.set(key, i); return i;
  };
  const borderIdx = (sp: StyleSpec) => {
    if (!sp.borders || sp.borders.length === 0) return 0;
    const key = sp.borders.map((b) => `${b.pos}:${b.color}`).sort().join(",");
    if (borderKey.has(key)) return borderKey.get(key)!;
    const side = (pos: Side["pos"]) => {
      const b = sp.borders!.find((x) => x.pos === pos);
      return b ? `<${pos} style="thin"><color rgb="${argb(b.color)}"/></${pos}>` : `<${pos}/>`;
    };
    const xml = `<border>${side("left")}${side("right")}${side("top")}${side("bottom")}<diagonal/></border>`;
    borders.push(xml); const i = borders.length - 1; borderKey.set(key, i); return i;
  };

  const xfs: string[] = [`<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`];
  const xfIndex = {} as Record<StyleId, number>;
  for (const id of STYLE_ORDER) {
    const sp = STYLE_SPECS[id];
    const fi = fontIdx(sp), li = fillIdx(sp), bi = borderIdx(sp);
    const a = sp.align;
    const alignXml = a
      ? `<alignment${a.h ? ` horizontal="${a.h.toLowerCase()}"` : ""}${a.v ? ` vertical="${a.v.toLowerCase()}"` : ""}${a.wrap ? ` wrapText="1"` : ""}/>`
      : "";
    xfs.push(`<xf numFmtId="0" fontId="${fi}" fillId="${li}" borderId="${bi}" xfId="0" applyFont="1"${li ? ` applyFill="1"` : ""}${bi ? ` applyBorder="1"` : ""}${a ? ` applyAlignment="1"` : ""}>${alignXml}</xf>`);
    xfIndex[id] = xfs.length - 1;
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="${fonts.length}">${fonts.join("")}</fonts>` +
    `<fills count="${fills.length}">${fills.join("")}</fills>` +
    `<borders count="${borders.length}">${borders.join("")}</borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`;
  return { xml, xfIndex };
}

// ── Sheet XML ───────────────────────────────────────────────────────────────────

function colLetter(n: number): string {
  let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function sheetXml(sheet: XlsSheet, xfIndex: Record<StyleId, number>): string {
  const merges: string[] = [];
  const rowsXml: string[] = [];

  sheet.rows.forEach((r, ri) => {
    const rowNum = ri + 1;
    let col = 1;
    const cellsXml: string[] = [];
    for (const input of r.cells) {
      const c = norm(input);
      const startCol = col;
      const span = c.m && c.m > 0 ? c.m : 0;
      const ref = `${colLetter(startCol)}${rowNum}`;
      const s = c.s ? ` s="${xfIndex[c.s]}"` : "";
      const isNum = c.v != null && (c.t === "Number" || (c.t !== "String" && typeof c.v === "number"));
      if (c.v == null || c.v === "") {
        cellsXml.push(`<c r="${ref}"${s}/>`);
      } else if (isNum) {
        cellsXml.push(`<c r="${ref}"${s}><v>${Number(c.v)}</v></c>`);
      } else {
        cellsXml.push(`<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(c.v)}</t></is></c>`);
      }
      if (span > 0) merges.push(`${ref}:${colLetter(startCol + span)}${rowNum}`);
      col += span + 1;
    }
    const ht = r.h ? ` ht="${r.h}" customHeight="1"` : "";
    rowsXml.push(`<row r="${rowNum}"${ht}>${cellsXml.join("")}</row>`);
  });

  const colsXml = sheet.cols && sheet.cols.length
    ? `<cols>${sheet.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(4, Math.round((w / 5.5) * 100) / 100)}" customWidth="1"/>`).join("")}</cols>`
    : "";

  const freeze = sheet.freeze && sheet.freeze > 0
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freeze}" topLeftCell="A${sheet.freeze + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${sheet.freeze + 1}" sqref="A${sheet.freeze + 1}"/></sheetView></sheetViews>`
    : "";

  const mergeXml = merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    freeze +
    colsXml +
    `<sheetData>${rowsXml.join("")}</sheetData>` +
    mergeXml +
    `</worksheet>`;
}

// ── ZIP (store / no compression) with CRC-32 ─────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry { name: string; data: Uint8Array; crc: number; offset: number }

function zip(files: { name: string; content: string }[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: number[] = [];
  const entries: ZipEntry[] = [];
  const u16 = (n: number) => { chunks.push(n & 0xff, (n >>> 8) & 0xff); };
  const u32 = (n: number) => { chunks.push(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff); };
  const bytes = (b: Uint8Array) => { for (let i = 0; i < b.length; i++) chunks.push(b[i]); };

  for (const f of files) {
    const data = enc.encode(f.content);
    const nameBytes = enc.encode(f.name);
    const crc = crc32(data);
    const offset = chunks.length;
    u32(0x04034b50); u16(20); u16(0); u16(0); u16(0); u16(0); // sig, ver, flags, method(0=store), time, date
    u32(crc); u32(data.length); u32(data.length); u16(nameBytes.length); u16(0);
    bytes(nameBytes); bytes(data);
    entries.push({ name: f.name, data, crc, offset });
  }

  const cdStart = chunks.length;
  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    u32(0x02014b50); u16(20); u16(20); u16(0); u16(0); u16(0); u16(0);
    u32(e.crc); u32(e.data.length); u32(e.data.length);
    u16(nameBytes.length); u16(0); u16(0); u16(0); u16(0); u32(0); u32(e.offset);
    bytes(nameBytes);
  }
  const cdSize = chunks.length - cdStart;
  u32(0x06054b50); u16(0); u16(0); u16(entries.length); u16(entries.length); u32(cdSize); u32(cdStart); u16(0);

  return new Uint8Array(chunks);
}

// ── Workbook assembly ────────────────────────────────────────────────────────────

/** Pure: produce the raw .xlsx bytes (no browser APIs — safe to unit-test in Node). */
export function xlsxBytes(wb: XlsWorkbook): Uint8Array {
  const { xml: stylesXml, xfIndex } = buildStyles();
  const sheets = wb.sheets.length ? wb.sheets : [{ name: "Sheet1", rows: [] }];

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const safeName = (n: string, i: number) => {
    const cleaned = (n || `Sheet${i + 1}`).replace(/[\\/?*\[\]:]/g, " ").slice(0, 31).trim() || `Sheet${i + 1}`;
    return xmlEsc(cleaned);
  };

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>${sheets.map((s, i) => `<sheet name="${safeName(s.name, i)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>` +
    `</workbook>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  const files = [
    { name: "[Content_Types].xml", content: contentTypes },
    { name: "_rels/.rels", content: rootRels },
    { name: "xl/workbook.xml", content: workbook },
    { name: "xl/_rels/workbook.xml.rels", content: workbookRels },
    { name: "xl/styles.xml", content: stylesXml },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, content: sheetXml(s, xfIndex) })),
  ];

  return zip(files);
}

// ── Helper row builders (unchanged API) ──────────────────────────────────────────

/** 5-row title block used at the top of every sheet. */
export function titleBlock(company: string, report: string, ref: string, date: string, nCols: number): XlsRow[] {
  const m = Math.max(0, nCols - 1);
  return [
    { cells: [{ v: `${company}  ·  ${report}`, s: "h1", m }], h: 34 },
    { cells: [{ v: ref, s: "h2", m }], h: 20 },
    { cells: [{ v: "SafetyIQ EHS Platform  ·  Reliance Predictive Safety Technologies", s: "h2", m }], h: 18 },
    { cells: [{ v: `Generated: ${date}`, s: "meta", m }], h: 16 },
    { cells: [{ v: null, s: "blank", m }], h: 6 },
  ];
}

export interface KpiDef { label: string; value: string | number; style?: StyleId }

/** Label row + large-value row + spacer for KPI scorecard. */
export function kpiBlock(kpis: KpiDef[], nCols: number): XlsRow[] {
  const pad = Math.max(0, nCols - kpis.length);
  const blanks: XlsCell[] = Array(pad).fill({ v: null, s: "blank" as StyleId });
  return [
    { cells: [...kpis.map((k): XlsCell => ({ v: k.label, s: "kpi_lbl" })), ...blanks], h: 26 },
    {
      cells: [
        ...kpis.map((k): XlsCell => ({ v: k.value, s: k.style ?? "kpi_val", t: typeof k.value === "number" ? "Number" : "String" })),
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

// ── Browser download ─────────────────────────────────────────────────────────────

export function buildXls(wb: XlsWorkbook): void {
  const bytes = xlsxBytes(wb);
  const filename = wb.filename.replace(/\.xlsx?$/i, "") + ".xlsx";
  const blob = new Blob([bytes as unknown as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
