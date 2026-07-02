"use client";

// Human-friendly replacement for a raw AI confidence score. Fully inline styles
// (layout + color) so the label rasterizes correctly for PNG/PDF export in a
// Tailwind-free clone (Tailwind v4 otherwise emits oklch() html2canvas rejects).

interface Props {
  confidence: number | null;
}

export function DataVerifiedBadge({ confidence }: Props) {
  let dot = "#cbd5e1";
  let text = "Not Assessed";
  let textColor = "#475569";

  if (confidence !== null) {
    if (confidence >= 80) { dot = "#22c55e"; text = "High Confidence"; textColor = "#15803d"; }
    else if (confidence >= 50) { dot = "#facc15"; text = "Moderate Confidence"; textColor = "#a16207"; }
    else { dot = "#ef4444"; text = "Needs Review"; textColor = "#b91c1c"; }
  }

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", borderRadius: 6, padding: 8 }}
      aria-label={`Data Verified: ${text}`}
    >
      <span style={{ display: "inline-block", height: 12, width: 12, flexShrink: 0, borderRadius: 9999, background: dot }} />
      <div>
        <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Data Verified</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: textColor, margin: 0 }}>{text}</p>
      </div>
    </div>
  );
}
