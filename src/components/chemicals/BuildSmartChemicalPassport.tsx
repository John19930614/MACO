"use client";

import React, { useEffect, useState, type CSSProperties, type ComponentType } from "react";
import {
  Cpu, FlaskConical, Phone, ShieldCheck, Warehouse, Home, Pipette, Trash2,
  CheckCircle2, AlertCircle, UploadCloud, BrainCircuit, Users,
} from "lucide-react";
import type { ChemicalPassportData } from "@/types/chemical-passport";
import { GhsPictogram } from "@/components/chemicals/GhsPictogram";
import { PpeIcon } from "@/components/chemicals/PpeIcon";

// FULLY inline styles (layout + color) so PassportActions can rasterize the
// label in a Tailwind-free iframe (Tailwind v4's oklch() colors break html2canvas).

const NAVY = "#1e3a8a";
const RED = "#dc2626";

interface Props {
  data: ChemicalPassportData;
}

const GHS_SHORT: Record<string, string> = {
  GHS01: "Explosive", GHS02: "Flammable", GHS03: "Oxidizer", GHS04: "Gas", GHS05: "Corrosive",
  GHS06: "Toxic", GHS07: "Irritant", GHS08: "Health Hazard", GHS09: "Environment",
};

const blueCaps: CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: NAVY, textTransform: "uppercase", margin: 0 };
const sectionHead: CSSProperties = { display: "flex", alignItems: "center", gap: 8, background: NAVY, color: "#fff", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" };

function ConfidenceRing({ pct }: { pct: number }) {
  const r = 26, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <svg width={64} height={64} viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={NAVY} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 32 32)" />
      <text x="32" y="37" textAnchor="middle" fontSize="16" fontWeight="800" fill="#0f172a">{pct}%</text>
    </svg>
  );
}

