"use client";

import { FileText, Printer } from "lucide-react";
import type { DocSection } from "@/lib/types";
import {
  buildDocHtml,
  buildPrintHtml,
  downloadDoc,
  openPrintDoc,
  exportDocFilename,
  type DocControlRow,
} from "@/lib/docExport";

export function DocumentExportButton({
  title,
  category,
  company,
  controlRows,
  sections,
  generatedNote,
}: {
  title: string;
  category: string;
  company: string;
  controlRows: DocControlRow[];
  sections: DocSection[];
  generatedNote?: string;
}) {
  const input = { title, controlRows, sections, company, generatedNote };

  function handleWord() {
    downloadDoc(exportDocFilename(category, title), buildDocHtml(input));
  }

  function handlePdf() {
    if (!openPrintDoc(buildPrintHtml(input))) {
      alert("Allow pop-ups for this site to export as PDF.");
    }
  }

  const cls =
    "flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50";

  return (
    <div className="flex items-center gap-2">
      <button onClick={handleWord} className={cls}>
        <FileText className="h-3.5 w-3.5" />
        Word
      </button>
      <button onClick={handlePdf} className={cls}>
        <Printer className="h-3.5 w-3.5" />
        PDF
      </button>
    </div>
  );
}
