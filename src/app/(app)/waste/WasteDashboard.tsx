"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FlaskConical,
  Calendar,
  FileText,
  Clock,
  AlertTriangle,
  Download,
  ChevronLeft,
  ChevronRight,
  Zap,
  Warehouse,
  Truck,
  CheckCircle2,
  PhoneCall,
  ClipboardCheck,
  GraduationCap,
  Flame,
  XCircle,
  Tag,
  Wrench,
  BarChart3,
  Scale,
  ShieldAlert,
} from "lucide-react";
import type {
  WasteStream,
  Chemical,
  WasteVendor,
  WastePickup,
  WasteInspection as LiveWasteInspection,
} from "@/lib/types";
import { Card, CardHeader, Pill, Stat } from "@/components/ui/primitives";
import { MOCK_MODE } from "@/lib/env";
import {
  addWorkspaceTask,
  addWasteVendor,
  updateWasteVendor,
  scheduleWastePickup,
  updateWastePickup,
  logWasteInspection,
} from "@/lib/actions/ehs";
import { Modal, Field, Input, Select, Textarea, SubmitRow } from "@/components/modals/Modal";
import { playCreateSound } from "@/lib/sounds";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "register" | "accumulation" | "schedule" | "manifests" | "storage" | "vendors" | "inspections" | "compliance" | "labels" | "capa" | "reports";

interface WasteSuggestion {
  chemicalId: string;
  chemicalName: string;
  classification: string;
  reason: string;
  disposalMethod: string;
  epaCode: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WASTE_STATUS_STYLE: Record<string, string> = {
  pending:        "bg-amber-100 text-amber-700",
  pending_pickup: "bg-amber-100 text-amber-700",
  accumulating:   "bg-blue-100 text-blue-700",
  manifested:     "bg-blue-100 text-blue-700",
  disposed:       "bg-emerald-100 text-emerald-700",
  reported:       "bg-slate-100 text-slate-600",
};

const CLASS_STYLE: Record<string, string> = {
  hazardous:    "bg-red-100 text-red-700",
  non_hazardous:"bg-emerald-100 text-emerald-700",
  clinical:     "bg-orange-100 text-orange-700",
  radioactive:  "bg-purple-100 text-purple-700",
  scheduled:    "bg-red-100 text-red-700",
  recyclable:   "bg-blue-100 text-blue-700",
  general:      "bg-slate-100 text-slate-600",
};

// Only tabs backed by the tenant's real data (waste streams) are exposed.
// The remaining tabs (manifests/storage/labels/vendors/inspections/capa/
// compliance/reports) were built on hardcoded sample data and are hidden until
// rebuilt against real tables — their render branches below are unreachable.
const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "register",     label: "Waste Register",        Icon: FlaskConical },
  { id: "accumulation", label: "Accumulation Tracker",  Icon: Clock },
  { id: "schedule",     label: "Pickup Schedule",       Icon: Calendar },
  { id: "vendors",      label: "Vendors / TSDF",        Icon: Truck },
  { id: "manifests",    label: "Pickups / Manifests",   Icon: FileText },
  { id: "inspections",  label: "Inspections",           Icon: ClipboardCheck },
];

// ── Storage Area mock data ────────────────────────────────────────────────────

interface StorageArea {
  id: string; name: string; room: string; type: string;
  capacity: string; fill: number; contents: string[]; lastInspection: string;
  status: "ok" | "attention" | "critical";
  signage: "ok" | "missing" | "damaged";
  containment: "ok" | "attention" | "fail";
  riskScore: number;
  genCategory: string;
  owner: string;
  nextInspection: string;
  containers: { id: string; type: string; vol: string; code: string; filled: string }[];
}

const STORAGE_AREAS: StorageArea[] = MOCK_MODE ? [
  {
    id: "sa-001", name: "Chemical SAA — Lab A", room: "Room 112", type: "Satellite Accumulation Area",
    capacity: "55 gal / 208 L", fill: 42, contents: ["F001 Halogenated solvents", "D001 Ignitable waste"],
    lastInspection: "2026-06-18", status: "ok",
    signage: "ok", containment: "ok", riskScore: 28, genCategory: "SQG",
    owner: "Dr. Kim Park — Lab Supervisor", nextInspection: "2026-06-25",
    containers: [
      { id: "CTR-2026-001", type: "55-gal drum", vol: "18.5 L", code: "F001", filled: "2026-04-03" },
      { id: "CTR-2026-002", type: "5-gal carboy", vol: "4.0 L",  code: "D001", filled: "2026-05-20" },
    ],
  },
  {
    id: "sa-002", name: "Biosafety SAA — Lab B", room: "Room 205", type: "Satellite Accumulation Area",
    capacity: "30-gal biohazard capacity", fill: 40, contents: ["BW-001 Biological / infectious waste"],
    lastInspection: "2026-06-15", status: "ok",
    signage: "ok", containment: "ok", riskScore: 15, genCategory: "SQG",
    owner: "Dr. Kim Park — Biosafety Officer", nextInspection: "2026-06-29",
    containers: [
      { id: "CTR-2026-003", type: "Red bag accumulation bin", vol: "12 kg", code: "BW-001", filled: "2026-06-10" },
    ],
  },
  {
    id: "sa-003", name: "Central Accumulation — Loading Dock", room: "Dock Bay 1", type: "Central Accumulation Area",
    capacity: "180-day SQG limit — unlimited qty", fill: 68, contents: ["F003 Non-halogenated solvents", "D002 Corrosive waste"],
    lastInspection: "2026-06-10", status: "attention",
    signage: "ok", containment: "attention", riskScore: 52, genCategory: "SQG",
    owner: "Facilities Manager", nextInspection: "2026-07-08",
    containers: [
      { id: "CTR-2026-004", type: "55-gal drum", vol: "22.0 L", code: "F003", filled: "2026-05-01" },
      { id: "CTR-2026-005", type: "5-gal carboy", vol: "3.2 L",  code: "D002", filled: "2026-05-28" },
    ],
  },
] : [];

// ── Vendor mock data ──────────────────────────────────────────────────────────

interface Vendor {
  id: string; name: string; specialty: string; license: string; dot: boolean;
  contact: string; phone: string; email: string; lastPickup: string | null;
  nextPickup: string | null; rating: number; streams: string[];
  status: "active" | "pending" | "review";
  licenseExpiry: string; permitExpiry: string; insuranceExpiry: string;
  restrictions: string[];
  disposalCertCount: number;
}

const VENDORS: Vendor[] = MOCK_MODE ? [
  {
    id: "v-001", name: "Clean Harbors", specialty: "Hazardous Waste Disposal",
    license: "NJ-HW-2024-0142", dot: true, contact: "Regional Account Mgr",
    phone: "(800) 282-0058", email: "northeast@cleanharbors.com",
    lastPickup: "2026-04-28", nextPickup: "2026-07-15",
    rating: 5, streams: ["F001 Halogenated Solvents", "D001 Ignitable Waste"],
    status: "active",
    licenseExpiry: "2026-12-31", permitExpiry: "2026-10-15", insuranceExpiry: "2026-09-30",
    restrictions: ["No RCRA-prohibited hazardous waste", "No PCBs > 50 ppm"],
    disposalCertCount: 12,
  },
  {
    id: "v-002", name: "Stericycle", specialty: "Clinical / Biomedical Waste",
    license: "NJ-MED-2025-0891", dot: true, contact: "Client Services",
    phone: "(800) 643-0090", email: "clientservices@stericycle.com",
    lastPickup: null, nextPickup: "2026-06-28",
    rating: 4, streams: ["BW-001 Biological / Infectious Waste"],
    status: "active",
    licenseExpiry: "2027-06-30", permitExpiry: "2027-01-15", insuranceExpiry: "2026-11-15",
    restrictions: ["Medical / biohazardous waste only — no chemical waste", "No dry biohazard > 150 lbs/shipment"],
    disposalCertCount: 8,
  },
  {
    id: "v-003", name: "Veolia Environmental", specialty: "Chemical Waste Treatment",
    license: "NJ-HW-2024-0634", dot: true, contact: "Scheduling",
    phone: "(877) 983-6425", email: "scheduling.ne@veolia.com",
    lastPickup: "2026-06-01", nextPickup: null,
    rating: 4, streams: ["F003 Non-Halogenated Solvents", "D002 Corrosive Waste"],
    status: "active",
    licenseExpiry: "2026-08-15", permitExpiry: "2026-07-01", insuranceExpiry: "2027-03-31",
    restrictions: ["No reactive waste (D003)", "Pre-notification required for pH < 2 aqueous waste"],
    disposalCertCount: 5,
  },
] : [];

// ── Inspection mock data ──────────────────────────────────────────────────────

interface ChecklistItem { item: string; result: "yes" | "no" | "na"; }

interface WasteInspection {
  id: string; area: string; areaType: "SAA" | "CAA";
  date: string; inspector: string;
  passed: number; failed: number; na: number;
  status: "pass" | "fail" | "partial";
  capaOpen: number; findings: string[];
  checklistItems: ChecklistItem[];
  inspectorNotes: string;
  photoCount: number;
  repeatFindings: string[];
}

const INSPECTIONS: WasteInspection[] = MOCK_MODE ? [
  {
    id: "INS-2026-022", area: "Chemical SAA — Lab A", areaType: "SAA",
    date: "2026-06-18", inspector: "Maria Lopez",
    passed: 14, failed: 1, na: 2, status: "partial", capaOpen: 1,
    findings: ["Container CTR-2026-001 label missing accumulation start date — CAPA opened (CAP-2026-041)"],
    checklistItems: [
      { item: "Container labels complete (contents, hazards, start date, gen info)", result: "no" },
      { item: "Secondary containment intact and clean", result: "yes" },
      { item: "Containers closed when not actively filling", result: "yes" },
      { item: "Compatible waste streams only in area", result: "yes" },
      { item: "Spill kit present and fully stocked", result: "yes" },
      { item: "Emergency contact posted and current", result: "yes" },
      { item: "Grounding / bonding for flammable containers verified", result: "yes" },
      { item: "SDS available for all waste streams in area", result: "na" },
      { item: "Prior CAPA items resolved", result: "na" },
    ],
    inspectorNotes: "CTR-2026-001 physical label not updated after container change — accumulation start date absent. All other items satisfactory. CAPA CAP-2026-041 opened immediately.",
    photoCount: 3,
    repeatFindings: [],
  },
  {
    id: "INS-2026-021", area: "Biosafety SAA — Lab B", areaType: "SAA",
    date: "2026-06-15", inspector: "Dr. Kim Park",
    passed: 17, failed: 0, na: 1, status: "pass", capaOpen: 0,
    findings: [],
    checklistItems: [
      { item: "Biohazard labels on all containers", result: "yes" },
      { item: "Red bag accumulation area clearly marked", result: "yes" },
      { item: "Secondary containment intact", result: "yes" },
      { item: "Biohazardous waste segregated from chemical waste", result: "yes" },
      { item: "PPE station stocked (gloves, mask, face shield)", result: "yes" },
      { item: "Spill kit appropriate for biohazardous materials", result: "yes" },
      { item: "Accumulation within 90-day SQG limit", result: "yes" },
      { item: "Emergency procedures posted and current", result: "yes" },
      { item: "Autoclave log current", result: "na" },
    ],
    inspectorNotes: "All items satisfactory. Lab B is the most compliant area on site. Recommend as model for new staff orientation tours.",
    photoCount: 2,
    repeatFindings: [],
  },
  {
    id: "INS-2026-020", area: "Central Accumulation — Loading Dock", areaType: "CAA",
    date: "2026-06-10", inspector: "Maria Lopez",
    passed: 13, failed: 2, na: 0, status: "fail", capaOpen: 2,
    findings: [
      "Secondary containment — minor floor cracking observed · CAPA opened (CAP-2026-038)",
      "Fire extinguisher inspection tag expired Jun 1 — replacement ordered · CAPA opened (CAP-2026-039)",
    ],
    checklistItems: [
      { item: "Container labels complete", result: "yes" },
      { item: "Secondary containment intact — no cracks or failures", result: "no" },
      { item: "Fire extinguisher present, tag current, inspected", result: "no" },
      { item: "Aisle access maintained — minimum 36 inches", result: "yes" },
      { item: "Accumulation within 180-day SQG / CAA limit", result: "yes" },
      { item: "Weekly inspection log up to date", result: "yes" },
      { item: "Containers closed and in good condition", result: "yes" },
      { item: "Emergency coordinator information posted", result: "yes" },
      { item: "Spill kit present and accessible", result: "yes" },
    ],
    inspectorNotes: "Two failures: (1) Secondary containment has minor floor cracking near drain — water test recommended, contractor quote received. (2) Fire extinguisher tag expired Jun 1, unit still pressurized but non-compliant. Both CAPAs opened immediately.",
    photoCount: 4,
    repeatFindings: ["Secondary containment deficiency previously noted in INS-2025-015 — repeat finding, escalated to major"],
  },
] : [];

// ── Compliance / Training mock data ───────────────────────────────────────────

const WASTE_TRAINING = MOCK_MODE ? [
  { role: "EHS Manager",            modules: ["RCRA Overview", "Waste Determination", "Manifest / LDR", "DOT Hazmat", "CAPA & Inspections"], status: "current", due: "2027-03-15" },
  { role: "Lab Supervisor",         modules: ["SAA/CAA Rules", "Labeling Requirements", "Spill Response", "Compatibility Matrix"], status: "current", due: "2027-01-10" },
  { role: "Generator (Lab Staff)",  modules: ["SAA Awareness", "Container Labeling", "Spill Kit Use"], status: "gap", due: "2026-07-30" },
  { role: "Facilities / Dock",      modules: ["DOT Hazmat Shipping", "Manifest Handling", "Emergency Response"], status: "current", due: "2026-11-20" },
  { role: "Procurement",            modules: ["Waste Vendor Approval", "Manifest Chain of Custody"], status: "gap", due: "2026-08-01" },
] : [];

const COMPLIANCE_TASKS = MOCK_MODE ? [
  { title: "Weekly SAA Inspection",             due: "2026-06-27", freq: "Weekly",   status: "scheduled", authority: "EPA 40 CFR §262.16",  submissionStatus: "pending"   as const, evidenceRequired: "Signed inspection checklist on file" },
  { title: "Large Generator Annual Inspection", due: "2026-07-15", freq: "Annual",   status: "overdue",   authority: "EPA 40 CFR §262.41",  submissionStatus: "pending"   as const, evidenceRequired: "Inspector report + CAPA resolution evidence" },
  { title: "Annual WMP Review",                 due: "2026-12-31", freq: "Annual",   status: "scheduled", authority: "Internal",             submissionStatus: "scheduled" as const, evidenceRequired: "Leadership sign-off document (all 3 reviewers)" },
  { title: "Vendor / TSDF Re-qualification",    due: "2026-09-01", freq: "Annual",   status: "scheduled", authority: "Internal",             submissionStatus: "scheduled" as const, evidenceRequired: "Updated TSDF permits and re-qualification inspection report" },
  { title: "Universal Waste Training Refresh",  due: "2026-08-15", freq: "Annual",   status: "scheduled", authority: "RCRA 40 CFR §273",    submissionStatus: "scheduled" as const, evidenceRequired: "Training attendance records and certification copies" },
  { title: "Biennial Waste Report",             due: "2027-03-01", freq: "Biennial", status: "scheduled", authority: "EPA / State DEP",      submissionStatus: "scheduled" as const, evidenceRequired: "State EPA acknowledgment receipt" },
  { title: "Tier II EPCRA Report",              due: "2027-03-01", freq: "Annual",   status: "scheduled", authority: "EPCRA §312",           submissionStatus: "scheduled" as const, evidenceRequired: "LEPC and SERC submission confirmation numbers" },
  { title: "TRI Form R Annual Submission",       due: "2027-07-01", freq: "Annual",   status: "scheduled", authority: "EPCRA §313",           submissionStatus: "scheduled" as const, evidenceRequired: "EPA TRI-ME e-submission ID" },
  { title: "HMBP Update — Hazardous Materials Business Plan", due: "2026-09-30", freq: "Annual", status: "scheduled", authority: "NJ Admin. Code 7:1E", submissionStatus: "scheduled" as const, evidenceRequired: "Certified program submission to CUPA / OES" },
  { title: "CUPA Biennial Compliance Inspection Report",      due: "2026-08-31", freq: "Biennial", status: "scheduled", authority: "NJ DEP",  submissionStatus: "scheduled" as const, evidenceRequired: "CUPA inspection report and signed attestation letter" },
] : [];

// ── Spill kit and EPCRA threshold data (BL-WMP-12) ──────────────────────────

