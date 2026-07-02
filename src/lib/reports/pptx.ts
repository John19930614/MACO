"use client";

// Professional PowerPoint (.pptx) report generator. Produces a branded deck:
//   1. Title slide (dark, accent bar, company + date)
//   2. Executive Summary slide (KPI tiles derived from the report summary)
//   3. Data table slide(s) — auto-paginated with a repeating styled header
//
// Built client-side with pptxgenjs (dynamically imported so it stays out of the
// initial bundle). No server or external service involved.

const BRAND = {
  blue:   "2563EB",
  slate:  "1E293B",
  slate2: "475569",
  light:  "F8FAFC",
  panel:  "F1F5F9",
  white:  "FFFFFF",
  border: "E2E8F0",
  muted:  "94A3B8",
};

export type CellValue = string | number | boolean | null | undefined;

export interface ReportChart {
  type: "bar" | "line" | "doughnut";
  title?: string;
  labels: string[];
  series: { name: string; values: number[] }[];
}

export interface PptxReportSpec {
  title: string;
  description: string;
  headers: string[];
  rows: CellValue[][];
  summary?: [string, string | number][];
  companyName: string;
  fileName: string;
  /** Accent color hex (no #). Defaults to brand blue. */
  accent?: string;
  /** Optional chart slide rendered between the summary and the data table. */
  chart?: ReportChart;
}

const WIDE_W = 13.33;

// Resolve the pptxgenjs constructor robustly across CJS/ESM bundler interop
// (some bundlers expose it as the module namespace, others under `.default`).
async function loadPptxGenJS() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pptxgenjs ships no ESM type for its default export; cast the dynamic-import namespace before resolving the constructor across CJS/ESM interop
  const mod: any = await import("pptxgenjs");
  const Ctor = mod?.default ?? mod;
  if (typeof Ctor !== "function") throw new Error("pptxgenjs failed to load");
  return Ctor;
}

