"use client";

import React from "react";

// Self-contained GHS pictogram (red diamond + black symbol) with a one-word
// plain-language label beneath. SVG uses hex colors so it rasterizes cleanly for
// PNG/PDF export. Symbols mirror the app's existing GhsLabelButton pictograms.

const GHS_LABELS: Record<string, string> = {
  GHS01: "Explosive",  GHS02: "Flammable",     GHS03: "Oxidizer",
  GHS04: "Gas",        GHS05: "Corrosive",     GHS06: "Toxic",
  GHS07: "Irritant",   GHS08: "Health Hazard", GHS09: "Environment",
};

const SYMBOLS: Record<string, React.ReactNode> = {
  GHS01: (
    <>
      <polygon points="40,12 43,23 54,18 47,28 60,31 49,36 55,47 41,41 40,53 39,41 25,47 31,36 20,31 33,28 26,18 37,23" fill="black" />
      <circle cx="40" cy="63" r="12" fill="black" />
      <path d="M 40 51 Q 50 44 47 35" stroke="black" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>
  ),
  GHS02: (
    <>
      <path d="M 40 68 C 25 59 17 46 22 33 C 24 25 31 24 30 30 C 30 21 35 13 40 11 C 40 18 37 22 40 25 C 43 17 50 12 53 18 C 57 25 53 32 55 38 C 60 47 54 59 40 68 Z" fill="black" />
      <ellipse cx="40" cy="50" rx="5.5" ry="9" fill="white" />
    </>
  ),
  GHS03: (
    <>
      <path d="M 40 44 C 32 39 27 31 30 24 C 32 19 36 19 35 24 C 35 16 38 11 40 10 C 40 16 38 18 40 20 C 42 15 47 10 50 16 C 53 22 50 30 52 35 C 55 40 49 44 40 44 Z" fill="black" />
      <circle cx="40" cy="61" r="11" fill="none" stroke="black" strokeWidth="5" />
    </>
  ),
  GHS04: (
    <>
      <rect x="28" y="43" width="24" height="22" rx="3" fill="black" />
      <ellipse cx="40" cy="43" rx="12" ry="5" fill="black" />
      <rect x="35" y="28" width="10" height="14" rx="2" fill="black" />
      <rect x="27" y="25" width="26" height="6" rx="3" fill="black" />
      <rect x="24" y="64" width="32" height="5" rx="2" fill="black" />
    </>
  ),
  GHS05: (
    <>
      <rect x="8" y="14" width="26" height="6" rx="2" fill="black" />
      <ellipse cx="15" cy="25" rx="3" ry="5" fill="black" />
      <ellipse cx="27" cy="25" rx="3" ry="5" fill="black" />
      <path d="M 6 33 Q 10 29 14 33 Q 18 37 22 33 Q 26 29 30 33 Q 34 37 36 35 L 36 42 L 6 42 Z" fill="black" />
      <rect x="48" y="44" width="22" height="20" rx="5" fill="black" />
      <ellipse cx="45" cy="52" rx="5" ry="7" fill="black" />
      <rect x="50" y="29" width="5" height="17" rx="2.5" fill="black" />
      <rect x="57" y="27" width="5" height="19" rx="2.5" fill="black" />
      <rect x="64" y="29" width="5" height="17" rx="2.5" fill="black" />
      <ellipse cx="58" cy="19" rx="3.5" ry="5.5" fill="black" />
    </>
  ),
  GHS06: (
    <>
      <ellipse cx="40" cy="30" rx="17" ry="16" fill="black" />
      <ellipse cx="33" cy="28" rx="5.5" ry="6.5" fill="white" />
      <ellipse cx="47" cy="28" rx="5.5" ry="6.5" fill="white" />
      <rect x="32" y="42" width="16" height="8" rx="2" fill="black" />
      <rect x="35" y="41" width="3" height="7" fill="white" />
      <rect x="42" y="41" width="3" height="7" fill="white" />
      <line x1="18" y1="56" x2="62" y2="70" stroke="black" strokeWidth="7" strokeLinecap="round" />
      <line x1="62" y1="56" x2="18" y2="70" stroke="black" strokeWidth="7" strokeLinecap="round" />
      <circle cx="18" cy="56" r="6" fill="black" />
      <circle cx="62" cy="56" r="6" fill="black" />
      <circle cx="18" cy="70" r="6" fill="black" />
      <circle cx="62" cy="70" r="6" fill="black" />
    </>
  ),
  GHS07: (
    <>
      <rect x="33" y="13" width="14" height="38" rx="6" fill="black" />
      <circle cx="40" cy="63" r="8" fill="black" />
    </>
  ),
  GHS08: (
    <>
      <circle cx="40" cy="16" r="8" fill="black" />
      <path d="M 33 24 L 30 52 L 36 52 L 36 40 L 44 40 L 44 52 L 50 52 L 47 24 Z" fill="black" />
      <path d="M 33 27 L 20 40" stroke="black" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M 47 27 L 60 40" stroke="black" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M 34 52 L 30 68" stroke="black" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M 46 52 L 50 68" stroke="black" strokeWidth="6" strokeLinecap="round" fill="none" />
      <line x1="47" y1="30" x2="56" y2="23" stroke="black" strokeWidth="3" strokeLinecap="round" />
      <line x1="49" y1="35" x2="61" y2="33" stroke="black" strokeWidth="3" strokeLinecap="round" />
      <line x1="48" y1="41" x2="58" y2="44" stroke="black" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  GHS09: (
    <>
      <rect x="18" y="36" width="6" height="28" rx="2" fill="black" />
      <path d="M 21 36 L 10 22 M 21 42 L 8 34 M 21 36 L 34 22 M 21 42 L 36 30" stroke="black" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M 12 66 L 30 66" stroke="black" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M 44 54 C 46 47 54 44 61 46 C 68 48 70 54 70 57 C 70 60 68 65 61 67 C 54 69 46 67 44 60 Z" fill="black" />
      <path d="M 44 57 L 36 52 L 36 62 Z" fill="black" />
      <circle cx="63" cy="56" r="3.5" fill="white" />
    </>
  ),
};

interface Props {
  code: string;
  size?: number;
  showLabel?: boolean;
}

export function GhsPictogram({ code, size = 56, showLabel = true }: Props) {
  const label = GHS_LABELS[code] ?? code;
  const clipId = `ghs-${code}`;
  const symbol = SYMBOLS[code];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }} aria-label={`GHS Hazard: ${label}`}>
      {symbol ? (
        <svg width={size} height={size} viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={label}>
          <defs>
            <clipPath id={clipId}>
              <polygon points="40,2 78,40 40,78 2,40" />
            </clipPath>
          </defs>
          <polygon points="40,2 78,40 40,78 2,40" fill="white" stroke="#cc0000" strokeWidth="5" />
          <g clipPath={`url(#${clipId})`}>{symbol}</g>
        </svg>
      ) : (
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, fontSize: 12, fontWeight: 700, width: size, height: size, border: "2px solid #cc0000", color: "#cc0000" }}
        >
          {code}
        </div>
      )}
      {showLabel && <span style={{ fontSize: 12, fontWeight: 600, color: "#b91c1c" }}>{label}</span>}
    </div>
  );
}
