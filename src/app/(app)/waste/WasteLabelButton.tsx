"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Tag } from "lucide-react";
import { Modal } from "@/components/modals/Modal";
import { useDemoUser } from "@/lib/context/demo-user";
import type { WasteStream } from "@/lib/types";

// Generates a printable RCRA/DOT-style hazardous-waste container label for a
// single waste stream, including a scannable QR code that encodes the stream's
// identifying data. Pure client-side; nothing is written to the database.

interface Props {
  stream: WasteStream;
  className?: string;
  label?: string;
}

function fmtDate(d: string | null): string {
  if (!d) return "________________";
  return new Date(d.includes("T") ? d : d + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Returns header color, text color, and label text based on hazard classification + waste code.
function getHazardTheme(stream: WasteStream) {
  const cls  = stream.classification;
  const code = (stream.waste_code ?? "").toUpperCase().trim();

  // Green — non-hazardous general waste
  if (cls === "general") {
    return { bg: "#16a34a", text: "#fff", headerText: "NON-HAZARDOUS WASTE",
             twBorder: "border-green-600", twHdr: "bg-green-600 text-white" };
  }
  // Teal — recyclable
  if (cls === "recyclable") {
    return { bg: "#0d9488", text: "#fff", headerText: "RECYCLABLE WASTE",
             twBorder: "border-teal-600", twHdr: "bg-teal-600 text-white" };
  }
  // Purple — radioactive
  if (cls === "radioactive") {
    return { bg: "#7c3aed", text: "#fff", headerText: "RADIOACTIVE WASTE",
             twBorder: "border-violet-700", twHdr: "bg-violet-700 text-white" };
  }
  // Biohazard orange — clinical/medical
  if (cls === "clinical") {
    return { bg: "#ea580c", text: "#fff", headerText: "CLINICAL / BIOHAZARDOUS WASTE",
             twBorder: "border-orange-600", twHdr: "bg-orange-600 text-white" };
  }
  // Dark red — acutely / scheduled hazardous
  if (cls === "scheduled") {
    return { bg: "#7f1d1d", text: "#fff", headerText: "ACUTELY HAZARDOUS WASTE — SCHEDULED",
             twBorder: "border-red-900", twHdr: "bg-red-900 text-white" };
  }
  // Hazardous — differentiate by EPA waste code
  if (code.startsWith("D003")) {
    return { bg: "#dc2626", text: "#fff", headerText: "HAZARDOUS WASTE — REACTIVE",
             twBorder: "border-red-600", twHdr: "bg-red-600 text-white" };
  }
  if (code.startsWith("D002")) {
    return { bg: "#ea580c", text: "#fff", headerText: "HAZARDOUS WASTE — CORROSIVE",
             twBorder: "border-orange-600", twHdr: "bg-orange-600 text-white" };
  }
  if (code.startsWith("D001")) {
    return { bg: "#f59e0b", text: "#000", headerText: "HAZARDOUS WASTE — IGNITABLE",
             twBorder: "border-amber-400", twHdr: "bg-amber-400 text-black" };
  }
  if (code.startsWith("P") || code.startsWith("U")) {
    return { bg: "#dc2626", text: "#fff", headerText: "HAZARDOUS WASTE — ACUTELY LISTED",
             twBorder: "border-red-600", twHdr: "bg-red-600 text-white" };
  }
  if (code.startsWith("F") || code.startsWith("K")) {
    return { bg: "#b91c1c", text: "#fff", headerText: "HAZARDOUS WASTE — LISTED",
             twBorder: "border-red-700", twHdr: "bg-red-700 text-white" };
  }
  // D004–D043 characteristic toxic
  const dNum = code.startsWith("D") ? parseInt(code.slice(1), 10) : 0;
  if (dNum >= 4 && dNum <= 43) {
    return { bg: "#c2410c", text: "#fff", headerText: "HAZARDOUS WASTE — TOXIC CHARACTERISTIC",
             twBorder: "border-orange-700", twHdr: "bg-orange-700 text-white" };
  }
  // Generic hazardous fallback — amber/yellow
  return { bg: "#f59e0b", text: "#000", headerText: "HAZARDOUS WASTE",
           twBorder: "border-amber-400", twHdr: "bg-amber-400 text-black" };
}

export function WasteLabelButton({ stream, className, label = "Label / QR" }: Props) {
  const [open, setOpen] = useState(false);
  const [qrSvg, setQrSvg] = useState<string>("");
  const { user } = useDemoUser();

  const generator = user.company || "Generator";
  const accumulationStart = fmtDate(stream.created_at);
  const isHazardous = stream.classification === "hazardous" || stream.classification === "scheduled";
  const theme = getHazardTheme(stream);

  const qrPayload =
    `SafetyIQ Waste\n` +
    `ID: ${stream.id}\n` +
    `Name: ${stream.waste_name}\n` +
    (stream.waste_code ? `EPA Code: ${stream.waste_code}\n` : "") +
    `Class: ${stream.classification}\n` +
    (stream.manifest_number ? `Manifest: ${stream.manifest_number}\n` : "") +
    `Qty: ${stream.quantity} ${stream.unit}`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    QRCode.toString(qrPayload, { type: "svg", margin: 1, width: 160, errorCorrectionLevel: "M" })
      .then((svg) => { if (!cancelled) setQrSvg(svg); })
      .catch(() => { if (!cancelled) setQrSvg(""); });
    return () => { cancelled = true; };
  }, [open, qrPayload]);

  function buildLabelHtml(): string {
    const accentBg   = theme.bg;
    const accentText = theme.text;
    const headerText = theme.headerText;
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Waste Label — ${esc(stream.waste_name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 16px; color: #111; }
  .label { width: 4in; border: 3px solid #000; margin: 0 auto; }
  .hdr { background: ${accentBg}; color: ${accentText}; text-align: center; font-weight: 800; font-size: 20px; letter-spacing: 1px; padding: 8px; border-bottom: 3px solid #000; }
  .sub { text-align:center; font-size: 9px; font-weight:700; padding: 3px; border-bottom: 2px solid #000; text-transform: uppercase; }
  .body { display: flex; }
  .fields { flex: 1; padding: 8px 10px; font-size: 11px; line-height: 1.5; }
  .fields .row { border-bottom: 1px dotted #aaa; padding: 2px 0; }
  .k { font-weight: 700; text-transform: uppercase; font-size: 9px; color: #444; display:block; }
  .v { font-size: 12px; }
  .qr { width: 130px; border-left: 2px solid #000; padding: 8px; display:flex; align-items:center; justify-content:center; }
  .qr svg { width: 100%; height: auto; }
  .footer { font-size: 8px; text-align:center; padding: 4px; border-top: 2px solid #000; color:#333; }
  @media print { body { padding: 0; } .noprint { display: none; } }
  .noprint { text-align:center; margin-top: 16px; }
  .noprint button { font-size: 13px; padding: 8px 18px; cursor: pointer; }
</style></head>
<body>
  <div class="label">
    <div class="hdr">${headerText}</div>
    <div class="sub">Federal Law Prohibits Improper Disposal · EPA 40 CFR 262 / DOT 49 CFR 172</div>
    <div class="body">
      <div class="fields">
        <div class="row"><span class="k">Generator</span><span class="v">${esc(generator)}</span></div>
        <div class="row"><span class="k">Waste Name</span><span class="v">${esc(stream.waste_name)}</span></div>
        <div class="row"><span class="k">EPA / Waste Code</span><span class="v">${esc(stream.waste_code ?? "—")}</span></div>
        <div class="row"><span class="k">Hazard Class</span><span class="v">${esc(stream.classification.replace(/_/g, " "))}</span></div>
        <div class="row"><span class="k">Quantity</span><span class="v">${esc(String(stream.quantity))} ${esc(stream.unit)}</span></div>
        <div class="row"><span class="k">Accumulation Start Date</span><span class="v">${esc(accumulationStart)}</span></div>
        <div class="row"><span class="k">Manifest #</span><span class="v">${esc(stream.manifest_number ?? "________________")}</span></div>
      </div>
      <div class="qr">${qrSvg}</div>
    </div>
    <div class="footer">SafetyIQ · Reliance Predictive Safety Technologies · Scan QR for digital record</div>
  </div>
  <div class="noprint"><button onclick="window.print()">Print this label</button></div>
</body></html>`;
  }

  function handlePrint() {
    const w = window.open("", "_blank", "width=520,height=640");
    if (!w) {
      // Popup blocked — fall back to downloading the label as an HTML file.
      const blob = new Blob([buildLabelHtml()], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `waste-label-${stream.id.slice(0, 8)}.html`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    w.document.write(buildLabelHtml());
    w.document.close();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} title="Generate printable container label with QR code">
        <Tag className="h-3 w-3" />
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Container Label — ${stream.waste_name}`}>
        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="flex gap-5">
            <div className="flex-1 space-y-1.5 text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Label Preview</div>
              <div className={`rounded-lg border-2 ${theme.twBorder} overflow-hidden`}>
                <div className={`px-3 py-1.5 text-center text-sm font-extrabold tracking-wide ${theme.twHdr}`}>
                  {theme.headerText}
                </div>
                <div className="space-y-1 px-3 py-2">
                  <Row k="Generator" v={generator} />
                  <Row k="Waste Name" v={stream.waste_name} />
                  <Row k="EPA / Waste Code" v={stream.waste_code ?? "—"} />
                  <Row k="Hazard Class" v={stream.classification.replace(/_/g, " ")} />
                  <Row k="Quantity" v={`${stream.quantity} ${stream.unit}`} />
                  <Row k="Accumulation Start" v={accumulationStart} />
                  <Row k="Manifest #" v={stream.manifest_number ?? "—"} />
                </div>
              </div>
            </div>
            <div className="flex w-40 shrink-0 flex-col items-center gap-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Scannable QR</div>
              <div className="h-36 w-36 rounded-lg border border-slate-200 bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
                   dangerouslySetInnerHTML={{ __html: qrSvg || "" }} />
              <div className="text-center text-[9px] text-slate-400">Encodes stream ID, code & manifest</div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-600">
            <span className="font-bold text-slate-700">Recommended label printers: </span>
            <span className="font-semibold text-slate-800">Brady BMP61</span> (chemical-resistant, EPA/DOT rated — industry standard) ·{" "}
            <span className="font-semibold text-slate-800">Brother QL-1110NWB</span> (4″ WiFi, best value for indoor storage) ·{" "}
            <span className="font-semibold text-slate-800">Zebra ZD620</span> (industrial/network environments).{" "}
            Print at 4-inch width for full compliance label size.
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Close
            </button>
            <button type="button" onClick={handlePrint} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
              Print Label
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dotted border-slate-200 py-0.5">
      <span className="text-[9px] font-bold uppercase text-slate-400">{k}</span>
      <span className="text-right text-[11px] font-medium text-slate-700">{v}</span>
    </div>
  );
}