// Browser-reliable save: build a Blob and click an anchor. pptxgenjs's own
// writeFile() can fail silently in bundled browser builds, so we download the
// blob ourselves.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pptxgenjs does not export its presentation instance type; annotate as any for this blob-save helper
async function savePptx(pptx: any, fileName: string): Promise<void> {
  const name = fileName.toLowerCase().endsWith(".pptx") ? fileName : `${fileName}.pptx`;
  const blob = (await pptx.write("blob")) as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// pptxgenjs's autoPage throws "addTable: Array expected!" on some
// column/option/data combinations (its internal continuation call gets an
// empty array). We paginate manually instead: a fixed number of body rows per
// slide, header repeated, autoPage off.
const ROWS_PER_SLIDE = 16;

function chunkRows<T>(rows: T[]): T[][] {
  if (rows.length === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_SLIDE) out.push(rows.slice(i, i + ROWS_PER_SLIDE));
  return out;
}

export async function downloadReportPptx(spec: PptxReportSpec): Promise<void> {
  const PptxGenJS = await loadPptxGenJS();
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "SafetyIQ";
  pptx.company = spec.companyName;
  pptx.title = spec.title;

  const accent = (spec.accent ?? BRAND.blue).replace("#", "").toUpperCase();
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const headerBar = (slide: ReturnType<typeof pptx.addSlide>, title: string) => {
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: WIDE_W, h: 0.9, fill: { color: BRAND.white }, line: { color: BRAND.border, width: 1 } });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.14, h: 0.9, fill: { color: accent } });
    slide.addText(title, { x: 0.45, y: 0, w: 9.5, h: 0.9, fontSize: 18, bold: true, color: BRAND.slate, valign: "middle", fontFace: "Arial" });
    slide.addText("SafetyIQ", { x: 10, y: 0, w: 2.9, h: 0.9, fontSize: 12, bold: true, color: accent, align: "right", valign: "middle", fontFace: "Arial" });
  };

  const footer = (slide: ReturnType<typeof pptx.addSlide>) => {
    slide.addText("SafetyIQ · Reliance Predictive Safety Technologies · Confidential", {
      x: 0.5, y: 7.05, w: 12.33, h: 0.3, fontSize: 8, color: BRAND.muted, align: "center", fontFace: "Arial",
    });
  };

  // ── 1. Title slide ──────────────────────────────────────────────────────────
  const title = pptx.addSlide();
  title.background = { color: BRAND.slate };
  title.addText("SafetyIQ", { x: 0.6, y: 0.55, w: 6, h: 0.45, fontSize: 15, bold: true, color: accent, fontFace: "Arial" });
  title.addShape(pptx.ShapeType.rect, { x: 0.62, y: 3.35, w: 2.2, h: 0.09, fill: { color: accent } });
  title.addText(spec.title, { x: 0.6, y: 2.1, w: 12.1, h: 1.2, fontSize: 40, bold: true, color: BRAND.white, fontFace: "Arial" });
  title.addText(spec.description, { x: 0.6, y: 3.6, w: 12.1, h: 0.7, fontSize: 16, color: "CBD5E1", fontFace: "Arial" });
  title.addText(
    [
      { text: spec.companyName, options: { fontSize: 18, bold: true, color: BRAND.white, breakLine: true } },
      { text: `Generated ${dateStr}  ·  Reliance Predictive Safety Technologies`, options: { fontSize: 12, color: BRAND.muted } },
    ],
    { x: 0.6, y: 5.7, w: 12.1, h: 1.0, fontFace: "Arial" },
  );

  // ── 2. Executive Summary (KPI tiles from the summary block) ──────────────────
  if (spec.summary && spec.summary.length) {
    const k = pptx.addSlide();
    k.background = { color: BRAND.light };
    headerBar(k, "Executive Summary");
    const tiles = spec.summary.slice(0, 6);
    const cols = tiles.length <= 4 ? Math.max(tiles.length, 1) : 3;
    const gap = 0.3;
    const tileW = (WIDE_W - 1.2 - (cols - 1) * gap) / cols;
    const tileH = 1.75;
    tiles.forEach((s, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 0.6 + col * (tileW + gap);
      const y = 1.55 + row * (tileH + gap);
      k.addShape(pptx.ShapeType.roundRect, { x, y, w: tileW, h: tileH, rectRadius: 0.08, fill: { color: BRAND.white }, line: { color: BRAND.border, width: 1 } });
      k.addShape(pptx.ShapeType.rect, { x, y, w: tileW, h: 0.1, fill: { color: accent } });
      k.addText(String(s[1]), { x, y: y + 0.32, w: tileW, h: 0.85, fontSize: 30, bold: true, color: accent, align: "center", fontFace: "Arial" });
      k.addText(s[0], { x: x + 0.15, y: y + 1.15, w: tileW - 0.3, h: 0.5, fontSize: 11, color: BRAND.slate2, align: "center", valign: "top", fontFace: "Arial" });
    });
    footer(k);
  }

  // ── 2b. Chart slide (optional) ───────────────────────────────────────────────
  if (spec.chart && spec.chart.series.length && spec.chart.labels.length) {
    const ch = pptx.addSlide();
    ch.background = { color: BRAND.light };
    headerBar(ch, spec.chart.title ?? "Analysis");
    const ct =
      spec.chart.type === "line" ? pptx.ChartType.line :
      spec.chart.type === "doughnut" ? pptx.ChartType.doughnut :
      pptx.ChartType.bar;
    const data = spec.chart.series.map((s) => ({ name: s.name, labels: spec.chart!.labels, values: s.values }));
    ch.addChart(ct, data, {
      x: 0.7, y: 1.4, w: WIDE_W - 1.4, h: 5.2,
      chartColors: [accent, "10B981", "F59E0B", "DC2626", "7C3AED", "0EA5E9", "64748B"],
      showLegend: spec.chart.type === "doughnut" || spec.chart.series.length > 1,
      legendPos: "b",
      showTitle: false,
      showValue: spec.chart.type !== "line",
      dataLabelColor: spec.chart.type === "doughnut" ? "FFFFFF" : "475569",
      dataLabelFontSize: 9,
      catAxisLabelFontSize: 9,
      valAxisLabelFontSize: 9,
      barDir: "col",
      holeSize: spec.chart.type === "doughnut" ? 55 : undefined,
    });
    footer(ch);
  }

  // ── 3. Data table (manually paginated across slides) ─────────────────────────
  const headerRow = spec.headers.map((h) => ({
    text: h,
    options: { bold: true, color: BRAND.white, fill: { color: accent }, fontSize: 9, align: "left" as const, valign: "middle" as const },
  }));
  const bodyRows = spec.rows.map((r, ri) =>
    r.map((c) => ({
      text: c == null ? "" : String(c),
      options: { fontSize: 8, color: BRAND.slate, fill: { color: ri % 2 ? BRAND.white : BRAND.panel }, align: "left" as const, valign: "middle" as const },
    })),
  );

  const chunks = chunkRows(bodyRows);
  chunks.forEach((chunk, idx) => {
    const slide = pptx.addSlide();
    slide.background = { color: BRAND.light };
    headerBar(slide, chunks.length > 1 ? `${spec.title} (${idx + 1}/${chunks.length})` : spec.title);
    const rowsForSlide = chunk.length
      ? [headerRow, ...chunk]
      : [headerRow, [{ text: "No records.", options: { fontSize: 9, italic: true, color: BRAND.muted, colspan: spec.headers.length, align: "center" as const } }]];
    slide.addTable(rowsForSlide, {
      x: 0.5,
      y: 1.45,
      w: WIDE_W - 1.0,
      border: { type: "solid", color: BRAND.border, pt: 0.5 },
      margin: 4,
      fontFace: "Arial",
      valign: "middle",
    });
    footer(slide);
  });

  await savePptx(pptx, spec.fileName);
}

