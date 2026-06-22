"use client";

import React, { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle2, XCircle, AlertTriangle, ClipboardList, Wind,
  Droplets, FlameKindling, Stethoscope, Eye, ChevronDown,
  ChevronUp, Plus, Activity, Shield, Wrench,
} from "lucide-react";
import type { Equipment } from "@/lib/types";
import { Pill } from "@/components/ui/primitives";
import { addCapa } from "@/lib/actions/ehs";
import { updateEquipment } from "@/lib/actions/ehs";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  equipment: Equipment[];
}

interface InspectionResult {
  equipId: string;
  date: string;
  pass: boolean;
  failedItems: string[];
  notes: string;
}

interface ExposureReading {
  id: string;
  chemical: string;
  type: "TWA" | "STEL";
  value: number;
  unit: string;
  location: string;
  date: string;
  monitor: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(s: string | null | undefined): number {
  if (!s) return 999;
  return Math.ceil((new Date(s).getTime() - Date.now()) / 86400000);
}

function isOverdue(s: string | null | undefined): boolean {
  if (!s) return false;
  return new Date(s) < new Date();
}

function isDueSoon(s: string | null | undefined, days = 30): boolean {
  if (!s) return false;
  const d = daysUntil(s);
  return d >= 0 && d <= days;
}

const EQUIP_STATUS_STYLE: Record<string, string> = {
  operational:     "bg-emerald-100 text-emerald-700",
  calibration_due: "bg-amber-100 text-amber-700",
  inspection_due:  "bg-amber-100 text-amber-700",
  out_of_service:  "bg-red-100 text-red-700",
  decommissioned:  "bg-slate-100 text-slate-400",
};

const EQUIP_TYPE_ICON: Record<string, React.ReactElement> = {
  emergency_eyewash: <Eye className="h-4 w-4" />,
  fire_extinguisher: <FlameKindling className="h-4 w-4" />,
  spill_kit:         <Droplets className="h-4 w-4" />,
  first_aid:         <Stethoscope className="h-4 w-4" />,
  air_monitor:       <Wind className="h-4 w-4" />,
  biosafety_cabinet: <Shield className="h-4 w-4" />,
  autoclave:         <Activity className="h-4 w-4" />,
  fume_hood:         <Wind className="h-4 w-4" />,
};

// ── Inspection checklists by type ─────────────────────────────────────────────

const INSPECTION_CHECKLISTS: Record<string, { item: string; regulation: string }[]> = {
  emergency_eyewash: [
    { item: "Both spray heads activate immediately (within 1 second)", regulation: "ANSI Z358.1" },
    { item: "Water flows for minimum 15 minutes unassisted",           regulation: "ANSI Z358.1" },
    { item: "Flow rate ≥ 0.4 GPM (eyewash) or 20 GPM (drench shower)", regulation: "ANSI Z358.1" },
    { item: "Unit is within 10 seconds travel distance from hazard",   regulation: "OSHA 1910.151" },
    { item: "No obstructions blocking access path",                    regulation: "ANSI Z358.1" },
    { item: "Stay-open valve is operational",                          regulation: "ANSI Z358.1" },
    { item: "Water temperature is tepid (16–38°C / 60–100°F)",         regulation: "ANSI Z358.1" },
    { item: "Dust covers are in place and free of debris",             regulation: "ANSI Z358.1" },
    { item: "Unit is clearly identified with a highly visible sign",   regulation: "ANSI Z358.1" },
  ],
  fire_extinguisher: [
    { item: "Pressure gauge in green/charged zone",                  regulation: "OSHA 1910.157" },
    { item: "Safety pin and tamper seal intact",                     regulation: "OSHA 1910.157" },
    { item: "No visible damage, dents, or corrosion",                regulation: "OSHA 1910.157" },
    { item: "Nozzle / discharge horn free of obstructions",          regulation: "OSHA 1910.157" },
    { item: "Weight / fullness check (heft test)",                   regulation: "OSHA 1910.157" },
    { item: "Mounted in designated location, clearly visible",       regulation: "OSHA 1910.157" },
    { item: "Last annual professional service within 12 months",     regulation: "OSHA 1910.157(e)" },
    { item: "Annual inspection tag current and legible",             regulation: "OSHA 1910.157" },
  ],
  spill_kit: [
    { item: "Absorbent pads / pillows — adequate supply",            regulation: "EPA 40 CFR 264" },
    { item: "Chemical-resistant gloves present and in good condition", regulation: "OSHA 1910.138" },
    { item: "Safety goggles / face shield present",                  regulation: "OSHA 1910.133" },
    { item: "Disposal bags and tie-wraps present",                   regulation: "EPA 40 CFR 262" },
    { item: "Acid/base neutraliser sachets present (if required)",   regulation: "Site SOP" },
    { item: "Container is clearly labelled 'Spill Kit'",             regulation: "Site SOP" },
    { item: "Spill kit contents match the hazards in the area",      regulation: "OSHA 1910.120" },
  ],
  first_aid: [
    { item: "Cabinet is fully stocked per ANSI Z308.1",              regulation: "OSHA 1910.266" },
    { item: "No expired medications or supplies",                    regulation: "OSHA 1910.266" },
    { item: "Clearly marked, accessible without obstruction",        regulation: "OSHA 1910.266" },
    { item: "AED present and battery/pad within expiry",             regulation: "Site SOP" },
    { item: "Eyewash saline solution within expiry (if present)",    regulation: "ANSI Z358.1" },
  ],
};

const DEFAULT_CHECKLIST = [
  { item: "Equipment is clean and free of visible damage",          regulation: "General" },
  { item: "All indicators/gauges are within normal operating range", regulation: "General" },
  { item: "Calibration / certification label is current",          regulation: "General" },
  { item: "Logbook/tag updated with this inspection date",         regulation: "General" },
];

// ── OEL data ──────────────────────────────────────────────────────────────────

const CHEMICAL_OELS = [
  {
    chemical: "Formaldehyde",
    cas: "50-00-0",
    pel_twa: 0.75,
    pel_stel: 2.0,
    idlh: 20,
    unit: "ppm",
    monitor: "Personal Air Monitor — PAM-02",
    regulation: "OSHA 29 CFR 1910.1048",
    notes: "Action Level (AL): 0.5 ppm TWA — triggers enhanced surveillance",
  },
  {
    chemical: "Chloroform",
    cas: "67-66-3",
    pel_twa: 50,
    pel_stel: null,
    idlh: 500,
    unit: "ppm",
    monitor: "Area Air Monitor",
    regulation: "OSHA 29 CFR 1910.1000 Table Z-1",
    notes: "NIOSH REL: 2 ppm (10-min ceiling — lower than OSHA PEL)",
  },
  {
    chemical: "Acetonitrile",
    cas: "75-05-8",
    pel_twa: 40,
    pel_stel: null,
    idlh: 500,
    unit: "ppm",
    monitor: "Area Air Monitor",
    regulation: "OSHA 29 CFR 1910.1000 Table Z-1",
    notes: "Combustible at 2.2–12.8% LEL. Ensure adequate ventilation.",
  },
];

// ── Spill response procedures ─────────────────────────────────────────────────

const SPILL_PROCEDURES = [
  {
    category: "Flammable Solvents",
    icon: <FlameKindling className="h-4 w-4" />,
    color: "border-orange-200 bg-orange-50",
    headerColor: "text-orange-800",
    examples: "Ethanol, Acetonitrile, Isopropanol",
    steps: [
      "STOP work. Alert personnel in the immediate area.",
      "Eliminate all ignition sources — turn off open flames, electrical equipment, and static sources.",
      "Don appropriate PPE: chemical-resistant gloves, safety glasses, lab coat. If large spill, use splash goggles and face shield.",
      "Contain the spill with non-sparking absorbent material (vermiculite, dry sand, or spill pads) starting from the outer edge inward.",
      "Do NOT use combustible absorbents (paper towel) for large solvent spills.",
      "Ventilate the area — open fume hood sash fully, open windows/doors if safe.",
      "Collect absorbed material in a sealed, labelled red hazardous waste container.",
      "Decontaminate the spill area with water and appropriate detergent.",
      "Complete a Spill Incident Report and notify EHS Coordinator.",
      "If spill exceeds 1 L, or vapours may reach an ignition source — EVACUATE and call emergency services.",
    ],
    ppe: ["Chemical-resistant nitrile gloves", "Safety glasses + splash goggles", "Lab coat", "Closed-toe shoes"],
  },
  {
    category: "Corrosives (Acids & Bases)",
    icon: <Droplets className="h-4 w-4" />,
    color: "border-red-200 bg-red-50",
    headerColor: "text-red-800",
    examples: "HCl, H₂SO₄, NaOH, KOH",
    steps: [
      "STOP work. Alert and evacuate non-essential personnel.",
      "Don PPE: chemical-resistant gloves (neoprene or nitrile heavy-duty), splash goggles, face shield, and acid/base-resistant lab coat.",
      "For acid spills: neutralise with sodium bicarbonate (baking soda) starting at the outer edge.",
      "For base spills: neutralise with citric acid or dilute acetic acid.",
      "Allow fizzing to subside before absorbing with spill pads.",
      "Collect neutralised material in a sealed hazardous waste container labelled with pH range.",
      "Rinse area thoroughly with water. Check pH of rinse water (target 6–8).",
      "If skin/eye contact occurs — IMMEDIATELY flush with water for 15 minutes and seek medical attention.",
      "Complete Spill Incident Report and notify EHS.",
    ],
    ppe: ["Neoprene/thick nitrile gloves", "Splash goggles + face shield", "Acid/base-resistant lab coat or apron", "Closed-toe shoes"],
  },
  {
    category: "Biological Materials (BSL-2)",
    icon: <Shield className="h-4 w-4" />,
    color: "border-emerald-200 bg-emerald-50",
    headerColor: "text-emerald-800",
    examples: "Cell cultures, BSL-2 organisms, human blood/body fluids",
    steps: [
      "STOP. Alert all personnel in the lab. Do NOT leave the area until it is decontaminated.",
      "If aerosol was generated, evacuate the lab immediately and wait 30 minutes before re-entry to allow aerosol to settle.",
      "Re-enter with proper PPE: gloves (double-glove), lab coat, and splash goggles.",
      "Cover the spill with paper towels soaked in 10% bleach (1:10 dilution of household bleach). Allow 20 minutes contact time.",
      "Working from the outside in, use absorbent paper towels to absorb the decontaminated material.",
      "Dispose of all contaminated material as biohazardous waste (red autoclave bag).",
      "Autoclave all contaminated material before disposal.",
      "Decontaminate the affected area with 70% ethanol after bleach treatment.",
      "Remove and autoclave contaminated clothing. Wash hands and exposed skin with soap and water.",
      "Complete a Spill Incident Report. Notify the Biosafety Officer and PI immediately.",
      "If exposure occurred (splash, needlestick, cut) — follow the Bloodborne Pathogen Exposure Protocol and seek immediate medical evaluation.",
    ],
    ppe: ["Double nitrile gloves", "Splash goggles", "BSL-2 lab coat (gown)", "Face mask if aerosol risk"],
  },
  {
    category: "Cryogenic Materials",
    icon: <Activity className="h-4 w-4" />,
    color: "border-blue-200 bg-blue-50",
    headerColor: "text-blue-800",
    examples: "Liquid Nitrogen (LN₂), Dry Ice",
    steps: [
      "STOP and alert personnel — LN₂ spills displace oxygen rapidly and create asphyxiation risk.",
      "Evacuate the area if a large spill (>500 mL LN₂) has occurred — oxygen monitoring required before re-entry.",
      "Do NOT handle LN₂ or dry ice with bare hands — cryogenic burns occur on contact.",
      "Don PPE: cryogenic (dewar) gloves, splash goggles, and face shield. Do NOT use latex gloves — they become brittle and fail.",
      "Allow small spills to evaporate in a well-ventilated area. Do not block drains.",
      "For dry ice: allow to sublimate in ventilated area or place in cold water to accelerate conversion to CO₂ gas.",
      "Ventilate area — open doors/windows. Verify O₂ level with oxygen monitor before re-entry (normal: >19.5%).",
      "Complete Spill Incident Report.",
    ],
    ppe: ["Cryogenic (dewar) gloves", "Splash goggles + face shield", "Lab coat", "Closed-toe shoes — NO open-toe"],
  },
];

// ── Seed mock exposure readings ───────────────────────────────────────────────

const SEED_READINGS: ExposureReading[] = [
  { id: "exp-001", chemical: "Formaldehyde", type: "TWA",  value: 0.42, unit: "ppm", location: "Lab 3", date: "2026-06-10", monitor: "PAM-02" },
  { id: "exp-002", chemical: "Formaldehyde", type: "STEL", value: 0.91, unit: "ppm", location: "Lab 3", date: "2026-06-10", monitor: "PAM-02" },
  { id: "exp-003", chemical: "Formaldehyde", type: "TWA",  value: 0.38, unit: "ppm", location: "Lab 3", date: "2026-05-22", monitor: "PAM-02" },
  { id: "exp-004", chemical: "Formaldehyde", type: "TWA",  value: 0.55, unit: "ppm", location: "Lab 3", date: "2026-04-15", monitor: "PAM-02" },
  { id: "exp-005", chemical: "Chloroform",   type: "TWA",  value: 8.2,  unit: "ppm", location: "Lab 2", date: "2026-05-01", monitor: "Area Monitor" },
];

// ── InspectionCard ─────────────────────────────────────────────────────────────

function InspectionCard({
  equip,
  onCapaGenerated,
}: {
  equip: Equipment;
  onCapaGenerated: (msg: string) => void;
}) {
  const [expanded, setExpanded]     = useState(false);
  const [logging, setLogging]       = useState(false);
  const [checks, setChecks]         = useState<Record<string, boolean>>({});
  const [notes, setNotes]           = useState("");
  const [done, setDone]             = useState(false);
  const [pending, startTransition]  = useTransition();

  const checklist = INSPECTION_CHECKLISTS[equip.type] ?? DEFAULT_CHECKLIST;
  const failedItems = checklist.filter((_, i) => checks[i] === false).map((c) => c.item);
  const allAnswered = checklist.every((_, i) => checks[i] !== undefined);
  const allPassed   = failedItems.length === 0;

  const overdue = isOverdue(equip.next_inspection_date);
  const dueDate = equip.next_inspection_date;

  function toggleCheck(i: number, pass: boolean) {
    setChecks((prev) => ({ ...prev, [i]: pass }));
  }

  function handleSubmitInspection() {
    const today     = new Date().toISOString().slice(0, 10);
    const intervals: Record<string, number> = {
      emergency_eyewash: 90,
      fire_extinguisher: 30,
      spill_kit:         90,
      first_aid:         30,
    };
    const intervalDays = intervals[equip.type] ?? 180;
    const nextDate = new Date(Date.now() + intervalDays * 86400000).toISOString().slice(0, 10);

    const fd = new FormData();
    fd.set("name",                  equip.name);
    fd.set("type",                  equip.type);
    fd.set("serial_number",         equip.serial_number ?? "");
    fd.set("location",              equip.location);
    fd.set("last_inspection_date",  today);
    fd.set("next_inspection_date",  nextDate);
    fd.set("last_calibration_date", equip.last_calibration_date ?? "");
    fd.set("next_calibration_date", equip.next_calibration_date ?? "");
    fd.set("calibration_interval_days", String(equip.calibration_interval_days ?? ""));
    fd.set("status",  allPassed ? "operational" : "out_of_service");
    fd.set("notes",   notes || (equip.notes ?? ""));

    startTransition(async () => {
      await updateEquipment(equip.id, fd);

      if (!allPassed) {
        const capaFd = new FormData();
        capaFd.set("title",       `Inspection Failure — ${equip.name}`);
        capaFd.set("description", `Inspection on ${today} identified ${failedItems.length} failed item(s):\n• ${failedItems.join("\n• ")}\n\nNotes: ${notes}`);
        capaFd.set("kind",        "corrective");
        capaFd.set("severity",    overdue ? "critical" : "major");
        capaFd.set("due_date",    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
        await addCapa(null, capaFd);
        onCapaGenerated(`CAPA auto-created for "${equip.name}" — ${failedItems.length} failed inspection item(s).`);
      }

      setDone(true);
      setLogging(false);
    });
  }

  function handleGenerateCapaOverdue() {
    const fd = new FormData();
    fd.set("title",       `Overdue Inspection — ${equip.name}`);
    fd.set("description", `${equip.name} at ${equip.location} has an overdue inspection (was due ${fmtDate(dueDate)}). Regulatory ref: ${equip.regulatory_ref ?? "N/A"}. Immediate inspection and corrective action required.`);
    fd.set("kind",        "corrective");
    fd.set("severity",    "critical");
    fd.set("due_date",    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));

    startTransition(async () => {
      await addCapa(null, fd);
      onCapaGenerated(`CAPA auto-created for overdue inspection of "${equip.name}" — due ${fmtDate(dueDate)}.`);
    });
  }

  const inspStatus = done
    ? "inspected"
    : overdue
    ? "overdue"
    : isDueSoon(equip.next_inspection_date, 30)
    ? "due_soon"
    : "current";

  return (
    <div className={`rounded-xl border bg-white shadow-sm overflow-hidden ${
      inspStatus === "overdue" ? "border-red-200" :
      inspStatus === "due_soon" ? "border-amber-200" :
      inspStatus === "inspected" ? "border-emerald-200" :
      "border-slate-100"
    }`}>
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          inspStatus === "overdue" ? "bg-red-100 text-red-600" :
          inspStatus === "due_soon" ? "bg-amber-100 text-amber-600" :
          inspStatus === "inspected" ? "bg-emerald-100 text-emerald-600" :
          "bg-slate-100 text-slate-500"
        }`}>
          {EQUIP_TYPE_ICON[equip.type] ?? <Wrench className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/monitoring/${equip.id}`} className="text-sm font-semibold text-blue-700 hover:underline truncate">
              {equip.name}
            </Link>
            <Pill className={EQUIP_STATUS_STYLE[equip.status] ?? "bg-slate-100 text-slate-600"}>
              {equip.status.replace(/_/g, " ")}
            </Pill>
            {done && <Pill className="bg-emerald-100 text-emerald-700">Inspected today ✓</Pill>}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">{equip.location}</div>
          <div className="mt-1 flex flex-wrap gap-3 text-[11px]">
            <span className="text-slate-400">Last: {fmtDate(equip.last_inspection_date)}</span>
            <span className={overdue ? "font-semibold text-red-600" : isDueSoon(equip.next_inspection_date) ? "font-semibold text-amber-600" : "text-slate-400"}>
              Next: {fmtDate(equip.next_inspection_date)}
              {overdue && " ⚠ OVERDUE"}
              {!overdue && isDueSoon(equip.next_inspection_date) && ` (${daysUntil(equip.next_inspection_date)}d)`}
            </span>
            {equip.regulatory_ref && <span className="text-slate-300">{equip.regulatory_ref}</span>}
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {overdue && !done && (
            <button
              onClick={handleGenerateCapaOverdue}
              disabled={pending}
              className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              {pending ? "…" : "Auto-CAPA"}
            </button>
          )}
          {!done && (
            <button
              onClick={() => setLogging((v) => !v)}
              className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              {logging ? "Cancel" : "Log Inspection"}
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-500 transition hover:bg-slate-100"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Inspection form */}
      {logging && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 space-y-3">
          <div className="text-xs font-semibold text-slate-700">
            Inspection Checklist — {equip.name}
            <span className="ml-2 text-[10px] font-normal text-slate-400">{checklist.length} items · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
          <div className="space-y-2">
            {checklist.map((item, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-white bg-white px-3 py-2.5 shadow-sm">
                <div className="flex-1">
                  <div className="text-[11px] font-medium text-slate-700">{item.item}</div>
                  <div className="text-[10px] text-slate-400">{item.regulation}</div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleCheck(i, true)}
                    className={`flex h-7 w-14 items-center justify-center gap-1 rounded-md border text-[10px] font-semibold transition ${checks[i] === true ? "border-emerald-400 bg-emerald-100 text-emerald-700" : "border-slate-200 text-slate-400 hover:border-emerald-300 hover:text-emerald-600"}`}
                  >
                    <CheckCircle2 className="h-3 w-3" /> Pass
                  </button>
                  <button
                    onClick={() => toggleCheck(i, false)}
                    className={`flex h-7 w-14 items-center justify-center gap-1 rounded-md border text-[10px] font-semibold transition ${checks[i] === false ? "border-red-400 bg-red-100 text-red-700" : "border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-600"}`}
                  >
                    <XCircle className="h-3 w-3" /> Fail
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any observations or corrective actions taken…"
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          {failedItems.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <div className="text-[11px] font-semibold text-red-700">{failedItems.length} item(s) failed — a CAPA will be auto-created on submit</div>
            </div>
          )}
          <button
            onClick={handleSubmitInspection}
            disabled={!allAnswered || pending}
            className="w-full rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-40"
          >
            {pending ? "Saving…" : allPassed ? "Submit — All Passed ✓" : `Submit — ${failedItems.length} Failed (CAPA will be created)`}
          </button>
        </div>
      )}

      {/* Checklist preview (expanded) */}
      {expanded && !logging && (
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Checklist ({checklist.length} items)
          </div>
          <ul className="space-y-1">
            {checklist.map((item, i) => (
              <li key={i} className="flex gap-2 text-[11px] text-slate-600">
                <span className="shrink-0 text-slate-300">•</span>
                <span>{item.item}</span>
                <span className="ml-auto shrink-0 text-[10px] text-slate-300">{item.regulation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Exposure Monitoring Component ─────────────────────────────────────────────

function ExposureMonitoring() {
  const [readings, setReadings] = useState<ExposureReading[]>(SEED_READINGS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    chemical: "Formaldehyde",
    type: "TWA" as "TWA" | "STEL",
    value: "",
    location: "Lab 3",
    monitor: "PAM-02",
  });

  function handleAdd() {
    if (!form.value) return;
    const oel = CHEMICAL_OELS.find((o) => o.chemical === form.chemical);
    const newReading: ExposureReading = {
      id: `exp-${Date.now()}`,
      chemical: form.chemical,
      type: form.type,
      value: parseFloat(form.value),
      unit: oel?.unit ?? "ppm",
      location: form.location,
      date: new Date().toISOString().slice(0, 10),
      monitor: form.monitor,
    };
    setReadings((prev) => [newReading, ...prev]);
    setShowForm(false);
    setForm({ chemical: "Formaldehyde", type: "TWA", value: "", location: "Lab 3", monitor: "PAM-02" });
  }

  return (
    <div className="space-y-5">
      {/* OEL comparison table */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Occupational Exposure Limits — Chemical Monitoring Status</h3>
            <p className="text-xs text-slate-500">Latest readings vs OSHA PEL/STEL. Red = at or above limit.</p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" /> Log Reading
          </button>
        </div>

        {/* Log reading form */}
        {showForm && (
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Chemical</label>
                <select
                  value={form.chemical}
                  onChange={(e) => setForm((f) => ({ ...f, chemical: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-400"
                >
                  {CHEMICAL_OELS.map((o) => <option key={o.chemical}>{o.chemical}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "TWA" | "STEL" }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-400"
                >
                  <option>TWA</option>
                  <option>STEL</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Reading (ppm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  placeholder="0.00"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAdd}
                  disabled={!form.value}
                  className="w-full rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OEL table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5 text-left">Chemical</th>
                <th className="px-4 py-2.5 text-center">PEL (TWA)</th>
                <th className="px-4 py-2.5 text-center">STEL</th>
                <th className="px-4 py-2.5 text-center">Latest TWA</th>
                <th className="px-4 py-2.5 text-center">Latest STEL</th>
                <th className="px-4 py-2.5 text-left">Monitor</th>
                <th className="px-4 py-2.5 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {CHEMICAL_OELS.map((oel) => {
                const latestTWA  = readings.filter((r) => r.chemical === oel.chemical && r.type === "TWA").sort((a, b) => b.date.localeCompare(a.date))[0];
                const latestSTEL = readings.filter((r) => r.chemical === oel.chemical && r.type === "STEL").sort((a, b) => b.date.localeCompare(a.date))[0];
                const twaExceeds  = latestTWA  && latestTWA.value  >= oel.pel_twa;
                const stelExceeds = latestSTEL && oel.pel_stel != null && latestSTEL.value >= oel.pel_stel;
                const atAction    = latestTWA  && latestTWA.value >= oel.pel_twa * 0.5 && !twaExceeds;
                const status      = twaExceeds || stelExceeds ? "exceeds_pel" : atAction ? "action_level" : latestTWA ? "compliant" : "no_data";

                return (
                  <tr key={oel.chemical} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="text-xs font-semibold text-slate-800">{oel.chemical}</div>
                      <div className="text-[10px] font-mono text-slate-400">CAS {oel.cas}</div>
                      <div className="text-[10px] text-slate-400">{oel.regulation}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-700">{oel.pel_twa} {oel.unit}</td>
                    <td className="px-4 py-3 text-center text-xs text-slate-600">{oel.pel_stel != null ? `${oel.pel_stel} ${oel.unit}` : "—"}</td>
                    <td className="px-4 py-3 text-center">
                      {latestTWA ? (
                        <div>
                          <div className={`text-sm font-bold tabular-nums ${twaExceeds ? "text-red-600" : atAction ? "text-amber-600" : "text-emerald-600"}`}>
                            {latestTWA.value} {oel.unit}
                          </div>
                          <div className="text-[9px] text-slate-400">{fmtDate(latestTWA.date)}</div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min((latestTWA.value / oel.pel_twa) * 100, 100)}%`,
                                backgroundColor: twaExceeds ? "#dc2626" : atAction ? "#d97706" : "#10b981",
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No data</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {latestSTEL ? (
                        <div className={`text-sm font-bold tabular-nums ${stelExceeds ? "text-red-600" : "text-emerald-600"}`}>
                          {latestSTEL.value} {oel.unit}
                          <div className="text-[9px] font-normal text-slate-400">{fmtDate(latestSTEL.date)}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{oel.monitor}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        status === "exceeds_pel"    ? "bg-red-100 text-red-700" :
                        status === "action_level"   ? "bg-amber-100 text-amber-700" :
                        status === "compliant"      ? "bg-emerald-100 text-emerald-700" :
                        "bg-slate-100 text-slate-500"
                      }`}>
                        {status === "exceeds_pel"  && <>{">"}PEL — Action Required</>}
                        {status === "action_level" && <>At Action Level</>}
                        {status === "compliant"    && <>Within PEL</>}
                        {status === "no_data"      && <>Monitoring Required</>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Readings history */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-800">Monitoring History</h3>
          <p className="text-xs text-slate-500">{readings.length} readings on record</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5 text-left">Chemical</th>
                <th className="px-4 py-2.5 text-left">Type</th>
                <th className="px-4 py-2.5 text-right">Reading</th>
                <th className="px-4 py-2.5 text-left">Location</th>
                <th className="px-4 py-2.5 text-left">Monitor</th>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">vs PEL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {readings.map((r) => {
                const oel = CHEMICAL_OELS.find((o) => o.chemical === r.chemical);
                const limit = r.type === "TWA" ? oel?.pel_twa : oel?.pel_stel;
                const pct = limit ? Math.round((r.value / limit) * 100) : null;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5 text-xs font-medium text-slate-800">{r.chemical}</td>
                    <td className="px-4 py-2.5"><Pill className="bg-slate-100 text-slate-600 text-[10px]">{r.type}</Pill></td>
                    <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums text-slate-700">{r.value} {r.unit}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{r.location}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{r.monitor}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-slate-500">{fmtDate(r.date)}</td>
                    <td className="px-4 py-2.5">
                      {pct != null ? (
                        <span className={`text-xs font-semibold ${pct >= 100 ? "text-red-600" : pct >= 50 ? "text-amber-600" : "text-emerald-600"}`}>
                          {pct}%
                        </span>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Spill Response ────────────────────────────────────────────────────────────

function SpillResponse() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700">
        <strong>Emergency First Response:</strong> In the event of any large, uncontrolled, or unsafe spill — evacuate the area, pull the fire alarm if fire hazard exists, and call <strong>911</strong> and the EHS Emergency Line. Only attempt spill control if it is safe to do so with the equipment and training available.
      </div>
      {SPILL_PROCEDURES.map((proc) => (
        <div key={proc.category} className={`rounded-xl border ${proc.color} overflow-hidden`}>
          <button
            onClick={() => setOpen(open === proc.category ? null : proc.category)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <span className={proc.headerColor}>{proc.icon}</span>
            <div className="flex-1">
              <div className={`text-sm font-semibold ${proc.headerColor}`}>{proc.category}</div>
              <div className="text-[11px] text-slate-500">{proc.examples}</div>
            </div>
            <span className="text-slate-400">
              {open === proc.category ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </button>
          {open === proc.category && (
            <div className="border-t border-white/60 bg-white/70 px-4 py-4">
              <div className="mb-3 flex flex-wrap gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Required PPE:</div>
                {proc.ppe.map((p) => (
                  <span key={p} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600">{p}</span>
                ))}
              </div>
              <ol className="space-y-2">
                {proc.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                      {i + 1}
                    </span>
                    <span className="text-[11px] leading-relaxed text-slate-700">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main MonitoringDashboard ──────────────────────────────────────────────────

const TABS = [
  { id: "overview",   label: "Overview",            icon: <ClipboardList className="h-3.5 w-3.5" /> },
  { id: "emergency",  label: "Emergency Equipment", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { id: "exposure",   label: "Exposure Monitoring", icon: <Wind className="h-3.5 w-3.5" /> },
  { id: "spill",      label: "Spill Response",      icon: <Droplets className="h-3.5 w-3.5" /> },
  { id: "register",   label: "Equipment Register",  icon: <Wrench className="h-3.5 w-3.5" /> },
] as const;

type TabId = "overview" | "emergency" | "exposure" | "spill" | "register";

const EMERGENCY_TYPES = new Set(["emergency_eyewash", "fire_extinguisher", "spill_kit", "first_aid", "emergency_shower"]);

export function MonitoringDashboard({ equipment }: Props) {
  const [tab, setTab]         = useState<TabId>("overview");
  const [capaMsg, setCapaMsg] = useState<string | null>(null);

  const active    = equipment.filter((e) => e.status === "operational").length;
  const calDue    = equipment.filter((e) => e.status === "calibration_due" || isDueSoon(e.next_calibration_date)).length;
  const inspDue   = equipment.filter((e) => e.status === "inspection_due"  || isDueSoon(e.next_inspection_date)).length;
  const overdue   = equipment.filter((e) => e.status === "out_of_service"  || isOverdue(e.next_inspection_date) || isOverdue(e.next_calibration_date)).length;

  const emergencyEquip = equipment.filter((e) => EMERGENCY_TYPES.has(e.type));
  const overdueCount   = equipment.filter((e) =>
    isOverdue(e.next_inspection_date) || isOverdue(e.next_calibration_date) || e.status === "out_of_service"
  ).length;

  const upcomingDue = equipment
    .filter((e) =>
      (isDueSoon(e.next_inspection_date, 30) && !isOverdue(e.next_inspection_date)) ||
      (isDueSoon(e.next_calibration_date, 30) && !isOverdue(e.next_calibration_date))
    )
    .sort((a, b) => {
      const aDate = Math.min(
        a.next_inspection_date  ? new Date(a.next_inspection_date).getTime()  : Infinity,
        a.next_calibration_date ? new Date(a.next_calibration_date).getTime() : Infinity,
      );
      const bDate = Math.min(
        b.next_inspection_date  ? new Date(b.next_inspection_date).getTime()  : Infinity,
        b.next_calibration_date ? new Date(b.next_calibration_date).getTime() : Infinity,
      );
      return aDate - bDate;
    });

  return (
    <div className="space-y-4">
      {/* CAPA created notification */}
      {capaMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="flex-1 text-xs text-emerald-800">{capaMsg}</div>
          <button onClick={() => setCapaMsg(null)} className="text-emerald-400 hover:text-emerald-600 text-lg leading-none">×</button>
        </div>
      )}

      {/* Overdue alert */}
      {overdueCount > 0 && (
        <div className="rounded-xl border-l-4 border-red-500 bg-red-50 px-4 py-3">
          <div className="text-sm font-semibold text-red-900">
            {overdueCount} item{overdueCount !== 1 ? "s" : ""} overdue for inspection or calibration
          </div>
          <div className="mt-0.5 text-xs text-red-700">
            {equipment
              .filter((e) => isOverdue(e.next_inspection_date) || isOverdue(e.next_calibration_date) || e.status === "out_of_service")
              .map((e) => e.name)
              .join(" · ")}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const badge =
            t.id === "emergency" && overdueCount > 0 ? overdueCount :
            null;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.id
                  ? "border-blue-300 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              {t.icon}{t.label}
              {badge && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${tab === t.id ? "bg-white/20 text-white" : "bg-red-100 text-red-700"}`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Operational",      value: active,    hint: "All systems go",   accent: "#10b981" },
              { label: "Calibration Due",  value: calDue,    hint: "Within 30 days",   accent: calDue > 0 ? "#d97706" : "#10b981" },
              { label: "Inspection Due",   value: inspDue,   hint: "Within 30 days",   accent: inspDue > 0 ? "#d97706" : "#10b981" },
              { label: "Overdue / OOS",    value: overdue,   hint: "Urgent attention",  accent: overdue > 0 ? "#dc2626" : "#10b981" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</div>
                <div className="mt-1 text-3xl font-bold" style={{ color: s.accent }}>{s.value}</div>
                <div className="mt-0.5 text-xs text-slate-400">{s.hint}</div>
              </div>
            ))}
          </div>

          {/* Upcoming due list */}
          {upcomingDue.length > 0 && (
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <span className="text-sm font-semibold text-slate-800">Upcoming Due — Next 30 Days</span>
              </div>
              <div className="divide-y divide-slate-50">
                {upcomingDue.map((e) => {
                  const nextInsp = e.next_inspection_date;
                  const nextCal  = e.next_calibration_date;
                  const inspDays = nextInsp ? daysUntil(nextInsp) : 999;
                  const calDays  = nextCal  ? daysUntil(nextCal)  : 999;
                  const isInsp   = inspDays <= calDays;
                  const days     = isInsp ? inspDays : calDays;
                  return (
                    <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                      <div className={`h-2 w-2 shrink-0 rounded-full ${days <= 7 ? "bg-red-500" : days <= 14 ? "bg-amber-500" : "bg-blue-400"}`} />
                      <div className="flex-1 text-xs font-medium text-slate-700">{e.name}</div>
                      <div className="text-xs text-slate-500">{e.location}</div>
                      <div className={`text-xs font-semibold tabular-nums ${days <= 7 ? "text-red-600" : days <= 14 ? "text-amber-600" : "text-blue-600"}`}>
                        {isInsp ? "Inspection" : "Calibration"} in {days}d
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All equipment summary */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3.5">
              <span className="text-sm font-semibold text-slate-800">Equipment Summary</span>
            </div>
            <div className="divide-y divide-slate-50">
              {equipment.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    {EQUIP_TYPE_ICON[e.type] ?? <Wrench className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/monitoring/${e.id}`} className="text-xs font-semibold text-blue-700 hover:underline truncate block">
                      {e.name}
                    </Link>
                    <div className="text-[10px] text-slate-400">{e.location}</div>
                  </div>
                  <Pill className={EQUIP_STATUS_STYLE[e.status] ?? "bg-slate-100 text-slate-600"}>
                    {e.status.replace(/_/g, " ")}
                  </Pill>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Emergency Equipment ── */}
      {tab === "emergency" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
            Emergency equipment must be inspected on schedule per ANSI Z358.1 and OSHA standards. Use <strong>Auto-CAPA</strong> for overdue items to create a tracked corrective action, or <strong>Log Inspection</strong> to perform a guided checklist inspection.
          </div>
          {emergencyEquip.length === 0 ? (
            <div className="rounded-xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
              No emergency equipment registered (eyewash, fire extinguisher, spill kit, first aid). Add equipment via the register.
            </div>
          ) : (
            emergencyEquip.map((e) => (
              <InspectionCard key={e.id} equip={e} onCapaGenerated={setCapaMsg} />
            ))
          )}
          {/* Other equipment that has overdue inspections */}
          {equipment.filter((e) => !EMERGENCY_TYPES.has(e.type) && (isOverdue(e.next_inspection_date) || isDueSoon(e.next_inspection_date, 14))).map((e) => (
            <InspectionCard key={e.id} equip={e} onCapaGenerated={setCapaMsg} />
          ))}
        </div>
      )}

      {/* ── Exposure Monitoring ── */}
      {tab === "exposure" && <ExposureMonitoring />}

      {/* ── Spill Response ── */}
      {tab === "spill" && <SpillResponse />}

      {/* ── Equipment Register ── */}
      {tab === "register" && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <span className="text-sm font-semibold text-slate-800">Equipment Register</span>
            <span className="ml-2 text-xs text-slate-400">{equipment.length} items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2.5 text-left">Equipment</th>
                  <th className="px-4 py-2.5 text-left">Type</th>
                  <th className="px-4 py-2.5 text-left">Location</th>
                  <th className="px-4 py-2.5 text-left">Last Cal.</th>
                  <th className="px-4 py-2.5 text-left">Next Cal.</th>
                  <th className="px-4 py-2.5 text-left">Last Insp.</th>
                  <th className="px-4 py-2.5 text-left">Next Insp.</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {equipment.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 max-w-48">
                      <Link href={`/monitoring/${e.id}`} className="text-xs font-semibold text-blue-700 hover:underline">
                        {e.name}
                      </Link>
                      {e.serial_number && <div className="font-mono text-[10px] text-slate-400">{e.serial_number}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <Pill className="bg-slate-100 text-slate-600 text-[10px] capitalize">{e.type.replace(/_/g, " ")}</Pill>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{e.location}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-500">{fmtDate(e.last_calibration_date)}</td>
                    <td className="px-4 py-3 text-xs tabular-nums">
                      <span className={isDueSoon(e.next_calibration_date) ? "font-semibold text-amber-600" : isOverdue(e.next_calibration_date) ? "font-semibold text-red-600" : "text-slate-500"}>
                        {fmtDate(e.next_calibration_date)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-500">{fmtDate(e.last_inspection_date)}</td>
                    <td className="px-4 py-3 text-xs tabular-nums">
                      <span className={isDueSoon(e.next_inspection_date) ? "font-semibold text-amber-600" : isOverdue(e.next_inspection_date) ? "font-semibold text-red-600" : "text-slate-500"}>
                        {fmtDate(e.next_inspection_date)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Pill className={EQUIP_STATUS_STYLE[e.status] ?? "bg-slate-100 text-slate-600"}>
                        {e.status.replace(/_/g, " ")}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
