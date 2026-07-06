"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { PageHeader, Card, CardHeader, Stat, Pill } from "@/components/ui/primitives";
import { X, Download, AlertTriangle, Printer, ChevronDown, ChevronUp, ExternalLink, Plus } from "lucide-react";
import type { OshaCase, OshaClassification, OshaInjuryType, Incident } from "@/lib/types";
import { addOshaCaseToStore } from "@/lib/actions/ehs";
import { OSHA_FTE, OSHA_HOURS_WORKED, OSHA_DART_BENCHMARK } from "@/lib/osha";
import { computeOsha300ASummary, type Osha300ASummary } from "@/lib/osha/osha300a";

// OSHA recordkeeping rate constants are real; establishment identity comes from the
// live tenant/onboarding profile. Fields with no live source render blank (user fills).
type EstInfo = {
  name: string; ein: string; street: string; city: string; state: string; zip: string;
  naics: string; industry: string; employees: number; hours: number; benchDart: number;
  ehsContact: string; employeesConfigured: boolean; hoursConfigured: boolean;
};
interface EstablishmentProp {
  name: string; industry: string | null; siteName: string | null; state: string | null;
  country: string | null; contactName: string | null; contactTitle: string | null;
  contactEmail: string | null; contactPhone: string | null;
}

const CLASS_LABEL: Record<OshaClassification, string> = {
  days_away:        "Days Away",
  restricted:       "Restricted/Transfer",
  other_recordable: "Other Recordable",
  fatality:         "Fatality",
};
const CLASS_STYLE: Record<OshaClassification, string> = {
  days_away:        "bg-red-100 text-red-700",
  restricted:       "bg-amber-100 text-amber-700",
  other_recordable: "bg-blue-100 text-blue-700",
  fatality:         "bg-red-900 text-white",
};
const INJURY_LABEL: Record<OshaInjuryType, string> = {
  injury:        "Injury",
  skin_disorder: "Skin Disorder",
  respiratory:   "Respiratory",
  poisoning:     "Poisoning",
  hearing_loss:  "Hearing Loss",
  other_illness: "Other Illness",
};
const CLASSIFICATIONS: OshaClassification[] = ["days_away", "restricted", "other_recordable", "fatality"];
const INJURY_TYPES:    OshaInjuryType[]     = ["injury", "skin_disorder", "respiratory", "poisoning", "hearing_loss", "other_illness"];