/**
 * Multi-section deck (e.g. a full audit binder): a title slide followed by a
 * styled table slide-set per section. Each section keeps its own header.
 */
export async function downloadMultiSectionPptx(opts: {
  title: string;
  description: string;
  companyName: string;
  fileName: string;
  accent?: string;
  sections: { name: string; headers: string[]; rows: CellValue[][] }[];
}): Promise<void> {
  const PptxGenJS = await loadPptxGenJS();
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "SafetyIQ";
  pptx.company = opts.companyName;
  pptx.title = opts.title;

  const accent = (opts.accent ?? BRAND.blue).replace("#", "").toUpperCase();
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const footer = (slide: ReturnType<typeof pptx.addSlide>) => {
    slide.addText("SafetyIQ · Reliance Predictive Safety Technologies · Confidential", {
      x: 0.5, y: 7.05, w: 12.33, h: 0.3, fontSize: 8, color: BRAND.muted, align: "center", fontFace: "Arial",
    });
  };

  // Cover
  const cover = pptx.addSlide();
  cover.background = { color: BRAND.slate };
  cover.addText("SafetyIQ", { x: 0.6, y: 0.55, w: 6, h: 0.45, fontSize: 15, bold: true, color: accent, fontFace: "Arial" });
  cover.addShape(pptx.ShapeType.rect, { x: 0.62, y: 3.35, w: 2.2, h: 0.09, fill: { color: accent } });
  cover.addText(opts.title, { x: 0.6, y: 2.1, w: 12.1, h: 1.2, fontSize: 40, bold: true, color: BRAND.white, fontFace: "Arial" });
  cover.addText(opts.description, { x: 0.6, y: 3.6, w: 12.1, h: 0.7, fontSize: 16, color: "CBD5E1", fontFace: "Arial" });
  cover.addText(
    [
      { text: opts.companyName, options: { fontSize: 18, bold: true, color: BRAND.white, breakLine: true } },
      { text: `Generated ${dateStr}  ·  ${opts.sections.length} sections`, options: { fontSize: 12, color: BRAND.muted } },
    ],
    { x: 0.6, y: 5.7, w: 12.1, h: 1.0, fontFace: "Arial" },
  );

  for (const section of opts.sections) {
    const headerRow = section.headers.map((h) => ({
      text: h,
      options: { bold: true, color: BRAND.white, fill: { color: accent }, fontSize: 9, align: "left" as const, valign: "middle" as const },
    }));
    const bodyRows = section.rows.map((r, ri) =>
      r.map((c) => ({
        text: c == null ? "" : String(c),
        options: { fontSize: 8, color: BRAND.slate, fill: { color: ri % 2 ? BRAND.white : BRAND.panel }, align: "left" as const, valign: "middle" as const },
      })),
    );

    const chunks = chunkRows(bodyRows);
    chunks.forEach((chunk, idx) => {
      const slide = pptx.addSlide();
      slide.background = { color: BRAND.light };
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: WIDE_W, h: 0.9, fill: { color: BRAND.white }, line: { color: BRAND.border, width: 1 } });
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.14, h: 0.9, fill: { color: accent } });
      const heading = chunks.length > 1 ? `${section.name} (${idx + 1}/${chunks.length})` : section.name;
      slide.addText(heading, { x: 0.45, y: 0, w: 9.5, h: 0.9, fontSize: 18, bold: true, color: BRAND.slate, valign: "middle", fontFace: "Arial" });
      slide.addText(`${section.rows.length} record${section.rows.length !== 1 ? "s" : ""}`, { x: 10, y: 0, w: 2.9, h: 0.9, fontSize: 11, color: BRAND.slate2, align: "right", valign: "middle", fontFace: "Arial" });

      const rows = chunk.length
        ? [headerRow, ...chunk]
        : [headerRow, [{ text: "No records.", options: { fontSize: 9, italic: true, color: BRAND.muted, colspan: section.headers.length, align: "center" as const } }]];
      slide.addTable(rows, {
        x: 0.5, y: 1.45, w: WIDE_W - 1.0,
        border: { type: "solid", color: BRAND.border, pt: 0.5 },
        margin: 4, fontFace: "Arial", valign: "middle",
      });
      footer(slide);
    });
  }

  await savePptx(pptx, opts.fileName);
}
