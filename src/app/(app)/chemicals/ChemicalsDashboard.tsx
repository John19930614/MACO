"use client";

import { useState, useMemo } from "react";
import type { Chemical, TrainingCourse } from "@/lib/types";
import { Card, CardHeader, Pill, Stat } from "@/components/ui/primitives";
import { ChemicalsTable } from "./ChemicalsTable";
import {
  AlertTriangle,
  BrainCircuit,
  ExternalLink,
  FileText,
  FlaskConical,
  GraduationCap,
  LayoutGrid,
  Shield,
  ShieldCheck,
  Upload,
  Zap,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const HIGH_HAZARD_H = ["H350", "H351", "H300", "H310", "H311", "H330", "H331"];

const H_TRAINING_RULES: { test: (h: string) => boolean; types: string[]; hazardLabel: string }[] = [
  { test: (h) => /^H2[0-6]/.test(h),                        types: ["fire_safety"],       hazardLabel: "Flammable / Explosive" },
  { test: (h) => /^H27/.test(h),                            types: ["fire_safety"],       hazardLabel: "Oxidizing" },
  { test: (h) => /^H(30[0-2]|31[0-2]|33[0-2])/.test(h),   types: ["chemical", "ppe"],   hazardLabel: "Acute Toxicity" },
  { test: (h) => /^H(314|315|317|318|319)/.test(h),         types: ["chemical", "ppe"],   hazardLabel: "Corrosive / Irritant" },
  { test: (h) => /^H(334|335)/.test(h),                     types: ["chemical"],          hazardLabel: "Respiratory Sensitizer" },
  { test: (h) => /^H(340|341)/.test(h),                     types: ["chemical"],          hazardLabel: "Mutagen" },
  { test: (h) => /^H(350|351)/.test(h),                     types: ["chemical"],          hazardLabel: "Carcinogen" },
  { test: (h) => /^H(360|361)/.test(h),                     types: ["chemical"],          hazardLabel: "Reproductive Hazard" },
  { test: (h) => /^H(370|371|372|373)/.test(h),             types: ["chemical"],          hazardLabel: "Target Organ Toxin" },
  { test: (h) => /^H4/.test(h),                             types: ["chemical"],          hazardLabel: "Aquatic / Environmental" },
];

const COURSE_TYPE_COLOR: Record<string, string> = {
  fire_safety: "bg-orange-100 text-orange-700",
  chemical:    "bg-red-100 text-red-700",
  ppe:         "bg-blue-100 text-blue-700",
  emergency:   "bg-amber-100 text-amber-700",
  equipment:   "bg-slate-100 text-slate-600",
  compliance:  "bg-purple-100 text-purple-700",
  induction:   "bg-teal-100 text-teal-700",
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface TriggeredCourse {
  course: TrainingCourse;
  triggeringHazards: string[];
  triggeringChemicals: string[];
}

type HazardClass =
  | "flammable"
  | "oxidizer"
  | "toxic"
  | "corrosive"
  | "cryogenic"
  | "water_reactive"
  | "harmful";

type Compatibility = "compatible" | "conditional" | "incompatible" | "self";

interface PPEProfile {
  gloves: string;
  eyes: string;
  respiratory: string;
  body: string;
  controls: string[];
  hazardSummary: string;
  hazardColor: string;
}

// ─── Training chain ───────────────────────────────────────────────────────────

function buildTriggeredCourses(chemicals: Chemical[], courses: TrainingCourse[]): TriggeredCourse[] {
  const courseTypeMap = new Map<string, { hazards: Set<string>; chemicals: Set<string> }>();
  for (const chem of chemicals) {
    for (const h of chem.hazard_statements) {
      for (const rule of H_TRAINING_RULES) {
        if (rule.test(h)) {
          for (const ct of rule.types) {
            if (!courseTypeMap.has(ct)) courseTypeMap.set(ct, { hazards: new Set(), chemicals: new Set() });
            courseTypeMap.get(ct)!.hazards.add(rule.hazardLabel);
            courseTypeMap.get(ct)!.chemicals.add(chem.name);
          }
        }
      }
    }
  }
  const result: TriggeredCourse[] = [];
  for (const course of courses) {
    const match = courseTypeMap.get(course.course_type);
    if (match) {
      result.push({
        course,
        triggeringHazards:   Array.from(match.hazards),
        triggeringChemicals: Array.from(match.chemicals).slice(0, 4),
      });
    }
  }
  return result;
}

// ─── SDS status ───────────────────────────────────────────────────────────────

function sdsStatus(c: Chemical): "on_file" | "expiring" | "expired" | "missing" {
  if (!c.sds_url) return "missing";
  if (!c.sds_expiry) return "on_file";
  const exp = new Date(c.sds_expiry);
  const now = new Date();
  if (exp < now) return "expired";
  if (exp.getTime() - now.getTime() < 90 * 24 * 60 * 60 * 1000) return "expiring";
  return "on_file";
}

// ─── Compatibility Matrix helpers ─────────────────────────────────────────────

function getHazardClasses(c: Chemical): Set<HazardClass> {
  const hs = new Set<HazardClass>();
  const h = c.hazard_statements;
  if (h.some((x) => /^H2[2-6]/.test(x)))           hs.add("flammable");
  if (h.some((x) => /^H27[12]/.test(x)))            hs.add("oxidizer");
  if (h.some((x) => /^H(300|310|330|331)/.test(x))) hs.add("toxic");
  if (h.some((x) => /^H314/.test(x)))               hs.add("corrosive");
  if (h.some((x) => /^H28[01]/.test(x)))            hs.add("cryogenic");
  if (h.some((x) => /^H290/.test(x)))               hs.add("water_reactive");
  if (h.some((x) => /^H(302|312|315|317|332|335)/.test(x))) hs.add("harmful");
  return hs;
}

function getCompatibility(a: Chemical, b: Chemical): Compatibility {
  if (a.id === b.id) return "self";
  const ac = getHazardClasses(a);
  const bc = getHazardClasses(b);
  const both = (x: HazardClass, y: HazardClass) =>
    (ac.has(x) && bc.has(y)) || (ac.has(y) && bc.has(x));
  const either = (x: HazardClass) => ac.has(x) || bc.has(x);

  // Hard incompatibilities (NFPA 400 / GHS segregation)
  if (both("flammable", "oxidizer"))       return "incompatible";
  if (both("oxidizer", "toxic"))           return "incompatible";
  if (both("oxidizer", "water_reactive"))  return "incompatible";
  if (both("oxidizer", "corrosive"))       return "incompatible"; // exothermic + toxic gas
  if (both("water_reactive", "corrosive")) return "incompatible"; // acid + azide → HN₃
  if (both("water_reactive", "toxic"))     return "incompatible"; // dual IDLH hazard

  // Cryogenics → always conditional (O₂ depletion risk)
  if (either("cryogenic")) return "conditional";

  // Flammable pairings
  if (both("flammable", "corrosive")) return "conditional";
  if (both("flammable", "toxic"))     return "conditional";
  if (both("water_reactive", "flammable")) return "conditional";
  if (either("water_reactive")) return "conditional";

  // Multiple oxidizers → conditional (segregate peroxide sub-types)
  if (ac.has("oxidizer") && bc.has("oxidizer")) return "conditional";

  // Flammable + flammable → compatible (same flammables cabinet OK)
  if (ac.has("flammable") && bc.has("flammable")) return "compatible";

  // Corrosive with anything → conditional
  if (either("corrosive")) return "conditional";

  // Toxic + harmful → conditional
  if (both("toxic", "harmful")) return "conditional";

  // Two harmful → compatible
  if (ac.has("harmful") && bc.has("harmful")) return "compatible";

  return "conditional";
}

function compatReason(a: Chemical, b: Chemical): string {
  const ac = getHazardClasses(a);
  const bc = getHazardClasses(b);
  const both = (x: HazardClass, y: HazardClass) =>
    (ac.has(x) && bc.has(y)) || (ac.has(y) && bc.has(x));
  const either = (x: HazardClass) => ac.has(x) || bc.has(x);

  if (both("flammable", "oxidizer"))       return "Severe fire/explosion risk — flammable + oxidizer (NFPA 400, OSHA 1910.106)";
  if (both("oxidizer", "toxic"))           return "Oxidizer can release toxic gases; extreme release risk";
  if (both("oxidizer", "water_reactive"))  return "Strong oxidizer + water-reactive azide — potentially explosive";
  if (both("oxidizer", "corrosive"))       return "Exothermic reaction risk; may release toxic corrosive fumes";
  if (both("water_reactive", "corrosive")) return "Acid or base contact releases hydrazoic acid (HN₃) — IDLH 1 ppm";
  if (both("water_reactive", "toxic"))     return "Both IDLH-class hazards — store in separate locked cabinets";
  if (either("cryogenic"))                 return "Cryogenic agent — O₂ depletion risk in confined space; separate storage area";
  if (both("flammable", "corrosive"))      return "Separate cabinets required — corrosive fumes + flammable vapour risk";
  if (both("flammable", "toxic"))          return "Separate cabinets — inhalation hazard with flammable vapours";
  if (ac.has("flammable") && bc.has("flammable")) return "Compatible flammable solvents — same FM/UL-listed flammables cabinet";
  if (ac.has("harmful") && bc.has("harmful"))     return "Low-level similar hazard profile — standard lab storage acceptable";
  return "Store per GHS SDS Section 7 segregation requirements";
}

const COMPAT_STYLE: Record<
  Compatibility,
  { bg: string; text: string; border: string; icon: string; label: string }
> = {
  compatible:   { bg: "bg-emerald-50",   text: "text-emerald-700", border: "border-emerald-200", icon: "✓", label: "Compatible" },
  conditional:  { bg: "bg-amber-50",     text: "text-amber-700",   border: "border-amber-200",   icon: "⚠", label: "Conditional" },
  incompatible: { bg: "bg-red-50",       text: "text-red-700",     border: "border-red-200",     icon: "✗", label: "Incompatible" },
  self:         { bg: "bg-slate-50",     text: "text-slate-300",   border: "border-slate-100",   icon: "—", label: "—" },
};

const CHEM_SHORT: Record<string, string> = {
  "Formaldehyde":           "HCHO",
  "Acetonitrile":           "ACN",
  "Chloroform":             "CHCl₃",
  "Ethanol (200 Proof)":    "EtOH",
  "Liquid Nitrogen":        "Liq. N₂",
  "Hydrogen Peroxide 30%":  "H₂O₂",
  "Sodium Azide":           "NaN₃",
  "Xylene (Mixed Isomers)": "Xylene",
};

function shortName(name: string): string {
  return (CHEM_SHORT[name] ?? (name.length > 12 ? name.slice(0, 10) + "…" : name));
}

// ─── PPE profile derivation ───────────────────────────────────────────────────

function getPPEProfile(c: Chemical): PPEProfile {
  const h = c.hazard_statements;
  const isFlammable     = h.some((x) => /^H2[2-6]/.test(x));
  const isOxidizer      = h.some((x) => /^H27[12]/.test(x));
  const isHighlyToxic   = h.some((x) => /^H(300|310)/.test(x));
  const isToxicInhal    = h.some((x) => /^H(330|331)/.test(x));
  const isCorrosive     = h.some((x) => /^H314/.test(x));
  const isCryo          = h.some((x) => /^H28[01]/.test(x));
  const isCarcinogen    = h.some((x) => /^H(350|351)/.test(x));
  const isReproHazard   = h.some((x) => /^H(360|361)/.test(x));
  const isWaterReactive = h.some((x) => /^H290/.test(x));

  let gloves = "Nitrile (4-mil minimum)";
  if (isCryo)
    gloves = "Cryogenic insulated gloves (Tempshield or equivalent)";
  else if (isOxidizer)
    gloves = "Butyl rubber or neoprene — NOT nitrile (peroxide degrades nitrile)";
  else if (isCorrosive)
    gloves = "Butyl rubber or neoprene (ASTM F739 tested for specific chemical)";
  else if (isHighlyToxic || isCarcinogen)
    gloves = "Double nitrile (8-mil outer); change frequently";
  else if (isWaterReactive)
    gloves = "Double nitrile; keep hands dry — no water contact";

  let eyes = "Safety glasses (ANSI Z87.1)";
  if (isCryo)
    eyes = "Full face shield + safety glasses underneath";
  else if (isCorrosive || isOxidizer)
    eyes = "Chemical splash goggles (indirect-vent) + face shield";
  else if (isHighlyToxic)
    eyes = "Chemical splash goggles (indirect-vent)";
  else if (isFlammable)
    eyes = "Safety glasses; face shield if splash risk present";

  let respiratory = "Standard room ventilation sufficient";
  if (isCryo)
    respiratory = "O₂-deficiency monitor in room; SCBA if confined-space entry";
  else if (isHighlyToxic && isToxicInhal)
    respiratory = "Half-face respirator with OV/P100 cartridge — fume hood mandatory";
  else if (isToxicInhal || isCarcinogen)
    respiratory = "Half-face respirator with OV cartridge or N95 at minimum";
  else if (isWaterReactive)
    respiratory = "OV/acid-gas cartridge — HN₃ release risk if moisture contact";
  else if (isFlammable || isOxidizer)
    respiratory = "Fume hood or ventilated enclosure; respirator for spill response";

  let body = "Lab coat (100% cotton preferred), closed-toe shoes";
  if (isCryo)
    body = "Cryogenic apron + lab coat; no loose clothing that can trap liquid N₂";
  else if (isCorrosive || isOxidizer)
    body = "Chemical-resistant apron over lab coat; no synthetics near oxidisers";
  else if (isCarcinogen || isHighlyToxic)
    body = "Lab coat — remove and bag immediately if contaminated; decontaminate before leaving";

  const controls: string[] = [];
  if (isFlammable)       controls.push("Eliminate ignition sources; use static-dissipating containers and grounding");
  if (isFlammable && !isOxidizer) controls.push("Store in FM/UL-approved flammables safety cabinet");
  if (isOxidizer)        controls.push("Oxidiser cabinet — fully segregated from organics and flammables");
  if (isHighlyToxic || isToxicInhal || isCarcinogen)
                         controls.push("ASHRAE 110-tested chemical fume hood required for all open handling");
  if (isCarcinogen || isReproHazard)
                         controls.push("Designated area — OSHA carcinogen/reproductive hazard signage required");
  if (c.is_scheduled)    controls.push(`OSHA regulated substance — ${(c.schedule_ref ?? "consult applicable schedule")}`);
  if (isWaterReactive)   controls.push("Store in locked, acid-free, dry cabinet; NO drain or sink disposal — ever");
  if (isCryo)            controls.push("O₂ sensor in storage/use room; pressure-relief valve on all Dewar vessels");
  if (isCorrosive)       controls.push("Eyewash within 10-second travel; segregate acids from bases");
  if (controls.length === 0) controls.push("Standard lab ventilation; follow GHS label and SDS Section 8");

  let hazardSummary = "Harmful";
  let hazardColor   = "bg-yellow-100 text-yellow-700";

  if (isCryo) {
    hazardSummary = "Cryogenic"; hazardColor = "bg-sky-100 text-sky-700";
  } else if (isHighlyToxic && isWaterReactive) {
    hazardSummary = "Highly Toxic + Reactive"; hazardColor = "bg-red-100 text-red-700";
  } else if (isHighlyToxic) {
    hazardSummary = "Highly Toxic"; hazardColor = "bg-red-100 text-red-700";
  } else if (isCarcinogen) {
    hazardSummary = "Carcinogen"; hazardColor = "bg-red-100 text-red-700";
  } else if (isOxidizer) {
    hazardSummary = "Oxidiser"; hazardColor = "bg-orange-100 text-orange-700";
  } else if (isCorrosive) {
    hazardSummary = "Corrosive"; hazardColor = "bg-orange-100 text-orange-700";
  } else if (isToxicInhal) {
    hazardSummary = "Toxic (Inhalation)"; hazardColor = "bg-red-50 text-red-600";
  } else if (isFlammable) {
    hazardSummary = "Flammable"; hazardColor = "bg-amber-100 text-amber-700";
  } else if (isReproHazard) {
    hazardSummary = "Repro. Hazard"; hazardColor = "bg-purple-100 text-purple-700";
  }

  return { gloves, eyes, respiratory, body, controls, hazardSummary, hazardColor };
}

// ─── Compatibility Matrix component ──────────────────────────────────────────

function CompatibilityMatrix({ chemicals }: { chemicals: Chemical[] }) {
  const [hovered, setHovered] = useState<{ aId: string; bId: string } | null>(null);

  const stats = useMemo(() => {
    let compat = 0, cond = 0, incompat = 0;
    for (let i = 0; i < chemicals.length; i++) {
      for (let j = i + 1; j < chemicals.length; j++) {
        const r = getCompatibility(chemicals[i], chemicals[j]);
        if (r === "compatible")   compat++;
        else if (r === "conditional")  cond++;
        else if (r === "incompatible") incompat++;
      }
    }
    return { compat, cond, incompat };
  }, [chemicals]);

  const hoveredA = hovered ? chemicals.find((c) => c.id === hovered.aId) : null;
  const hoveredB = hovered ? chemicals.find((c) => c.id === hovered.bId) : null;
  const hoveredResult = (hoveredA && hoveredB) ? getCompatibility(hoveredA, hoveredB) : null;
  const hoveredReason = (hoveredA && hoveredB) ? compatReason(hoveredA, hoveredB) : null;

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <div className="text-2xl font-bold tabular-nums text-emerald-700">{stats.compat}</div>
          <div className="mt-0.5 text-xs font-medium text-emerald-600">Compatible Pairs</div>
          <div className="mt-0.5 text-[10px] text-emerald-500">Same cabinet acceptable</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
          <div className="text-2xl font-bold tabular-nums text-amber-700">{stats.cond}</div>
          <div className="mt-0.5 text-xs font-medium text-amber-600">Conditional Pairs</div>
          <div className="mt-0.5 text-[10px] text-amber-500">Separate cabinets required</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <div className="text-2xl font-bold tabular-nums text-red-700">{stats.incompat}</div>
          <div className="mt-0.5 text-xs font-medium text-red-600">Incompatible Pairs</div>
          <div className="mt-0.5 text-[10px] text-red-500">Never co-store</div>
        </div>
      </div>

      {/* Hover info */}
      {hovered && hoveredResult && hoveredA && hoveredB && (
        <div
          className={`rounded-xl border-l-4 p-4 ${
            hoveredResult === "incompatible"
              ? "border-red-500 bg-red-50"
              : hoveredResult === "conditional"
              ? "border-amber-500 bg-amber-50"
              : hoveredResult === "compatible"
              ? "border-emerald-500 bg-emerald-50"
              : "border-slate-300 bg-slate-50"
          }`}
        >
          <div className="text-sm font-semibold text-slate-800">
            {COMPAT_STYLE[hoveredResult].icon} {COMPAT_STYLE[hoveredResult].label} — {hoveredA.name} + {hoveredB.name}
          </div>
          {hoveredReason && (
            <div className="mt-0.5 text-xs text-slate-600">{hoveredReason}</div>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="w-24 min-w-24 border-b border-r border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-[10px] uppercase tracking-wide text-slate-400">
                Chemical →
              </th>
              {chemicals.map((c) => (
                <th
                  key={c.id}
                  className="min-w-14 border-b border-r border-slate-100 bg-slate-50 px-2 py-2.5 text-center font-semibold text-slate-700"
                  title={c.name}
                >
                  {shortName(c.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chemicals.map((row) => (
              <tr key={row.id}>
                <td
                  className="border-b border-r border-slate-100 bg-slate-50 px-3 py-2.5 font-semibold text-slate-700 whitespace-nowrap"
                  title={row.name}
                >
                  {shortName(row.name)}
                </td>
                {chemicals.map((col) => {
                  const result = getCompatibility(row, col);
                  const style  = COMPAT_STYLE[result];
                  const isHov  = hovered?.aId === row.id && hovered?.bId === col.id;
                  return (
                    <td
                      key={col.id}
                      className={`border-b border-r border-slate-100 px-2 py-2.5 text-center select-none transition-colors ${style.bg} ${style.text} ${
                        isHov ? "ring-2 ring-inset ring-blue-400" : ""
                      } ${result !== "self" ? "cursor-pointer hover:opacity-75" : "opacity-30"}`}
                      onMouseEnter={() =>
                        result !== "self"
                          ? setHovered({ aId: row.id, bId: col.id })
                          : undefined
                      }
                      onMouseLeave={() => setHovered(null)}
                      title={result !== "self" ? `${row.name} + ${col.name}` : ""}
                    >
                      <span className="text-base font-bold leading-none">{style.icon}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Legend</span>
        {(["compatible", "conditional", "incompatible"] as const).map((k) => (
          <div
            key={k}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${COMPAT_STYLE[k].bg} ${COMPAT_STYLE[k].text} ${COMPAT_STYLE[k].border}`}
          >
            {COMPAT_STYLE[k].icon}{" "}
            {k === "compatible"
              ? "Compatible — same cabinet OK"
              : k === "conditional"
              ? "Conditional — separate cabinets"
              : "Incompatible — never co-store"}
          </div>
        ))}
        <span className="ml-auto text-[10.5px] text-slate-400">
          NFPA 400 · OSHA 1910.106 · EPA 40 CFR 264
        </span>
      </div>
    </div>
  );
}

// ─── PPE & Controls component ─────────────────────────────────────────────────

function PPEControlsTable({ chemicals }: { chemicals: Chemical[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-2.5">
      <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
        <span className="font-semibold">Minimum PPE requirements</span> derived from GHS H-codes per OSHA 29 CFR 1910.132. Click a chemical to see full detail. Additional controls may apply — always consult the SDS.
      </div>

      {chemicals.map((c) => {
        const ppe = getPPEProfile(c);
        const isOpen = expanded === c.id;

        return (
          <div
            key={c.id}
            className={`rounded-xl border transition-all ${
              isOpen ? "border-blue-200 bg-blue-50/20" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            {/* Summary row */}
            <button
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              onClick={() => setExpanded(isOpen ? null : c.id)}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                  <Pill className={ppe.hazardColor}>{ppe.hazardSummary}</Pill>
                  {c.is_scheduled && (
                    <Pill className="bg-orange-100 text-orange-700">OSHA Scheduled</Pill>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-500">
                  {ppe.gloves.split(";")[0]} · {ppe.eyes.split("+")[0].trim()} · {ppe.controls[0]}
                </div>
              </div>
              <svg
                className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded detail */}
            {isOpen && (
              <div className="border-t border-slate-100 px-4 pb-5 pt-4">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {/* Left: PPE requirements */}
                  <div>
                    <div className="mb-3 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                      Personal Protective Equipment
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: "Gloves",         value: ppe.gloves },
                        { label: "Eye / Face",     value: ppe.eyes },
                        { label: "Respiratory",    value: ppe.respiratory },
                        { label: "Body / Clothing", value: ppe.body },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex gap-3">
                          <div className="w-20 shrink-0">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500">
                              {label}
                            </span>
                          </div>
                          <div className="text-xs text-slate-700">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Engineering controls + H-codes */}
                  <div>
                    <div className="mb-3 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                      Engineering Controls &amp; Regulatory Notes
                    </div>
                    <ul className="space-y-2">
                      {ppe.controls.map((ctrl, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                          {ctrl}
                        </li>
                      ))}
                    </ul>

                    {c.hazard_statements.length > 0 && (
                      <div className="mt-4">
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          GHS H-Codes
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {c.hazard_statements.map((code) => (
                            <span
                              key={code}
                              className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── SDS Register component ───────────────────────────────────────────────────

const SDS_STATUS_CONFIG = {
  on_file:  { label: "On File",       color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  expiring: { label: "Expiring Soon", color: "bg-amber-100 text-amber-700",     dot: "bg-amber-500"   },
  expired:  { label: "Expired",       color: "bg-red-100 text-red-700",         dot: "bg-red-500"     },
  missing:  { label: "No SDS",        color: "bg-red-100 text-red-700",         dot: "bg-red-500"     },
} as const;

const STATUS_ORDER: Record<string, number> = { expired: 0, missing: 1, expiring: 2, on_file: 3 };

function fmtExp(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function SDSRegister({ chemicals }: { chemicals: Chemical[] }) {
  const [filter, setFilter] = useState<"all" | "issues">("all");

  const today = new Date();

  const rows = chemicals.map((c) => {
    const status = sdsStatus(c);
    const daysUntil = c.sds_expiry
      ? Math.ceil((new Date(c.sds_expiry).getTime() - today.getTime()) / 86400000)
      : null;
    return { ...c, status, daysUntil };
  });

  const counts = {
    on_file:  rows.filter((r) => r.status === "on_file").length,
    expiring: rows.filter((r) => r.status === "expiring").length,
    expired:  rows.filter((r) => r.status === "expired").length,
    missing:  rows.filter((r) => r.status === "missing").length,
  };
  const issues = counts.expiring + counts.expired + counts.missing;

  const displayed = [...(filter === "issues" ? rows.filter((r) => r.status !== "on_file") : rows)]
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {(["on_file", "expiring", "expired", "missing"] as const).map((s) => {
          const cfg = SDS_STATUS_CONFIG[s];
          const n   = counts[s];
          const active = n > 0 && s !== "on_file";
          return (
            <div
              key={s}
              className={`rounded-xl border p-3 text-center transition-colors ${
                active
                  ? s === "on_file"
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50"
                  : s === "on_file"
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-slate-100 bg-slate-50"
              }`}
            >
              <div className={`text-xl font-bold tabular-nums ${
                s === "on_file"  ? "text-emerald-700" :
                active           ? "text-red-700" : "text-slate-300"
              }`}>{n}</div>
              <div className={`text-xs font-medium ${
                s === "on_file" ? "text-emerald-600" :
                active ? "text-red-600" : "text-slate-400"
              }`}>{cfg.label}</div>
              {s === "expiring" && <div className="text-[10px] text-slate-400">within 90 days</div>}
              {s === "missing"  && <div className="text-[10px] text-slate-400">HazCom risk</div>}
            </div>
          );
        })}
      </div>

      {/* Alert banner */}
      {issues > 0 && (
        <div className="flex items-start gap-3 rounded-xl border-l-4 border-red-500 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <div className="text-sm font-semibold text-red-900">
              {issues} SDS {issues === 1 ? "Issue" : "Issues"} Require Attention
            </div>
            <div className="mt-0.5 text-xs text-red-700">
              OSHA 29 CFR 1910.1200(g) requires current SDS for all hazardous chemicals.
              {counts.expired > 0 && ` ${counts.expired} SDS ${counts.expired === 1 ? "has" : "have"} expired —`}
              {counts.expired > 0 && " obtain updated version from manufacturer immediately."}
              {counts.missing > 0 && ` ${counts.missing} chemical${counts.missing > 1 ? "s have" : " has"} no SDS on file.`}
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "all"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All ({chemicals.length})
          </button>
          <button
            onClick={() => setFilter("issues")}
            disabled={issues === 0}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "issues"
                ? "bg-red-600 text-white shadow-sm"
                : issues > 0
                ? "bg-red-50 text-red-700 hover:bg-red-100"
                : "cursor-default bg-slate-50 text-slate-300"
            }`}
          >
            Issues Only ({issues})
          </button>
        </div>
        <div className="text-[10.5px] text-slate-400">
          Review cycle: 3 years or when new hazard info available
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">Chemical</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">SDS Status</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">Expiry Date</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500 hidden lg:table-cell">Storage Location</th>
              <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">SDS Document</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayed.map((c) => {
              const cfg = SDS_STATUS_CONFIG[c.status];
              return (
                <tr key={c.id} className="bg-white hover:bg-slate-50/60 transition-colors">
                  {/* Chemical */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{c.name}</div>
                    {c.cas_number && (
                      <div className="mt-0.5 font-mono text-[10px] text-slate-400">CAS {c.cas_number}</div>
                    )}
                  </td>
                  {/* Status */}
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.color}`}>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </td>
                  {/* Expiry */}
                  <td className="px-3 py-3">
                    {c.sds_expiry ? (
                      <div>
                        <div className={`font-medium ${
                          c.status === "expired"  ? "text-red-600" :
                          c.status === "expiring" ? "text-amber-600" :
                          "text-slate-700"
                        }`}>
                          {fmtExp(c.sds_expiry)}
                        </div>
                        {c.daysUntil !== null && (
                          <div className={`text-[10px] ${
                            c.daysUntil < 0    ? "text-red-500 font-medium" :
                            c.daysUntil <= 90  ? "text-amber-500 font-medium" :
                            "text-slate-400"
                          }`}>
                            {c.daysUntil < 0
                              ? `${Math.abs(c.daysUntil)}d overdue`
                              : `${c.daysUntil}d remaining`}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  {/* Location */}
                  <td className="hidden px-3 py-3 lg:table-cell">
                    <div className="max-w-[200px] truncate text-[11px] text-slate-500" title={c.storage_location}>
                      {c.storage_location}
                    </div>
                  </td>
                  {/* Document */}
                  <td className="px-3 py-3 text-center">
                    {c.sds_url ? (
                      <a
                        href={c.sds_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                          c.status === "expired"
                            ? "bg-red-50 text-red-700 hover:bg-red-100"
                            : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                        }`}
                      >
                        <ExternalLink className="h-3 w-3" />
                        View SDS
                        {c.status === "expired" && (
                          <span className="rounded bg-red-100 px-1 text-[9px] text-red-600">outdated</span>
                        )}
                      </a>
                    ) : (
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-red-300 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-100"
                        onClick={() => alert("Contact your EHS Manager to upload the SDS for this chemical.")}
                      >
                        <Upload className="h-3 w-3" />
                        Request SDS
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Regulatory footnote */}
      <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-[10.5px] text-slate-500">
        <span className="font-semibold text-slate-600">OSHA 29 CFR 1910.1200(g):</span> Employers must maintain an SDS for each hazardous chemical and ensure SDSs are readily accessible during each work shift. Update when new hazard information is available or every 3 years as best practice.
      </div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

type Tab = "inventory" | "compatibility" | "ppe" | "sds";

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "inventory",     label: "Inventory",    Icon: FlaskConical },
  { id: "sds",           label: "SDS Register", Icon: FileText     },
  { id: "compatibility", label: "Compatibility", Icon: LayoutGrid   },
  { id: "ppe",           label: "PPE & Controls", Icon: Shield      },
];

export function ChemicalsDashboard({
  chemicals,
  courses,
}: {
  chemicals: Chemical[];
  courses: TrainingCourse[];
}) {
  const [tab, setTab] = useState<Tab>("inventory");

  const highHazard = chemicals.filter(
    (c) =>
      c.is_scheduled ||
      c.hazard_statements.some((h) => HIGH_HAZARD_H.some((hh) => h.startsWith(hh))),
  );

  const sdsOnFile  = chemicals.filter((c) => sdsStatus(c) === "on_file").length;
  const sdsProblem = chemicals.filter((c) => {
    const s = sdsStatus(c);
    return s === "missing" || s === "expired";
  }).length;

  const triggeredCourses = useMemo(
    () => buildTriggeredCourses(chemicals, courses),
    [chemicals, courses],
  );

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total Chemicals"       value={chemicals.length}  hint="Active inventory" />
        <Stat label="AI High-Hazard Flags"  value={highHazard.length} hint="Immediate attention" accent="#dc2626" />
        <Stat label="SDS on File"           value={sdsOnFile}         hint="Current & valid" accent="#10b981" />
        <Stat
          label="SDS Missing / Expired"
          value={sdsProblem}
          hint="Required by HazCom"
          accent={sdsProblem > 0 ? "#dc2626" : "#10b981"}
        />
      </div>

      {/* AI scan alert */}
      {highHazard.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border-l-4 border-violet-500 bg-violet-50 p-4">
          <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-violet-900">
              AI Inventory Scan — {highHazard.length} High-Hazard Flag
              {highHazard.length > 1 ? "s" : ""} Raised
            </div>
            <div className="mt-0.5 text-xs text-violet-700">
              {highHazard.map((c) => c.name).join(", ")}. Training triggers reviewed. Waste profiles auto-generated.
            </div>
          </div>
        </div>
      )}

      {/* Inventory-driven training chain */}
      {triggeredCourses.length > 0 && (
        <Card>
          <CardHeader
            title="Training Requirements Triggered by Inventory"
            subtitle={`${triggeredCourses.length} course${triggeredCourses.length !== 1 ? "s" : ""} required — automatically identified from GHS hazard classes`}
            right={
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                <Zap className="h-3 w-3" />
                Inventory-driven
              </div>
            }
          />
          <div className="divide-y divide-slate-50">
            {triggeredCourses.map(({ course, triggeringHazards, triggeringChemicals }) => (
              <div key={course.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/60">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                  <GraduationCap className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{course.title}</span>
                    <Pill className={COURSE_TYPE_COLOR[course.course_type] ?? "bg-slate-100 text-slate-600"}>
                      {course.course_type.replace(/_/g, " ")}
                    </Pill>
                    {course.validity_period_days && (
                      <Pill className="bg-slate-100 text-slate-500">
                        Valid {course.validity_period_days}d
                      </Pill>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-slate-500">
                    <span>
                      <span className="font-medium text-slate-600">Hazards: </span>
                      {triggeringHazards.join(" · ")}
                    </span>
                    <span>
                      <span className="font-medium text-slate-600">From: </span>
                      {triggeringChemicals.join(", ")}
                      {triggeringChemicals.length === 4 && " …"}
                    </span>
                  </div>
                </div>
                {course.regulatory_ref && (
                  <div className="shrink-0 font-mono text-[10.5px] text-slate-400">
                    {course.regulatory_ref}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab navigation */}
      <div>
        <div className="mb-4 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                tab === id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab: Inventory */}
        {tab === "inventory" && (
          <Card>
            <CardHeader
              title="Chemical Inventory"
              subtitle={`${chemicals.length} chemicals · ${highHazard.length} high-hazard · ${sdsProblem} SDS issues`}
            />
            <ChemicalsTable chemicals={chemicals} />
          </Card>
        )}

        {/* Tab: Storage Compatibility */}
        {tab === "compatibility" && (
          <Card>
            <CardHeader
              title="Storage Compatibility Matrix"
              subtitle="GHS hazard class co-storage analysis — hover a cell to see the segregation rule"
              right={
                <Pill className="bg-slate-100 font-mono text-slate-600">
                  {chemicals.length} × {chemicals.length}
                </Pill>
              }
            />
            <div className="p-5">
              <CompatibilityMatrix chemicals={chemicals} />
            </div>
          </Card>
        )}

        {/* Tab: PPE & Controls */}
        {tab === "ppe" && (
          <Card>
            <CardHeader
              title="PPE & Exposure Controls"
              subtitle="Minimum PPE and engineering controls derived from GHS H-codes — per OSHA 29 CFR 1910.132"
              right={
                <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  <Shield className="h-3 w-3" />
                  {chemicals.length} chemicals
                </div>
              }
            />
            <div className="p-4">
              <PPEControlsTable chemicals={chemicals} />
            </div>
          </Card>
        )}

        {/* Tab: SDS Register */}
        {tab === "sds" && (
          <Card>
            <CardHeader
              title="SDS Register"
              subtitle="Safety Data Sheet status for all inventory chemicals — OSHA 29 CFR 1910.1200(g)"
              right={
                <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  <FileText className="h-3 w-3" />
                  {chemicals.length} chemicals
                </div>
              }
            />
            <div className="p-5">
              <SDSRegister chemicals={chemicals} />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
