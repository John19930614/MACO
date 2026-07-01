"use client";

import React, { useEffect, useState, type CSSProperties } from "react";
import type { ChemicalPassportData } from "@/types/chemical-passport";
import { GhsPictogram } from "@/components/chemicals/GhsPictogram";
import { PpeIcon } from "@/components/chemicals/PpeIcon";
import { DataVerifiedBadge } from "@/components/chemicals/DataVerifiedBadge";

// FULLY inline styles (layout + color). This lets PassportActions rasterize the
// label for PNG/PDF in a Tailwind-free clone — Tailwind v4 emits oklch() colors
// that html2canvas can't parse, so the export strips Tailwind stylesheets and
// relies entirely on these inline styles.

interface Props {
  data: ChemicalPassportData;
}

const capLabel: CSSProperties = { fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 };
const section: CSSProperties = {};

export function BuildSmartChemicalPassport({ data }: Props) {
  const [qr, setQr] = useState<string>("");

  const recordUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/chemicals/${data.id}`
      : `/chemicals/${data.id}`;

  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then((QR) => QR.toDataURL(recordUrl, { margin: 1, width: 200, errorCorrectionLevel: "M" }))
      .then((url) => { if (!cancelled) setQr(url); })
      .catch(() => { if (!cancelled) setQr(""); });
    return () => { cancelled = true; };
  }, [recordUrl]);

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #chemical-passport-label, #chemical-passport-label * { visibility: visible; }
          #chemical-passport-label { position: absolute; inset: 0; margin: 0 auto; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div
        id="chemical-passport-label"
        style={{ maxWidth: 680, margin: "0 auto", background: "#ffffff", border: "2px solid #1f2937", borderRadius: 8, overflow: "hidden" }}
      >
        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "16px 24px", background: "#111827", color: "#ffffff" }}>
          <div>
            <p style={{ ...capLabel, color: "#9ca3af", letterSpacing: "0.15em" }}>Smart Chemical Passport</p>
            <h2 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1, margin: "2px 0 0", color: "#ffffff" }}>{data.chemicalName}</h2>
            <p style={{ marginTop: 2, fontSize: 14, color: "#d1d5db" }}>
              Product ID: <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#ffffff" }}>{data.productId}</span>
            </p>
          </div>
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>CAS Number</p>
            <p style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, margin: 0, color: "#ffffff" }}>{data.casNumber}</p>
            <p style={{ fontSize: 12, color: "#d1d5db", margin: 0 }}>{data.chemicalName}</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 24 }}>
          {/* IDENTITY */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: 12 }}>
              <p style={{ ...capLabel, color: "#64748b" }}>Formula</p>
              <p style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>{data.formula}</p>
            </div>
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: 12 }}>
              <p style={{ ...capLabel, color: "#64748b" }}>Molecular Weight</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>
                {data.molecularWeight}{data.molecularWeight !== "—" ? " g/mol" : ""}
              </p>
            </div>
          </div>

          {/* GHS PICTOGRAMS */}
          {data.ghsPictograms.length > 0 && (
            <div style={section}>
              <p style={{ ...capLabel, color: "#64748b", marginBottom: 8 }}>GHS Hazard Pictograms</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {data.ghsPictograms.map((code) => <GhsPictogram key={code} code={code} />)}
              </div>
            </div>
          )}

          {/* HAZARD STATEMENTS */}
          {data.hazardStatements.length > 0 && (
            <div style={section}>
              <p style={{ ...capLabel, color: "#64748b", marginBottom: 4 }}>Hazard Statements</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {data.hazardStatements.map((stmt) => (
                  <p key={stmt} style={{ fontSize: 14, fontWeight: 500, color: "#b91c1c", margin: 0 }}>{stmt}</p>
                ))}
              </div>
            </div>
          )}

          {/* PPE */}
          {data.ppeRequirements.length > 0 && (
            <div style={section}>
              <p style={{ ...capLabel, color: "#64748b", marginBottom: 8 }}>Required PPE</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                {data.ppeRequirements.map((ppe) => <PpeIcon key={ppe.code} code={ppe.code} label={ppe.label} />)}
              </div>
            </div>
          )}

          {/* STORAGE */}
          <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 8, padding: 16 }}>
            <p style={{ ...capLabel, color: "#854d0e", marginBottom: 4 }}>Storage Guidance</p>
            <p style={{ fontSize: 14, color: "#713f12", margin: 0 }}>{data.storageGuidance}</p>
          </div>

          {/* COMPATIBILITY */}
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: 16 }}>
            <p style={{ ...capLabel, color: "#9a3412", marginBottom: 4 }}>Do Not Mix With / Store Away From</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {data.incompatibleWith.map((item) => (
                <li key={item} style={{ fontSize: 14, color: "#7c2d12" }}>{item}</li>
              ))}
            </ul>
          </div>

          {/* USED FOR */}
          {data.usedFor.length > 0 && (
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 16 }}>
              <p style={{ ...capLabel, color: "#1e40af", marginBottom: 4 }}>What This Chemical Is Used For</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {data.usedFor.map((tag) => (
                  <span key={tag} style={{ borderRadius: 9999, padding: "2px 8px", fontSize: 12, fontWeight: 600, background: "#dbeafe", color: "#1e40af" }}>{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* EMERGENCY */}
          <div style={{ background: "#dc2626", color: "#ffffff", borderRadius: 8, padding: 16 }}>
            <p style={{ ...capLabel, color: "#fecaca", letterSpacing: "0.15em" }}>Emergency Contact</p>
            <p style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.02em", margin: 0, color: "#ffffff" }}>{data.emergencyPhone}</p>
            {data.emergencyName && <p style={{ marginTop: 2, fontSize: 14, color: "#fecaca" }}>{data.emergencyName}</p>}
            {data.emergencyInstructions && <p style={{ marginTop: 4, fontSize: 14, color: "#fecaca" }}>{data.emergencyInstructions}</p>}
          </div>

          {/* QR + NFC + VERIFIED */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ border: "1px solid #e5e7eb", background: "#ffffff", borderRadius: 8, padding: 8 }}>
                {qr
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={qr} alt="QR code to open the digital chemical record" width={96} height={96} />
                  : <div style={{ width: 96, height: 96 }} />}
              </div>
              <p style={{ marginTop: 4, textAlign: "center", fontSize: 12, color: "#64748b" }}>Scan for digital record</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ display: "flex", height: 64, width: 64, alignItems: "center", justifyContent: "center", borderRadius: 9999, border: "4px solid #3b82f6", background: "#eff6ff" }}>
                <svg viewBox="0 0 24 24" fill="none" width={32} height={32} style={{ color: "#2563eb" }} stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856a9.75 9.75 0 0113.788 0M1.924 8.674a14.25 14.25 0 0120.152 0M12 20.25h.008v.008H12v-.008z" />
                </svg>
              </div>
              <p style={{ marginTop: 4, textAlign: "center", fontSize: 12, color: "#64748b" }}>Tap to Access<br />Digital Record</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <DataVerifiedBadge confidence={data.aiConfidenceScore} />
              <div style={{ background: "#f8fafc", borderRadius: 6, padding: 8 }}>
                <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Label Last Verified</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", margin: 0 }}>
                  {data.lastVerifiedAt
                    ? new Date(data.lastVerifiedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                    : "Not yet verified"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
