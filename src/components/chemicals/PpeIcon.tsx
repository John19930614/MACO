"use client";

import { Glasses, Hand, Shirt, Wind, Footprints, ShieldCheck } from "lucide-react";
import type { ComponentType } from "react";

// PPE code → recognizable icon. A visible text label ALWAYS renders beneath
// (UX rule: no PPE icon without a word). Fully inline styles so it rasterizes
// correctly in the Tailwind-free export clone.
const ICONS: Record<string, ComponentType<{ size?: number; color?: string }>> = {
  SAFETY_GLASSES: Glasses, CHEMICAL_GOGGLES: Glasses, FACE_SHIELD: Glasses,
  NITRILE_GLOVES: Hand, NEOPRENE_GLOVES: Hand, BUTYL_GLOVES: Hand,
  CHEMICAL_APRON: Shirt, LAB_COAT: Shirt, FR_CLOTHING: Shirt,
  RESPIRATOR: Wind, VENTILATION: Wind, STEEL_TOE: Footprints,
};

interface Props {
  code: string;
  label: string;
}

export function PpeIcon({ code, label }: Props) {
  const Icon = ICONS[code] ?? ShieldCheck;
  return (
    <div style={{ display: "flex", width: 72, flexDirection: "column", alignItems: "center", gap: 5 }} aria-label={`PPE Required: ${label}`}>
      <div style={{ display: "flex", height: 44, width: 44, alignItems: "center", justifyContent: "center", borderRadius: 9999, background: "#1e3a8a" }}>
        <Icon size={22} color="#ffffff" />
      </div>
      <span style={{ textAlign: "center", fontSize: 11, fontWeight: 600, lineHeight: 1.15, color: "#334155" }}>{label}</span>
    </div>
  );
}
