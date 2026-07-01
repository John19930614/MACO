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
    <div style={{ display: "flex", width: 80, flexDirection: "column", alignItems: "center", gap: 4 }} aria-label={`PPE Required: ${label}`}>
      <div style={{ display: "flex", height: 48, width: 48, alignItems: "center", justifyContent: "center", borderRadius: 9999, border: "2px solid #1d4ed8", background: "#eff6ff" }}>
        <Icon size={24} color="#1d4ed8" />
      </div>
      <span style={{ textAlign: "center", fontSize: 12, fontWeight: 700, lineHeight: 1.15, color: "#1e40af" }}>{label}</span>
    </div>
  );
}
