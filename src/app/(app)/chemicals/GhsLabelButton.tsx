"use client";

import { useState } from "react";
import { Tag, Printer, X, Shield, Plus, Package, Phone, FileText } from "lucide-react";
import type { Chemical } from "@/lib/types";
import { deriveSignalWord, derivePictograms, getHText, getPText } from "@/lib/ghsData";
import { logLabelPrint, type LabelSnapshot } from "@/lib/actions/labels";

const REGULATORY_BASIS = "OSHA 29 CFR 1910.1200 (HazCom 2012) / GHS Rev. 9 / WHMIS 2015";

// ── GHS pictogram names ───────────────────────────────────────────────────────

const GHS_NAMES: Record<string, string> = {
  GHS01: "Explosive",     GHS02: "Flammable",     GHS03: "Oxidizing",
  GHS04: "Gas",           GHS05: "Corrosive",     GHS06: "Toxic",
  GHS07: "Irritant",      GHS08: "Health Hazard", GHS09: "Environmental",
};

// ── GHS pictogram React component (SVG diamond frame + symbol) ────────────────

function GhsPictogram({ code, size = 60 }: { code: string; size?: number }) {
  const clipId = `ghs-${code}`;

  const symbols: Record<string, React.ReactNode> = {
    GHS01: ( // Exploding bomb — starburst + round body + fuse
      <>
        <polygon points="40,12 43,23 54,18 47,28 60,31 49,36 55,47 41,41 40,53 39,41 25,47 31,36 20,31 33,28 26,18 37,23" fill="black"/>
        <circle cx="40" cy="63" r="12" fill="black"/>
        <path d="M 40 51 Q 50 44 47 35" stroke="black" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      </>
    ),
    GHS02: ( // Flame — fluid teardrop with bright inner ellipse
      <>
        <path d="M 40 68 C 25 59 17 46 22 33 C 24 25 31 24 30 30 C 30 21 35 13 40 11 C 40 18 37 22 40 25 C 43 17 50 12 53 18 C 57 25 53 32 55 38 C 60 47 54 59 40 68 Z" fill="black"/>
        <ellipse cx="40" cy="50" rx="5.5" ry="9" fill="white"/>
      </>
    ),
    GHS03: ( // Flame over circle — oxidizing
      <>
        <path d="M 40 44 C 32 39 27 31 30 24 C 32 19 36 19 35 24 C 35 16 38 11 40 10 C 40 16 38 18 40 20 C 42 15 47 10 50 16 C 53 22 50 30 52 35 C 55 40 49 44 40 44 Z" fill="black"/>
        <circle cx="40" cy="61" r="11" fill="none" stroke="black" strokeWidth="5"/>
      </>
    ),
    GHS04: ( // Gas cylinder — body, dome, neck, valve, base
      <>
        <rect x="28" y="43" width="24" height="22" rx="3" fill="black"/>
        <ellipse cx="40" cy="43" rx="12" ry="5" fill="black"/>
        <rect x="35" y="28" width="10" height="14" rx="2" fill="black"/>
        <rect x="27" y="25" width="26" height="6" rx="3" fill="black"/>
        <rect x="24" y="64" width="32" height="5" rx="2" fill="black"/>
      </>
    ),
    GHS05: ( // Corrosion — two plates with drips (left) + hand with drop (right)
      <>
        <rect x="8" y="14" width="26" height="6" rx="2" fill="black"/>
        <ellipse cx="15" cy="25" rx="3" ry="5" fill="black"/>
        <ellipse cx="27" cy="25" rx="3" ry="5" fill="black"/>
        <path d="M 6 33 Q 10 29 14 33 Q 18 37 22 33 Q 26 29 30 33 Q 34 37 36 35 L 36 42 L 6 42 Z" fill="black"/>
        <rect x="48" y="44" width="22" height="20" rx="5" fill="black"/>
        <ellipse cx="45" cy="52" rx="5" ry="7" fill="black"/>
        <rect x="50" y="29" width="5" height="17" rx="2.5" fill="black"/>
        <rect x="57" y="27" width="5" height="19" rx="2.5" fill="black"/>
        <rect x="64" y="29" width="5" height="17" rx="2.5" fill="black"/>
        <ellipse cx="58" cy="19" rx="3.5" ry="5.5" fill="black"/>
      </>
    ),
    GHS06: ( // Skull and crossbones
      <>
        <ellipse cx="40" cy="30" rx="17" ry="16" fill="black"/>
        <ellipse cx="33" cy="28" rx="5.5" ry="6.5" fill="white"/>
        <ellipse cx="47" cy="28" rx="5.5" ry="6.5" fill="white"/>
        <rect x="32" y="42" width="16" height="8" rx="2" fill="black"/>
        <rect x="35" y="41" width="3" height="7" fill="white"/>
        <rect x="42" y="41" width="3" height="7" fill="white"/>
        <line x1="18" y1="56" x2="62" y2="70" stroke="black" strokeWidth="7" strokeLinecap="round"/>
        <line x1="62" y1="56" x2="18" y2="70" stroke="black" strokeWidth="7" strokeLinecap="round"/>
        <circle cx="18" cy="56" r="6" fill="black"/>
        <circle cx="62" cy="56" r="6" fill="black"/>
        <circle cx="18" cy="70" r="6" fill="black"/>
        <circle cx="62" cy="70" r="6" fill="black"/>
      </>
    ),
    GHS07: ( // Exclamation mark — irritant / harmful
      <>
        <rect x="33" y="13" width="14" height="38" rx="6" fill="black"/>
        <circle cx="40" cy="63" r="8" fill="black"/>
      </>
    ),
    GHS08: ( // Health hazard — person silhouette + chest starburst rays
      <>
        <circle cx="40" cy="16" r="8" fill="black"/>
        <path d="M 33 24 L 30 52 L 36 52 L 36 40 L 44 40 L 44 52 L 50 52 L 47 24 Z" fill="black"/>
        <path d="M 33 27 L 20 40" stroke="black" strokeWidth="6" strokeLinecap="round" fill="none"/>
        <path d="M 47 27 L 60 40" stroke="black" strokeWidth="6" strokeLinecap="round" fill="none"/>
        <path d="M 34 52 L 30 68" stroke="black" strokeWidth="6" strokeLinecap="round" fill="none"/>
        <path d="M 46 52 L 50 68" stroke="black" strokeWidth="6" strokeLinecap="round" fill="none"/>
        <line x1="47" y1="30" x2="56" y2="23" stroke="black" strokeWidth="3" strokeLinecap="round"/>
        <line x1="49" y1="35" x2="61" y2="33" stroke="black" strokeWidth="3" strokeLinecap="round"/>
        <line x1="48" y1="41" x2="58" y2="44" stroke="black" strokeWidth="3" strokeLinecap="round"/>
      </>
    ),
    GHS09: ( // Environmental — bare dead tree (left) + dead fish (right/bottom)
      <>
        <rect x="18" y="36" width="6" height="28" rx="2" fill="black"/>
        <path d="M 21 36 L 10 22 M 21 42 L 8 34 M 21 36 L 34 22 M 21 42 L 36 30" stroke="black" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
        <path d="M 12 66 L 30 66" stroke="black" strokeWidth="3" strokeLinecap="round" fill="none"/>
        <path d="M 44 54 C 46 47 54 44 61 46 C 68 48 70 54 70 57 C 70 60 68 65 61 67 C 54 69 46 67 44 60 Z" fill="black"/>
        <path d="M 44 57 L 36 52 L 36 62 Z" fill="black"/>
        <circle cx="63" cy="56" r="3.5" fill="white"/>
      </>
    ),
  };

  return (
    <svg width={size} height={size} viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-label={GHS_NAMES[code] ?? code}>
      <defs>
        <clipPath id={clipId}>
          <polygon points="40,2 78,40 40,78 2,40"/>
        </clipPath>
      </defs>
      <polygon points="40,2 78,40 40,78 2,40" fill="white" stroke="#cc0000" strokeWidth="5"/>
      <g clipPath={`url(#${clipId})`}>
        {symbols[code] ?? null}
      </g>
    </svg>
  );
}