function fmt(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Recordability Guidance ─────────────────────────────────────────────────────

function RecordabilityGuide({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-blue-800">📋 Recordability Determination Guide</span>
          <Pill className="bg-blue-100 text-blue-700 text-[10px]">29 CFR 1904.7</Pill>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-blue-500" /> : <ChevronDown className="h-4 w-4 text-blue-500" />}
      </button>
      {open && (
        <div className="border-t border-blue-200 px-4 pb-4 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-red-700">✗ Recordable Cases</div>
              <ul className="space-y-1 text-xs text-red-800">
                <li>• Medical treatment beyond first aid</li>
                <li>• Days away from work</li>
                <li>• Restricted work or job transfer</li>
                <li>• Loss of consciousness</li>
                <li>• Diagnosis of a significant injury/illness by a physician</li>
                <li>• Work-related hearing loss (STS)</li>
                <li>• Needlestick / sharps injury with blood exposure</li>
                <li>• Positive TB test result due to occupational exposure</li>
              </ul>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-green-700">✓ First Aid Only (NOT Recordable)</div>
              <ul className="space-y-1 text-xs text-green-800">
                <li>• Non-prescription medication at nonprescription strength</li>
                <li>• Tetanus immunization</li>
                <li>• Cleaning, flushing, or soaking wounds on skin surface</li>
                <li>• Wound closures (bandages, butterfly, steri-strips)</li>
                <li>• Hot or cold therapy</li>
                <li>• Non-rigid means of support (elastic bandage)</li>
                <li>• Temporary immobilization (splint) of first aid type</li>
                <li>• Drilling fingernail or toenail for relief of pressure</li>
                <li>• Eye patches</li>
                <li>• Removing splinters by simple means</li>
                <li>• Finger guards</li>
                <li>• Massages</li>
                <li>• Drinking fluids for heat stress relief</li>
              </ul>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              { label: "Fatality — OSHA Reporting", text: "Report within 8 hours by phone to OSHA. 1-800-321-OSHA", color: "bg-red-100 text-red-800 border-red-200" },
              { label: "Hospitalization (1–2 workers)", text: "Report within 24 hours. Inpatient admission required.", color: "bg-amber-100 text-amber-800 border-amber-200" },
              { label: "Amputation or Eye Loss", text: "Report within 24 hours even if not hospitalized.", color: "bg-amber-100 text-amber-800 border-amber-200" },
            ].map(r => (
              <div key={r.label} className={`rounded-lg border p-2 ${r.color}`}>
                <div className="text-[10px] font-bold uppercase tracking-wide">{r.label}</div>
                <div className="mt-0.5 text-xs">{r.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Case Modal ─────────────────────────────────────────────────────────────

function AddCaseModal({ onClose, onAdd, nextNo, tenantId }: {
  onClose: () => void;
  onAdd: (c: OshaCase) => void;
  tenantId: string;
  nextNo: number;
}) {
  const [employee, setEmployee]               = useState("");
  const [isPrivacy, setIsPrivacy]             = useState(false);
  const [jobTitle, setJobTitle]               = useState("");
  const [date, setDate]                       = useState("");
  const [location, setLocation]               = useState("");
  const [description, setDescription]         = useState("");
  const [classification, setClass]            = useState<OshaClassification>("days_away");
  const [injuryType, setInjuryType]           = useState<OshaInjuryType>("injury");
  const [daysAway, setDaysAway]               = useState(0);
  const [daysRestricted, setDaysRestr]        = useState(0);
  const [isSevereInjury, setIsSevere]         = useState(false);
  const [howOccurred, setHowOccurred]         = useState("");
  const [equipment, setEquipment]             = useState("");
  const [physician, setPhysician]             = useState("");
  const [medFacility, setMedFacility]         = useState("");
  const [treatmentER, setTreatmentER]         = useState(false);
  const [treatmentHospitalized, setHospital]  = useState(false);
  const [saving, setSaving]                   = useState(false);

  const caseNo = `2026-${String(nextNo).padStart(3, "0")}`;
  const isFatality = classification === "fatality";
  const showReportingAlert = isFatality || isSevereInjury || treatmentHospitalized;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if ((!employee.trim() && !isPrivacy) || !date || !description.trim()) return;
    setSaving(true);
    setTimeout(() => {
      onAdd({
        id: String(Date.now()),
        tenant_id: tenantId,
        created_at: new Date().toISOString(),
        caseNo,
        employee: isPrivacy ? "Privacy Case" : employee.trim(),
        jobTitle: jobTitle.trim(),
        date,
        location: location.trim(),
        description: description.trim(),
        classification,
        injuryType,
        daysAway,
        daysRestricted,
        isPrivacy,
        isSevereInjury: isSevereInjury || isFatality,
        howOccurred: howOccurred.trim(),
        equipment: equipment.trim(),
        physician: physician.trim(),
        medFacility: medFacility.trim(),
        treatmentER,
        treatmentHospitalized,
      });
      onClose();
    }, 700);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-sm font-bold text-slate-800">Log OSHA Case</div>
            <div className="text-xs text-slate-400">Case #{caseNo}</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Reporting alert */}
        {showReportingAlert && (
          <div className="mx-4 mt-4 rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <div className="text-sm font-bold text-red-800">
                  {isFatality ? "⚠ FATALITY — 8-Hour OSHA Reporting Required" : "⚠ Severe Injury — 24-Hour OSHA Reporting Required"}
                </div>
                <div className="mt-0.5 text-xs text-red-700">
                  {isFatality
                    ? "You must report a work-related fatality to OSHA within 8 hours. Call 1-800-321-OSHA (6742) or submit online at osha.gov/pls/imis/establishment.html"
                    : "In-patient hospitalization, amputation, or loss of an eye must be reported to OSHA within 24 hours. Call 1-800-321-OSHA (6742)."}
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {/* Employee */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                Employee Name {!isPrivacy && <span className="text-red-500">*</span>}
              </label>
              <input
                value={isPrivacy ? "" : employee}
                onChange={e => setEmployee(e.target.value)}
                disabled={isPrivacy}
                placeholder="Full name"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
            <div className="pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isPrivacy} onChange={e => setIsPrivacy(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                <span className="text-xs font-medium text-slate-600">Privacy case</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Job Title</label>
              <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Lab Technician"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Date of Event <span className="text-red-500">*</span></label>
              <input required type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Where Event Occurred</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Lab B, Warehouse, Loading Dock"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none" />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Description of Injury/Illness <span className="text-red-500">*</span></label>
            <textarea required value={description} onChange={e => setDescription(e.target.value)}
              rows={2} placeholder="Describe the injury or illness, including the body part affected and the object or substance involved"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none resize-none" />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">How the Incident Occurred</label>
            <textarea value={howOccurred} onChange={e => setHowOccurred(e.target.value)}
              rows={2} placeholder="Describe what happened step by step and why the incident occurred"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none resize-none" />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Object/Equipment Involved</label>
            <input value={equipment} onChange={e => setEquipment(e.target.value)} placeholder="e.g. Autoclave Model SV-2000, Chemical container"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Classification</label>
              <select value={classification} onChange={e => setClass(e.target.value as OshaClassification)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none">
                {CLASSIFICATIONS.map(c => <option key={c} value={c}>{CLASS_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Injury/Illness Type</label>
              <select value={injuryType} onChange={e => setInjuryType(e.target.value as OshaInjuryType)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none">
                {INJURY_TYPES.map(t => <option key={t} value={t}>{INJURY_LABEL[t]}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Days Away from Work</label>
              <input type="number" min={0} value={daysAway} onChange={e => setDaysAway(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Days Restricted/Transferred</label>
              <input type="number" min={0} value={daysRestricted} onChange={e => setDaysRestr(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none" />
            </div>
          </div>

          {/* Severe injury flags */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isSevereInjury} onChange={e => setIsSevere(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-red-600" />
              <span className="text-xs font-medium text-slate-700">Hospitalization / Severe Injury</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={treatmentER} onChange={e => setTreatmentER(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-amber-600" />
              <span className="text-xs font-medium text-slate-700">ER Treatment</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={treatmentHospitalized} onChange={e => setHospital(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-red-600" />
              <span className="text-xs font-medium text-slate-700">Inpatient Hospitalization</span>
            </label>
          </div>

          {/* Medical info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Physician</label>
              <input value={physician} onChange={e => setPhysician(e.target.value)} placeholder="Dr. Name, MD"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Medical Facility</label>
              <input value={medFacility} onChange={e => setMedFacility(e.target.value)} placeholder="Facility name and address"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving || ((!employee.trim() && !isPrivacy) || !date || !description.trim())}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50">
              {saving ? "Logging…" : "Log Case"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── OSHA 301 Report view ───────────────────────────────────────────────────────

function Report301({ c, onClose, est: EST }: { c: OshaCase; onClose: () => void; est: EstInfo }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <div className="text-sm font-bold text-slate-800">OSHA Form 301 — Injury and Illness Incident Report</div>
            <div className="text-xs text-slate-400">Case #{c.caseNo} · 29 CFR 1904.29</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 px-6 py-5">
          {/* Section A */}
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Section A — Employee Information</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Full Name", value: c.isPrivacy ? "Privacy Case — withheld" : c.employee },
                { label: "Job Title", value: c.jobTitle || "—" },
                { label: "Date of Injury/Illness", value: fmt(c.date) },
                { label: "Time of Event", value: "—" },
              ].map(f => (
                <div key={f.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{f.label}</div>
                  <div className="mt-0.5 text-sm font-medium text-slate-800">{f.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section B */}
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Section B — Employer Information</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Establishment Name", value: EST.name },
                { label: "Address", value: [EST.street, EST.city, EST.state, EST.zip].filter(Boolean).join(", ") || "—" },
                { label: "NAICS", value: [EST.naics, EST.industry].filter(Boolean).join(" — ") || "—" },
                { label: "EHS Contact", value: EST.ehsContact },
              ].map(f => (
                <div key={f.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{f.label}</div>
                  <div className="mt-0.5 text-sm font-medium text-slate-800">{f.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section C */}
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Section C — Case Information</div>
            <div className="grid gap-3">
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Where did the event occur?</div>
                <div className="mt-0.5 text-sm text-slate-800">{c.location || "—"}</div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">What was the employee doing just before the incident occurred?</div>
                <div className="mt-0.5 text-sm text-slate-800">{c.description}</div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">What happened? How did the injury/illness occur?</div>
                <div className="mt-0.5 text-sm text-slate-800">{c.howOccurred || "—"}</div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">What object or substance directly harmed the employee?</div>
                <div className="mt-0.5 text-sm text-slate-800">{c.equipment || "—"}</div>
              </div>
            </div>
          </div>

          {/* Section D */}
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Section D — Medical Treatment</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Physician / Health Care Professional", value: c.physician || "—" },
                { label: "Medical Facility", value: c.medFacility || "—" },
                { label: "Treated in Emergency Room?", value: c.treatmentER ? "Yes" : "No" },
                { label: "Inpatient Hospitalization?", value: c.treatmentHospitalized ? "Yes — 24-hr OSHA reporting triggered" : "No" },
              ].map(f => (
                <div key={f.label} className={`rounded-lg border px-3 py-2.5 ${
                  (f.label.includes("Hospitalization") && c.treatmentHospitalized) || (f.label.includes("Emergency") && c.treatmentER)
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-100 bg-slate-50"
                }`}>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{f.label}</div>
                  <div className="mt-0.5 text-sm font-medium text-slate-800">{f.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Classification */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">OSHA 300 Classification</div>
              <div className="mt-0.5 flex items-center gap-2">
                <Pill className={CLASS_STYLE[c.classification]}>{CLASS_LABEL[c.classification]}</Pill>
                <span className="text-sm text-slate-600">
                  {c.daysAway > 0 ? `${c.daysAway} days away` : ""}
                  {c.daysAway > 0 && c.daysRestricted > 0 ? " · " : ""}
                  {c.daysRestricted > 0 ? `${c.daysRestricted} days restricted` : ""}
                </span>
              </div>
            </div>
            {c.isSevereInjury && (
              <div className="rounded-lg border border-red-300 bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">
                ⚠ Severe Injury — 24-hr report
              </div>
            )}
          </div>

          <div className="flex justify-between pt-1 border-t border-slate-100">
            <Link href="/capa" className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100">
              <Plus className="h-3.5 w-3.5" /> Create CAPA from this case
            </Link>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <Printer className="h-3.5 w-3.5" /> Print 301
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Export helpers ─────────────────────────────────────────────────────────────

function esc(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function exportITA(cases: OshaCase[], EST: EstInfo) {
  const daysAwayCases   = cases.filter(c => c.classification === "days_away").length;
  const restrictedCases = cases.filter(c => c.classification === "restricted").length;
  const otherCases      = cases.filter(c => c.classification === "other_recordable").length;
  const fatalities      = cases.filter(c => c.classification === "fatality").length;
  const totalDaysAway   = cases.reduce((s, c) => s + c.daysAway, 0);
  const totalDaysRestr  = cases.reduce((s, c) => s + c.daysRestricted, 0);
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // ITA format — field,value pairs for OSHA Injury Tracking Application portal
  // Header rows are informational; ITA data begins after the blank separator.
  const infoLines = [
    `# OSHA Injury Tracking Application (ITA) — 300A Submission Data`,
    `# ${EST.name} | Generated: ${dateStr}`,
    `# Upload this file at: https://www.osha.gov/injuryreporting`,
    `# NOTE: Remove these comment lines (#) before uploading to ITA portal.`,
    `#`,
    `field,value`,
  ];

  const dataLines = [
    ["establishment_name", EST.name],
    ["ein", EST.ein],
    ["street", EST.street],
    ["city", EST.city],
    ["state", EST.state],
    ["zip", EST.zip],
    ["industry_description", EST.industry],
    ["naics_code", EST.naics],
    ["annual_average_employees", String(EST.employees)],
    ["total_hours_worked", String(EST.hours)],
    ["year", "2026"],
    ["total_deaths", String(fatalities)],
    ["total_dafw_cases", String(daysAwayCases)],
    ["total_djtr_cases", String(restrictedCases)],
    ["total_other_cases", String(otherCases)],
    ["total_dafw_days", String(totalDaysAway)],
    ["total_djtr_days", String(totalDaysRestr)],
    ["total_injuries", String(cases.filter(c => c.injuryType === "injury").length)],
    ["total_skin_disorders", String(cases.filter(c => c.injuryType === "skin_disorder").length)],
    ["total_resp_conditions", String(cases.filter(c => c.injuryType === "respiratory").length)],
    ["total_poisonings", String(cases.filter(c => c.injuryType === "poisoning").length)],
    ["total_hearing_loss", String(cases.filter(c => c.injuryType === "hearing_loss").length)],
    ["total_other_illnesses", String(cases.filter(c => c.injuryType === "other_illness").length)],
  ].map(r => r.join(","));

  const trir = ((cases.length / EST.hours) * 200000).toFixed(2);
  const dart = (((daysAwayCases + restrictedCases) / EST.hours) * 200000).toFixed(2);
  const summaryLines = [
    `#`,
    `# CALCULATED RATES (not uploaded — for internal reference):`,
    `# TRIR (Total Recordable Incident Rate): ${trir} per 100 FTE`,
    `# DART Rate (Days Away/Restricted/Transfer): ${dart} per 100 FTE`,
    `# Industry Benchmark DART: ${EST.benchDart} (NAICS 5417 — R&D Biotech)`,
  ];

  const csv = [...infoLines, ...dataLines, ...summaryLines].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `${EST.name.split(" ")[0]}-OSHA-ITA-300A-2026.csv`;
  a.click();
}

async function downloadOsha300APdf(EST: EstInfo, summary: Osha300ASummary) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 40;
  const contentW = pageW - marginX * 2;
  let y = 44;

  function sectionTitle(label: string) {
    y += 4;
    doc.setFillColor(26, 26, 26);
    doc.rect(marginX, y, contentW, 16, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), marginX + 6, y + 11);
    doc.setTextColor(0, 0, 0);
    y += 16 + 12;
  }
  function field(label: string, value: string, x: number, w: number) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(90, 90, 90);
    doc.text(label.toUpperCase(), x, y);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(value || "—", x, y + 12);
    doc.setDrawColor(0);
    doc.setLineWidth(0.75);
    doc.line(x, y + 15, x + w, y + 15);
  }
  function statRow(cols: { letter: string; label: string; value: string | number }[], boxH = 46) {
    const colW = contentW / cols.length;
    doc.setDrawColor(0);
    doc.setLineWidth(1);
    doc.rect(marginX, y, contentW, boxH);
    cols.forEach((c, i) => {
      const cx = marginX + i * colW;
      if (i > 0) doc.line(cx, y, cx, y + boxH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(c.letter, cx + colW / 2, y + 12, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      const labelLines = doc.splitTextToSize(c.label, colW - 8);
      doc.text(labelLines, cx + colW / 2, y + 22, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(String(c.value), cx + colW / 2, y + boxH - 8, { align: "center" });
    });
    y += boxH + 12;
  }

  // ── Header ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text("U.S. Department of Labor — Occupational Safety and Health Administration", marginX, y);
  y += 14;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("OSHA's Form 300A", marginX, y);
  y += 14;
  doc.setFontSize(9);
  doc.text("Summary of Work-Related Injuries and Illnesses", marginX, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.text(`Year ${summary.year}  ·  29 CFR Part 1904  ·  Must be posted Feb 1 – Apr 30 of the following year`, marginX, y);
  y += 14;
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(245, 158, 11);
  doc.rect(marginX, y, contentW, 18, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(146, 64, 14);
  doc.text(
    `POST THIS FORM FROM FEBRUARY 1 TO APRIL 30, ${summary.year + 1} — in a conspicuous location`,
    marginX + contentW / 2, y + 12, { align: "center" }
  );
  doc.setTextColor(0, 0, 0);
  y += 18 + 18;

  // ── Establishment info ──
  sectionTitle("Establishment Information");
  field("Establishment Name", EST.name, marginX, contentW / 2 - 10);
  field("Employer ID Number (EIN)", EST.ein, marginX + contentW / 2 + 10, contentW / 2 - 10);
  y += 26;
  const thirdW = contentW / 3 - 10;
  field("Industry Description", EST.industry, marginX, thirdW);
  field("NAICS Code", EST.naics, marginX + thirdW + 15, thirdW);
  field("State", EST.state, marginX + (thirdW + 15) * 2, thirdW);
  y += 26;
  field("Annual Average Number of Employees", String(EST.employees), marginX, contentW / 2 - 10);
  field("Total Hours Worked by All Employees", `${EST.hours.toLocaleString()} hrs`, marginX + contentW / 2 + 10, contentW / 2 - 10);
  y += 30;

  // ── Number of cases ──
  sectionTitle("Number of Cases");
  statRow([
    { letter: "G", label: "Total deaths", value: summary.totals.deaths },
    { letter: "H", label: "Cases with days away from work", value: summary.totals.daysAwayCases },
    { letter: "I", label: "Cases with job transfer or restriction", value: summary.totals.restrictedTransferCases },
    { letter: "J", label: "Other recordable cases", value: summary.totals.otherRecordableCases },
  ]);

  // ── Number of days ──
  sectionTitle("Number of Days");
  statRow([
    { letter: "K", label: "Total days away from work", value: summary.totals.totalDaysAway },
    { letter: "L", label: "Total days of job transfer or restriction", value: summary.totals.totalDaysRestricted },
  ]);

  // ── Injury and illness types ──
  sectionTitle("Injury and Illness Types");
  statRow([
    { letter: "M", label: "Injuries", value: summary.totals.injuryTypeCounts.injury },
    { letter: "N", label: "Skin disorders", value: summary.totals.injuryTypeCounts.skin_disorder },
    { letter: "O", label: "Respiratory conditions", value: summary.totals.injuryTypeCounts.respiratory },
    { letter: "P", label: "Poisonings", value: summary.totals.injuryTypeCounts.poisoning },
    { letter: "Q", label: "Hearing loss", value: summary.totals.injuryTypeCounts.hearing_loss },
    { letter: "R", label: "All other illnesses", value: summary.totals.injuryTypeCounts.other_illness },
  ], 44);

  // ── No-cases checkbox ──
  doc.setDrawColor(0);
  doc.setLineWidth(1);
  doc.rect(marginX, y, 9, 9);
  if (summary.noCasesToReport) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("X", marginX + 1.5, y + 8);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`No injuries or illnesses to report for ${summary.year}`, marginX + 14, y + 8);
  y += 24;

  // ── Rates ──
  sectionTitle("Incidence Rates (per 100 full-time workers)");
  const rateW = contentW / 2 - 10;
  field("Total Recordable Incident Rate (TRIR)", summary.totals.trir === null ? "—" : String(summary.totals.trir), marginX, rateW);
  field("DART Rate (Days Away, Restricted, Transfer)", summary.totals.dartRate === null ? "—" : String(summary.totals.dartRate), marginX + rateW + 20, rateW);
  y += 30;

  // ── Certification ──
  sectionTitle("Certification — Knowingly falsifying this document may result in a fine");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);
  const certLines = doc.splitTextToSize(
    `"I certify that I have examined this document and that to the best of my knowledge the entries are true, accurate, and complete." — 29 CFR 1904.32(b)(3)`,
    contentW
  );
  doc.text(certLines, marginX, y);
  doc.setTextColor(0, 0, 0);
  y += certLines.length * 9 + 16;

  field("Company Executive — Signature", "", marginX, contentW / 2 - 10);
  field("Title", "", marginX + contentW / 2 + 10, contentW / 2 - 10);
  y += 26;
  field("Phone", "", marginX, contentW / 2 - 10);
  field("Date", "", marginX + contentW / 2 + 10, contentW / 2 - 10);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(90, 90, 90);
  doc.text(
    "The \"company executive\" who certifies must be an owner, a corporate officer, the highest-ranking official at the establishment, or that official's immediate supervisor.",
    marginX, y
  );

  // ── Footer ──
  const genDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  doc.setFontSize(6.5);
  doc.setTextColor(90, 90, 90);
  doc.text("OSHA Form 300A (Rev. 01/2004) · 29 CFR Part 1904", marginX, 780);
  doc.text(`Generated by SafetyIQ · Reliance Predictive Safety Technologies · ${genDate}`, pageW - marginX, 780, { align: "right" });

  doc.save(`OSHA-300A-${EST.name.replace(/[^a-z0-9]+/gi, "-")}-${summary.year}.pdf`);
}

function exportCSV(cases: OshaCase[], EST: EstInfo) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const trir = ((cases.length / EST.hours) * 200000).toFixed(2);
  const dart = (((cases.filter(c => c.classification === "days_away" || c.classification === "restricted").length) / EST.hours) * 200000).toFixed(2);
  const totalDaysAway   = cases.reduce((s, c) => s + c.daysAway, 0);
  const totalDaysRestr  = cases.reduce((s, c) => s + c.daysRestricted, 0);

  const header = [
    [esc(EST.name), esc("OSHA Form 300 — Log of Work-Related Injuries and Illnesses")].join(","),
    [esc("29 CFR Part 1904"), esc("SafetyIQ · Reliance Predictive Safety Technologies")].join(","),
    [esc("Generated:"), esc(dateStr)].join(","),
    [esc("Reporting Year:"), esc("2026")].join(","),
    [esc("Establishment:"), esc(`${EST.name} — ${EST.street}, ${EST.city} ${EST.state} ${EST.zip}`)].join(","),
    [esc("NAICS:"), esc(`${EST.naics} — ${EST.industry}`)].join(","),
    [esc("Annual Average Employees:"), esc(String(EST.employees))].join(","),
    [esc("Total Hours Worked:"), esc(EST.hours.toLocaleString())].join(","),
    "",
    [esc("Case No"), esc("Employee Name"), esc("Job Title"), esc("Date of Incident"), esc("Where Occurred"),
     esc("Classification (300 Col)"), esc("Injury / Illness Type"), esc("Days Away from Work"),
     esc("Days Restricted / Transferred"), esc("Privacy Case?"), esc("Severe Injury?"),
     esc("ER Treatment?"), esc("Hospitalized?"), esc("Physician"), esc("Medical Facility"), esc("Description")].join(","),
  ];

  const rows = cases.map(c => [
    esc(c.caseNo),
    esc(c.isPrivacy ? "PRIVACY — withheld per 29 CFR 1904.29(b)(7)" : c.employee),
    esc(c.jobTitle || "—"),
    esc(fmtDate(c.date)),
    esc(c.location || "—"),
    esc(CLASS_LABEL[c.classification]),
    esc(INJURY_LABEL[c.injuryType]),
    esc(c.daysAway > 0 ? String(c.daysAway) : "—"),
    esc(c.daysRestricted > 0 ? String(c.daysRestricted) : "—"),
    esc(c.isPrivacy ? "Yes" : "No"),
    esc(c.isSevereInjury ? "Yes — 24-hr report required" : "No"),
    esc(c.treatmentER ? "Yes" : "No"),
    esc(c.treatmentHospitalized ? "Yes" : "No"),
    esc(c.isPrivacy ? "withheld" : (c.physician || "—")),
    esc(c.isPrivacy ? "withheld" : (c.medFacility || "—")),
    esc(c.description),
  ].join(","));

  const summary = [
    "",
    [esc("── ANNUAL SUMMARY (Form 300A) ──"), ""].join(","),
    [esc("Total Recordable Cases:"), esc(String(cases.length))].join(","),
    [esc("Days Away from Work Cases:"), esc(String(cases.filter(c => c.classification === "days_away").length))].join(","),
    [esc("Restricted / Transfer Cases:"), esc(String(cases.filter(c => c.classification === "restricted").length))].join(","),
    [esc("Other Recordable Cases:"), esc(String(cases.filter(c => c.classification === "other_recordable").length))].join(","),
    [esc("Fatalities:"), esc(String(cases.filter(c => c.classification === "fatality").length))].join(","),
    [esc("Total Days Away:"), esc(String(totalDaysAway))].join(","),
    [esc("Total Days Restricted:"), esc(String(totalDaysRestr))].join(","),
    [esc("Severe Injuries (24-hr reportable):"), esc(String(cases.filter(c => c.isSevereInjury).length))].join(","),
    "",
    [esc("TRIR (per 100 FTE):"), esc(trir)].join(","),
    [esc("DART Rate (per 100 FTE):"), esc(dart)].join(","),
    [esc("Industry Benchmark DART:"), esc("1.8")].join(","),
  ];

  const csv = "﻿" + [...header, ...rows, ...summary].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `${EST.name.split(" ")[0]}-OSHA-300-Log-2026.csv`;
  a.click();
}

// ── Trend Analysis ─────────────────────────────────────────────────────────────

function TrendsTab({ cases, incidents, oshaHours = OSHA_HOURS_WORKED }: { cases: OshaCase[]; incidents: Incident[]; oshaHours?: number }) {
  const byMonth: Record<string, number> = {};
  for (const c of cases) {
    const month = c.date.slice(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + 1;
  }
  const months = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b));
  const maxCount = Math.max(...months.map(([, n]) => n), 1);

  const byClassification = CLASSIFICATIONS.map(cl => ({
    label: CLASS_LABEL[cl],
    count: cases.filter(c => c.classification === cl).length,
    style: CLASS_STYLE[cl],
  })).filter(r => r.count > 0);

  const byInjuryType = INJURY_TYPES.map(t => ({
    label: INJURY_LABEL[t],
    count: cases.filter(c => c.injuryType === t).length,
  })).filter(r => r.count > 0);

  const daysAwayTotal    = cases.reduce((s, c) => s + c.daysAway, 0);
  const daysRestTotal    = cases.reduce((s, c) => s + c.daysRestricted, 0);
  const erCases          = cases.filter(c => c.treatmentER).length;
  const hospitalCases    = cases.filter(c => c.treatmentHospitalized).length;
  const severeCases      = cases.filter(c => c.isSevereInjury).length;
  const dart = (((cases.filter(c => c.classification === "days_away" || c.classification === "restricted").length) / oshaHours) * 200000);
  const trir = ((cases.length / oshaHours) * 200000);

  return (
    <div className="space-y-5">
      {/* Rate metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "TRIR", value: trir.toFixed(2), hint: "Total Recordable Incident Rate per 100 FTE" },
          { label: "DART Rate", value: dart.toFixed(2), hint: `Days Away, Restricted, Transfer per 100 FTE · Industry avg ${OSHA_DART_BENCHMARK}` },
          { label: "Total Lost Days", value: String(daysAwayTotal + daysRestTotal), hint: `${daysAwayTotal} away + ${daysRestTotal} restricted` },
          { label: "Severe Injuries", value: String(severeCases), hint: `${erCases} ER · ${hospitalCases} hospitalized` },
        ].map(s => (
          <Card key={s.label}>
            <div className="px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.label}</div>
              <div className="mt-0.5 text-3xl font-black text-slate-800">{s.value}</div>
              <div className="mt-0.5 text-[10.5px] text-slate-500">{s.hint}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Monthly trend bar chart */}
      <Card>
        <CardHeader title="Cases by Month" subtitle="Incident frequency trend — 2026" />
        <div className="px-4 pb-4">
          {months.length > 0 ? (
            <div className="flex items-end gap-3 h-28">
              {months.map(([month, count]) => (
                <div key={month} className="flex flex-1 flex-col items-center gap-1">
                  <div className="text-xs font-bold text-slate-600">{count}</div>
                  <div
                    className="w-full rounded-t-md bg-red-400"
                    style={{ height: `${(count / maxCount) * 80}px`, minHeight: "4px" }}
                  />
                  <div className="text-[9px] text-slate-400 whitespace-nowrap">
                    {new Date(month + "-01").toLocaleDateString("en-US", { month: "short" })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400">No case data to display</div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* By classification */}
        <Card>
          <CardHeader title="Cases by Classification" subtitle="OSHA 300 column breakdown" />
          <div className="divide-y divide-slate-50">
            {byClassification.map(r => (
              <div key={r.label} className="flex items-center gap-3 px-4 py-2.5">
                <Pill className={r.style}>{r.label}</Pill>
                <div className="flex-1">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-red-400" style={{ width: `${(r.count / cases.length) * 100}%` }} />
                  </div>
                </div>
                <div className="text-sm font-bold text-slate-700 w-5 text-right">{r.count}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* By injury type */}
        <Card>
          <CardHeader title="Cases by Type" subtitle="Injury and illness type breakdown" />
          <div className="divide-y divide-slate-50">
            {byInjuryType.map(r => (
              <div key={r.label} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-28 text-xs font-medium text-slate-600 shrink-0">{r.label}</div>
                <div className="flex-1">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-400" style={{ width: `${(r.count / cases.length) * 100}%` }} />
                  </div>
                </div>
                <div className="text-sm font-bold text-slate-700 w-5 text-right">{r.count}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Incident cross-reference */}
      {incidents.length > 0 && (() => {
        const recordable = incidents.filter(i =>
          i.regulatory_reportable || i.medical_treatment_required || (i.lost_time_days ?? 0) > 0
        );
        if (recordable.length === 0) return null;
        return (
          <Card>
            <CardHeader
              title="Incident Register Cross-Reference"
              subtitle="Recordable incidents from the Incident module — verify each appears in your OSHA 300 Log"
              right={
                <Link href="/incidents" className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                  View all incidents <ExternalLink className="h-3 w-3" />
                </Link>
              }
            />
            <div className="px-4 pb-4 space-y-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <strong>{recordable.length} incident{recordable.length > 1 ? "s" : ""}</strong> flagged as regulatory-reportable, medical-treatment, or lost-time in the Incident Register. Confirm each has a corresponding OSHA 300 entry.
              </div>
              {recordable.map(i => (
                <div key={i.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-800">{i.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      {i.regulatory_reportable && <Pill className="bg-red-100 text-red-700 text-[10px]">Regulatory Reportable</Pill>}
                      {i.medical_treatment_required && <Pill className="bg-orange-100 text-orange-700 text-[10px]">Medical Treatment</Pill>}
                      {(i.lost_time_days ?? 0) > 0 && <Pill className="bg-red-100 text-red-700 text-[10px]">{i.lost_time_days}d lost time</Pill>}
                      <span className="text-[10.5px] text-slate-400">
                        {new Date(i.occurred_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {i.location ? ` · ${i.location}` : ""}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/incidents/${i.id}`}
                    className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    View Incident
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      {/* CAPA linkage panel */}
      <Card>
        <CardHeader
          title="CAPA Linkage"
          subtitle="Corrective actions arising from OSHA recordable cases"
          right={
            <Link href="/capa" className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
              View all CAPAs <ExternalLink className="h-3 w-3" />
            </Link>
          }
        />
        <div className="px-4 pb-4">
          <div className="grid gap-2">
            {cases.filter(c => c.classification !== "other_recordable" || c.isSevereInjury || c.daysAway > 3).map(c => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-800">
                    Case #{c.caseNo} — {c.isPrivacy ? "Privacy Case" : c.employee}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Pill className={CLASS_STYLE[c.classification]}>{CLASS_LABEL[c.classification]}</Pill>
                    <span className="text-[10.5px] text-slate-400">{fmt(c.date)} · {c.location}</span>
                  </div>
                </div>
                <Link
                  href="/capa"
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100"
                >
                  <Plus className="h-3 w-3" /> CAPA
                </Link>
              </div>
            ))}
            {cases.length === 0 && (
              <div className="py-4 text-center text-xs text-slate-400">No cases requiring CAPA linkage.</div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function OshaClient({ initialCases, incidents = [], establishment, tenantId, oshaHours = OSHA_HOURS_WORKED, oshaEstablishment }: { initialCases: OshaCase[]; incidents?: Incident[]; establishment: EstablishmentProp; tenantId: string; oshaHours?: number; oshaEstablishment?: { ein: string; naics: string; employees: number; employeesConfigured?: boolean; hoursConfigured?: boolean } }) {
  const EST: EstInfo = {
    name:      establishment.name,
    ein:       oshaEstablishment?.ein ?? "",
    street:    "",
    city:      establishment.siteName ?? "",
    state:     establishment.state ?? "",
    zip:       "",
    naics:     oshaEstablishment?.naics ?? "",
    industry:  establishment.industry ?? "",
    employees: oshaEstablishment?.employees || OSHA_FTE,
    hours:     oshaHours,
    benchDart: OSHA_DART_BENCHMARK,
    ehsContact: [establishment.contactName, establishment.contactTitle].filter(Boolean).join(", ") || "—",
    employeesConfigured: oshaEstablishment?.employeesConfigured ?? false,
    hoursConfigured:     oshaEstablishment?.hoursConfigured ?? false,
  };

  const [cases, setCases]           = useState(initialCases);
  const [showModal, setShowModal]   = useState(false);
  const [toast, setToast]           = useState("");
  const [tab, setTab]               = useState<"log300" | "summary300a" | "report301" | "trends">("log300");
  const [viewing301, setViewing301] = useState<OshaCase | null>(null);
  const [guideOpen, setGuideOpen]   = useState(false);
  const [summaryGuideOpen, setSummaryGuideOpen] = useState(true);
  const [pdfBusy, setPdfBusy]       = useState(false);

  const summaryYear = new Date().getFullYear();
  const summary: Osha300ASummary = useMemo(
    () => computeOsha300ASummary({
      cases,
      year: summaryYear,
      oshaHours: EST.hours,
      avgEmployees: EST.employees,
      hoursConfigured: EST.hoursConfigured,
      employeesConfigured: EST.employeesConfigured,
    }),
    [cases, summaryYear, EST.hours, EST.employees, EST.hoursConfigured, EST.employeesConfigured]
  );

  const daysAwayCases    = cases.filter(c => c.classification === "days_away");
  const restrictedCases  = cases.filter(c => c.classification === "restricted");
  const totalDaysAway    = cases.reduce((s, c) => s + c.daysAway, 0);
  const severeCases      = cases.filter(c => c.isSevereInjury || c.classification === "fatality");

  async function handleAdd(c: OshaCase) {
    // Optimistically show the case, then confirm the write persisted.
    setCases(prev => [...prev, c]);
    setToast(`Case #${c.caseNo} logged`);
    const fd = new FormData();
    fd.append("case", JSON.stringify(c));
    try {
      const res = await addOshaCaseToStore(null, fd);
      if (!res?.ok) {
        // Roll back the optimistic add and surface the failure.
        setCases(prev => prev.filter(x => x !== c));
        setToast(`Could not save case — ${res?.error ?? "please try again"}`);
      }
    } catch (err) {
      setCases(prev => prev.filter(x => x !== c));
      setToast(`Could not save case — ${String(err)}`);
    }
    setTimeout(() => setToast(""), 4000);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Print-only regulatory header */}
      <div className="print-only mb-4 border-b-2 border-black pb-3">
        <div className="text-center">
          <div className="text-lg font-extrabold uppercase tracking-wide">OSHA Form 300 — Log of Work-Related Injuries and Illnesses</div>
          <div className="text-sm font-semibold">Year: 2026 &nbsp;|&nbsp; Establishment: {EST.name} &nbsp;|&nbsp; NAICS: {EST.naics}</div>
          <div className="text-xs text-slate-500 mt-0.5">29 CFR 1904 · Printed via SafetyIQ · Reliance Predictive Safety Technologies</div>
        </div>
      </div>

      {viewing301 && <Report301 c={viewing301} onClose={() => setViewing301(null)} est={EST} />}

      {showModal && (
        <AddCaseModal
          onClose={() => setShowModal(false)}
          onAdd={handleAdd}
          nextNo={cases.length + 1}
          tenantId={tenantId}
        />
      )}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          ✓ {toast}
        </div>
      )}

      {/* Severe injury reporting banner */}
      {severeCases.length > 0 && (
        <div className="mx-6 mt-4 rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div>
              <div className="text-sm font-bold text-red-800">
                {severeCases.length} severe injury case{severeCases.length > 1 ? "s" : ""} — verify OSHA reporting completed
              </div>
              <div className="mt-0.5 text-xs text-red-700">
                Fatalities require 8-hour phone reporting · Hospitalizations, amputations, and eye loss require 24-hour reporting.
                Call <strong>1-800-321-OSHA</strong> or report online at osha.gov.
              </div>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title="OSHA Logs"
        subtitle="OSHA 300 recordkeeping — work-related injuries and illnesses (29 CFR 1904)"
        actions={
          <div className="flex gap-2 print:hidden">
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button onClick={() => exportCSV(cases, EST)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Download className="h-3.5 w-3.5" /> Export 300
            </button>
            <button onClick={() => exportITA(cases, EST)}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100">
              <Download className="h-3.5 w-3.5" /> ITA Export
            </button>
            <button onClick={() => setShowModal(true)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
              + Log Case
            </button>
          </div>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* Recordability guide */}
        <RecordabilityGuide open={guideOpen} onToggle={() => setGuideOpen(o => !o)} />

        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4 print:hidden">
          <Stat label="Total Recordable Cases" value={cases.length}            hint="OSHA 300 entries"           />
          <Stat label="Days Away Cases"         value={daysAwayCases.length}   hint="Classification column G"    accent="#dc2626" />
          <Stat label="Restricted/Transfer"     value={restrictedCases.length} hint="Column H"                  accent="#d97706" />
          <Stat label="Total Days Away"         value={totalDaysAway}          hint="All lost time combined"     accent="#2563eb" />
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 border-b border-slate-200 print:hidden">
          {[
            { key: "log300",      label: "OSHA 300 Log" },
            { key: "summary300a", label: "300A Annual Summary" },
            { key: "report301",   label: "301 Incident Reports" },
            { key: "trends",      label: "Trends & Analysis" },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* OSHA 300 Log */}
        {tab === "log300" && (
          <Card>
            <CardHeader
              title="OSHA Form 300 — Log of Work-Related Injuries and Illnesses"
              subtitle={`${cases.length} cases · Year 2026`}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2.5 text-left">Case #</th>
                    <th className="px-3 py-2.5 text-left">Employee</th>
                    <th className="px-3 py-2.5 text-left">Job Title</th>
                    <th className="px-3 py-2.5 text-left">Date</th>
                    <th className="px-3 py-2.5 text-left">Where Occurred</th>
                    <th className="px-3 py-2.5 text-left">Classification</th>
                    <th className="px-3 py-2.5 text-left">Type</th>
                    <th className="px-3 py-2.5 text-center">Days Away</th>
                    <th className="px-3 py-2.5 text-center">Days Restr.</th>
                    <th className="px-3 py-2.5 text-center">301</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {cases.map(c => (
                    <tr key={c.id} className={`hover:bg-slate-50 ${c.isSevereInjury || c.classification === "fatality" ? "bg-red-50/30" : ""}`}>
                      <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-600">
                        {c.caseNo}
                        {c.isSevereInjury && <span title="Severe injury — OSHA reporting required" className="ml-1 text-red-500">⚠</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-800 text-xs">
                          {c.isPrivacy ? <span className="italic text-slate-400">Privacy Case</span> : c.employee}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">{c.jobTitle || "—"}</td>
                      <td className="px-3 py-3 text-xs tabular-nums text-slate-600">{fmt(c.date)}</td>
                      <td className="px-3 py-3 text-xs text-slate-600 max-w-36 truncate" title={c.location}>
                        {c.location || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <Pill className={CLASS_STYLE[c.classification]}>{CLASS_LABEL[c.classification]}</Pill>
                      </td>
                      <td className="px-3 py-3">
                        <Pill className="bg-slate-100 text-slate-600 text-xs">{INJURY_LABEL[c.injuryType]}</Pill>
                      </td>
                      <td className="px-3 py-3 text-center text-xs font-bold text-slate-700">
                        {c.daysAway > 0 ? c.daysAway : "—"}
                      </td>
                      <td className="px-3 py-3 text-center text-xs font-bold text-slate-700">
                        {c.daysRestricted > 0 ? c.daysRestricted : "—"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => setViewing301(c)}
                          className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10.5px] font-medium text-blue-700 hover:bg-blue-100"
                        >
                          View 301
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cases.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-400">
                        No recordable cases logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* OSHA 300A */}
        {tab === "summary300a" && (
          <div className="space-y-5">
            {/* First-time explainer */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 print:hidden">
              <button
                type="button"
                onClick={() => setSummaryGuideOpen(o => !o)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-blue-800"
              >
                <span>What is Form 300A, and when is it due?</span>
                {summaryGuideOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {summaryGuideOpen && (
                <div className="border-t border-blue-200 px-4 py-3 text-xs leading-relaxed text-blue-800">
                  <p>
                    Form 300A summarizes every recordable work-related injury and illness for the year — it doesn&apos;t list
                    individual cases, just the totals. Every covered employer must post it where employees can see it from
                    {" "}<strong>February 1 through April 30</strong> of the following year, even if nothing happened all year.
                  </p>
                  <p className="mt-2">
                    These numbers are calculated automatically from your OSHA 300 Log below — if a total looks wrong, fix the
                    case on the{" "}
                    <button type="button" onClick={() => setTab("log300")} className="font-semibold underline">
                      OSHA 300 Log
                    </button>{" "}
                    tab rather than editing this summary directly.
                  </p>
                </div>
              )}
            </div>

            {/* Missing establishment data */}
            {summary.missingFields.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 print:hidden">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="text-xs text-amber-800">
                    <div className="font-semibold">We&apos;re missing some site details, so these totals may not be complete.</div>
                    <div className="mt-1">Missing: {summary.missingFields.join(", ")}.</div>
                    <Link href="/settings" className="mt-1 inline-flex items-center gap-1 font-semibold underline">
                      Add them in Settings <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Reconciliation / anomaly warning */}
            {summary.anomalies.length > 0 && (
              <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 print:hidden">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <div className="text-xs text-red-800">
                    <div className="font-semibold">Some numbers don&apos;t add up.</div>
                    {summary.anomalies.map((a) => (
                      <div key={a} className="mt-1">{a}</div>
                    ))}
                    <button type="button" onClick={() => setTab("log300")} className="mt-1 font-semibold underline">
                      Review OSHA 300 Log entries
                    </button>
                  </div>
                </div>
              </div>
            )}

            <Card>
              <CardHeader
                title="OSHA Form 300A — Annual Summary"
                subtitle={`Year ${summary.year} · ${EST.name}`}
                right={
                  <div className="flex flex-col items-end gap-1">
                    <button
                      disabled={summary.missingFields.length > 0 || pdfBusy}
                      onClick={async () => {
                        setPdfBusy(true);
                        try {
                          await downloadOsha300APdf(EST, summary);
                        } finally {
                          setPdfBusy(false);
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Download className="h-3.5 w-3.5" /> {pdfBusy ? "Generating…" : "Download printable summary (PDF)"}
                    </button>
                    {summary.missingFields.length > 0 && (
                      <span className="text-[10px] text-amber-700">Add missing site details to enable download</span>
                    )}
                  </div>
                }
              />
              <div className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  {[
                    { label: "Establishment Name", value: EST.name },
                    { label: "NAICS Code", value: `${EST.naics || "—"} — ${EST.industry || "—"}` },
                    { label: "Annual Avg. Employees", value: String(EST.employees) },
                    { label: "Total Hours Worked", value: `${EST.hours.toLocaleString()} hrs` },
                    { label: "SIC Code", value: "2836" },
                    { label: "Covered Period", value: `Jan 1 – Dec 31, ${summary.year}` },
                  ].map(f => (
                    <div key={f.label}>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{f.label}</div>
                      <div className="mt-0.5 font-medium text-slate-800">{f.value}</div>
                    </div>
                  ))}
                </div>
                <label className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                  <input type="checkbox" checked={summary.noCasesToReport} readOnly className="h-3.5 w-3.5" />
                  No injuries or illnesses to report for {summary.year}
                </label>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: "Total Deaths", value: String(summary.totals.deaths), sub: "Column G — fatalities", color: "" },
                { label: "Days-Away Cases", value: String(summary.totals.daysAwayCases), sub: "Column H", color: "text-red-600" },
                { label: "Restricted/Transfer Cases", value: String(summary.totals.restrictedTransferCases), sub: "Column I", color: "text-amber-600" },
                { label: "Other Recordable Cases", value: String(summary.totals.otherRecordableCases), sub: "Column J", color: "text-blue-600" },
                { label: "Total Days Away", value: String(summary.totals.totalDaysAway), sub: "Column K", color: "" },
                { label: "Total Days Restricted", value: String(summary.totals.totalDaysRestricted), sub: "Column L", color: "" },
              ].map(s => (
                <Card key={s.label}>
                  <div className="px-4 py-4">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">{s.label}</div>
                    <div className={`text-3xl font-black ${s.color || "text-slate-800"}`}>{s.value}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{s.sub}</div>
                  </div>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader title="Injury & Illness Type Breakdown" subtitle="Columns M–R" />
              <div className="grid grid-cols-3 gap-4 px-4 pb-4 sm:grid-cols-6">
                {INJURY_TYPES.map(t => (
                  <div key={t} className="text-center">
                    <div className="text-xl font-black text-slate-800">{summary.totals.injuryTypeCounts[t]}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{INJURY_LABEL[t]}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="DART Rate" subtitle="Days Away, Restricted or Transfer rate per 100 FTE" />
              <div className="px-4 pb-4">
                <div className="flex items-baseline gap-3">
                  <div className="text-4xl font-black text-slate-800">
                    {summary.totals.dartRate === null ? "—" : summary.totals.dartRate.toFixed(1)}
                  </div>
                  <div className="text-sm text-slate-500">per 100 FTE · industry avg {EST.benchDart}</div>
                </div>
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-700">
                    300A must be posted in a visible location from <strong>Feb 1 – Apr 30</strong> of the following year. Certification required by company executive.
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* OSHA 301 list */}
        {tab === "report301" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
              <strong>OSHA Form 301</strong> — Injury and Illness Incident Report. One 301 is required for each case logged on the 300. Click any case to view or print the full 301 report.
            </div>
            {cases.map(c => (
              <Card key={c.id}>
                <div className="flex items-start gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-sm font-bold text-red-700">
                    301
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800">
                          Case #{c.caseNo} — {c.isPrivacy ? "Privacy Case" : c.employee}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Pill className={CLASS_STYLE[c.classification]}>{CLASS_LABEL[c.classification]}</Pill>
                          <Pill className="bg-slate-100 text-slate-600 text-xs">{INJURY_LABEL[c.injuryType]}</Pill>
                          <span className="text-xs text-slate-400">{fmt(c.date)} · {c.location}</span>
                          {c.isSevereInjury && <Pill className="bg-red-100 text-red-700 text-xs">⚠ Severe</Pill>}
                        </div>
                        <div className="mt-1.5 text-xs text-slate-500 line-clamp-2">{c.description}</div>
                      </div>
                      <button
                        onClick={() => setViewing301(c)}
                        className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        View 301
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            {cases.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                No 301 reports yet — log a case on the OSHA 300 Log tab.
              </div>
            )}
          </div>
        )}

        {/* Trends & Analysis */}
        {tab === "trends" && <TrendsTab cases={cases} incidents={incidents} oshaHours={oshaHours} />}
      </div>
    </div>
  );
}