const SPILL_KIT_AREAS = MOCK_MODE ? [
  { area: "Chemical SAA — Lab A",               kit: "Chemical Spill Kit (small)", location: "Lab A corridor, outside Room 112", lastInspected: "2026-06-18", status: "ok"        as const },
  { area: "Biosafety SAA — Lab B",              kit: "Biohazard Spill Kit",        location: "Lab B Room 205, cabinet B-3",       lastInspected: "2026-06-15", status: "ok"        as const },
  { area: "Central Accumulation — Loading Dock", kit: "Large Chemical Spill Kit",  location: "Loading Dock Bay 1, wall mount N",  lastInspected: "2026-06-10", status: "attention" as const },
] : [];

const EPCRA_THRESHOLDS = [
  { chemical: "Chloroform (F001 component)",       cas: "67-66-3",   qty: "~5 kg",  threshold: "10 lbs / ~4.5 kg",         program: "TRI (EPCRA §313)",    flagged: true  },
  { chemical: "Dichloromethane (F001 component)",  cas: "75-09-2",   qty: "~12 kg", threshold: "25,000 lbs / ~11,340 kg",  program: "TRI (EPCRA §313)",    flagged: false },
  { chemical: "Sulfuric Acid (D002 component)",    cas: "7664-93-9", qty: "~2 kg",  threshold: "1,000 lbs / ~454 kg",      program: "EPCRA §302 EHS List", flagged: false },
];

// ── Stream supplemental detail data (BL-WMP-03) ──────────────────────────────

interface StreamVersion { version: string; date: string; reviewer: string | null; change: string; }
interface StreamDetail {
  code: string;
  sourceProcess: string; owner: string; location: string;
  sdsLinks: { title: string; number: string }[];
  uncertainty: string | null;
  versions: StreamVersion[];
}

const STREAM_DETAILS: StreamDetail[] = MOCK_MODE ? [
  {
    code: "F001", sourceProcess: "Column chromatography solvent recovery — Lab A",
    owner: "Dr. Kim Park — Lab Supervisor", location: "Lab A, Room 112",
    sdsLinks: [{ title: "Dichloromethane SDS", number: "SDS-2024-0142" }, { title: "Chloroform SDS", number: "SDS-2024-0098" }],
    uncertainty: null,
    versions: [
      { version: "v2.1", date: "2026-04-02", reviewer: "Maria Lopez", change: "Disposal method updated to incineration per 2026 CFR guidance" },
      { version: "v2.0", date: "2025-09-15", reviewer: "Maria Lopez", change: "Annual review — no change to classification" },
      { version: "v1.0", date: "2024-11-01", reviewer: "Site Director", change: "Initial profile created" },
    ],
  },
  {
    code: "D001", sourceProcess: "Flammable solvent waste from bench experiments — Lab A",
    owner: "Dr. Kim Park — Lab Supervisor", location: "Lab A, Room 112",
    sdsLinks: [{ title: "Acetone SDS", number: "SDS-2024-0031" }, { title: "Ethanol SDS", number: "SDS-2024-0055" }],
    uncertainty: null,
    versions: [
      { version: "v1.0", date: "2026-05-19", reviewer: "Maria Lopez", change: "Initial profile created from SDS inventory review" },
    ],
  },
  {
    code: "BW-001", sourceProcess: "Cell culture and microbiological lab operations — Lab B",
    owner: "Dr. Kim Park — Biosafety Officer", location: "Lab B, Room 205",
    sdsLinks: [],
    uncertainty: "BSL-2 exposure potential assumed from process knowledge — no analytical testing performed. Confirm with biosafety officer annually.",
    versions: [
      { version: "v1.2", date: "2026-06-09", reviewer: "Dr. Kim Park", change: "EPCRA reportable quantity note added" },
      { version: "v1.0", date: "2025-07-20", reviewer: "Site Director", change: "Initial biosafety waste profile" },
    ],
  },
  {
    code: "F003", sourceProcess: "Equipment cleaning and column chromatography — Loading Dock / Lab A",
    owner: "Facilities Manager", location: "Loading Dock Bay 1",
    sdsLinks: [{ title: "Methanol SDS", number: "SDS-2024-0072" }, { title: "Isopropanol SDS", number: "SDS-2024-0081" }],
    uncertainty: "F003 listing based on process knowledge — analytical confirmation scheduled for Q3 2026.",
    versions: [
      { version: "v1.1", date: "2026-06-15", reviewer: "Maria Lopez", change: "Analytical confirmation note added — submission pending Q3 2026" },
      { version: "v1.0", date: "2026-03-10", reviewer: "Maria Lopez", change: "Initial profile created from inventory audit" },
    ],
  },
  {
    code: "D002", sourceProcess: "Equipment wash and reagent neutralization — Loading Dock",
    owner: "Dr. Kim Park — Lab Supervisor", location: "Loading Dock Bay 1",
    sdsLinks: [{ title: "Sulfuric Acid SDS", number: "SDS-2024-0019" }],
    uncertainty: "D002 characteristic corrosivity determination based on pH < 2 process knowledge — corrosivity lab confirmation pending.",
    versions: [
      { version: "v1.0", date: "2026-06-01", reviewer: null, change: "AI draft — EHS review required before approval" },
    ],
  },
] : [];

const RETIRED_STREAMS = MOCK_MODE ? [
  {
    name: "Spent Acetone Waste", code: "F003-PRIOR", retiredDate: "2026-03-01",
    supersededBy: "Non-Halogenated Solvents Waste (F003)" as string | null,
    reason: "Classification consolidated into broader non-halogenated solvent stream per 2026 annual review.",
  },
  {
    name: "Mixed Lab Waste — Pilot Study", code: "D012", retiredDate: "2025-12-15",
    supersededBy: null as string | null,
    reason: "Pilot study concluded. Waste stream closed — no ongoing generation confirmed.",
  },
] : [];

// ── Labels & Compatibility mock data (BL-WMP-07 + BL-WMP-08) ─────────────────

interface LabelContainer {
  id: string; area: string; code: string; contents: string;
  hazards: string[]; genInfo: string; startDate: string;
  labelStatus: "complete" | "incomplete" | "missing";
  missing: string[];
  condition: "ok" | "damaged" | "leaking";
  photoCount: number;
}

const LABEL_CONTAINERS: LabelContainer[] = MOCK_MODE ? [
  {
    id: "CTR-2026-001", area: "Chemical SAA — Lab A", code: "F001",
    contents: "Halogenated Solvents", hazards: ["Flammable", "Harmful"],
    genInfo: "BioStar Research Inc. — Lab A, Room 112", startDate: "2026-04-03",
    labelStatus: "incomplete",
    missing: ["Accumulation start date missing from physical label — CAPA open (CAP-2026-041)"],
    condition: "ok", photoCount: 2,
  },
  {
    id: "CTR-2026-002", area: "Chemical SAA — Lab A", code: "D001",
    contents: "Ignitable Waste", hazards: ["Flammable"],
    genInfo: "BioStar Research Inc. — Lab A, Room 112", startDate: "2026-05-20",
    labelStatus: "complete", missing: [],
    condition: "ok", photoCount: 0,
  },
  {
    id: "CTR-2026-003", area: "Biosafety SAA — Lab B", code: "BW-001",
    contents: "Biohazardous / Infectious Waste", hazards: ["Biohazard"],
    genInfo: "BioStar Research Inc. — Lab B, Room 205", startDate: "2026-06-10",
    labelStatus: "complete", missing: [],
    condition: "ok", photoCount: 1,
  },
  {
    id: "CTR-2026-004", area: "Central Accumulation — Dock", code: "F003",
    contents: "Non-Halogenated Solvents", hazards: ["Flammable"],
    genInfo: "BioStar Research Inc. — Loading Dock Bay 1", startDate: "2026-05-01",
    labelStatus: "complete", missing: [],
    condition: "ok", photoCount: 0,
  },
  {
    id: "CTR-2026-005", area: "Central Accumulation — Dock", code: "D002",
    contents: "Corrosive Waste", hazards: ["Corrosive"],
    genInfo: "BioStar Research Inc. — Loading Dock Bay 1", startDate: "2026-05-28",
    labelStatus: "missing",
    missing: ["Contents description not present", "Hazard class not displayed", "Generator information missing"],
    condition: "damaged", photoCount: 1,
  },
] : [];

interface CompatPair {
  a: string; classA: string; b: string; classB: string;
  risk: "critical" | "warning" | "ok";
  reason: string; action: string;
}

const COMPAT_MATRIX: CompatPair[] = [
  {
    a: "F001 Halogenated Solvents", classA: "Flammable",
    b: "D001 Ignitable Waste",      classB: "Flammable",
    risk: "ok",
    reason: "Same hazard class — compatible in same secondary containment area.",
    action: "Segregate from oxidizers. Grounding/bonding required for both containers.",
  },
  {
    a: "D001 Ignitable Waste",      classA: "Flammable",
    b: "D001 Oxidizing Waste",      classB: "Oxidizing",
    risk: "critical",
    reason: "Flammable + Oxidizer — fire and explosion risk if combined or co-stored without separation.",
    action: "Separate storage areas required — do not store together under any circumstances.",
  },
  {
    a: "D002 Corrosive (Acid)",     classA: "Acid",
    b: "D002 Corrosive (Base)",     classB: "Base",
    risk: "warning",
    reason: "Acid + Base — potential for violent reaction, heat generation, and gas release.",
    action: "Secondary containment required. Separate shelving units minimum. Review SDS before co-storage.",
  },
  {
    a: "BW-001 Biohazardous Waste", classA: "Biohazard",
    b: "D001 Ignitable Waste",      classB: "Flammable",
    risk: "critical",
    reason: "Biohazard + Flammable — RCRA and biosafety regulations both prohibit co-storage.",
    action: "Separate rooms required. Biosafety SAA and Chemical SAA must remain physically distinct.",
  },
];

// ── CAPA mock data (BL-WMP-15) ────────────────────────────────────────────────

interface Capa {
  id: string; title: string; source: string; sourceId: string;
  severity: "critical" | "major" | "minor";
  owner: string; due: string;
  status: "open" | "in_progress" | "pending_verification" | "closed";
  evidence: string | null; notes: string;
}

const CAPAS: Capa[] = MOCK_MODE ? [
  {
    id: "CAP-2026-041",
    title: "CTR-2026-001 — Accumulation start date missing from physical label",
    source: "Inspection", sourceId: "INS-2026-022",
    severity: "minor", owner: "Maria Lopez", due: "2026-06-30",
    status: "in_progress", evidence: null,
    notes: "Label reprint ordered from approved profile. Physical update scheduled before next inspection.",
  },
  {
    id: "CAP-2026-039",
    title: "Central Accumulation — Fire extinguisher inspection tag expired Jun 1",
    source: "Inspection", sourceId: "INS-2026-020",
    severity: "major", owner: "Facilities Manager", due: "2026-06-25",
    status: "in_progress", evidence: null,
    notes: "Replacement unit ordered. Installation scheduled Jun 24. Evidence photo required at close.",
  },
  {
    id: "CAP-2026-038",
    title: "Central Accumulation — Secondary containment floor cracking observed",
    source: "Inspection", sourceId: "INS-2026-020",
    severity: "major", owner: "Facilities Manager", due: "2026-07-15",
    status: "open", evidence: null,
    notes: "Repair contractor quote received. Pending approval from site director. Independent verification required before closure.",
  },
  {
    id: "CAP-2026-042",
    title: "SPL-2026-001 — SAA container handling procedure review and Lab A spill response refresher",
    source: "Spill Event", sourceId: "SPL-2026-001",
    severity: "minor", owner: "Maria Lopez", due: "2026-06-30",
    status: "in_progress", evidence: null,
    notes: "Auto-generated from SPL-2026-001. Secondary containment performed correctly — no release to environment. Action: update SAA handling SOP and schedule Lab A spill response refresher training.",
  },
] : [];

// ── Profile Pipeline mock data (BL-WMP-04 + BL-WMP-05) ──────────────────────

interface ProfileReviewItem {
  streamId: string; name: string; code: string;
  state: "draft" | "ehs_review" | "approved" | "active" | "retired";
  reviewer: string | null; submittedDate: string | null; approvedDate: string | null;
  version: string; aiGenerated: boolean; confidence: number | null;
}

const PROFILE_PIPELINE: ProfileReviewItem[] = MOCK_MODE ? [
  { streamId: "ws-1", name: "Halogenated Solvents Waste",       code: "F001", state: "active",     reviewer: "Maria Lopez",  submittedDate: "2026-04-01", approvedDate: "2026-04-02", version: "v2.1", aiGenerated: true,  confidence: 94 },
  { streamId: "ws-2", name: "Ignitable Waste — Lab A",           code: "D001", state: "approved",   reviewer: "Maria Lopez",  submittedDate: "2026-05-18", approvedDate: "2026-05-19", version: "v1.0", aiGenerated: true,  confidence: 88 },
  { streamId: "ws-3", name: "Biohazardous / Infectious Waste",   code: "BW-001", state: "active",   reviewer: "Dr. Kim Park", submittedDate: "2026-06-08", approvedDate: "2026-06-09", version: "v1.2", aiGenerated: false, confidence: null },
  { streamId: "ws-4", name: "Non-Halogenated Solvents Waste",    code: "F003", state: "ehs_review", reviewer: "Maria Lopez",  submittedDate: "2026-06-15", approvedDate: null,          version: "v1.1", aiGenerated: true,  confidence: 81 },
  { streamId: "ws-5", name: "Corrosive Waste — Loading Dock",    code: "D002", state: "draft",      reviewer: null,           submittedDate: null,          approvedDate: null,          version: "v1.0", aiGenerated: true,  confidence: 76 },
] : [];

// ── Pickup Requests + Readiness mock data (BL-WMP-10) ────────────────────────

interface PickupRequest {
  id: string; vendor: string; streams: string[];
  requestedDate: string; confirmedDate: string | null;
  readiness: { item: string; done: boolean }[];
  status: "draft" | "submitted" | "confirmed" | "completed";
}

const PICKUP_REQUESTS: PickupRequest[] = [
  {
    id: "PKR-2026-007", vendor: "Clean Harbors",
    streams: ["CTR-2026-001 · F001 Halogenated Solvents", "CTR-2026-004 · F003 Non-Halogenated Solvents"],
    requestedDate: "2026-07-15", confirmedDate: "2026-07-15", status: "confirmed",
    readiness: [
      { item: "Manifest number assigned",                     done: true  },
      { item: "LDR notification / certification prepared",    done: true  },
      { item: "Container labels verified complete",           done: false },
      { item: "Emergency contact card posted",                done: true  },
      { item: "Proper placards on transport vehicle confirmed", done: false },
      { item: "Waste profile approved and current",           done: true  },
      { item: "Return copy routing confirmed",                done: false },
    ],
  },
  {
    id: "PKR-2026-006", vendor: "Stericycle",
    streams: ["CTR-2026-003 · BW-001 Biohazardous Waste"],
    requestedDate: "2026-06-28", confirmedDate: "2026-06-28", status: "confirmed",
    readiness: [
      { item: "Manifest number assigned",                         done: true },
      { item: "Biohazard packaging compliant with 49 CFR",        done: true },
      { item: "Container labels verified complete",               done: true },
      { item: "Waste profile approved and current",               done: true },
      { item: "Return copy routing confirmed",                    done: true },
      { item: "Chain-of-custody document prepared",               done: true },
      { item: "Pickup time window confirmed with facility security", done: false },
    ],
  },
];

// ── Drill Log + Spill Events mock data (BL-WMP-12) ───────────────────────────

interface DrillRecord {
  id: string; date: string; type: string; location: string;
  participants: number; duration: string; facilitator: string;
  outcome: "passed" | "needs_improvement"; notes: string;
}

const DRILL_LOG: DrillRecord[] = [
  { id: "DRL-2026-004", date: "2026-06-01", type: "Chemical Spill — Tabletop", location: "Lab A / Lab B", participants: 8, duration: "45 min", facilitator: "Maria Lopez", outcome: "passed", notes: "All personnel demonstrated correct PPE donning, containment kit use, and EHS notification protocol." },
  { id: "DRL-2026-003", date: "2026-03-14", type: "Emergency Evacuation Drill", location: "Whole Site", participants: 47, duration: "12 min", facilitator: "Site Director", outcome: "passed", notes: "All areas cleared within the 10-minute target. Loading dock evacuation path review recommended." },
  { id: "DRL-2026-002", date: "2026-01-22", type: "Biohazardous Spill Response", location: "Lab B", participants: 5, duration: "30 min", facilitator: "Dr. Kim Park", outcome: "needs_improvement", notes: "Secondary containment cart location unknown to 2 of 5 participants. Reminder posted. Follow-up drill scheduled." },
];

interface SpillEvent {
  id: string; date: string; area: string; material: string; volume: string;
  cause: string; severity: "minor" | "major" | "reportable";
  responders: string; cleanup: string;
  reported: boolean; reportedTo: string | null; status: "closed" | "open";
}