// ── Print HTML builder — same symbols as HTML-format SVG strings ──────────────

function buildPictogramSvgStr(code: string, size: number): string {
  const SYMBOL_HTML: Record<string, string> = {
    GHS01: `<polygon points="40,12 43,23 54,18 47,28 60,31 49,36 55,47 41,41 40,53 39,41 25,47 31,36 20,31 33,28 26,18 37,23" fill="black"/><circle cx="40" cy="63" r="12" fill="black"/><path d="M 40 51 Q 50 44 47 35" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    GHS02: `<path d="M 40 68 C 25 59 17 46 22 33 C 24 25 31 24 30 30 C 30 21 35 13 40 11 C 40 18 37 22 40 25 C 43 17 50 12 53 18 C 57 25 53 32 55 38 C 60 47 54 59 40 68 Z" fill="black"/><ellipse cx="40" cy="50" rx="5.5" ry="9" fill="white"/>`,
    GHS03: `<path d="M 40 44 C 32 39 27 31 30 24 C 32 19 36 19 35 24 C 35 16 38 11 40 10 C 40 16 38 18 40 20 C 42 15 47 10 50 16 C 53 22 50 30 52 35 C 55 40 49 44 40 44 Z" fill="black"/><circle cx="40" cy="61" r="11" fill="none" stroke="black" stroke-width="5"/>`,
    GHS04: `<rect x="28" y="43" width="24" height="22" rx="3" fill="black"/><ellipse cx="40" cy="43" rx="12" ry="5" fill="black"/><rect x="35" y="28" width="10" height="14" rx="2" fill="black"/><rect x="27" y="25" width="26" height="6" rx="3" fill="black"/><rect x="24" y="64" width="32" height="5" rx="2" fill="black"/>`,
    GHS05: `<rect x="8" y="14" width="26" height="6" rx="2" fill="black"/><ellipse cx="15" cy="25" rx="3" ry="5" fill="black"/><ellipse cx="27" cy="25" rx="3" ry="5" fill="black"/><path d="M 6 33 Q 10 29 14 33 Q 18 37 22 33 Q 26 29 30 33 Q 34 37 36 35 L 36 42 L 6 42 Z" fill="black"/><rect x="48" y="44" width="22" height="20" rx="5" fill="black"/><ellipse cx="45" cy="52" rx="5" ry="7" fill="black"/><rect x="50" y="29" width="5" height="17" rx="2.5" fill="black"/><rect x="57" y="27" width="5" height="19" rx="2.5" fill="black"/><rect x="64" y="29" width="5" height="17" rx="2.5" fill="black"/><ellipse cx="58" cy="19" rx="3.5" ry="5.5" fill="black"/>`,
    GHS06: `<ellipse cx="40" cy="30" rx="17" ry="16" fill="black"/><ellipse cx="33" cy="28" rx="5.5" ry="6.5" fill="white"/><ellipse cx="47" cy="28" rx="5.5" ry="6.5" fill="white"/><rect x="32" y="42" width="16" height="8" rx="2" fill="black"/><rect x="35" y="41" width="3" height="7" fill="white"/><rect x="42" y="41" width="3" height="7" fill="white"/><line x1="18" y1="56" x2="62" y2="70" stroke="black" stroke-width="7" stroke-linecap="round"/><line x1="62" y1="56" x2="18" y2="70" stroke="black" stroke-width="7" stroke-linecap="round"/><circle cx="18" cy="56" r="6" fill="black"/><circle cx="62" cy="56" r="6" fill="black"/><circle cx="18" cy="70" r="6" fill="black"/><circle cx="62" cy="70" r="6" fill="black"/>`,
    GHS07: `<rect x="33" y="13" width="14" height="38" rx="6" fill="black"/><circle cx="40" cy="63" r="8" fill="black"/>`,
    GHS08: `<circle cx="40" cy="16" r="8" fill="black"/><path d="M 33 24 L 30 52 L 36 52 L 36 40 L 44 40 L 44 52 L 50 52 L 47 24 Z" fill="black"/><path d="M 33 27 L 20 40" stroke="black" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M 47 27 L 60 40" stroke="black" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M 34 52 L 30 68" stroke="black" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M 46 52 L 50 68" stroke="black" stroke-width="6" stroke-linecap="round" fill="none"/><line x1="47" y1="30" x2="56" y2="23" stroke="black" stroke-width="3" stroke-linecap="round"/><line x1="49" y1="35" x2="61" y2="33" stroke="black" stroke-width="3" stroke-linecap="round"/><line x1="48" y1="41" x2="58" y2="44" stroke="black" stroke-width="3" stroke-linecap="round"/>`,
    GHS09: `<rect x="18" y="36" width="6" height="28" rx="2" fill="black"/><path d="M 21 36 L 10 22 M 21 42 L 8 34 M 21 36 L 34 22 M 21 42 L 36 30" stroke="black" stroke-width="3.5" stroke-linecap="round" fill="none"/><path d="M 12 66 L 30 66" stroke="black" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M 44 54 C 46 47 54 44 61 46 C 68 48 70 54 70 57 C 70 60 68 65 61 67 C 54 69 46 67 44 60 Z" fill="black"/><path d="M 44 57 L 36 52 L 36 62 Z" fill="black"/><circle cx="63" cy="56" r="3.5" fill="white"/>`,
  };
  const sym = SYMBOL_HTML[code] ?? "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:top;"><defs><clipPath id="c${code}"><polygon points="40,2 78,40 40,78 2,40"/></clipPath></defs><polygon points="40,2 78,40 40,78 2,40" fill="white" stroke="#cc0000" stroke-width="5"/><g clip-path="url(#c${code})">${sym}</g></svg>`;
}

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildPrintHtml(chemical: Chemical): string {
  const h = chemical.hazard_statements ?? [];
  const p = chemical.precautionary_statements ?? [];
  const signalWord = deriveSignalWord(h);
  const pictogramCodes = derivePictograms(h);

  const picsHtml = pictogramCodes.map((c) => buildPictogramSvgStr(c, 72)).join(" ");

  const hLines = h.map((code) => {
    const text = getHText(code);
    return `<p style="margin:1px 0 3px;font-size:9.5pt;line-height:1.3;"><strong style="color:#8b0000;">${esc(code)}</strong>${text ? ": " + esc(text) : " — see SDS"}</p>`;
  }).join("");

  const pLines = p.slice(0, 12).map((code) => {
    const text = getPText(code);
    return `<p style="margin:1px 0 3px;font-size:9.5pt;line-height:1.3;"><strong style="color:#1d4ed8;">${esc(code)}</strong>${text ? ": " + esc(text) : " — see SDS"}</p>`;
  }).join("");

  const signalHtml = signalWord
    ? `<div style="font-size:24pt;font-weight:900;color:${signalWord === "Danger" ? "#cc0000" : "#d97706"};margin-bottom:6px;letter-spacing:-0.5px;">${signalWord.toUpperCase()}</div>`
    : "";

  const labelCodeHtml = chemical.label_code
    ? `<div style="font-family:monospace;font-size:11pt;font-weight:bold;letter-spacing:2px;color:#334155;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;padding:3px 8px;display:inline-block;margin-top:4px;">${esc(chemical.label_code)}</div>`
    : "";

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Label — ${esc(chemical.name)}</title>
<style>
  @page { size: 4in 4in; margin: 0.15in; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 8px; background: white; }
  .label { border: 3px solid ${h.length > 0 ? "#cc0000" : "#334155"}; padding: 10px; }
  .hdr { border-bottom: 2px solid ${h.length > 0 ? "#cc0000" : "#334155"}; padding-bottom: 6px; margin-bottom: 8px; }
  .name { font-size: 15pt; font-weight: bold; line-height: 1.2; color: #111; }
  .sub { font-size: 8.5pt; color: #555; margin-top: 3px; }
  .body { display: flex; gap: 10px; }
  .pics { flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; }
  .content { flex: 1; }
  .sec-title { font-size: 7pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.6px; color: #888; border-bottom: 1px solid #ddd; margin: 6px 0 3px; padding-bottom: 1px; }
  .footer { border-top: 1px solid #ccc; margin-top: 8px; padding-top: 6px; font-size: 7.5pt; color: #555; line-height: 1.5; }
  .reg { font-size: 6.5pt; color: #aaa; margin-top: 2px; }
</style></head>
<body>
<div class="label">
  <div class="hdr">
    <div class="name">${esc(chemical.name)}</div>
    <div class="sub">
      ${chemical.cas_number ? `CAS No. <strong>${esc(chemical.cas_number)}</strong>` : ""}
      ${chemical.cas_number && chemical.supplier ? " &nbsp;&middot;&nbsp; " : ""}
      ${chemical.supplier ? `Supplier: ${esc(chemical.supplier)}` : ""}
    </div>
    ${labelCodeHtml}
  </div>
  <div class="body">
    <div class="pics">${picsHtml}</div>
    <div class="content">
      ${signalHtml}
      ${h.length > 0 ? `<div class="sec-title">Hazard Statements</div>${hLines}` : '<p style="font-size:9pt;color:#64748b;margin:4px 0;">No GHS hazard classification — refer to SDS for hazard information.</p>'}
      ${p.length > 0 ? `<div class="sec-title">Precautionary Statements</div>${pLines}` : ""}
    </div>
  </div>
  <div class="footer">
    ${chemical.storage_location ? `<strong>Storage:</strong> ${esc(chemical.storage_location)}<br>` : ""}
    <strong>Emergency:</strong> Call 911 &nbsp;&middot;&nbsp; Poison Control: 1-800-222-1222<br>
    Refer to Safety Data Sheet for complete health, safety and environmental information.
    <div class="reg">${h.length > 0 ? "GHS workplace label &mdash; OSHA 29 CFR 1910.1200 (HazCom 2012) / GHS Rev. 9 / WHMIS 2015" : "Container identification label &mdash; SafetyIQ"}</div>
  </div>
</div>
<script>setTimeout(function(){window.print();},350);</script>
</body></html>`;
}

// ── Categorise P-statements by section ───────────────────────────────────────

function categorizePStatements(codes: string[]) {
  const prevention: string[] = [];
  const response: string[] = [];
  const storage: string[] = [];
  const disposal: string[] = [];
  for (const code of codes) {
    const base = code.split("+")[0];
    const num = parseInt(base.slice(1), 10);
    if (num >= 500)      disposal.push(code);
    else if (num >= 400) storage.push(code);
    else if (num >= 300) response.push(code);
    else                 prevention.push(code); // P1xx + P2xx
  }
  return { prevention, response, storage, disposal };
}

// ── Main component ────────────────────────────────────────────────────────────

export function GhsLabelButton({ chemical }: { chemical: Chemical }) {
  const [open, setOpen] = useState(false);
  const [logNote, setLogNote] = useState<{ ok: boolean; text: string } | null>(null);

  const h = chemical.hazard_statements ?? [];
  const p = chemical.precautionary_statements ?? [];
  const signalWord = deriveSignalWord(h);
  const picCodes   = derivePictograms(h);
  const cats       = categorizePStatements(p);

  function recordPrint() {
    const snapshot: LabelSnapshot = {
      product_name:             chemical.name,
      cas_number:               chemical.cas_number,
      supplier:                 chemical.supplier,
      storage_location:         chemical.storage_location || null,
      signal_word:              signalWord,
      pictogram_codes:          picCodes,
      hazard_statements:        h.map((code) => ({ code, text: getHText(code) })),
      precautionary_statements: p.map((code) => ({ code, text: getPText(code) })),
      regulatory_basis:         REGULATORY_BASIS,
    };
    logLabelPrint({ chemicalId: chemical.id, snapshot })
      .then((res) =>
        setLogNote(
          res.ok
            ? { ok: true, text: "Print recorded to the label audit log." }
            : { ok: false, text: `Print log failed: ${res.error}` },
        ),
      )
      .catch((err) => setLogNote({ ok: false, text: `Print log failed: ${String(err)}` }));
  }

  function handlePrint() {
    const html = buildPrintHtml(chemical);
    const w = window.open("", "_blank", "width=520,height=680");
    if (!w) {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `GHS-Label-${chemical.name.replace(/[^a-zA-Z0-9]/g, "_")}.html`;
      a.click();
      URL.revokeObjectURL(url);
      recordPrint();
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    recordPrint();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={h.length > 0 ? "Generate GHS Workplace Label" : "Generate Container ID Label"}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
          h.length > 0
            ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
        }`}
      >
        <Tag className="h-3 w-3"/>
        {h.length > 0 ? "GHS Label" : "Label"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-6">
          <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl">

            {/* ── Modal chrome ── */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="text-sm font-bold text-slate-800">GHS Workplace Label</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {chemical.name}{chemical.label_code ? ` ${chemical.label_code}` : ""}
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <X className="h-4 w-4"/>
              </button>
            </div>

            <div className="p-5">

              {/* ══════════════════════════════════════════════════════════════
                  LABEL PREVIEW — matches printed GHS workplace label layout
              ══════════════════════════════════════════════════════════════ */}
              <div className="overflow-hidden rounded-lg border-[3px] border-red-700 bg-white text-slate-900 shadow">

                {/* ── 1. Header: name / CAS / product ID ── */}
                <div className="flex items-start justify-between gap-4 border-b-2 border-slate-900 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-lg font-black uppercase leading-tight tracking-tight text-slate-900">
                      {chemical.name}
                    </div>
                    {chemical.chemical_formula && (
                      <div className="mt-0.5 text-[10px] text-slate-500">
                        Chemical Formula: <strong className="text-slate-700">{chemical.chemical_formula}</strong>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-start gap-5 text-right">
                    {chemical.cas_number && (
                      <div>
                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-400">CAS Number</div>
                        <div className="text-base font-black text-slate-900">{chemical.cas_number}</div>
                      </div>
                    )}
                    {chemical.label_code && (
                      <div className="border-l border-slate-300 pl-5">
                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-400">Product ID</div>
                        <div className="text-base font-black text-slate-900">{chemical.label_code}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── 2. Pictogram + signal word  |  Hazard statements ── */}
                <div className="flex border-b border-slate-200">

                  {/* Left: pictogram(s) + signal word + primary hazard + GHS name */}
                  <div className="flex w-1/2 items-center gap-3 border-r border-slate-200 p-4">
                    {picCodes.length > 0 && (
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        {picCodes.map((code) => (
                          <GhsPictogram key={code} code={code} size={68}/>
                        ))}
                      </div>
                    )}
                    <div>
                      {signalWord ? (
                        <div className={`text-2xl font-black leading-none ${signalWord === "Danger" ? "text-red-700" : "text-amber-500"}`}>
                          {signalWord.toUpperCase()}
                        </div>
                      ) : (
                        <div className="text-xs italic text-slate-400">No signal word</div>
                      )}
                      {h[0] && getHText(h[0]) && (
                        <div className="mt-1 text-[11px] font-medium leading-snug text-slate-700">
                          {getHText(h[0])}.
                        </div>
                      )}
                      {picCodes[0] && (
                        <div className="mt-1.5 text-[10px]">
                          <span className="font-bold text-red-700">{picCodes[0]}</span>
                          <span className="text-slate-500">: {GHS_NAMES[picCodes[0]]}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: all H-statements */}
                  <div className="w-1/2 p-4">
                    <div className="mb-2 border-b border-red-200 pb-1 text-[9px] font-black uppercase tracking-widest text-red-700">
                      Hazard Statement{h.length !== 1 ? "s" : ""}
                    </div>
                    {h.length > 0 ? (
                      <div className="space-y-1">
                        {h.map((code) => {
                          const text = getHText(code);
                          return (
                            <p key={code} className="text-[11px] leading-snug">
                              <span className="font-bold">{code}</span>
                              {text && <span className="text-slate-600">: {text}.</span>}
                            </p>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] italic text-slate-400">No GHS hazard classification — refer to SDS.</p>
                    )}
                  </div>
                </div>

                {/* ── 3. Prevention | Response | Storage ── */}
                <div className="grid grid-cols-3 border-b border-slate-200">

                  {/* Prevention (blue) */}
                  <div className="border-r border-slate-200">
                    <div className="flex items-center gap-1.5 bg-blue-800 px-3 py-2 text-white">
                      <Shield className="h-3 w-3 flex-shrink-0"/>
                      <span className="text-[9px] font-black uppercase tracking-wider">Prevention</span>
                    </div>
                    <div className="min-h-[80px] p-3 space-y-1.5">
                      {cats.prevention.length > 0 ? cats.prevention.map((code) => {
                        const text = getPText(code);
                        return (
                          <p key={code} className="text-[10px] leading-snug text-slate-700">
                            <span className="font-bold">{code}</span>
                            {text && <span>: {text}.</span>}
                          </p>
                        );
                      }) : <p className="text-[10px] italic text-slate-300">—</p>}
                    </div>
                  </div>

                  {/* Response / First Aid (red) */}
                  <div className="border-r border-slate-200">
                    <div className="flex items-center gap-1.5 bg-red-700 px-3 py-2 text-white">
                      <Plus className="h-3 w-3 flex-shrink-0"/>
                      <span className="text-[9px] font-black uppercase tracking-wider">Response / First Aid</span>
                    </div>
                    <div className="min-h-[80px] p-3 space-y-1.5">
                      {cats.response.length > 0 ? cats.response.map((code) => {
                        const text = getPText(code);
                        return (
                          <p key={code} className="text-[10px] leading-snug text-slate-700">
                            <span className="font-bold">{code}</span>
                            {text && <span>: {text}.</span>}
                          </p>
                        );
                      }) : <p className="text-[10px] italic text-slate-300">—</p>}
                    </div>
                  </div>

                  {/* Storage + Disposal (green) */}
                  <div>
                    <div className="flex items-center gap-1.5 bg-green-800 px-3 py-2 text-white">
                      <Package className="h-3 w-3 flex-shrink-0"/>
                      <span className="text-[9px] font-black uppercase tracking-wider">Storage</span>
                    </div>
                    <div className="min-h-[80px] p-3 space-y-1.5">
                      {chemical.storage_location && (
                        <p className="text-[10px] leading-snug text-slate-600">{chemical.storage_location}</p>
                      )}
                      {cats.storage.map((code) => {
                        const text = getPText(code);
                        return (
                          <p key={code} className="text-[10px] leading-snug text-slate-700">
                            <span className="font-bold">{code}</span>
                            {text && <span>: {text}.</span>}
                          </p>
                        );
                      })}
                      {cats.disposal.length > 0 && (
                        <>
                          <div className="pt-1 text-[8px] font-black uppercase tracking-wider text-amber-600">Disposal</div>
                          {cats.disposal.map((code) => {
                            const text = getPText(code);
                            return (
                              <p key={code} className="text-[10px] leading-snug text-slate-700">
                                <span className="font-bold">{code}</span>
                                {text && <span>: {text}.</span>}
                              </p>
                            );
                          })}
                        </>
                      )}
                      {cats.storage.length === 0 && cats.disposal.length === 0 && !chemical.storage_location && (
                        <p className="text-[10px] italic text-slate-300">—</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── 4. Emergency | Refer to SDS | Label Info ── */}
                <div className="grid grid-cols-3">

                  {/* Emergency (dark) */}
                  <div className="border-r border-slate-200 bg-slate-900 p-3 text-white">
                    <div className="mb-1.5 flex items-center gap-1 text-[8px] font-black uppercase tracking-wider">
                      <Phone className="h-3 w-3"/>
                      Emergency Information
                    </div>
                    <p className="text-[10px] leading-snug">
                      Call <span className="font-black text-red-400">911</span> in case of emergency
                    </p>
                    <p className="text-[10px] leading-snug">
                      Poison Control: <span className="font-bold text-red-400">1-800-222-1222</span>
                    </p>
                  </div>

                  {/* Refer to SDS */}
                  <div className="border-r border-slate-200 p-3">
                    <div className="mb-1.5 flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-slate-600">
                      <FileText className="h-3 w-3"/>
                      Refer to SDS
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      For complete information, refer to the Safety Data Sheet.
                    </p>
                    {chemical.sds_url && (
                      <p className="mt-1 break-all text-[9px] font-medium text-blue-600">{chemical.sds_url}</p>
                    )}
                  </div>

                  {/* Label Information */}
                  <div className="p-3">
                    <div className="mb-1.5 flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-slate-600">
                      <Tag className="h-3 w-3"/>
                      Label Information
                    </div>
                    {chemical.supplier && (
                      <p className="text-[10px] leading-snug">
                        <span className="text-slate-500">Prepared by:</span>{" "}
                        <span className="font-medium">{chemical.supplier}</span>
                      </p>
                    )}
                    {chemical.sds_expiry && (
                      <p className="text-[10px] leading-snug">
                        <span className="text-slate-500">Revision date:</span>{" "}
                        <span className="font-medium">{chemical.sds_expiry}</span>
                      </p>
                    )}
                    <p className="text-[10px] leading-snug">
                      <span className="text-slate-500">Version:</span>{" "}
                      <span className="font-medium">1.0</span>
                    </p>
                  </div>
                </div>

                {/* ── 5. Compliance footer bar ── */}
                <div className="bg-red-700 py-1.5 text-center text-[8px] font-bold uppercase tracking-wide text-white">
                  This label complies with OSHA 29 CFR 1910.1200 (HazCom 2012) and GHS Rev. 9 / WHMIS 2015 requirements.
                </div>
              </div>
            </div>

            {/* ── Actions footer ── */}
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
              {logNote ? (
                <span className={`text-xs font-medium ${logNote.ok ? "text-emerald-600" : "text-red-600"}`}>
                  {logNote.text}
                </span>
              ) : (
                <span className="text-xs text-slate-400">
                  {picCodes.length} pictogram{picCodes.length !== 1 ? "s" : ""} · {h.length} H-statement{h.length !== 1 ? "s" : ""} · {p.length} P-statement{p.length !== 1 ? "s" : ""}
                </span>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 transition-colors"
                >
                  <Printer className="h-3.5 w-3.5"/>
                  Print Label
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
