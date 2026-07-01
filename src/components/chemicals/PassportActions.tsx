"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, FileDown, Image as ImageIcon, Loader2 } from "lucide-react";

interface Props {
  chemicalId: string;
}

export function PassportActions({ chemicalId }: Props) {
  const [exporting, setExporting] = useState<"pdf" | "png" | "print" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Print the SAME single fitted image the PNG/PDF export produces (a proven,
  // working render). CSS transform/zoom on the live element can't guarantee one
  // page — transforms don't shrink the box the print engine paginates on. An
  // image sized to the page physically cannot paginate → always exactly one
  // landscape page, whatever the label's height.
  const handlePrint = async () => {
    setError(null);
    setExporting("print");
    try {
      const canvas = await captureLabel();
      const dataUrl = canvas.toDataURL("image/png");
      const w = window.open("", "_blank", "width=1100,height=800");
      if (!w) { window.print(); return; } // popup blocked → in-page fallback
      w.document.write(
        `<!doctype html><html><head><meta charset="utf-8"><title>Chemical Passport</title>` +
        `<style>@page{size:landscape;margin:0.3in}html,body{height:100%;margin:0;background:#fff}` +
        `body{display:flex;align-items:center;justify-content:center}` +
        `img{max-width:100%;max-height:100%}</style></head>` +
        `<body><img alt="Chemical passport" src="${dataUrl}" onload="setTimeout(function(){window.focus();window.print();},150)"/></body></html>`,
      );
      w.document.close();
    } catch {
      window.print(); // capture failed → plain browser print
    } finally {
      setExporting(null);
    }
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
        disabled={!!exporting}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
        aria-label="Print label"
      >
        {exporting === "print" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
        {exporting === "print" ? "Preparing…" : "Print Label"}
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
