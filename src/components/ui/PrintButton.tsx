"use client";

import { Printer } from "lucide-react";

export interface PrintRow { label: string; value: string | null | undefined }
export interface PrintSection {
  heading: string;
  rows?: PrintRow[];
  body?: string;
  items?: { text: string; meta?: string; status?: string }[];
  flags?: string[];
}
export interface PrintReportData {
  reportType: string;
  title: string;
  subtitle?: string;
  meta?: string;
  sections: PrintSection[];
}

export function PrintButton({ data }: { data: PrintReportData }) {
  function handlePrint() {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(buildHtml(data));
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 500);
  }
  return (
    <button
      onClick={handlePrint}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
    >
      <Printer className="h-3.5 w-3.5" />
      Print Report
    </button>
  );
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtml(d: PrintReportData): string {
  const sectionsHtml = d.sections
    .filter((s) =>
      (s.rows && s.rows.some((r) => r.value)) ||
      (s.body && s.body.trim()) ||
      (s.items && s.items.length > 0) ||
      (s.flags && s.flags.length > 0),
    )
    .map((s) => {
      let inner = "";
      if (s.rows) {
        inner = `<table>${s.rows
          .filter((r) => r.value)
          .map((r) => `<tr><td class="lbl">${esc(r.label)}</td><td>${esc(String(r.value))}</td></tr>`)
          .join("")}</table>`;
      } else if (s.body) {
        inner = `<p class="body">${esc(s.body).replace(/\n/g, "<br>")}</p>`;
      } else if (s.items) {
        inner = `<ul>${s.items
          .map(
            (i) =>
              `<li>${esc(i.text)}${i.meta ? ` <span class="meta"> · ${esc(i.meta)}</span>` : ""}${i.status ? ` <span class="badge">${esc(i.status)}</span>` : ""}</li>`,
          )
          .join("")}</ul>`;
      } else if (s.flags) {
        inner = `<ul class="flags">${s.flags.map((f) => `<li>⚠ ${esc(f)}</li>`).join("")}</ul>`;
      }
      return `<section><h2>${esc(s.heading)}</h2>${inner}</section>`;
    })
    .join("");

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>${esc(d.reportType)} — ${esc(d.title)}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 13px; color: #1e293b; padding: 32px; max-width: 800px; margin: 0 auto; }
.header { border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
.report-type { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #2563eb; margin-bottom: 6px; }
h1 { font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.3; margin-bottom: 4px; }
.subtitle { font-size: 12px; color: #64748b; margin-top: 2px; }
.meta-line { font-size: 10px; color: #94a3b8; margin-top: 8px; }
section { margin-bottom: 22px; page-break-inside: avoid; }
h2 { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; }
table { width: 100%; border-collapse: collapse; }
td { padding: 5px 0; vertical-align: top; }
td.lbl { width: 164px; font-size: 11px; font-weight: 600; color: #64748b; padding-right: 16px; }
p.body { line-height: 1.7; color: #374151; white-space: pre-wrap; }
ul { padding-left: 18px; }
li { margin-bottom: 5px; line-height: 1.5; }
ul.flags { padding-left: 0; list-style: none; }
ul.flags li { color: #b45309; font-weight: 600; }
span.meta { color: #94a3b8; font-size: 11px; }
span.badge { background: #f1f5f9; border-radius: 4px; padding: 1px 7px; font-size: 11px; font-weight: 600; margin-left: 6px; }
.footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
@media print { body { padding: 0; } @page { margin: 20mm; } }
</style>
</head><body>
<div class="header">
  <div class="report-type">${esc(d.reportType)}</div>
  <h1>${esc(d.title)}</h1>
  ${d.subtitle ? `<div class="subtitle">${esc(d.subtitle)}</div>` : ""}
  ${d.meta ? `<div class="meta-line">${esc(d.meta)}</div>` : ""}
</div>
${sectionsHtml}
<div class="footer">
  <span>SafetyIQ EHS Platform · ${esc(d.reportType)}</span>
  <span>Printed ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
</div>
</body></html>`;
}