const SPILL_EVENTS: SpillEvent[] = [
  { id: "SPL-2026-001", date: "2026-05-12", area: "Chemical SAA — Lab A", material: "F001 Halogenated Solvents", volume: "~0.5 L", cause: "Container tipped during handling — secondary containment captured spill", severity: "minor", responders: "Lab staff + EHS on call", cleanup: "Absorbent pads applied; waste containerized and labeled F001. Area inspected within 1 hour.", reported: false, reportedTo: null, status: "closed" },
];

// ── Annual WMP Review sign-off data (BL-WMP-16) ──────────────────────────────

interface WmpSection {
  id: string; title: string;
  status: "reviewed" | "pending"; reviewer: string | null; notes: string;
}
interface WmpReviewer {
  name: string; role: string; signed: boolean; signedDate: string | null;
}

const WMP_SECTIONS: WmpSection[] = [
  { id: "s01", title: "Waste Determination & Legal Register (BL-WMP-02–03)",     status: "reviewed", reviewer: "Maria Lopez",   notes: "All streams determined, legal register current, 7 CFRs mapped to generator category." },
  { id: "s02", title: "Waste Profile Management & AI Workflow (BL-WMP-04–05)",   status: "reviewed", reviewer: "Maria Lopez",   notes: "Profile pipeline reviewed. D002 draft — submission due 2026-07-15." },
  { id: "s03", title: "SAA/CAA Area Management (BL-WMP-06)",                     status: "reviewed", reviewer: "Maria Lopez",   notes: "Central Accumulation containment CAPA open — repair scheduled Jul 15." },
  { id: "s04", title: "Container Labels & Compatibility (BL-WMP-07–08)",         status: "reviewed", reviewer: "Dr. Kim Park", notes: "CTR-2026-001 label CAPA in progress. Compatibility matrix current and blocking shipment on critical pairs." },
  { id: "s05", title: "Inspections & CAPA Program (BL-WMP-09, 15)",              status: "reviewed", reviewer: "Maria Lopez",   notes: "3 open CAPAs, all in progress. No repeat findings. Evidence required before closure." },
  { id: "s06", title: "Transportation, Manifest & LDR (BL-WMP-10)",              status: "reviewed", reviewer: "Maria Lopez",   notes: "1 return copy pending day-21 of 35-day window. LDR certs current." },
  { id: "s07", title: "Vendor / TSDF Approval File (BL-WMP-11)",                 status: "reviewed", reviewer: "Maria Lopez",   notes: "Veolia TSDF permit expires Jul 1 — re-qualification initiated." },
  { id: "s08", title: "Emergency Preparedness & Spill Records (BL-WMP-12)",      status: "reviewed", reviewer: "Dr. Kim Park", notes: "Fire extinguisher CAPA in progress. 3 drills completed YTD. Spill SPL-2026-001 closed." },
  { id: "s09", title: "Training & Compliance Calendar (BL-WMP-13–14)",           status: "reviewed", reviewer: "Maria Lopez",   notes: "2 training gaps (Lab Staff, Procurement) — remediation scheduled Aug 2026." },
  { id: "s10", title: "Waste Minimization & Improvement Plan (BL-WMP-15)",       status: "pending",  reviewer: null,            notes: "Minimization goals to be acknowledged by Site Director before final sign-off." },
];

