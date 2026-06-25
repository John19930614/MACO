/**
 * Per-document Word (.doc) export in the Reliance master-template style.
 *
 * Emits a Word-compatible HTML document (the same zero-dependency trick as
 * xlsExport — Word opens HTML saved as .doc) so a generated EHS document can be
 * downloaded for the document library / audits with the navy banners and
 * navy-header tables intact. Reuses the shared `docMarkdown` AST so the export
 * matches what is shown on screen.
 */
import type { DocSection } from "@/lib/types";
import { parseBlocks, splitInline, isCheckboxList, parseChecklistItem } from "@/lib/docMarkdown";

export type DocControlRow = { field: string; value: string };

const NAVY = "#17213A";
const BORDER = "#D9E2EF";
const LIGHT = "#F8FAFC";
const BODY = "#334155";
const ACCENT = "#7C2AE8";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineHtml(text: string): string {
  return splitInline(text)
    .map((tok) =>
      tok.bold
        ? `<strong style="color:${NAVY}">${esc(tok.text)}</strong>`
        : esc(tok.text),
    )
    .join("");
}

const TH = `style="background:${NAVY};color:#fff;border:1px solid ${BORDER};padding:6px 9px;text-align:left;font-weight:bold;font-size:10.5pt"`;
const TD = `border:1px solid ${BORDER};padding:6px 9px;vertical-align:top;color:${BODY};font-size:10.5pt`;

function bannerHtml(n: number, heading: string): string {
  return `<p style="background:${NAVY};color:#fff;padding:6px 10px;margin:16px 0 8px;font-weight:bold;font-size:11.5pt">`
    + `<span style="color:${ACCENT}">${n}.</span>&nbsp;${esc(heading)}</p>`;
}

function bodyHtml(body: string): string {
  return parseBlocks(body)
    .map((b) => {
      if (b.type === "table") {
        const head = `<tr>${b.header.map((h) => `<th ${TH}>${inlineHtml(h)}</th>`).join("")}</tr>`;
        const rows = b.rows
          .map((r, ri) =>
            `<tr style="background:${ri % 2 ? LIGHT : "#FFFFFF"}">`
            + b.header.map((_, ci) => `<td style="${TD}">${inlineHtml(r[ci] ?? "")}</td>`).join("")
            + `</tr>`,
          )
          .join("");
        return `<table style="width:100%;border-collapse:collapse;margin:6px 0 10px">${head}${rows}</table>`;
      }
      if (b.type === "list") {
        if (isCheckboxList(b.items)) {
          const items = b.items
            .map((it) => {
              const { checked, text } = parseChecklistItem(it);
              return `<p style="margin:2px 0;color:${BODY};font-size:10.5pt">`
                + `<span style="color:${NAVY}">${checked ? "&#9745;" : "&#9744;"}</span>&nbsp;${inlineHtml(text)}</p>`;
            })
            .join("");
          return items;
        }
        const tag = b.ordered ? "ol" : "ul";
        const items = b.items.map((it) => `<li>${inlineHtml(it)}</li>`).join("");
        return `<${tag} style="margin:6px 0 10px 18px;color:${BODY};font-size:10.5pt">${items}</${tag}>`;
      }
      return `<p style="margin:6px 0;color:${BODY};font-size:10.5pt;line-height:1.5">${inlineHtml(b.text)}</p>`;
    })
    .join("");
}

export interface DocExportInput {
  title: string;
  controlRows: DocControlRow[];
  sections: DocSection[];
  company: string;
  generatedNote?: string;
}

// The document body (title → Document Control → authored sections → note),
// shared verbatim by the Word (.doc) and PDF/print outputs so they are identical.
function renderInner({ title, controlRows, sections, company, generatedNote }: DocExportInput): string {
  const controlTable =
    `<table style="width:100%;border-collapse:collapse;margin:6px 0 10px">`
    + controlRows
      .map((r, i) =>
        `<tr style="background:${i % 2 ? LIGHT : "#FFFFFF"}">`
        + `<th style="border:1px solid ${BORDER};padding:6px 9px;text-align:left;color:${NAVY};font-weight:bold;width:34%;font-size:10.5pt">${esc(r.field)}</th>`
        + `<td style="${TD}">${esc(r.value)}</td>`
        + `</tr>`,
      )
      .join("")
    + `</table>`;

  const sectionHtml = sections
    .map((s, i) => bannerHtml(i + 2, s.heading) + bodyHtml(s.body ?? ""))
    .join("");

  const note = generatedNote
    ? `<p style="color:#64748B;font-size:9pt;margin-top:18px;border-top:1px solid ${BORDER};padding-top:6px">${esc(generatedNote)}</p>`
    : "";

  return (
    `<h1 style="color:${NAVY};font-size:18pt;margin:0 0 2px">${esc(title)}</h1>`
    + `<p style="color:${ACCENT};font-weight:bold;font-size:10pt;margin:0 0 14px">${esc(company)}</p>`
    + bannerHtml(1, "Document Control")
    + controlTable
    + sectionHtml
    + note
  );
}

export function buildDocHtml(input: DocExportInput): string {
  return (
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">`
    + `<head><meta charset="utf-8"><title>${esc(input.title)}</title>`
    + `<style>body{font-family:Calibri,Aptos,sans-serif;color:${BODY};margin:0.6in}</style></head>`
    + `<body>${renderInner(input)}</body></html>`
  );
}

// Print-ready HTML for "Save as PDF": real page margins, color-accurate banners
// (browsers strip backgrounds unless told otherwise), table page-break hints,
// and an auto-print trigger once the window has loaded.
export function buildPrintHtml(input: DocExportInput): string {
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(input.title)}</title>`
    + `<style>`
    + `@page{margin:0.6in}`
    + `body{font-family:Calibri,Aptos,sans-serif;color:${BODY};margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}`
    + `table{page-break-inside:auto}tr{page-break-inside:avoid}h1{page-break-after:avoid}`
    + `</style></head>`
    + `<body>${renderInner(input)}`
    + `<script>window.onload=function(){window.focus();window.print();};</script>`
    + `</body></html>`
  );
}

/** Slug used by the EHS-[TYPE]-[SHORT TITLE] naming convention. */
function slug(s: string): string {
  return s.trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

const TYPE_CODE: Record<string, string> = {
  sop: "SOP", policy: "POL", procedure: "PRC", form: "FRM",
  permit: "PMT", msds: "SDS", plan: "PRG", guideline: "GDL",
  emergency_procedure: "EMG",
};

export function exportDocFilename(category: string, title: string): string {
  return `EHS-${TYPE_CODE[category] ?? "DOC"}-${slug(title)}.doc`;
}

/** Trigger a browser download of the built Word document. */
export function downloadDoc(filename: string, html: string): void {
  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Open the print-ready document in a new window and let the browser print it /
 * save it as PDF. Returns false if the window was blocked (caller can prompt the
 * user to allow pop-ups).
 */
export function openPrintDoc(html: string): boolean {
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