function TaskPill({ icon: Icon, label, color, bg }: { icon: ComponentType<{ size?: number; color?: string }>; label: string; color: string; bg: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${color}`, background: bg, borderRadius: 8, padding: "6px 10px" }}>
      <Icon size={16} color={color} />
      <span style={{ fontSize: 12, fontWeight: 700, color, letterSpacing: "0.03em" }}>{label}</span>
    </div>
  );
}

function ValueProp({ icon: Icon, title, sub }: { icon: ComponentType<{ size?: number; color?: string }>; title: string; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Icon size={26} color="#93c5fd" />
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "0.03em" }}>{title}</div>
        <div style={{ fontSize: 11, color: "#c7d2fe" }}>{sub}</div>
      </div>
    </div>
  );
}

export function BuildSmartChemicalPassport({ data }: Props) {
  const [qr, setQr] = useState<string>("");
  const recordUrl = typeof window !== "undefined" ? `${window.location.origin}/chemicals/${data.id}` : `/chemicals/${data.id}`;

  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then((QR) => QR.toDataURL(recordUrl, { margin: 1, width: 220, errorCorrectionLevel: "M" }))
      .then((url) => { if (!cancelled) setQr(url); })
      .catch(() => { if (!cancelled) setQr(""); });
    return () => { cancelled = true; };
  }, [recordUrl]);

  const firstPic = data.ghsPictograms[0];
  const primaryStmt = data.hazardStatements[0] ?? "";
  const primaryText = primaryStmt.includes(" – ") ? primaryStmt.split(" – ").slice(1).join(" – ") : primaryStmt || "No significant hazards recorded.";
  const signalColor = data.signalWord === "Danger" ? RED : "#b45309";
  const mwText = data.molecularWeight === "—" ? "—" : `${data.molecularWeight} g/mol`;

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

      <div id="chemical-passport-label" style={{ width: 1160, maxWidth: "100%", margin: "0 auto", background: "#fff", border: `6px solid ${NAVY}`, borderRadius: 16, overflow: "hidden", fontFamily: "Inter, system-ui, sans-serif", color: "#0f172a" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: `linear-gradient(90deg, ${NAVY}, #1e40af)`, color: "#fff", padding: "14px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(255,255,255,0.14)" }}>
              <FlaskConical size={24} color="#fff" />
            </div>
            <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "0.01em" }}>SMART CHEMICAL PASSPORT</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 12, padding: "8px 16px" }}>
            <Cpu size={22} color={NAVY} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#1e40af", letterSpacing: "0.08em" }}>SMART LABEL ID</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", fontFamily: "monospace" }}>{data.smartLabelId}</div>
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ display: "flex" }}>
          {/* MAIN */}
          <div style={{ flex: "1 1 0", minWidth: 0, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Identity */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, borderBottom: "1px solid #e5e7eb", paddingBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.05, margin: 0, textTransform: "uppercase", color: "#0f172a" }}>{data.chemicalName}</h2>
                <p style={{ marginTop: 8, fontSize: 13, color: "#334155" }}>
                  CHEMICAL FORMULA: <b>{data.formula}</b> &nbsp;•&nbsp; MOLECULAR WEIGHT: <b>{mwText}</b>
                </p>
              </div>
              <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
                <div><p style={blueCaps}>CAS Number</p><p style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{data.casNumber}</p></div>
                <div style={{ borderLeft: "1px solid #e5e7eb", paddingLeft: 20 }}><p style={blueCaps}>Product ID</p><p style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{data.productId}</p></div>
              </div>
            </div>

            {/* Hazard hero */}
            <div style={{ display: "flex", gap: 16, borderBottom: "1px solid #e5e7eb", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "1 1 0", minWidth: 0 }}>
                {firstPic && <GhsPictogram code={firstPic} size={92} showLabel={false} />}
                <div>
                  {data.signalWord && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: signalColor, color: "#fff", padding: "5px 16px 5px 12px", borderRadius: 4, fontWeight: 800, fontSize: 20, clipPath: "polygon(0 0, 92% 0, 100% 50%, 92% 100%, 0 100%)" }}>
                      <AlertCircle size={20} color="#fff" /> {data.signalWord.toUpperCase()}
                    </div>
                  )}
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginTop: 8, lineHeight: 1.15 }}>{primaryText}</div>
                  {firstPic && <div style={{ fontSize: 13, fontWeight: 700, color: "#b91c1c", marginTop: 4 }}>{firstPic}: {GHS_SHORT[firstPic] ?? "Hazard"}</div>}
                </div>
              </div>
              <div style={{ width: 1, background: "#e5e7eb" }} />
              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                <div style={{ ...blueCaps, borderBottom: "2px solid #b91c1c", paddingBottom: 4, marginBottom: 8, display: "inline-block" }}>Hazard Statement</div>
                {data.hazardStatements.length > 0 ? data.hazardStatements.map((s) => {
                  const [code, ...rest] = s.split(" – ");
                  return <p key={s} style={{ fontSize: 14, margin: "0 0 4px", color: "#0f172a" }}><b>{code}:</b> {rest.join(" – ")}</p>;
                }) : <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>No hazard statements recorded.</p>}
              </div>
            </div>

            {/* PPE / Storage / Task */}
            <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr 1fr", gap: 12 }}>
              <div>
                <div style={sectionHead}><ShieldCheck size={14} color="#fff" /> Recommended PPE</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {data.ppeRequirements.length > 0
                    ? data.ppeRequirements.map((p) => <PpeIcon key={p.code} code={p.code} label={p.label} />)
                    : <span style={{ fontSize: 12, color: "#64748b" }}>Refer to SDS Section 8.</span>}
                </div>
              </div>
              <div>
                <div style={sectionHead}><Warehouse size={14} color="#fff" /> Storage Guidance</div>
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <div style={{ display: "flex", height: 32, width: 32, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#16a34a" }}>
                    <Warehouse size={18} color="#fff" />
                  </div>
                  <p style={{ fontSize: 12.5, color: "#334155", margin: 0 }}>{data.storageGuidance}</p>
                </div>
              </div>
              <div>
                <div style={sectionHead}><Home size={14} color="#fff" /> Task Mode</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                  <TaskPill icon={Home} label="RECEIVE / STORE" color="#1e40af" bg="#eff6ff" />
                  <TaskPill icon={Pipette} label="USE / DISPENSE" color="#15803d" bg="#f0fdf4" />
                  <TaskPill icon={Trash2} label="WASTE / DISPOSE" color="#c2410c" bg="#fff7ed" />
                </div>
              </div>
            </div>

            {/* Compatibility */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ ...sectionHead, borderRadius: 0 }}>Compatibility Check</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 14, padding: 12 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <CheckCircle2 size={20} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#15803d" }}>COMPATIBLE WITH:</div>
                    {data.compatibleWith.map((c) => <div key={c} style={{ fontSize: 12.5, color: "#334155" }}>{c}</div>)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <AlertCircle size={20} color={RED} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#b91c1c" }}>INCOMPATIBLE WITH:</div>
                    {data.incompatibleWith.map((c) => <div key={c} style={{ fontSize: 12.5, color: "#334155" }}>{c}</div>)}
                  </div>
                </div>
              </div>
            </div>

            {/* Emergency */}
            <div style={{ background: RED, color: "#fff", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 15 }}><Phone size={20} color="#fff" /> EMERGENCY CONTACT</div>
              <div style={{ fontSize: 13 }}>CALL <b style={{ fontSize: 18 }}>911</b><div style={{ fontSize: 10, color: "#fecaca" }}>IN CASE OF EMERGENCY</div></div>
              <div style={{ fontSize: 12 }}><div style={{ color: "#fecaca" }}>POISON CONTROL CENTER</div><b style={{ fontSize: 15 }}>1-800-222-1222</b></div>
              <div style={{ fontSize: 12 }}><div style={{ color: "#fecaca" }}>CHEMTREC (US/Canada)</div><b style={{ fontSize: 15 }}>1-800-424-9300</b></div>
            </div>
          </div>

          {/* SIDEBAR */}
          <div style={{ width: 312, flexShrink: 0, background: "#f8fafc", borderLeft: "1px solid #e5e7eb", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <p style={{ ...blueCaps, marginBottom: 6 }}>Scan for Full Data</p>
                <div style={{ display: "inline-block", border: "1px solid #e5e7eb", borderRadius: 10, padding: 6, background: "#fff" }}>
                  {qr
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={qr} alt="QR code to open the digital chemical record" width={120} height={120} />
                    : <div style={{ width: 120, height: 120 }} />}
                </div>
                <p style={{ fontSize: 11, color: "#64748b", margin: "6px 0 0" }}>Scan QR or visit<br />smartdata.io/{data.productId}</p>
              </div>
              <div style={{ width: 104, textAlign: "center" }}>
                <p style={{ ...blueCaps, marginBottom: 6 }}>Tap NFC</p>
                <div style={{ display: "inline-flex", height: 64, width: 64, alignItems: "center", justifyContent: "center", borderRadius: 9999, background: NAVY }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <svg viewBox="0 0 24 24" fill="none" width={26} height={26} stroke="#fff" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856a9.75 9.75 0 0113.788 0M1.924 8.674a14.25 14.25 0 0120.152 0M12 20.25h.008v.008H12v-.008z" />
                    </svg>
                    <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", marginTop: 1 }}>NFC</span>
                  </div>
                </div>
                <p style={{ fontSize: 11, color: "#64748b", margin: "6px 0 0" }}>Tap to access<br />live data</p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>
              <Phone size={18} color={RED} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#b91c1c" }}>EMERGENCY SCAN</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Scan in an emergency for critical information</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>
              {data.aiConfidenceScore !== null ? <ConfidenceRing pct={data.aiConfidenceScore} /> : <BrainCircuit size={40} color="#94a3b8" />}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, letterSpacing: "0.04em" }}>AI CONFIDENCE SCORE</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#15803d" }}>
                  {data.aiConfidenceScore === null ? "Not Assessed" : data.aiConfidenceScore >= 80 ? "High Confidence" : data.aiConfidenceScore >= 50 ? "Moderate Confidence" : "Needs Review"}
                </div>
                <div style={{ fontSize: 10.5, color: "#64748b" }}>Data verified and continuously updated by AI monitors.</div>
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck size={16} color={NAVY} />
                <span style={{ fontSize: 11, fontWeight: 700, color: NAVY, letterSpacing: "0.04em" }}>REVIEW STATUS</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: data.reviewStatus === "verified" ? "#16a34a" : "#64748b", borderRadius: 6, padding: "1px 8px", textTransform: "uppercase" }}>
                  {data.reviewStatus === "verified" ? "Active" : "Pending"}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: "#334155", marginTop: 6 }}>
                Last Reviewed: {data.lastVerifiedAt ? new Date(data.lastVerifiedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "Not yet verified"}
              </div>
              <div style={{ fontSize: 11.5, color: "#334155" }}>Revision: 1.0</div>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ background: NAVY, color: "#fff", padding: "14px 22px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <ValueProp icon={ShieldCheck} title="SECURE & TRACEABLE" sub="Authenticated. Tamper-evident." />
          <ValueProp icon={UploadCloud} title="ALWAYS CURRENT" sub="Live data. Always up to date." />
          <ValueProp icon={BrainCircuit} title="TASK-INTELLIGENT" sub="Right info. Right time." />
          <ValueProp icon={Users} title="SAFER OPERATIONS" sub="Protect people. Protect process." />
        </div>
      </div>
    </>
  );
}