const WMP_REVIEWERS: WmpReviewer[] = [
  { name: "Maria Lopez",   role: "EHS Manager",        signed: true,  signedDate: "2026-06-20" },
  { name: "Dr. Kim Park",  role: "Lab Safety Officer", signed: true,  signedDate: "2026-06-21" },
  { name: "Site Director", role: "Site Director",      signed: false, signedDate: null },
];

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function suggestWaste(c: Chemical): WasteSuggestion | null {
  const h = c.hazard_statements;
  if (h.some((x) => /^H2[0-6]|^H27/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Flammable / Explosive", disposalMethod: "incineration", epaCode: "D001" };
  if (h.some((x) => /^H(30[0-2]|31[0-2]|33[0-2])/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Acute Toxic", disposalMethod: "treatment", epaCode: "D012" };
  if (h.some((x) => /^H(350|351)/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Carcinogenic", disposalMethod: "incineration", epaCode: "D012" };
  if (h.some((x) => /^H(360|361)/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Reproductive Hazard", disposalMethod: "treatment", epaCode: "D012" };
  if (h.some((x) => /^H(370|371|372|373)/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Target Organ Toxin", disposalMethod: "treatment", epaCode: "D012" };
  if (h.some((x) => /^H(290|314|315)/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Corrosive", disposalMethod: "neutralization", epaCode: "D002" };
  if (h.some((x) => /^H4/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Aquatic Toxic", disposalMethod: "treatment", epaCode: "D012" };
  if (c.is_scheduled)
    return { chemicalId: c.id, chemicalName: c.name, classification: "scheduled", reason: "Scheduled substance", disposalMethod: "treatment", epaCode: "—" };
  return null;
}

// ── Accumulation Tracker ──────────────────────────────────────────────────────

function AccumulationTracker({ streams }: { streams: WasteStream[] }) {
  const LIMIT_DAYS = 90;
  const now = useMemo(() => new Date(), []);

  const active = streams.filter((s) => s.status !== "disposed" && s.status !== "reported");

  const items = useMemo(
    () =>
      active.map((s) => {
        const start = new Date(s.created_at);
        const daysAccum = Math.max(0, daysBetween(start, now));
        const daysLeft  = Math.max(0, LIMIT_DAYS - daysAccum);
        const pct       = Math.min(100, (daysAccum / LIMIT_DAYS) * 100);
        const urgent    = daysLeft <= 14;
        const warning   = daysLeft > 14 && daysLeft <= 30;
        const dotColor  = urgent ? "#dc2626" : warning ? "#f59e0b" : "#10b981";
        const barClass  = urgent ? "bg-red-500" : warning ? "bg-amber-500" : "bg-emerald-500";
        const limitDate = new Date(start);
        limitDate.setDate(limitDate.getDate() + LIMIT_DAYS);
        return { ...s, daysAccum, daysLeft, pct, urgent, warning, dotColor, barClass, limitDate };
      }),
    [active, now],
  );

  const urgentCount = items.filter((i) => i.urgent).length;

  if (active.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
        No active waste streams to track — all streams are disposed or reported.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {urgentCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border-l-4 border-red-500 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div>
            <div className="text-sm font-semibold text-red-900">
              {urgentCount} stream{urgentCount > 1 ? "s" : ""} approaching the 90-day EPA accumulation limit
            </div>
            <div className="mt-0.5 text-xs text-red-700">
              SQG facilities must arrange disposal before the accumulation limit expires. Contact your waste contractor immediately.
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader
          title="Satellite Accumulation Areas"
          subtitle={`${active.length} active stream${active.length !== 1 ? "s" : ""} · EPA 90-day SQG accumulation limit`}
        />
        <div className="flex flex-col divide-y divide-slate-50">
          {items.map((item) => (
            <div key={item.id} className="px-5 py-4">
              <div className="mb-2 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/waste/${item.id}`}
                    className="text-sm font-medium text-slate-800 hover:text-blue-700 hover:underline"
                  >
                    {item.waste_name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Pill className={CLASS_STYLE[item.classification] ?? "bg-slate-100 text-slate-600"}>
                      {item.classification.replace(/_/g, " ")}
                    </Pill>
                    <Pill className={WASTE_STATUS_STYLE[item.status] ?? "bg-slate-100 text-slate-600"}>
                      {item.status.replace(/_/g, " ")}
                    </Pill>
                    {item.waste_code && (
                      <span className="text-[11px] font-mono text-slate-400">{item.waste_code}</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-2xl font-bold tabular-nums" style={{ color: item.dotColor }}>
                    {item.daysLeft}
                  </div>
                  <div className="text-[11px] text-slate-400">days left</div>
                </div>
              </div>

              <div className="mb-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${item.barClass}`}
                  style={{ width: `${item.pct}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Started: {fmt(item.created_at)}</span>
                <span>
                  {item.daysAccum} / {LIMIT_DAYS} days · Limit:{" "}
                  {item.limitDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>

              <div className="mt-1 text-[11px] text-slate-400">
                {item.quantity} {item.unit} · {item.disposal_contractor ?? "No contractor assigned"}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-50 bg-slate-50/50 px-5 py-3 text-[11px] text-slate-400">
          EPA 40 CFR Part 262 — SQG: 90-day limit · LQG: 90-day limit · VSQG: No time limit · Ref: 40 CFR §262.16(b)(1)
        </div>
      </Card>
    </div>
  );
}

// ── Pickup Schedule ───────────────────────────────────────────────────────────

function PickupSchedule({ streams }: { streams: WasteStream[] }) {
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay   = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  type CalEvent = { name: string; type: "disposal" | "limit"; color: string };

  const eventsByDay = useMemo<Record<number, CalEvent[]>>(() => {
    const map: Record<number, CalEvent[]> = {};
    for (const s of streams) {
      if (s.disposal_date) {
        const d = new Date(s.disposal_date);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate();
          if (!map[day]) map[day] = [];
          map[day].push({
            name: s.waste_name,
            type: "disposal",
            color: s.status === "disposed" ? "#10b981" : "#3b82f6",
          });
        }
      }
      if (s.status !== "disposed" && s.status !== "reported") {
        const start = new Date(s.created_at);
        const limitDate = new Date(start);
        limitDate.setDate(limitDate.getDate() + 90);
        if (limitDate.getFullYear() === year && limitDate.getMonth() === month) {
          const day = limitDate.getDate();
          if (!map[day]) map[day] = [];
          map[day].push({ name: s.waste_name + " — 90d limit", type: "limit", color: "#dc2626" });
        }
      }
    }
    return map;
  }, [streams, year, month]);

  const upcomingPickups = useMemo(
    () =>
      streams
        .filter((s) => s.disposal_date && new Date(s.disposal_date) >= today)
        .sort((a, b) => new Date(a.disposal_date!).getTime() - new Date(b.disposal_date!).getTime())
        .slice(0, 5),
    [streams, today],
  );

  const unscheduled = streams.filter((s) => !s.disposal_date && s.status !== "disposed" && s.status !== "reported");

  const blanks = Array(firstDay).fill(null);
  const days   = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Calendar */}
      <div className="lg:col-span-2">
        <Card>
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="font-semibold text-slate-800">
              {MONTH_NAMES[month]} {year}
            </h3>
            <div className="flex gap-1">
              <button
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 px-3 pb-3">
            <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="py-2">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {blanks.map((_, i) => (
                <div key={`b-${i}`} />
              ))}
              {days.map((day) => {
                const events = eventsByDay[day] || [];
                const isToday =
                  today.getDate() === day &&
                  today.getMonth() === month &&
                  today.getFullYear() === year;
                return (
                  <div
                    key={day}
                    className={`min-h-[56px] rounded-lg p-1.5 ${
                      isToday
                        ? "bg-blue-50 ring-1 ring-blue-200"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`text-xs font-medium ${
                        isToday ? "text-blue-700" : "text-slate-600"
                      }`}
                    >
                      {day}
                    </span>
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      {events.slice(0, 2).map((ev, i) => (
                        <div
                          key={i}
                          className="truncate rounded px-1 py-0.5 text-[9px] leading-tight text-white"
                          style={{ backgroundColor: ev.color }}
                          title={ev.name}
                        >
                          {ev.name.length > 14 ? ev.name.slice(0, 14) + "…" : ev.name}
                        </div>
                      ))}
                      {events.length > 2 && (
                        <div className="text-[9px] text-slate-400">+{events.length - 2} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-slate-50 bg-slate-50/50 px-5 py-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded" style={{ backgroundColor: "#3b82f6" }} />
              <span className="text-slate-500">Scheduled pickup</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded" style={{ backgroundColor: "#10b981" }} />
              <span className="text-slate-500">Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded" style={{ backgroundColor: "#dc2626" }} />
              <span className="text-slate-500">90-day limit</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Upcoming Pickups" subtitle="Scheduled disposal dates" />
          <div className="flex flex-col divide-y divide-slate-50">
            {upcomingPickups.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-slate-400">
                No upcoming pickups scheduled
              </div>
            ) : (
              upcomingPickups.map((s) => (
                <div key={s.id} className="px-4 py-3">
                  <div className="text-sm font-medium text-slate-700">{s.waste_name}</div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">{s.disposal_contractor ?? "—"}</span>
                    <span className="text-xs font-medium text-blue-700">{fmt(s.disposal_date)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Unscheduled Streams" subtitle="No disposal date set" />
          <div className="flex flex-col divide-y divide-slate-50">
            {unscheduled.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-slate-400">
                All active streams have scheduled dates
              </div>
            ) : (
              unscheduled.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700">{s.waste_name}</div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {s.quantity} {s.unit} · {s.disposal_contractor ?? "No contractor"}
                    </div>
                  </div>
                  <Pill className={WASTE_STATUS_STYLE[s.status] ?? "bg-slate-100 text-slate-600"}>
                    {s.status.replace(/_/g, " ")}
                  </Pill>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Manifest Archive ──────────────────────────────────────────────────────────

type ManifestFilter = "all" | "manifested" | "disposed" | "pending";

function ManifestArchive({ streams }: { streams: WasteStream[] }) {
  const [filter, setFilter] = useState<ManifestFilter>("all");

  const filtered = filter === "all" ? streams : streams.filter((s) => s.status === filter);
  const manifestedCount = streams.filter((s) => s.manifest_number).length;
  const disposedCount   = streams.filter((s) => s.status === "disposed").length;

  const FILTER_OPTIONS: { id: ManifestFilter; label: string }[] = [
    { id: "all",        label: "All" },
    { id: "manifested", label: "Manifested" },
    { id: "disposed",   label: "Disposed" },
    { id: "pending",    label: "Pending" },
  ];

  function handleDownload(stream: WasteStream) {
    const content = [
      "HAZARDOUS WASTE MANIFEST",
      "",
      `Manifest #:       ${stream.manifest_number ?? "NOT YET ASSIGNED"}`,
      `Waste Name:       ${stream.waste_name}`,
      `Waste Code:       ${stream.waste_code ?? "—"}`,
      `Classification:   ${stream.classification}`,
      `Quantity:         ${stream.quantity} ${stream.unit}`,
      `Disposal Method:  ${stream.disposal_method}`,
      `Contractor:       ${stream.disposal_contractor ?? "—"}`,
      `Disposal Date:    ${stream.disposal_date ?? "Not scheduled"}`,
      `Status:           ${stream.status}`,
      "",
      `Generated: ${new Date().toISOString()}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `manifest-${(stream.manifest_number ?? stream.id).replace(/[^a-zA-Z0-9-]/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Filter:</span>
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setFilter(opt.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === opt.id
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Manifest Archive"
          subtitle={`${manifestedCount} manifested · ${disposedCount} disposed · Full regulatory audit trail`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 text-left">Waste Stream</th>
                <th className="px-4 py-2.5 text-left">Manifest #</th>
                <th className="px-4 py-2.5 text-left">Classification</th>
                <th className="px-4 py-2.5 text-left">Qty</th>
                <th className="px-4 py-2.5 text-left">Contractor</th>
                <th className="px-4 py-2.5 text-left">Disposal Date</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Manifest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/waste/${s.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {s.waste_name}
                    </Link>
                    {s.waste_code && (
                      <div className="mt-0.5 text-xs font-mono text-slate-400">{s.waste_code}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-600">
                    {s.manifest_number ?? (
                      <span className="text-slate-300 italic">Not assigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Pill className={CLASS_STYLE[s.classification] ?? "bg-slate-100 text-slate-600"}>
                      {s.classification.replace(/_/g, " ")}
                    </Pill>
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                    {s.quantity} {s.unit}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{s.disposal_contractor ?? "—"}</td>
                  <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                    {fmt(s.disposal_date)}
                  </td>
                  <td className="px-4 py-3">
                    <Pill className={WASTE_STATUS_STYLE[s.status] ?? "bg-slate-100 text-slate-600"}>
                      {s.status.replace(/_/g, " ")}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDownload(s)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      {s.manifest_number ? "Download" : "Draft"}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                    No streams match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Schedule Task button (creates a real tracked workspace task) ──────────────
// Used by inspection/pickup "schedule" actions — these map to addWorkspaceTask,
// which inserts a row into workspace_tasks. Disabled labels are used for
// workflows that have no backing table yet (see "Coming soon" buttons below).

function ScheduleTaskButton({
  label,
  title,
  defaultTitle,
  defaultType,
  defaultDue,
  className,
}: {
  label: string;
  title: string;
  defaultTitle: string;
  defaultType: string;
  defaultDue?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await addWorkspaceTask(null, new FormData(e.currentTarget));
    if (res.ok) { playCreateSound(); setOpen(false); router.refresh(); }
    setPending(false);
  }

  const dueValue = defaultDue ? defaultDue.slice(0, 10) : "";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Field label="Task Title" required>
              <Input name="title" defaultValue={defaultTitle} required />
            </Field>
            <Field label="Notes">
              <Textarea name="notes" placeholder="Additional context or instructions…" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Type">
                <Select name="type" defaultValue={defaultType}>
                  <option value="Waste">Waste</option>
                  <option value="Audit">Audit</option>
                  <option value="General">General</option>
                </Select>
              </Field>
              <Field label="Priority">
                <Select name="priority" defaultValue="medium">
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
              </Field>
            </div>
            <Field label="Due Date">
              <Input name="due_date" type="date" defaultValue={dueValue} />
            </Field>
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}

// ── Disabled "not yet available" button — honest placeholder for workflows
// that have no backing table/action yet (QR labels, signage, posters, vendor
// management, profile-approval pipeline, iCal export, report packages). ────────

function ComingSoonButton({
  label,
  className,
  note = "Not yet available",
}: {
  label: string;
  className?: string;
  note?: string;
}) {
  return (
    <button
      type="button"
      disabled
      title={note}
      className={`cursor-not-allowed opacity-60 ${className ?? ""}`}
    >
      {label}
    </button>
  );
}

// ── Live vendor / pickup / inspection workflow primitives ─────────────────────
// Backed by waste_vendors / waste_pickups / waste_inspections via real actions.

const VENDOR_STATUS_STYLE: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700",
  pending:  "bg-amber-100 text-amber-700",
  review:   "bg-amber-100 text-amber-700",
  inactive: "bg-slate-100 text-slate-500",
  expired:  "bg-red-100 text-red-700",
};

const PICKUP_STATUS_STYLE: Record<string, string> = {
  requested: "bg-amber-100 text-amber-700",
  scheduled: "bg-blue-100 text-blue-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Add / Edit Vendor modal → addWasteVendor / updateWasteVendor
function VendorFormButton({
  mode,
  vendor,
  label,
  className,
}: {
  mode: "add" | "edit";
  vendor?: WasteVendor;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res =
      mode === "edit" && vendor
        ? await updateWasteVendor(vendor.id, fd)
        : await addWasteVendor(null, fd);
    if (res.ok) {
      playCreateSound();
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error ?? "Could not save vendor.");
    }
    setPending(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={mode === "edit" ? `Edit Vendor — ${vendor?.name ?? ""}` : "Add Waste Vendor / TSDF"}>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
            )}
            <Field label="Vendor Name" required>
              <Input name="name" defaultValue={vendor?.name ?? ""} required placeholder="Clean Harbors" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="EPA ID">
                <Input name="epa_id" defaultValue={vendor?.epa_id ?? ""} placeholder="NJD000000000" />
              </Field>
              <Field label="Status">
                <Select name="status" defaultValue={vendor?.status ?? "active"}>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="review">Under Review</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Contact Name">
                <Input name="contact_name" defaultValue={vendor?.contact_name ?? ""} placeholder="Account manager" />
              </Field>
              <Field label="Phone">
                <Input name="phone" defaultValue={vendor?.phone ?? ""} placeholder="(800) 000-0000" />
              </Field>
            </div>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={vendor?.email ?? ""} placeholder="scheduling@vendor.com" />
            </Field>
            <Field label="Services (comma-separated)">
              <Input name="services" defaultValue={(vendor?.services ?? []).join(", ")} placeholder="Hazardous disposal, Transport, TSDF" />
            </Field>
            <Field label="Permit Expiry">
              <Input name="permit_expiry" type="date" defaultValue={vendor?.permit_expiry ? vendor.permit_expiry.slice(0, 10) : ""} />
            </Field>
            <Field label="Notes">
              <Textarea name="notes" defaultValue={vendor?.notes ?? ""} placeholder="Restrictions, scope, certifications…" />
            </Field>
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}

// Schedule Pickup modal → scheduleWastePickup
function SchedulePickupButton({
  vendors,
  streams,
  label,
  className,
  prefillVendorId,
}: {
  vendors: WasteVendor[];
  streams: WasteStream[];
  label: string;
  className?: string;
  prefillVendorId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await scheduleWastePickup(null, new FormData(e.currentTarget));
    if (res.ok) {
      playCreateSound();
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error ?? "Could not schedule pickup.");
    }
    setPending(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Schedule Waste Pickup">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
            )}
            <Field label="Vendor" required>
              <Select name="vendor_id" defaultValue={prefillVendorId ?? ""} required>
                <option value="" disabled>Select a vendor…</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Waste Stream">
              <Select name="waste_stream_id" defaultValue="">
                <option value="">— Not specified —</option>
                {streams.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.waste_name}{s.waste_code ? ` (${s.waste_code})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Manifest #">
                <Input name="manifest_number" placeholder="NJ-2026-000000" />
              </Field>
              <Field label="Scheduled Date" required>
                <Input name="scheduled_date" type="date" defaultValue={todayISO()} required />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Quantity">
                <Input name="quantity" type="number" step="any" min="0" placeholder="0" />
              </Field>
              <Field label="Unit">
                <Select name="unit" defaultValue="kg">
                  <option value="kg">kg</option>
                  <option value="lb">lb</option>
                  <option value="L">L</option>
                  <option value="gal">gal</option>
                  <option value="drums">drums</option>
                </Select>
              </Field>
            </div>
            <Field label="Status">
              <Select name="status" defaultValue="requested">
                <option value="requested">Requested</option>
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
              </Select>
            </Field>
            <Field label="Notes">
              <Textarea name="notes" placeholder="Pickup window, access instructions…" />
            </Field>
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}

// Per-pickup "Mark Complete" → updateWastePickup(id, {status:"completed", completed_date: today})
function MarkPickupCompleteButton({ pickup }: { pickup: WastePickup }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("status", "completed");
    fd.set("completed_date", todayISO());
    fd.set("manifest_number", pickup.manifest_number ?? "");
    fd.set("scheduled_date", pickup.scheduled_date ?? "");
    if (pickup.quantity != null) fd.set("quantity", String(pickup.quantity));
    fd.set("unit", pickup.unit ?? "kg");
    fd.set("notes", pickup.notes ?? "");
    const res = await updateWastePickup(pickup.id, fd);
    if (res.ok) {
      playCreateSound();
      router.refresh();
    } else {
      setError(res.error ?? "Could not update pickup.");
    }
    setPending(false);
  }

  if (pickup.status === "completed") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" /> Completed
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Mark Complete"}
      </button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}

// Log Inspection modal → logWasteInspection
function LogInspectionButton({
  label,
  className,
  prefillArea,
}: {
  label: string;
  className?: string;
  prefillArea?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await logWasteInspection(null, new FormData(e.currentTarget));
    if (res.ok) {
      playCreateSound();
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error ?? "Could not log inspection.");
    }
    setPending(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Log SAA / CAA Inspection">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
            )}
            <Field label="Area" required>
              <Input name="area" defaultValue={prefillArea ?? ""} required placeholder="Chemical SAA — Lab A" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Inspection Date" required>
                <Input name="inspection_date" type="date" defaultValue={todayISO()} required />
              </Field>
              <Field label="Inspector">
                <Input name="inspector" placeholder="Inspector name" />
              </Field>
            </div>
            <Field label="Result">
              <Select name="passed" defaultValue="true">
                <option value="true">Pass</option>
                <option value="false">Fail — findings noted</option>
              </Select>
            </Field>
            <Field label="Findings">
              <Textarea name="findings" placeholder="Deficiencies, CAPA notes, observations…" />
            </Field>
            <Field label="Next Due">
              <Input name="next_due" type="date" />
            </Field>
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}

// ── WasteDashboard (main export) ──────────────────────────────────────────────

export function WasteDashboard({
  streams,
  chemicals,
  vendors,
  pickups,
  inspections,
}: {
  streams: WasteStream[];
  chemicals: Chemical[];
  vendors: WasteVendor[];
  pickups: WastePickup[];
  inspections: LiveWasteInspection[];
}) {
  const [tab, setTab] = useState<Tab>("register");
  const [expandedStream, setExpandedStream] = useState<string | null>(null);
  const [expandedInspection, setExpandedInspection] = useState<string | null>(null);

  const pending    = streams.filter((w) => w.status === "pending" || w.status === "pending_pickup").length;
  const manifested = streams.filter((w) => w.status === "manifested").length;
  const disposed   = streams.filter((w) => w.status === "disposed").length;
  const hazardous  = streams.filter((w) => w.classification === "hazardous" || w.classification === "clinical").length;

  // Readiness score: starts at 100, deduct for open issues
  const openCapas    = INSPECTIONS.reduce((n, i) => n + i.capaOpen, 0);
  const failedInsp   = INSPECTIONS.filter((i) => i.status === "fail").length;
  const trainingGaps = WASTE_TRAINING.filter((t) => t.status === "gap").length;
  const overdueComp  = COMPLIANCE_TASKS.filter((t) => t.status === "overdue").length;
  const readinessScore = Math.max(0, 100 - openCapas * 8 - failedInsp * 10 - trainingGaps * 6 - overdueComp * 5 - (pending > 0 ? 5 : 0));
  const readinessColor = readinessScore >= 80 ? "#10b981" : readinessScore >= 60 ? "#f59e0b" : "#dc2626";

  const trackedNames = new Set(streams.map((w) => w.waste_name.toLowerCase()));
  const suggestions: WasteSuggestion[] = [];
  for (const chem of chemicals) {
    if (chem.status !== "active") continue;
    const s = suggestWaste(chem);
    if (s && !trackedNames.has(chem.name.toLowerCase())) suggestions.push(s);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Readiness Score" value={`${readinessScore}%`} hint="Waste compliance score" accent={readinessColor} />
        <Stat label="Waste Streams"   value={streams.length}       hint="Tracked streams" />
        <Stat label="Hazardous"       value={hazardous}            hint="Haz + biohaz"      accent={hazardous > 0 ? "#dc2626" : "#10b981"} />
        <Stat label="Pending Pickup"  value={pending}              hint="Awaiting disposal" accent={pending > 0 ? "#f59e0b" : "#10b981"} />
        <Stat label="Open CAPAs"      value={openCapas}            hint="From inspections"  accent={openCapas > 0 ? "#f59e0b" : "#10b981"} />
      </div>

      {/* Pending alert */}
      {pending > 0 && (
        <div className="rounded-xl border-l-4 border-amber-500 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">
            {pending} Waste Stream{pending > 1 ? "s" : ""} Pending Pickup — Review Accumulation Limits
          </div>
          <div className="mt-0.5 text-xs text-amber-700">
            Ensure accumulation start dates and EPA 90/270-day limits are tracked. Contact disposal contractor.
          </div>
        </div>
      )}

      {/* Daily Action List — BL-WMP-01 */}
      {(() => {
        const actions: { priority: string; type: string; label: string; targetTab: Tab }[] = [];
        CAPAS.filter(c => c.status !== "closed").forEach(c => {
          const diff = Math.ceil((new Date(c.due).getTime() - Date.now()) / 86400000);
          if (diff <= 7) actions.push({ priority: diff <= 0 ? "critical" : "high", type: "CAPA", label: `${c.id} due ${fmt(c.due)} — ${c.title.slice(0, 55)}${c.title.length > 55 ? "…" : ""}`, targetTab: "capa" });
        });
        LABEL_CONTAINERS.filter(c => c.labelStatus !== "complete").forEach(c => {
          actions.push({ priority: c.labelStatus === "missing" ? "critical" : "medium", type: "Label", label: `${c.id} label ${c.labelStatus} — ${c.area}`, targetTab: "labels" });
        });
        COMPLIANCE_TASKS.filter(t => t.status === "overdue").forEach(t => {
          actions.push({ priority: "high", type: "Compliance", label: `OVERDUE: ${t.title}`, targetTab: "compliance" });
        });
        VENDORS.forEach(v => {
          const diff = Math.ceil((new Date(v.permitExpiry).getTime() - Date.now()) / 86400000);
          if (diff <= 90) actions.push({ priority: diff <= 30 ? "high" : "medium", type: "Vendor", label: `${v.name} TSDF permit expires ${fmt(v.permitExpiry)} — re-qualification required`, targetTab: "vendors" });
        });
        if (actions.length === 0) return null;
        return (
          <Card>
            <CardHeader
              title="Daily Action List"
              subtitle={`${actions.length} item${actions.length !== 1 ? "s" : ""} requiring attention — BL-WMP-01 Command Center`}
            />
            <div className="divide-y divide-slate-50">
              {actions.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTab(a.targetTab)}
                  className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    a.priority === "critical" ? "bg-red-500" :
                    a.priority === "high"     ? "bg-amber-500" : "bg-blue-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <span className={`mr-2 text-[10px] font-bold uppercase tracking-wide ${
                      a.priority === "critical" ? "text-red-600" :
                      a.priority === "high"     ? "text-amber-600" : "text-blue-600"
                    }`}>{a.type}</span>
                    <span className="text-xs text-slate-700">{a.label}</span>
                  </div>
                  <span className="shrink-0 mt-0.5 text-[10px] font-medium text-blue-500">→ {a.targetTab}</span>
                </button>
              ))}
            </div>
          </Card>
        );
      })()}

      {/* Tab navigation */}
      <div className="overflow-x-auto rounded-xl bg-slate-100 p-1">
        <div className="flex min-w-max gap-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                tab === id
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === "register" && (
        <div className="flex flex-col gap-4">
          {suggestions.length > 0 && (
            <Card>
              <CardHeader
                title="Inventory-Derived Waste Profiles"
                subtitle={`${suggestions.length} chemical${suggestions.length !== 1 ? "s" : ""} suggest waste streams not yet recorded — create entries to close the gap`}
                right={
                  <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    <Zap className="h-3 w-3" />
                    Inventory-driven
                  </div>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2.5 text-left">Chemical</th>
                      <th className="px-4 py-2.5 text-left">Hazard Basis</th>
                      <th className="px-4 py-2.5 text-left">Suggested Classification</th>
                      <th className="px-4 py-2.5 text-left">Disposal Method</th>
                      <th className="px-4 py-2.5 text-left">EPA Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {suggestions.map((s) => (
                      <tr key={s.chemicalId} className="hover:bg-amber-50/30">
                        <td className="px-4 py-3 font-medium text-slate-800">{s.chemicalName}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{s.reason}</td>
                        <td className="px-4 py-3">
                          <Pill className={CLASS_STYLE[s.classification] ?? "bg-slate-100 text-slate-600"}>
                            {s.classification.replace(/_/g, " ")}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-xs capitalize text-slate-600">
                          {s.disposalMethod.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-500">{s.epaCode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Profile Review Pipeline — BL-WMP-04 / BL-WMP-05 */}
          <Card>
            <CardHeader
              title="Waste Profile Review Pipeline"
              subtitle="BL-WMP-04 / BL-WMP-05 · Draft → EHS Review → Approved → Active · Reviewer approval locks profile for container assignment"
              right={
                <ComingSoonButton
                  label="AI Draft Profile (coming soon)"
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                  note="AI profile drafting is not yet available"
                />
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 text-left">Profile Name</th>
                    <th className="px-4 py-2.5 text-left">Code</th>
                    <th className="px-4 py-2.5 text-left">Ver.</th>
                    <th className="px-4 py-2.5 text-left">AI Confidence</th>
                    <th className="px-4 py-2.5 text-left">Reviewer</th>
                    <th className="px-4 py-2.5 text-left">State</th>
                    <th className="px-4 py-2.5 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {PROFILE_PIPELINE.map((p) => (
                    <tr key={p.streamId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{p.name}</td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-700">{p.code}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.version}</td>
                      <td className="px-4 py-3">
                        {p.aiGenerated && p.confidence !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                              <div className={`h-full rounded-full ${p.confidence >= 85 ? "bg-emerald-400" : p.confidence >= 70 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${p.confidence}%` }} />
                            </div>
                            <span className={`text-[10px] font-bold ${p.confidence >= 85 ? "text-emerald-600" : p.confidence >= 70 ? "text-amber-600" : "text-red-600"}`}>{p.confidence}%</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">{p.aiGenerated ? "—" : "Manual"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{p.reviewer ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Pill className={
                          p.state === "active"     ? "bg-emerald-100 text-emerald-700" :
                          p.state === "approved"   ? "bg-blue-100 text-blue-700"       :
                          p.state === "ehs_review" ? "bg-amber-100 text-amber-700"     :
                          p.state === "retired"    ? "bg-slate-100 text-slate-500"      :
                                                     "bg-slate-100 text-slate-600"
                        }>
                          {p.state === "ehs_review" ? "EHS Review" :
                           p.state.charAt(0).toUpperCase() + p.state.slice(1)}
                        </Pill>
                      </td>
                      <td className="px-4 py-3">
                        {p.state === "draft" && (
                          <ComingSoonButton
                            label="Submit for Review"
                            className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700"
                            note="Profile approval pipeline is not yet available"
                          />
                        )}
                        {p.state === "ehs_review" && (
                          <div className="flex gap-1.5">
                            <ComingSoonButton label="Approve" className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white" note="Profile approval pipeline is not yet available" />
                            <ComingSoonButton label="Reject" className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700" note="Profile approval pipeline is not yet available" />
                          </div>
                        )}
                        {(p.state === "approved" || p.state === "active") && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" /> {p.approvedDate ? `Approved ${fmt(p.approvedDate)}` : "Approved"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {PROFILE_PIPELINE.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                        No waste profiles in review — draft a profile to populate this pipeline.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-50 bg-slate-50/50 px-5 py-3 text-[10.5px] text-slate-400">
              BL-WMP-04 · AI draft requires confidence ≥ 80% before EHS submission · BL-WMP-05 · Approved profiles lock for container assignment · Version history retained on all state transitions
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Waste Stream Register"
              subtitle={`${streams.length} streams · ${hazardous} hazardous · ${manifested} manifested`}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 text-left">Waste Name</th>
                    <th className="px-4 py-2.5 text-left">Code</th>
                    <th className="px-4 py-2.5 text-left">Classification</th>
                    <th className="px-4 py-2.5 text-left">Profile State</th>
                    <th className="px-4 py-2.5 text-left">Quantity</th>
                    <th className="px-4 py-2.5 text-left">Disposal Method</th>
                    <th className="px-4 py-2.5 text-left">Contractor</th>
                    <th className="px-4 py-2.5 text-left">Disposal Date</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {streams.map((w) => {
                    const detail = STREAM_DETAILS.find((d) => d.code === w.waste_code);
                    return (
                      <React.Fragment key={w.id}>
                        <tr className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setExpandedStream(expandedStream === w.id ? null : w.id)}
                                className="shrink-0 text-slate-300 transition-colors hover:text-blue-500"
                                title="Show stream details"
                              >
                                {expandedStream === w.id ? "▾" : "▸"}
                              </button>
                              <Link href={`/waste/${w.id}`} className="font-medium text-blue-700 hover:underline">
                                {w.waste_name}
                              </Link>
                            </div>
                            {w.manifest_number && (
                              <div className="ml-4 mt-0.5 text-xs font-mono text-slate-400">
                                {w.manifest_number}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-500">
                            {w.waste_code ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Pill className={CLASS_STYLE[w.classification] ?? "bg-slate-100 text-slate-600"}>
                              {w.classification.replace(/_/g, " ")}
                            </Pill>
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const ps = w.status === "disposed" || w.status === "reported" ? "approved" :
                                         w.status === "manifested" ? "active" : "active";
                              return (
                                <Pill className={
                                  ps === "approved" ? "bg-emerald-100 text-emerald-700" :
                                  ps === "active"   ? "bg-blue-100 text-blue-700"       :
                                                      "bg-amber-100 text-amber-700"
                                }>
                                  {ps === "approved" ? "Approved" : ps === "active" ? "Active" : "Draft"}
                                </Pill>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                            {w.quantity} {w.unit}
                          </td>
                          <td className="px-4 py-3 text-xs capitalize text-slate-600">
                            {w.disposal_method.replace(/_/g, " ")}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {w.disposal_contractor ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                            {fmt(w.disposal_date)}
                          </td>
                          <td className="px-4 py-3">
                            <Pill className={WASTE_STATUS_STYLE[w.status] ?? "bg-slate-100 text-slate-600"}>
                              {w.status}
                            </Pill>
                          </td>
                        </tr>
                        {expandedStream === w.id && detail && (
                          <tr className="bg-blue-50/40">
                            <td colSpan={9} className="px-5 py-4">
                              <div className="mb-3 grid grid-cols-3 gap-4">
                                <div>
                                  <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Source Process</div>
                                  <div className="text-xs text-slate-700">{detail.sourceProcess}</div>
                                </div>
                                <div>
                                  <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Owner</div>
                                  <div className="text-xs text-slate-700">{detail.owner}</div>
                                </div>
                                <div>
                                  <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Location</div>
                                  <div className="text-xs text-slate-700">{detail.location}</div>
                                </div>
                              </div>
                              {detail.sdsLinks.length > 0 && (
                                <div className="mb-3">
                                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">SDS Documents</div>
                                  <div className="flex flex-wrap gap-2">
                                    {detail.sdsLinks.map((s) => (
                                      <span key={s.number}
                                        title="SDS document link not yet available"
                                        className="cursor-not-allowed rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-400"
                                      >
                                        {s.title} · {s.number}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {detail.uncertainty && (
                                <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                                  <div className="text-xs text-amber-800"><span className="font-semibold">Uncertainty / Assumption: </span>{detail.uncertainty}</div>
                                </div>
                              )}
                              <div>
                                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Version History</div>
                                <div className="space-y-1">
                                  {detail.versions.map((v) => (
                                    <div key={v.version} className="flex items-start gap-3 text-xs">
                                      <span className="w-8 shrink-0 font-mono text-slate-500">{v.version}</span>
                                      <span className="w-20 shrink-0 text-slate-400">{fmt(v.date)}</span>
                                      <span className="w-28 shrink-0 text-slate-500">{v.reviewer ?? "Unreviewed"}</span>
                                      <span className="text-slate-700">{v.change}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {streams.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">
                        No waste streams recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Retired / Superseded Streams — BL-WMP-03 */}
          <Card>
            <CardHeader
              title="Retired / Superseded Streams"
              subtitle="BL-WMP-03 · Historical record retained per RCRA retention requirements — do not delete"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 text-left">Stream Name</th>
                    <th className="px-4 py-2.5 text-left">Code</th>
                    <th className="px-4 py-2.5 text-left">Retired</th>
                    <th className="px-4 py-2.5 text-left">Superseded By</th>
                    <th className="px-4 py-2.5 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {RETIRED_STREAMS.map((r, i) => (
                    <tr key={i} className="opacity-60 hover:opacity-80">
                      <td className="px-4 py-3 text-sm text-slate-400 line-through">{r.name}</td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500">{r.code}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{fmt(r.retiredDate)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{r.supersededBy ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{r.reason}</td>
                    </tr>
                  ))}
                  {RETIRED_STREAMS.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                        No retired or superseded streams.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── Inspections tab ── */}
      {tab === "inspections" && (
        <div className="space-y-5">
          {/* Summary KPIs — live SAA/CAA inspection records */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Total Inspections" value={inspections.length} hint="All areas" />
            <Stat label="Passed"  value={inspections.filter(i => i.passed === true).length}  hint="Fully compliant" accent="#10b981" />
            <Stat label="Failed"  value={inspections.filter(i => i.passed === false).length} hint="Findings noted"  accent="#dc2626" />
            <Stat label="Logged 30d" value={inspections.filter(i => i.inspection_date && (Date.now() - new Date(i.inspection_date).getTime()) <= 30 * 86400000).length} hint="Recent activity" />
          </div>

          {/* Blueprint info + Log Inspection */}
          <div className="flex items-start justify-between gap-4 rounded-xl border-l-4 border-violet-500 bg-violet-50 p-4">
            <div className="text-xs text-violet-800">
              <div className="font-semibold text-sm text-violet-900 mb-1">BL-WMP-09 Inspection &amp; Audit App</div>
              SAA/CAA inspections record area, date, inspector, pass/fail result, findings, and the next due date.
              Failed inspections should be followed by a CAPA in the CAPA module.
            </div>
            <LogInspectionButton
              label="Log Inspection"
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
            />
          </div>

          {/* Live inspection records */}
          {inspections.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
              No inspections logged yet. Use “Log Inspection” to record an SAA/CAA inspection.
            </div>
          ) : (
            inspections.map((insp) => {
              const passed = insp.passed === true;
              const failed = insp.passed === false;
              return (
                <Card key={insp.id}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <ClipboardCheck className={`mt-0.5 h-5 w-5 shrink-0 ${passed ? "text-emerald-500" : failed ? "text-red-500" : "text-slate-400"}`} />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-800">{insp.area ?? "Unspecified area"}</h3>
                            <Pill className={passed ? "bg-emerald-100 text-emerald-700" : failed ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}>
                              {passed ? "Pass" : failed ? "Fail" : "—"}
                            </Pill>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Inspector: {insp.inspector ?? "—"} · {fmt(insp.inspection_date)}
                          </p>
                        </div>
                      </div>
                      {insp.next_due && (
                        <div className="shrink-0 text-right">
                          <div className="text-[10px] text-slate-400">Next due</div>
                          <div className="text-sm font-semibold text-blue-600">{fmt(insp.next_due)}</div>
                        </div>
                      )}
                    </div>
                    {insp.findings ? (
                      <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-red-600">Findings</div>
                        <p className="text-xs text-red-800">{insp.findings}</p>
                      </div>
                    ) : passed ? (
                      <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> No findings recorded
                      </div>
                    ) : null}
                  </div>
                </Card>
              );
            })
          )}

          {/* Sample inspection cards (mock display mode only) */}
          {MOCK_MODE && INSPECTIONS.map((insp) => {
            const total = insp.passed + insp.failed + insp.na;
            const passPct = total > 0 ? Math.round((insp.passed / total) * 100) : 0;
            const statusColor =
              insp.status === "pass"    ? "text-emerald-700 bg-emerald-100" :
              insp.status === "partial" ? "text-amber-700 bg-amber-100" :
                                         "text-red-700 bg-red-100";
            const barColor =
              insp.status === "pass"    ? "bg-emerald-400" :
              insp.status === "partial" ? "bg-amber-400" : "bg-red-500";
            return (
              <Card key={insp.id}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3">
                      <ClipboardCheck className={`h-5 w-5 mt-0.5 shrink-0 ${insp.status === "pass" ? "text-emerald-500" : insp.status === "partial" ? "text-amber-500" : "text-red-500"}`} />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-800">{insp.area}</h3>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase">{insp.areaType}</span>
                          <Pill className={statusColor}>{insp.status}</Pill>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">Inspector: {insp.inspector} · {fmt(insp.date)}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold text-slate-800">{passPct}%</div>
                      <div className="text-[11px] text-slate-400">pass rate</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${passPct}%` }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-emerald-600 font-semibold">{insp.passed} passed</span>
                      {insp.failed > 0 && <span className="text-[10px] text-red-600 font-semibold">{insp.failed} failed</span>}
                      <span className="text-[10px] text-slate-400">{insp.na} N/A</span>
                    </div>
                  </div>

                  {/* Findings */}
                  {insp.findings.length > 0 ? (
                    <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-red-600 mb-1">Findings / CAPAs</div>
                      {insp.findings.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-red-800">
                          <XCircle className="h-3 w-3 shrink-0 mt-0.5 text-red-500" />
                          {f}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> No findings — all items passed
                    </div>
                  )}

                  {insp.capaOpen > 0 && (
                    <div className="mt-3 text-xs text-amber-700 font-semibold">
                      {insp.capaOpen} open CAPA{insp.capaOpen > 1 ? "s" : ""} pending closure
                    </div>
                  )}

                  {insp.repeatFindings.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                      <span className="text-xs font-semibold text-orange-700">Repeat finding — escalation required</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setExpandedInspection(expandedInspection === insp.id ? null : insp.id)}
                    className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    {expandedInspection === insp.id ? "▾ Hide Checklist" : "▸ Show Checklist"} ({insp.checklistItems.length} items · {insp.photoCount} photo{insp.photoCount !== 1 ? "s" : ""})
                  </button>

                  {expandedInspection === insp.id && (
                    <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                      {insp.checklistItems.map((ci, idx) => (
                        <div key={idx} className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${
                          ci.result === "yes" ? "bg-emerald-50" : ci.result === "no" ? "bg-red-50" : "bg-slate-50"
                        }`}>
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            ci.result === "yes" ? "bg-emerald-200 text-emerald-800" :
                            ci.result === "no"  ? "bg-red-200 text-red-800"         :
                                                  "bg-slate-200 text-slate-500"
                          }`}>
                            {ci.result === "yes" ? "YES" : ci.result === "no" ? "NO" : "N/A"}
                          </span>
                          <span className={ci.result === "no" ? "font-medium text-red-800" : "text-slate-700"}>{ci.item}</span>
                        </div>
                      ))}
                      {insp.inspectorNotes && (
                        <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Inspector Notes</div>
                          <p className="text-xs text-slate-600">{insp.inspectorNotes}</p>
                        </div>
                      )}
                      {insp.repeatFindings.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                          <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600">Repeat Findings — Escalation Required</div>
                          {insp.repeatFindings.map((rf, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-800">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                              {rf}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Training & Compliance tab ── */}
      {tab === "compliance" && (
        <div className="space-y-5">

          {/* Training gaps alert */}
          {trainingGaps > 0 && (
            <div className="flex items-start gap-3 rounded-xl border-l-4 border-amber-500 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <div className="text-sm font-semibold text-amber-900">
                  {trainingGaps} Training Gap{trainingGaps > 1 ? "s" : ""} — Restricted actions blocked until resolved
                </div>
                <div className="mt-0.5 text-xs text-amber-700">
                  RCRA requires role-based waste training before personnel perform waste-related duties.
                  Restricted actions remain blocked when required training is missing.
                </div>
              </div>
            </div>
          )}

          {/* Training Matrix */}
          <Card>
            <CardHeader
              title="Waste Training Matrix"
              subtitle="BL-WMP-13 · Role-based training by waste area, type, generator category, and responsibility"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 text-left">Role</th>
                    <th className="px-4 py-2.5 text-left">Required Modules</th>
                    <th className="px-4 py-2.5 text-left">Due Date</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {WASTE_TRAINING.map((t) => (
                    <tr key={t.role} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{t.role}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {t.modules.map((m) => (
                            <span key={m} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{m}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{fmt(t.due)}</td>
                      <td className="px-4 py-3">
                        <Pill className={t.status === "current" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                          {t.status === "current" ? "Current" : "Gap — Overdue"}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Compliance Calendar */}
          <Card>
            <CardHeader
              title="Compliance Calendar"
              subtitle="BL-WMP-14 · EPA, DOT, RCRA, EPCRA, and internal obligations with owners and evidence requirements"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 text-left">Obligation</th>
                    <th className="px-4 py-2.5 text-left">Authority</th>
                    <th className="px-4 py-2.5 text-left">Frequency</th>
                    <th className="px-4 py-2.5 text-left">Due Date</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                    <th className="px-4 py-2.5 text-left">Submission Status</th>
                    <th className="px-4 py-2.5 text-left">Evidence Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {COMPLIANCE_TASKS.map((t) => (
                    <tr key={t.title} className={t.status === "overdue" ? "bg-red-50/40" : "hover:bg-slate-50"}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{t.title}</div>
                        {t.status === "overdue" && (
                          <div className="mt-0.5 text-[10px] font-semibold text-red-600">OVERDUE — Action required</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">{t.authority}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{t.freq}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{fmt(t.due)}</td>
                      <td className="px-4 py-3">
                        <Pill className={
                          t.status === "overdue"   ? "bg-red-100 text-red-700" :
                          t.status === "scheduled" ? "bg-blue-100 text-blue-700" :
                                                     "bg-emerald-100 text-emerald-700"
                        }>
                          {t.status}
                        </Pill>
                      </td>
                      <td className="px-4 py-3">
                        <Pill className={
                          t.submissionStatus === "pending"   ? "bg-amber-100 text-amber-700" :
                                                               "bg-blue-100 text-blue-700"
                        }>
                          {t.submissionStatus}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs">{t.evidenceRequired}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-slate-50 bg-slate-50/50 px-5 py-3">
              <span className="text-[10.5px] text-slate-400">BL-WMP-14 · Retention rules apply — do-not-delete status on regulated records · All exports include company, site, record ID, version, generated date, and evidence index</span>
              <ComingSoonButton
                label="Export Calendar (coming soon)"
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600"
                note="Calendar export (iCal / PDF) is not yet available"
              />
            </div>
          </Card>

          {/* Legal Register — BL-WMP-02 */}
          <Card>
            <CardHeader
              title="Legal Register &amp; Jurisdiction"
              subtitle="BL-WMP-02 · Federal baseline, state overlay, and generator category obligations for this site"
            />
            <div className="divide-y divide-slate-50">
              {[
                { authority: "EPA 40 CFR Part 262",  obligation: "Hazardous Waste Generator Standards",         category: "Federal",   status: "active",  gen: "SQG" },
                { authority: "EPA 40 CFR Part 265",  obligation: "Interim Status Standards — Storage / Containers", category: "Federal", status: "active", gen: "SQG" },
                { authority: "EPA 40 CFR Part 268",  obligation: "Land Disposal Restrictions (LDR) — All Haz Waste", category: "Federal", status: "active", gen: "All" },
                { authority: "DOT 49 CFR Parts 171–180", obligation: "Hazardous Materials Transportation",      category: "Federal",   status: "active",  gen: "All" },
                { authority: "EPCRA §312",            obligation: "Tier II Chemical Inventory Reporting",        category: "Federal",   status: "active",  gen: "All" },
                { authority: "NJ Admin. Code 7:26",  obligation: "NJ Hazardous Waste Rules — State Overlay",    category: "State",     status: "active",  gen: "SQG" },
                { authority: "NJ Admin. Code 7:1E",  obligation: "Discharge Prevention — Containment Rules",    category: "State",     status: "active",  gen: "All" },
              ].map((row) => (
                <div key={row.authority} className="flex items-start gap-4 px-5 py-3">
                  <Scale className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="font-mono text-[11px] text-slate-500">{row.authority}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${row.category === "Federal" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}>
                        {row.category}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{row.gen}</span>
                    </div>
                    <p className="text-xs text-slate-700">{row.obligation}</p>
                  </div>
                  <Pill className="bg-emerald-100 text-emerald-700">{row.status}</Pill>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-50 bg-slate-50/50 px-5 py-3 text-[10.5px] text-slate-400">
              BL-WMP-02 · Generator category: Small Quantity Generator (SQG) · State: New Jersey ·
              California overlay and client-specific stricter-rule layers configurable per site
            </div>
          </Card>

          {/* Document Retention Rules — BL-WMP-14 */}
          <Card>
            <CardHeader title="Document Retention Rules" subtitle="BL-WMP-14 · RCRA-mandated minimum retention periods — regulated records may not be deleted" />
            <div className="divide-y divide-slate-50">
              {[
                { doc: "Hazardous Waste Manifests",        period: "3 years from signature date",               authority: "40 CFR §264.74(b)" },
                { doc: "LDR Certifications",               period: "3 years from date of signature",            authority: "40 CFR §268.7"     },
                { doc: "Inspection Records",                period: "3 years",                                   authority: "40 CFR §262.11"    },
                { doc: "Training Records",                  period: "3 years (or employment + 1 year)",          authority: "40 CFR §265.16"    },
                { doc: "Biennial Waste Reports",            period: "3 years",                                   authority: "40 CFR §262.41"    },
                { doc: "Waste Profiles / Determinations",  period: "Indefinite — retained while waste on-site", authority: "Internal policy"   },
              ].map((r, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-700">{r.doc}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Minimum: {r.period}</div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 shrink-0">{r.authority}</span>
                  <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 shrink-0">DO NOT DELETE</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs text-slate-500">
            <div className="mb-1 font-semibold text-slate-600">California Overlay — Not Active</div>
            BL-WMP-02 · This site is registered in New Jersey. California-specific obligations (DTSC hazardous waste tiers, HMBPs under H&S Code §6.95, CalARP) are not applicable.
            If a California site is added, CA overlay obligations appear in this compliance calendar automatically.
          </div>

          {/* Emergency Preparedness summary */}
          <Card>
            <CardHeader
              title="Emergency Preparedness &amp; Spill Response"
              subtitle="BL-WMP-12 · Site-specific postings and emergency response asset verification"
            />
            <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
              {[
                { label: "Spill Kits",          value: "3 of 3",  status: "ok",  note: "All stocked per waste stream hazards" },
                { label: "Eyewash/Shower",       value: "2 of 2",  status: "ok",  note: "Last tested Jun 18" },
                { label: "Fire Equipment",       value: "2 of 3",  status: "gap", note: "CAA — extinguisher tag expired; CAPA open" },
                { label: "Emergency Postings",   value: "3 of 3",  status: "ok",  note: "Contact roster current" },
              ].map((item) => (
                <div key={item.label} className={`rounded-xl border p-3 ${item.status === "ok" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                  <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${item.status === "ok" ? "text-emerald-600" : "text-red-600"}`}>
                    {item.status === "ok" ? <CheckCircle2 className="h-3 w-3" /> : <Flame className="h-3 w-3" />}
                    {item.label}
                  </div>
                  <div className={`mt-1 text-xl font-bold ${item.status === "ok" ? "text-emerald-700" : "text-red-700"}`}>{item.value}</div>
                  <div className="mt-0.5 text-[10px] text-slate-500">{item.note}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Spill Kit Assignments — BL-WMP-12 */}
          <Card>
            <CardHeader title="Area-Level Spill Kit Assignments" subtitle="BL-WMP-12 · Per-area spill response kit inventory and inspection status" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 text-left">Area</th>
                    <th className="px-4 py-2.5 text-left">Kit Type</th>
                    <th className="px-4 py-2.5 text-left">Location</th>
                    <th className="px-4 py-2.5 text-left">Last Inspected</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                    <th className="px-4 py-2.5 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {SPILL_KIT_AREAS.map((k, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs font-medium text-slate-700">{k.area}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{k.kit}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{k.location}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{fmt(k.lastInspected)}</td>
                      <td className="px-4 py-3">
                        <Pill className={k.status === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                          {k.status === "ok" ? "OK" : "Attention"}
                        </Pill>
                      </td>
                      <td className="px-4 py-3">
                        <ComingSoonButton
                          label="Generate Poster"
                          className="rounded border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600"
                          note="Emergency poster generation is not yet available"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Emergency Drill Log — BL-WMP-12 */}
          <Card>
            <CardHeader
              title="Emergency Drill Log"
              subtitle="BL-WMP-12 · RCRA-required annual drills · Records retained 3 years · Follow-up drills generated for needs-improvement outcomes"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 text-left">Drill ID</th>
                    <th className="px-4 py-2.5 text-left">Date</th>
                    <th className="px-4 py-2.5 text-left">Type</th>
                    <th className="px-4 py-2.5 text-left">Location</th>
                    <th className="px-4 py-2.5 text-left">Participants</th>
                    <th className="px-4 py-2.5 text-left">Duration</th>
                    <th className="px-4 py-2.5 text-left">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {DRILL_LOG.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-[11px] text-blue-700">{d.id}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{fmt(d.date)}</td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-700">{d.type}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{d.location}</td>
                      <td className="px-4 py-3 text-xs tabular-nums text-slate-600">{d.participants} personnel</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{d.duration}</td>
                      <td className="px-4 py-3">
                        <Pill className={d.outcome === "passed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                          {d.outcome === "passed" ? "Passed" : "Needs Improvement"}
                        </Pill>
                        {d.outcome === "needs_improvement" && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-orange-700">
                            <AlertTriangle className="h-2.5 w-2.5" /> Follow-up drill auto-escalated
                          </div>
                        )}
                        {d.notes && <div className="mt-1 text-[10px] text-slate-400 max-w-xs">{d.notes.slice(0, 90)}{d.notes.length > 90 ? "…" : ""}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Spill Event Records — BL-WMP-12 */}
          <Card>
            <CardHeader
              title="Spill Event Records"
              subtitle="BL-WMP-12 · EPCRA threshold monitoring · Reportable releases routed to regulatory notification and CAPA workflow"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 text-left">Event ID</th>
                    <th className="px-4 py-2.5 text-left">Date</th>
                    <th className="px-4 py-2.5 text-left">Area</th>
                    <th className="px-4 py-2.5 text-left">Material / Volume</th>
                    <th className="px-4 py-2.5 text-left">Severity</th>
                    <th className="px-4 py-2.5 text-left">Reported</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {SPILL_EVENTS.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">No spill events recorded</td>
                    </tr>
                  ) : SPILL_EVENTS.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-[11px] text-blue-700">{s.id}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{fmt(s.date)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{s.area}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{s.material} · {s.volume}</td>
                      <td className="px-4 py-3">
                        <Pill className={
                          s.severity === "reportable" ? "bg-red-100 text-red-700" :
                          s.severity === "major"      ? "bg-amber-100 text-amber-700" :
                                                        "bg-blue-100 text-blue-700"
                        }>
                          {s.severity}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {s.reported
                          ? <span className="font-medium text-emerald-600">Reported to {s.reportedTo}</span>
                          : <span className="text-slate-400">Not required — below threshold</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Pill className={s.status === "closed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                          {s.status}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-50 bg-slate-50/50 px-5 py-3 text-[10.5px] text-slate-400">
              BL-WMP-12 · EPCRA §304/§311 reportable quantity thresholds checked automatically · All spill events generate CAPA · Records retained 3 years
            </div>
          </Card>

          {/* EPCRA Threshold Check — BL-WMP-12 */}
          <Card>
            <CardHeader
              title="EPCRA Threshold Check"
              subtitle="BL-WMP-12 · Reportable quantity screening against EPCRA §302 EHS, EPCRA §313 TRI, and CERCLA thresholds"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 text-left">Chemical</th>
                    <th className="px-4 py-2.5 text-left">CAS No.</th>
                    <th className="px-4 py-2.5 text-left">On-Site Qty</th>
                    <th className="px-4 py-2.5 text-left">RQ Threshold</th>
                    <th className="px-4 py-2.5 text-left">Program</th>
                    <th className="px-4 py-2.5 text-left">Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {EPCRA_THRESHOLDS.map((e, i) => (
                    <tr key={i} className={e.flagged ? "bg-red-50/40" : "hover:bg-slate-50"}>
                      <td className="px-4 py-3 text-xs font-medium text-slate-800">{e.chemical}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{e.cas}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">{e.qty}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{e.threshold}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{e.program}</td>
                      <td className="px-4 py-3">
                        {e.flagged
                          ? <Pill className="bg-red-100 text-red-700">Above RQ — Report Required</Pill>
                          : <Pill className="bg-emerald-100 text-emerald-700">Below RQ</Pill>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-50 bg-slate-50/50 px-5 py-3 text-[10.5px] text-slate-400">
              BL-WMP-12 · Chloroform exceeds TRI §313 reporting threshold — include in annual TRI Form R submission · Thresholds recalculated automatically when stream quantities are updated
            </div>
          </Card>
        </div>
      )}

      {tab === "accumulation" && <AccumulationTracker streams={streams} />}
      {tab === "schedule"     && <PickupSchedule streams={streams} />}

      {/* ── CAPA & Continuous Improvement tab (BL-WMP-15) ── */}
      {tab === "capa" && (
        <div className="space-y-5">
          <div className="rounded-xl border-l-4 border-orange-500 bg-orange-50 p-4 text-xs text-orange-800">
            <div className="mb-1 font-semibold text-sm text-orange-900">BL-WMP-15 CAPA &amp; Continuous Improvement</div>
            Failed inspections, spill events, overdue records, and audit findings automatically generate corrective actions.
            Each CAPA requires an owner, severity rating, due date, evidence upload, and independent verification before closure.
            Repeat findings trigger trend escalation and are surfaced in the readiness score.
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Open CAPAs"           value={CAPAS.filter(c => c.status !== "closed").length}              hint="Require action"     accent={CAPAS.filter(c => c.status !== "closed").length > 0 ? "#f59e0b" : "#10b981"} />
            <Stat label="In Progress"           value={CAPAS.filter(c => c.status === "in_progress").length}         hint="Owner actioning"    accent="#3b82f6" />
            <Stat label="Pending Verification"  value={CAPAS.filter(c => c.status === "pending_verification").length} hint="Awaiting sign-off" />
            <Stat label="Closed"                value={CAPAS.filter(c => c.status === "closed").length}              hint="Verified & closed"  accent="#10b981" />
          </div>

          {/* CAPA Trend Analysis — BL-WMP-15 */}
          <Card>
            <CardHeader title="CAPA Trend Analysis" subtitle="BL-WMP-15 · Source breakdown · Repeat finding detection · Closure rate YTD" />
            <div className="grid grid-cols-3 gap-4 p-4">
              <div className="rounded-xl border border-slate-100 p-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Source Breakdown</div>
                {(["Inspection", "Spill Event"] as const).map((src) => {
                  const count = CAPAS.filter((c) => c.source === src).length;
                  return (
                    <div key={src} className="mb-1.5 flex items-center gap-2">
                      <div className="w-20 shrink-0 text-xs text-slate-600">{src}</div>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.round((count / CAPAS.length) * 100)}%` }} />
                      </div>
                      <div className="w-4 text-xs font-semibold text-slate-700">{count}</div>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-600">Repeat Findings</div>
                {INSPECTIONS.some((i) => i.repeatFindings.length > 0) ? (
                  INSPECTIONS.filter((i) => i.repeatFindings.length > 0).flatMap((i) =>
                    i.repeatFindings.map((rf, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-xs text-amber-800">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                        <span className="leading-snug">{rf}</span>
                      </div>
                    ))
                  )
                ) : (
                  <div className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" /> No repeat findings
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-slate-100 p-3">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Closure Rate (YTD)</div>
                <div className="text-3xl font-bold text-slate-800">0%</div>
                <div className="mb-2 text-[11px] text-slate-400">0 closed of {CAPAS.length} total</div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-300" style={{ width: "0%" }} />
                </div>
                <div className="mt-2 text-[10px] text-amber-700">All {CAPAS.length} CAPAs awaiting evidence &amp; verification</div>
              </div>
            </div>
          </Card>

          {CAPAS.map((capa) => {
            const sevColor =
              capa.severity === "critical" ? "bg-red-100 text-red-700"    :
              capa.severity === "major"    ? "bg-amber-100 text-amber-700" :
                                             "bg-blue-100 text-blue-700";
            const stColor =
              capa.status === "closed"               ? "bg-emerald-100 text-emerald-700" :
              capa.status === "pending_verification" ? "bg-purple-100 text-purple-700"   :
              capa.status === "in_progress"          ? "bg-blue-100 text-blue-700"       :
                                                       "bg-slate-100 text-slate-600";
            return (
              <Card key={capa.id}>
                <div className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-400">{capa.id}</span>
                        <Pill className={sevColor}>{capa.severity}</Pill>
                        <Pill className={stColor}>{capa.status.replace(/_/g, " ")}</Pill>
                      </div>
                      <h3 className="text-sm font-bold text-slate-800">{capa.title}</h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Source: {capa.source} · {capa.sourceId} · Owner: {capa.owner}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] text-slate-400">Due</div>
                      <div className="text-sm font-bold text-slate-700">{fmt(capa.due)}</div>
                    </div>
                  </div>

                  <div className="mb-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Evidence Required</div>
                    <div className="text-xs text-slate-600">
                      {capa.evidence ?? "No evidence uploaded — action owner must provide photo or document before verification."}
                    </div>
                  </div>

                  {capa.notes && <div className="mb-4 text-xs text-slate-500">{capa.notes}</div>}

                  <div className="flex gap-2">
                    <Link
                      href="/capa"
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                    >
                      Manage in CAPA Module
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}

          <Card>
            <CardHeader title="Waste Minimization Goals" subtitle="BL-WMP-15 · Annual improvement plan — selected goals for EHS review" />
            <div className="space-y-3 p-4">
              {[
                { goal: "Reduce F001 halogenated solvent generation 15% through solvent recycling program", target: "2026-12-31", progress: 38, status: "on_track" },
                { goal: "Implement reusable container program for Lab B to reduce biohazardous packaging waste", target: "2026-09-30", progress: 65, status: "on_track" },
                { goal: "Achieve 100% label compliance across all SAA/CAA areas", target: "2026-07-31", progress: 60, status: "at_risk" },
              ].map((g, i) => (
                <div key={i} className="rounded-xl border border-slate-100 p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="text-sm text-slate-700">{g.goal}</p>
                    <Pill className={g.status === "on_track" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                      {g.status === "on_track" ? "On Track" : "At Risk"}
                    </Pill>
                  </div>
                  <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${g.status === "on_track" ? "bg-emerald-400" : "bg-amber-400"}`}
                      style={{ width: `${g.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>{g.progress}% complete</span>
                    <span>Target: {fmt(g.target)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Labels & Compatibility tab (BL-WMP-07 + BL-WMP-08) ── */}
      {tab === "labels" && (
        <div className="space-y-5">
          <div className="rounded-xl border-l-4 border-indigo-500 bg-indigo-50 p-4 text-xs text-indigo-800">
            <div className="mb-1 font-semibold text-sm text-indigo-900">BL-WMP-07 Container &amp; Label Control · BL-WMP-08 Compatibility Matrix &amp; Storage Risk</div>
            Every container requires a complete label: contents, hazards, accumulation start date, generator information, and state-specific fields.
            Labels are printed from approved waste profiles only. The compatibility matrix flags unsafe co-storage pairs from SDS hazard classes and waste codes,
            blocking shipment when critical conflicts are unresolved.
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Total Containers" value={LABEL_CONTAINERS.length}                                              hint="All areas" />
            <Stat label="Labels Complete"  value={LABEL_CONTAINERS.filter(c => c.labelStatus === "complete").length}   hint="All fields present"  accent="#10b981" />
            <Stat label="Incomplete"       value={LABEL_CONTAINERS.filter(c => c.labelStatus === "incomplete").length} hint="Missing fields"       accent="#f59e0b" />
            <Stat label="Label Missing"    value={LABEL_CONTAINERS.filter(c => c.labelStatus === "missing").length}    hint="No label on container" accent="#dc2626" />
          </div>

          <Card>
            <CardHeader
              title="Container Label Status"
              subtitle="BL-WMP-07 · Label completeness validation · Labels tied to approved waste profiles"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 text-left">Container ID</th>
                    <th className="px-4 py-2.5 text-left">Area</th>
                    <th className="px-4 py-2.5 text-left">Code</th>
                    <th className="px-4 py-2.5 text-left">Contents</th>
                    <th className="px-4 py-2.5 text-left">Hazard Class</th>
                    <th className="px-4 py-2.5 text-left">Start Date</th>
                    <th className="px-4 py-2.5 text-left">Condition</th>
                    <th className="px-4 py-2.5 text-left">Label Status</th>
                    <th className="px-4 py-2.5 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {LABEL_CONTAINERS.map((c) => (
                    <tr key={c.id} className={c.labelStatus !== "complete" ? "bg-amber-50/30" : "hover:bg-slate-50"}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{c.id}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{c.area}</td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-700">{c.code}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">{c.contents}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.hazards.map((h) => (
                            <span key={h} className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">{h}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{fmt(c.startDate)}</td>
                      <td className="px-4 py-3">
                        <Pill className={
                          c.condition === "ok"      ? "bg-emerald-100 text-emerald-700" :
                          c.condition === "damaged"  ? "bg-amber-100 text-amber-700"    :
                                                       "bg-red-100 text-red-700"
                        }>
                          {c.condition}
                        </Pill>
                        {c.photoCount > 0 && (
                          <div className="mt-1 text-[10px] text-slate-400">{c.photoCount} photo{c.photoCount > 1 ? "s" : ""}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Pill className={
                          c.labelStatus === "complete"   ? "bg-emerald-100 text-emerald-700" :
                          c.labelStatus === "incomplete" ? "bg-amber-100 text-amber-700"     :
                                                           "bg-red-100 text-red-700"
                        }>
                          {c.labelStatus === "complete" ? "Complete" : c.labelStatus === "incomplete" ? "Incomplete" : "Missing"}
                        </Pill>
                        {c.missing.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {c.missing.map((m, i) => (
                              <div key={i} className="text-[10px] text-red-700">{m}</div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <ComingSoonButton
                            label="QR / Print"
                            className="whitespace-nowrap rounded border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600"
                            note="Container label / QR generation is not yet available"
                          />
                          <ComingSoonButton
                            label="+ Photo"
                            className="whitespace-nowrap rounded border border-blue-200 px-2 py-1 text-[10px] font-medium text-blue-600"
                            note="Photo evidence upload is not yet available"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Compatibility Matrix"
              subtitle="BL-WMP-08 · Flags incompatible co-storage pairs · Risk contributes to readiness score and CAPA workflow"
            />
            <div className="space-y-3 p-4">
              {COMPAT_MATRIX.map((pair, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-4 ${
                    pair.risk === "critical" ? "border-red-200 bg-red-50"     :
                    pair.risk === "warning"  ? "border-amber-200 bg-amber-50" :
                                               "border-emerald-200 bg-emerald-50"
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <ShieldAlert className={`h-4 w-4 shrink-0 ${
                        pair.risk === "critical" ? "text-red-500"    :
                        pair.risk === "warning"  ? "text-amber-500"  : "text-emerald-500"
                      }`} />
                      <span className="text-xs font-semibold text-slate-700">{pair.a}</span>
                      <span className="text-[10px] text-slate-400 italic">vs</span>
                      <span className="text-xs font-semibold text-slate-700">{pair.b}</span>
                    </div>
                    <Pill className={
                      pair.risk === "critical" ? "bg-red-100 text-red-700"       :
                      pair.risk === "warning"  ? "bg-amber-100 text-amber-700"   :
                                                 "bg-emerald-100 text-emerald-700"
                    }>
                      {pair.risk === "critical" ? "Critical — Do Not Store Together" :
                       pair.risk === "warning"  ? "Warning — Segregation Required"   : "Compatible"}
                    </Pill>
                  </div>
                  <p className={`text-xs ${
                    pair.risk === "critical" ? "text-red-800"    :
                    pair.risk === "warning"  ? "text-amber-800"  : "text-emerald-800"
                  }`}>{pair.reason}</p>
                  <p className="mt-1.5 text-xs font-semibold text-slate-700">Required action: {pair.action}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-50 bg-slate-50/50 px-5 py-3 text-[10.5px] text-slate-400">
              BL-WMP-08 · Grounding/bonding reminders auto-generated for flammable pairs ·
              Incompatible pairs block shipment release and route to CAPA workflow
            </div>
          </Card>
        </div>
      )}
      {tab === "manifests"    && (
        <div className="flex flex-col gap-4">
          {/* LDR info banner */}
          <div className="rounded-xl border-l-4 border-blue-500 bg-blue-50 p-4 text-xs text-blue-800">
            <div className="font-semibold text-sm text-blue-900 mb-1">Transportation, Manifest &amp; LDR Workflow</div>
            Each shipment requires: pickup request → shipment readiness checklist → manifest number →
            Land Disposal Restriction (LDR) certification → return copy → disposal certificate.
            Shipment is blocked until all required evidence is confirmed.
          </div>

          {/* Live scheduled pickups / manifests — waste_pickups */}
          <Card>
            <CardHeader
              title="Scheduled Pickups &amp; Manifests"
              subtitle={`${pickups.length} pickup${pickups.length !== 1 ? "s" : ""} · ${pickups.filter(p => p.status === "completed").length} completed`}
              right={
                <SchedulePickupButton
                  vendors={vendors}
                  streams={streams}
                  label="Schedule Pickup"
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                />
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 text-left">Vendor</th>
                    <th className="px-4 py-2.5 text-left">Manifest #</th>
                    <th className="px-4 py-2.5 text-left">Scheduled</th>
                    <th className="px-4 py-2.5 text-left">Completed</th>
                    <th className="px-4 py-2.5 text-left">Qty</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pickups.map((p) => {
                    const vendor = vendors.find((v) => v.id === p.vendor_id);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs font-medium text-slate-700">{vendor?.name ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {p.manifest_number ?? <span className="italic text-slate-300">Not assigned</span>}
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums text-slate-600">{fmt(p.scheduled_date)}</td>
                        <td className="px-4 py-3 text-xs tabular-nums text-slate-600">{fmt(p.completed_date)}</td>
                        <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                          {p.quantity != null ? `${p.quantity} ${p.unit ?? ""}`.trim() : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Pill className={PICKUP_STATUS_STYLE[p.status] ?? "bg-slate-100 text-slate-600"}>
                            {p.status.replace(/_/g, " ")}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end">
                            <MarkPickupCompleteButton pickup={p} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pickups.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                        No pickups scheduled yet. Use “Schedule Pickup” to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pickup Requests + Readiness Checklist — BL-WMP-10 */}
          <Card>
            <CardHeader
              title="Pickup Requests &amp; Shipment Readiness"
              subtitle="BL-WMP-10 · Submit → confirm → readiness check → release · Shipment blocked until all items confirmed"
              right={
                <ScheduleTaskButton
                  label="+ New Request"
                  title="New Pickup Request"
                  defaultTitle="Arrange waste pickup with disposal contractor"
                  defaultType="Waste"
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                />
              }
            />
            <div className="space-y-4 p-4">
              {PICKUP_REQUESTS.map((req) => {
                const doneCount = req.readiness.filter(r => r.done).length;
                const ready = doneCount === req.readiness.length;
                return (
                  <div key={req.id} className={`rounded-xl border p-4 ${ready ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/30"}`}>
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[11px] text-slate-400">{req.id}</span>
                          <Pill className={req.status === "confirmed" ? "bg-blue-100 text-blue-700" : req.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>
                            {req.status}
                          </Pill>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-800">{req.vendor}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {req.streams.map((s) => <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{s}</span>)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[10px] text-slate-400">Scheduled</div>
                        <div className="text-sm font-semibold text-slate-700">{fmt(req.confirmedDate ?? req.requestedDate)}</div>
                        <div className="mt-1 text-[11px] font-bold" style={{ color: ready ? "#10b981" : "#f59e0b" }}>
                          {doneCount}/{req.readiness.length} ready
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {req.readiness.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {item.done
                            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            : <XCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                          <span className={item.done ? "text-slate-600" : "font-medium text-amber-700"}>{item.item}</span>
                        </div>
                      ))}
                    </div>
                    {!ready && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
                        Shipment release is blocked until all readiness checklist items are confirmed.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Manifest Return Copies + Discrepancy Log — BL-WMP-10 */}
          <Card>
            <CardHeader
              title="Manifest Return Copies &amp; Discrepancy Log"
              subtitle="BL-WMP-10 · Generator must receive signed return copy within 35 days · Exception reporting required for discrepancies"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 text-left">Manifest #</th>
                    <th className="px-4 py-2.5 text-left">Waste Stream</th>
                    <th className="px-4 py-2.5 text-left">Pickup Date</th>
                    <th className="px-4 py-2.5 text-left">Return Copy</th>
                    <th className="px-4 py-2.5 text-left">Discrepancy</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[
                    { manifest: "NJ-2026-007412", stream: "F001 Halogenated Solvents", pickup: "2026-04-28", returnCopy: "2026-05-01" as string | null, discrepancy: null as string | null, status: "closed" },
                    { manifest: "NJ-2026-005884", stream: "F003 Non-Halogenated Solvents", pickup: "2026-06-01", returnCopy: null as string | null, discrepancy: "Return copy not received — day 21 of 35-day window. Follow up required.", status: "open" },
                  ].map((row) => (
                    <tr key={row.manifest} className={row.status === "open" ? "bg-amber-50/30" : "hover:bg-slate-50"}>
                      <td className="px-4 py-3 font-mono text-xs text-blue-700">{row.manifest}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{row.stream}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{fmt(row.pickup)}</td>
                      <td className="px-4 py-3 text-xs">
                        {row.returnCopy
                          ? <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> {fmt(row.returnCopy)}</span>
                          : <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3 w-3" /> Pending</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{row.discrepancy ?? <span className="text-slate-300">None</span>}</td>
                      <td className="px-4 py-3">
                        <Pill className={row.status === "closed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>{row.status}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <ManifestArchive streams={streams} />
        </div>
      )}

      {/* ── Storage Areas tab ── */}
      {tab === "storage" && (
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Accumulation Areas" value={STORAGE_AREAS.length} hint="SAA + Central" />
            <Stat label="Active Containers" value={STORAGE_AREAS.reduce((n, a) => n + a.containers.length, 0)} hint="All areas combined" />
            <Stat label="Needs Attention" value={STORAGE_AREAS.filter(a => a.status !== "ok").length} hint="Fill > 60% or overdue inspect" />
            <Stat label="Last Full Inspection" value="Jun 18" hint="All areas current" />
          </div>

          {/* Site Area Map — BL-WMP-06 */}
          <Card>
            <CardHeader title="Site Area Map" subtitle="BL-WMP-06 · All accumulation areas by location — owners, fill levels, and waste codes at a glance" />
            <div className="p-4 grid grid-cols-3 gap-3">
              {STORAGE_AREAS.map((area) => (
                <div key={area.id} className={`rounded-xl border p-3 ${area.status === "ok" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                  <div className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${area.status === "ok" ? "text-emerald-600" : "text-amber-600"}`}>
                    {area.type === "Satellite Accumulation Area" ? "SAA" : "CAA"} · {area.genCategory}
                  </div>
                  <div className="text-xs font-bold text-slate-800">{area.name}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{area.room} · {area.owner}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {area.contents.map((c) => (
                      <span key={c} className="rounded bg-white px-1.5 py-0.5 font-mono text-[9px] text-red-700 border border-red-100">{c.split(" ")[0]}</span>
                    ))}
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-white/60 overflow-hidden">
                    <div className={`h-full rounded-full ${area.fill >= 70 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${area.fill}%` }} />
                  </div>
                  <div className="mt-0.5 text-[9px] text-slate-400">{area.fill}% full · Next: {fmt(area.nextInspection)}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Area cards */}
          {STORAGE_AREAS.map((area) => (
            <Card key={area.id}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Warehouse className={`h-5 w-5 mt-0.5 shrink-0 ${area.status === "ok" ? "text-emerald-500" : "text-amber-500"}`} />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-800">{area.name}</h3>
                        <span className="text-xs text-slate-400">{area.room}</span>
                        <Pill className={area.status === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                          {area.status === "ok" ? "OK" : "Attention"}
                        </Pill>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{area.type} · Capacity: {area.capacity}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1.5">
                    <div>
                      <div className="text-[10px] text-slate-400">Area Owner</div>
                      <div className="text-xs font-semibold text-slate-700">{area.owner}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Last inspected</div>
                      <div className="text-xs font-semibold text-slate-600">{fmt(area.lastInspection)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Next inspection</div>
                      <div className="text-xs font-semibold text-blue-600">{fmt(area.nextInspection)}</div>
                    </div>
                  </div>
                </div>

                {/* Fill bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">Fill level</span>
                    <span className={`text-xs font-bold ${area.fill >= 70 ? "text-amber-600" : "text-emerald-600"}`}>{area.fill}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full transition-all ${area.fill >= 70 ? "bg-amber-400" : "bg-emerald-400"}`}
                      style={{ width: `${area.fill}%` }}
                    />
                  </div>
                </div>

                {area.fill >= 80 && (
                  <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                    <div className="text-xs font-semibold text-red-800">Volume limit alert — {area.fill}% full. Coordinate pickup before limit is reached.</div>
                  </div>
                )}

                {/* Risk score + signage + containment */}
                <div className="mb-4 grid grid-cols-3 gap-3">
                  <div className={`rounded-xl border p-3 text-center ${area.riskScore >= 50 ? "border-amber-200 bg-amber-50" : area.riskScore >= 30 ? "border-blue-100 bg-blue-50" : "border-emerald-200 bg-emerald-50"}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Area Risk</div>
                    <div className={`text-2xl font-bold ${area.riskScore >= 50 ? "text-amber-600" : area.riskScore >= 30 ? "text-blue-600" : "text-emerald-600"}`}>{area.riskScore}</div>
                    <div className="text-[10px] text-slate-400">/100</div>
                  </div>
                  <div className={`rounded-xl border p-3 text-center ${area.signage === "ok" ? "border-emerald-200 bg-emerald-50" : area.signage === "damaged" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
                    <div className={`text-[10px] font-bold uppercase tracking-wide mb-0.5 ${area.signage === "ok" ? "text-emerald-600" : area.signage === "damaged" ? "text-amber-600" : "text-red-600"}`}>Signage</div>
                    <div className={`text-sm font-bold ${area.signage === "ok" ? "text-emerald-700" : area.signage === "damaged" ? "text-amber-700" : "text-red-700"}`}>
                      {area.signage === "ok" ? "Posted OK" : area.signage === "damaged" ? "Damaged" : "Missing"}
                    </div>
                  </div>
                  <div className={`rounded-xl border p-3 text-center ${area.containment === "ok" ? "border-emerald-200 bg-emerald-50" : area.containment === "attention" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
                    <div className={`text-[10px] font-bold uppercase tracking-wide mb-0.5 ${area.containment === "ok" ? "text-emerald-600" : area.containment === "attention" ? "text-amber-600" : "text-red-600"}`}>Containment</div>
                    <div className={`text-sm font-bold ${area.containment === "ok" ? "text-emerald-700" : area.containment === "attention" ? "text-amber-700" : "text-red-700"}`}>
                      {area.containment === "ok" ? "OK" : area.containment === "attention" ? "Attention" : "Fail"}
                    </div>
                  </div>
                </div>

                {/* Generator category + volume/time limits */}
                <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-600">Generator Category: {area.genCategory}</span>
                  {" · "}
                  {area.type === "Satellite Accumulation Area"
                    ? "SAA: ≤ 55 gal / 208 L per waste code · No time limit until full · Must be at/near point of generation · No permit required"
                    : "CAA: SQG 180-day limit · Unlimited quantity for SQG · Weekly inspection required · Emergency coordinator designation required"}
                </div>

                {/* Waste codes */}
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {area.contents.map((c) => (
                    <span key={c} className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-700">{c}</span>
                  ))}
                </div>

                {/* Container table */}
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                        <th className="px-3 py-2 text-left">Container ID</th>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Waste Code</th>
                        <th className="px-3 py-2 text-left">Volume / Mass</th>
                        <th className="px-3 py-2 text-left">Date Started</th>
                        <th className="px-3 py-2 text-left">Label</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {area.containers.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-blue-700">{c.id}</td>
                          <td className="px-3 py-2 text-slate-600">{c.type}</td>
                          <td className="px-3 py-2">
                            <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono font-semibold text-red-700">{c.code}</span>
                          </td>
                          <td className="px-3 py-2 tabular-nums text-slate-600">{c.vol}</td>
                          <td className="px-3 py-2 tabular-nums text-slate-500">{fmt(c.filled)}</td>
                          <td className="px-3 py-2">
                            {(() => {
                              const lc = LABEL_CONTAINERS.find(l => l.id === c.id);
                              if (!lc) return <span className="text-[10px] text-slate-400">—</span>;
                              return (
                                <Pill className={
                                  lc.labelStatus === "complete"   ? "bg-emerald-100 text-emerald-700" :
                                  lc.labelStatus === "incomplete" ? "bg-amber-100 text-amber-700"     :
                                                                    "bg-red-100 text-red-700"
                                }>
                                  {lc.labelStatus === "complete" ? "OK" : lc.labelStatus === "incomplete" ? "Incomplete" : "Missing"}
                                </Pill>
                              );
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex gap-2">
                  <ComingSoonButton
                    label="Signage Package"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600"
                    note="Signage package generation is not yet available"
                  />
                  <LogInspectionButton
                    label="Schedule Inspection"
                    prefillArea={area.name}
                    className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Vendors / TSDF tab ── */}
      {tab === "vendors" && (
        <div className="space-y-5">
          <div className="rounded-xl border-l-4 border-blue-500 bg-blue-50 p-4 text-xs text-blue-800">
            <div className="font-semibold text-sm text-blue-900 mb-1">BL-WMP-11 Vendor / Transporter / TSDF Approval</div>
            Approved/current status required before pickup release.
            Vendor profile includes service scope, licenses, permits, insurance, restrictions, and expiration dates.
            Shipments are blocked when TSDF permit evidence is missing or expired.
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Vendors"          value={vendors.length}                                          hint="On file" />
            <Stat label="Active"           value={vendors.filter(v => v.status === "active").length}        hint="Approved status"  accent="#10b981" />
            <Stat label="Permit Expiring"  value={vendors.filter(v => v.permit_expiry && (new Date(v.permit_expiry).getTime() - Date.now()) <= 90 * 86400000).length} hint="≤ 90 days"  accent="#f59e0b" />
            <Stat label="Needs Review"     value={vendors.filter(v => v.status !== "active").length}        hint="Pending / inactive" />
          </div>

          {/* Live approved vendors / TSDF — waste_vendors */}
          <Card>
            <CardHeader
              title="Approved Vendors / TSDF"
              subtitle={`${vendors.length} vendor${vendors.length !== 1 ? "s" : ""} on file`}
              right={
                <VendorFormButton
                  mode="add"
                  label="Add Vendor"
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                />
              }
            />
            <div className="divide-y divide-slate-50">
              {vendors.map((v) => {
                const permitDays = v.permit_expiry ? Math.ceil((new Date(v.permit_expiry).getTime() - Date.now()) / 86400000) : null;
                const permitExpired = permitDays != null && permitDays <= 0;
                const permitExpiring = permitDays != null && permitDays > 0 && permitDays <= 90;
                return (
                  <div key={v.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Truck className="h-4 w-4 shrink-0 text-blue-500" />
                        <h3 className="text-sm font-bold text-slate-800">{v.name}</h3>
                        <Pill className={VENDOR_STATUS_STYLE[v.status] ?? "bg-slate-100 text-slate-600"}>
                          {v.status.replace(/_/g, " ")}
                        </Pill>
                      </div>
                      <div className="mt-1 grid grid-cols-1 gap-x-6 gap-y-0.5 text-xs text-slate-500 sm:grid-cols-2">
                        <span>EPA ID: <span className="font-mono text-slate-600">{v.epa_id ?? "—"}</span></span>
                        <span>Contact: {v.contact_name ?? "—"}</span>
                        {v.phone && (
                          <span className="flex items-center gap-1 text-blue-600"><PhoneCall className="h-3 w-3" />{v.phone}</span>
                        )}
                        <span className={permitExpired ? "font-semibold text-red-600" : permitExpiring ? "font-semibold text-amber-600" : ""}>
                          Permit: {fmt(v.permit_expiry)}{permitExpired ? " — EXPIRED" : permitExpiring ? ` — ${permitDays}d` : ""}
                        </span>
                      </div>
                      {v.services.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {v.services.map((s) => (
                            <span key={s} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <SchedulePickupButton
                        vendors={vendors}
                        streams={streams}
                        prefillVendorId={v.id}
                        label="Schedule pickup"
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                      />
                      <VendorFormButton
                        mode="edit"
                        vendor={v}
                        label="Edit"
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                      />
                      {v.email && (
                        <a
                          href={`mailto:${v.email}`}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                          Contact
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
              {vendors.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-slate-400">
                  No vendors on file. Use “Add Vendor” to register a disposal vendor or TSDF.
                </div>
              )}
            </div>
          </Card>

          {/* Sample vendor profiles (mock display mode only) */}
          {MOCK_MODE && VENDORS.map((v) => (
            <Card key={v.id}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Truck className="h-5 w-5 mt-0.5 shrink-0 text-blue-500" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-800">{v.name}</h3>
                        <Pill className="bg-emerald-100 text-emerald-700">{v.specialty}</Pill>
                        {v.dot && (
                          <span className="flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                            <CheckCircle2 className="h-3 w-3" /> DOT Certified
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">License: {v.license}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    {[1,2,3,4,5].map((s) => (
                      <span key={s} className={`text-sm ${s <= v.rating ? "text-amber-400" : "text-slate-200"}`}>★</span>
                    ))}
                  </div>
                </div>

                {/* License / permit / insurance expiry badges — BL-WMP-11 */}
                <div className="mb-4 grid grid-cols-3 gap-3">
                  {[
                    { label: "License", expires: v.licenseExpiry },
                    { label: "Permit",  expires: v.permitExpiry  },
                    { label: "Insurance", expires: v.insuranceExpiry },
                  ].map(({ label, expires }) => {
                    const daysLeft = Math.ceil((new Date(expires).getTime() - Date.now()) / 86400000);
                    const isExpired  = daysLeft <= 0;
                    const isExpiring = daysLeft <= 90 && !isExpired;
                    return (
                      <div key={label} className={`rounded-xl border px-3 py-2.5 text-center ${isExpired ? "border-red-200 bg-red-50" : isExpiring ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50"}`}>
                        <div className={`text-[10px] font-bold uppercase tracking-wide ${isExpired ? "text-red-600" : isExpiring ? "text-amber-600" : "text-slate-400"}`}>{label}</div>
                        <div className={`mt-0.5 text-xs font-semibold ${isExpired ? "text-red-700" : isExpiring ? "text-amber-700" : "text-slate-600"}`}>{fmt(expires)}</div>
                        <div className={`mt-0.5 text-[10px] font-bold ${isExpired ? "text-red-600" : isExpiring ? "text-amber-600" : "text-emerald-600"}`}>
                          {isExpired ? "EXPIRED" : `${daysLeft}d`}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4 mb-4">
                  {[
                    { label: "Contact", value: v.contact },
                    { label: "Last Pickup", value: v.lastPickup ? fmt(v.lastPickup) : "No prior pickups" },
                    { label: "Next Scheduled", value: v.nextPickup ? fmt(v.nextPickup) : "Not scheduled" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
                      <div className="mt-0.5 text-xs text-slate-700">{value}</div>
                    </div>
                  ))}
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Contact</div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-blue-600">
                      <PhoneCall className="h-3 w-3" />{v.phone}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Managed Waste Streams</div>
                  <div className="flex flex-wrap gap-1.5">
                    {v.streams.map((s) => (
                      <span key={s} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{s}</span>
                    ))}
                  </div>
                </div>

                {v.restrictions.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Restrictions</div>
                    <div className="space-y-0.5">
                      {v.restrictions.map((r, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                          <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />{r}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Disposal Certificates</span>
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{v.disposalCertCount} on file</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <ScheduleTaskButton
                    label="Schedule Pickup"
                    title={`Schedule Pickup — ${v.name}`}
                    defaultTitle={`Schedule waste pickup with ${v.name}`}
                    defaultType="Waste"
                    defaultDue={v.nextPickup}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                  />
                  <ComingSoonButton
                    label="Evidence Package"
                    className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700"
                    note="Vendor evidence package export is not yet available"
                  />
                  {v.email && (
                    <a
                      href={`mailto:${v.email}`}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      Contact Vendor
                    </a>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Reports / Audit Binder tab (BL-WMP-16) ── */}
      {tab === "reports" && (
        <div className="space-y-5">
          <div className="rounded-xl border-l-4 border-teal-500 bg-teal-50 p-4 text-xs text-teal-800">
            <div className="mb-1 font-semibold text-sm text-teal-900">BL-WMP-16 Reports, Audit Binder &amp; Closeout</div>
            Export packages for EHS leadership, regulators, clients, and auditors.
            Every export includes: company, site, record ID, version, generated date/time, reviewer, approval status,
            source data, open exceptions, and evidence index. Reports render without broken links, clipping, or missing evidence.
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Waste Program Dashboard Snapshot",  desc: "Readiness score, KPIs, open CAPAs, upcoming deadlines, and training gaps",           ready: true },
              { title: "Waste Stream Register",             desc: "All streams with classification, profile state, SDS links, and version history",       ready: true },
              { title: "Waste Profile Package",             desc: "Approved profiles with determination basis, reviewer, SDS references, and audit trail", ready: true },
              { title: "SAA / CAA Area Report",             desc: "Area map, containers, fill levels, inspection history, and open items by area",         ready: true },
              { title: "Container Inventory",               desc: "All active containers with label status, waste codes, start dates, and open issues",     ready: true },
              { title: "Compatibility Matrix Report",       desc: "Full compatibility analysis with risk ratings and segregation requirements",             ready: true },
              { title: "Shipment & Disposal Package",       desc: "Manifests, LDR certs, return copies, disposal certificates, and discrepancies",         ready: true },
              { title: "Vendor / TSDF File",                desc: "Approved vendors, licenses, permit evidence, expiration dates, and performance",         ready: true },
              { title: "Training Report",                   desc: "Role-based matrix, completion status, expiration dates, and gap list",                   ready: true },
              { title: "CAPA Report",                       desc: "All corrective actions with owner, severity, evidence status, and trend analysis",       ready: openCapas > 0 },
              { title: "Annual WMP Review",                 desc: "Full Waste Management Program review with improvement plan and leadership sign-off",      ready: WMP_REVIEWERS.every(r => r.signed) },
              { title: "Final Audit Binder",                desc: "Complete regulatory package — all records, manifests, training, CAPAs, and evidence",    ready: WMP_REVIEWERS.every(r => r.signed) },
            ].map((r) => (
              <div key={r.title} className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm text-slate-800">{r.title}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{r.desc}</div>
                  </div>
                  <Pill className={r.ready ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}>
                    {r.ready ? "Ready" : "Pending"}
                  </Pill>
                </div>
                <button
                  type="button"
                  disabled
                  title="Report package export is not yet available"
                  className="flex cursor-not-allowed items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400"
                >
                  <Download className="h-3 w-3" />
                  Export — coming soon
                </button>
              </div>
            ))}
          </div>

          {/* Annual WMP Review Sign-Off Workflow — BL-WMP-16 */}
          <Card>
            <CardHeader
              title="Annual WMP Review — Leadership Sign-Off"
              subtitle={`BL-WMP-16 · ${WMP_REVIEWERS.filter(r => r.signed).length} of ${WMP_REVIEWERS.length} reviewers signed · ${WMP_SECTIONS.filter(s => s.status === "reviewed").length} of ${WMP_SECTIONS.length} sections acknowledged`}
              right={
                <Pill className={WMP_REVIEWERS.every(r => r.signed) ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                  {WMP_REVIEWERS.every(r => r.signed) ? "Fully Signed" : `${WMP_REVIEWERS.filter(r => r.signed).length}/${WMP_REVIEWERS.length} Signed`}
                </Pill>
              }
            />
            <div className="grid grid-cols-1 gap-3 px-5 pb-4 sm:grid-cols-3">
              {WMP_REVIEWERS.map((rev) => (
                <div key={rev.name} className={`rounded-xl border p-3 ${rev.signed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-800">{rev.name}</div>
                      <div className="text-[10px] text-slate-500">{rev.role}</div>
                    </div>
                    {rev.signed
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    }
                  </div>
                  {rev.signed ? (
                    <div className="mt-2 text-[10px] font-semibold text-emerald-600">Signed {fmt(rev.signedDate)}</div>
                  ) : (
                    <ComingSoonButton
                      label="Pending Sign-Off"
                      className="mt-2 w-full rounded-lg border border-amber-300 bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700"
                      note="Leadership sign-off workflow is not yet available"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100">
              <div className="divide-y divide-slate-50">
                {WMP_SECTIONS.map((s) => (
                  <div key={s.id} className="flex items-start gap-3 px-5 py-3">
                    {s.status === "reviewed"
                      ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-700">{s.title}</div>
                      <div className="mt-0.5 text-[10px] text-slate-400">{s.notes}</div>
                    </div>
                    {s.reviewer && <span className="shrink-0 text-[10px] text-slate-400">{s.reviewer}</span>}
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-slate-50 bg-slate-50/50 px-5 py-3 text-[10.5px] text-slate-400">
              BL-WMP-16 · All 3 reviewers must sign before Annual WMP Review export is released · Sign-off timestamps retained in the audit record
            </div>
          </Card>

          {/* Final Audit Binder Assembly — BL-WMP-16 */}
          <Card>
            <CardHeader
              title="Final Audit Binder — Evidence Index &amp; Assembly"
              subtitle="BL-WMP-16 · Complete regulatory package · All sources must be confirmed before binder compilation is enabled"
            />
            <div className="space-y-2.5 p-4">
              {[
                { category: "Waste Stream Register & Profiles",        sources: 5,  confirmed: true,  note: "All active profiles with version history and determination basis" },
                { category: "SAA/CAA Inspection Records",              sources: 3,  confirmed: true,  note: "3-year rolling retention · INS-2026-020 through INS-2026-022" },
                { category: "CAPA Log with Evidence",                  sources: 3,  confirmed: true,  note: "3 CAPAs · Evidence required before closure · Trend analysis included" },
                { category: "Manifest Archive & Return Copies",        sources: 2,  confirmed: false, note: "NJ-2026-005884 return copy pending — day 21 of 35-day window" },
                { category: "Vendor / TSDF Approval File",             sources: 3,  confirmed: true,  note: "Licenses, permits, and insurance certs · Veolia re-qual in progress" },
                { category: "Training Records by Role",                sources: 5,  confirmed: true,  note: "5 roles · 2 training gaps noted · Remediation evidence required" },
                { category: "Compliance Calendar & Submissions",       sources: 10, confirmed: true,  note: "All 10 obligations documented · Overdue inspection flagged" },
                { category: "Emergency Plans, Drills & Spill Records", sources: 4,  confirmed: true,  note: "Drill log, spill events, contact roster, and asset inventory" },
                { category: "Annual WMP Review & Leadership Sign-Off", sources: 1,  confirmed: false, note: "Site Director approval pending — 2 of 3 reviewers signed" },
                { category: "Waste Minimization Improvement Plan",     sources: 3,  confirmed: true,  note: "3 minimization goals with progress and target dates" },
              ].map((ev) => (
                <div key={ev.category} className={`flex items-start gap-3 rounded-xl border p-3 ${ev.confirmed ? "border-slate-100 bg-slate-50" : "border-amber-200 bg-amber-50/60"}`}>
                  {ev.confirmed
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-700">{ev.category}</span>
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{ev.sources} source{ev.sources !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">{ev.note}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 px-5 py-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Binder readiness</span>
                <span className="text-xs font-bold text-amber-600">8 / 10 sources confirmed</span>
              </div>
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-4/5 rounded-full bg-amber-400 transition-all" />
              </div>
              <button
                type="button"
                disabled
                className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400"
              >
                <Download className="h-3.5 w-3.5" />
                Compile &amp; Download Audit Binder — 2 sources unconfirmed
              </button>
            </div>
            <div className="border-t border-slate-50 bg-slate-50/50 px-5 py-3 text-[10.5px] text-slate-400">
              BL-WMP-16 · Compilation blocked until all evidence sources confirmed · Export includes company, site, record IDs, version, generated date/time, reviewer, and evidence index
            </div>
          </Card>

          <Card>
            <CardHeader title="Audit Binder Checklist" subtitle="Required evidence for a complete regulatory audit binder — BL-WMP-16" />
            <div className="divide-y divide-slate-50">
              {[
                { item: "Waste Stream Register — all active, retired, and superseded profiles",   done: true },
                { item: "Waste Determination Basis — SDS, process knowledge, analytical records", done: true },
                { item: "SAA/CAA Area Map and Emergency Asset Inventory",                         done: true },
                { item: "Inspection Records — 3-year rolling retention",                          done: true },
                { item: "CAPA Log — open and closed with evidence and verification",              done: true },
                { item: "Manifest Archive — return copies and disposal certificates on file",     done: true },
                { item: "Training Records — by role, completion date, and certificate",           done: true },
                { item: "Vendor / TSDF Approval File — licenses, permits, and expiration dates", done: true },
                { item: "Compliance Calendar — obligations, evidence, and submission history",    done: true },
                { item: "Annual WMP Review — improvement plan and leadership sign-off",           done: false },
              ].map((row) => (
                <div key={row.item} className="flex items-start gap-3 px-5 py-3">
                  {row.done
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  }
                  <span className={`text-xs ${row.done ? "text-slate-700" : "text-slate-500"}`}>{row.item}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}
