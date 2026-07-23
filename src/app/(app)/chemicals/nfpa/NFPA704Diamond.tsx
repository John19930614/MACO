"use client";

// Reusable, color-coded NFPA 704 "fire diamond", usable at container, storage-
// area and building level. Built as an SVG (the four cells are a square rotated
// 45°, numbers kept upright) so it scales cleanly from a 96px thumbnail to a
// 360px printable placard.
//
// Safety behaviour: a category with a null rating renders "—" plus an explicit
// "Rating not yet entered" caption, NEVER a silent 0. Special-hazard symbols sit
// in the white quadrant; water-reactive "W" is shown struck-through per NFPA 704.

import type { NfpaRating, NfpaSpecialHazard } from "@/lib/nfpa704/types";

function renderSpecial(h: NfpaSpecialHazard): string {
  // Water-reactive is posted as a struck-through W.
  return h === "W" ? "W̶" : h;
}

function CellValue({ value, color }: { value: number | null; color: string }) {
  if (value === null) {
    return (
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="13"
        fontWeight="700"
        fill={color}
      >
        —
      </text>
    );
  }
  return (
    <text
      textAnchor="middle"
      dominantBaseline="central"
      fontSize="26"
      fontWeight="800"
      fill={color}
    >
      {value}
    </text>
  );
}

export function NFPA704Diamond({
  rating,
  size = 200,
  label,
}: {
  rating: NfpaRating;
  size?: number;
  label?: string;
}) {
  const specialText = rating.specialHazards.map(renderSpecial).join(" ");
  const aria =
    `NFPA 704 rating — health ${rating.health ?? "not entered"}, ` +
    `flammability ${rating.flammability ?? "not entered"}, ` +
    `instability ${rating.instability ?? "not entered"}` +
    (rating.specialHazards.length ? `, special ${rating.specialHazards.join(", ")}` : "");

  return (
    <div className="inline-flex flex-col items-center gap-2">
      {label && (
        <div className="text-sm font-semibold text-slate-700 text-center">{label}</div>
      )}

      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="img"
        aria-label={aria}
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform="rotate(45 50 50)">
          {/* Flammability — top (red) */}
          <rect x="27" y="27" width="23" height="23" fill="#ef4444" stroke="#000" strokeWidth="0.4" />
          {/* Instability — right (yellow) */}
          <rect x="50" y="27" width="23" height="23" fill="#facc15" stroke="#000" strokeWidth="0.4" />
          {/* Health — left (blue) */}
          <rect x="27" y="50" width="23" height="23" fill="#2563eb" stroke="#000" strokeWidth="0.4" />
          {/* Special — bottom (white) */}
          <rect x="50" y="50" width="23" height="23" fill="#ffffff" stroke="#000" strokeWidth="0.4" />
        </g>

        {/* Numbers/symbols upright (not rotated). */}
        <g transform="translate(50 30)">
          <CellValue value={rating.flammability} color="#ffffff" />
        </g>
        <g transform="translate(70 50)">
          <CellValue value={rating.instability} color="#000000" />
        </g>
        <g transform="translate(30 50)">
          <CellValue value={rating.health} color="#ffffff" />
        </g>
        <text
          x="50"
          y="72"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={specialText.length > 4 ? "8" : "11"}
          fontWeight="800"
          fill="#000000"
        >
          {specialText}
        </text>
      </svg>

      {rating.specialHazards.length > 0 && (
        <div className="text-xs font-semibold text-slate-700" aria-label="Special hazard symbols">
          {rating.specialHazards.map(renderSpecial).join(" · ")}
        </div>
      )}

      {!rating.isComplete && (
        <div
          className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 max-w-[16rem] text-center"
          role="status"
        >
          One or more categories: <strong>Rating not yet entered.</strong> This is
          not the same as &ldquo;no hazard.&rdquo;
        </div>
      )}
    </div>
  );
}
