"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, FileDown, Image as ImageIcon, Loader2 } from "lucide-react";

interface Props {
  chemicalId: string;
}

export function PassportActions({ chemicalId }: Props) {
  const [exporting, setExporting] = useState<"pdf" | "png" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fit the label onto ONE landscape page. A fixed print scale can't do this —
  // the label's height varies by chemical. Measure it and compute the scale that
  // fits both the width and height of a landscape Letter page (minus 0.3in
  // margins, at 96 CSS px/in), then expose it to the print CSS as --print-scale.
  const handlePrint = () => {
    const el = document.getElementById("chemical-passport-label");
    if (el) {
      const PAGE_W = (11 - 0.6) * 96; // 998px printable width  (landscape Letter)
      const PAGE_H = (8.5 - 0.6) * 96; // 758px printable height
      const w = el.scrollWidth || 1160;
      const h = el.scrollHeight || 1;
      const scale = Math.min(PAGE_W / w, PAGE_H / h, 1) * 0.98; // 2% safety margin
      el.style.setProperty("--print-scale", scale.toFixed(3));
    }
    window.print();
  };

  const captureLabel = async () => {
    const { default: html2canvas } = await import("html2canvas");
    const el = document.getElementById("chemical-passport-label");
    if (!el) throw new Error("Label not ready — please wait a moment and try again.");
    // html2canvas reads the LIVE element's computed styles, which under Tailwind
    // v4 are oklch() (which it can't parse) — onclone can't prevent that. So we
    // render the label in an isolated iframe that never loaded Tailwind. The
    // label is fully inline-styled, so its outerHTML renders identically there,
    // and every computed color is plain hex → html2canvas succeeds.
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, { position: "fixed", left: "-10000px", top: "0", width: "760px", height: `${el.scrollHeight + 60}px`, border: "0" });
    document.body.appendChild(iframe);
    try {
      const idoc = iframe.contentDocument;
      if (!idoc) throw new Error("Could not prepare the export canvas.");
      idoc.open();
      idoc.write(`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#ffffff">${el.outerHTML}</body></html>`);
      idoc.close();
      // Let the inline QR data-URL image and layout settle before capture.
      await new Promise((r) => setTimeout(r, 350));
      const target = idoc.getElementById("chemical-passport-label") as HTMLElement | null;
      if (!target) throw new Error("Could not prepare the export canvas.");
      return await html2canvas(target, { scale: 3, backgroundColor: "#ffffff", useCORS: true });
    } finally {
      document.body.removeChild(iframe);
    }
  };

  const handleExportPdf = async () => {
    setExporting("pdf"); setError(null);
    try {
      const canvas = await captureLabel();
      const { jsPDF } = await import("jspdf");
      const w = canvas.width / 3, h = canvas.height / 3;
      const pdf = new jsPDF({ orientation: w > h ? "landscape" : "portrait", unit: "px", format: [w, h] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
      pdf.save(`chemical-passport-${chemicalId}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF export failed. Try Print instead.");
    } finally {
      setExporting(null);
    }
  };

  const handleExportPng = async () => {
    setExporting("png"); setError(null);
    try {
      const canvas = await captureLabel();
      const link = document.createElement("a");
      link.download = `chemical-passport-${chemicalId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      setError(e instanceof Error ? e.message : "PNG export failed. Try Print instead.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-3">
      <Link
        href={`/chemicals/${chemicalId}`}
        className="mr-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Chemical Record
      </Link>

      <button
        onClick={handlePrint}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        aria-label="Print label"
      >
        <Printer className="h-4 w-4" /> Print Label
      </button>

      <button
        onClick={handleExportPdf}
        disabled={!!exporting}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        aria-label="Export label as PDF"
      >
        {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        {exporting === "pdf" ? "Exporting…" : "Export PDF"}
      </button>

      <button
        onClick={handleExportPng}
        disabled={!!exporting}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        aria-label="Export label as PNG image"
      >
        {exporting === "png" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
        {exporting === "png" ? "Exporting…" : "Export PNG"}
      </button>

      {error && <p className="w-full text-xs text-red-600">{error}</p>}
      <p className="mt-1 w-full text-xs text-slate-400">
        Tip: use <strong>PDF</strong> for drums and totes; use <strong>PNG</strong> for bottles and smaller containers.
      </p>
    </div>
  );
}
