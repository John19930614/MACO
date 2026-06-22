"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Building2, Layers, Shield, Users, FileText, CheckCircle,
  ChevronRight, ChevronLeft, Check, AlertCircle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface OnboardingData {
  // Step 1 — Company Profile
  legalName: string;
  dba: string;
  address: string;
  city: string;
  state: string;
  country: string;
  employees: string;
  yearsInBusiness: string;
  primaryContactName: string;
  primaryContactTitle: string;
  primaryContactEmail: string;
  primaryContactPhone: string;

  // Step 2 — Industry & Scope
  industry: string;
  subIndustries: string[];
  hazardTriggers: string[];
  regulatoryFrameworks: string[];
  numberOfSites: string;
  statesOfOperation: string;

  // Step 3 — Safety History
  emr: string;
  trir: string;
  dart: string;
  recordables: string;
  existingPrograms: string[];
  certifications: string[];
  recentIncidentsSummary: string;
  openCitations: string;
  safetyGoals: string;

  // Step 4 — Team
  teamMembers: TeamMember[];

  // Step 5 — Documents
  documentsAcknowledged: string[];
  additionalNotes: string;

  // Step 6 — Legal
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  digitalSignature: string;
  dateSigned: string;
  agreementsChecked: string[];
  signatureId: string;
  signatureTimestamp: string;
}

interface TeamMember {
  name: string;
  title: string;
  email: string;
  role: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: "company",   label: "Company Profile",   icon: Building2 },
  { id: "industry",  label: "Industry & Scope",  icon: Layers },
  { id: "safety",    label: "Safety History",    icon: Shield },
  { id: "team",      label: "Your Team",         icon: Users },
  { id: "documents", label: "Documents",         icon: FileText },
  { id: "legal",     label: "Sign-Off",          icon: CheckCircle },
];

const INDUSTRIES = [
  { id: "construction",           label: "Construction",                    emoji: "🏗️" },
  { id: "biotechnology",          label: "Biotechnology / Life Sciences",   emoji: "🧬" },
  { id: "chemical_manufacturing", label: "Chemical / Manufacturing",        emoji: "⚗️" },
  { id: "healthcare",             label: "Healthcare / Medical",            emoji: "🏥" },
  { id: "general_industry",       label: "General Industry",               emoji: "🏭" },
  { id: "food_beverage",          label: "Food & Beverage",                emoji: "🍔" },
  { id: "oil_gas_mining",         label: "Oil, Gas & Mining",              emoji: "⛏️" },
  { id: "transportation",         label: "Transportation / Logistics",     emoji: "🚚" },
  { id: "environmental",          label: "Environmental Services",         emoji: "🌿" },
  { id: "other",                  label: "Other",                          emoji: "🏢" },
];

const HAZARD_TRIGGERS: Record<string, { label: string; industries: string[] }> = {
  falls:           { label: "Fall exposure / elevated work / MEWPs",       industries: ["construction", "general_industry"] },
  confined_space:  { label: "Confined spaces",                             industries: ["construction", "chemical_manufacturing", "oil_gas_mining", "general_industry"] },
  loto:            { label: "LOTO / energized work / stored energy",       industries: ["construction", "chemical_manufacturing", "general_industry", "food_beverage"] },
  hot_work:        { label: "Hot work / welding / cutting",                industries: ["construction", "general_industry", "oil_gas_mining"] },
  crane_rigging:   { label: "Cranes, hoisting or rigging",                industries: ["construction", "general_industry"] },
  excavation:      { label: "Excavation / trenching",                     industries: ["construction", "oil_gas_mining", "environmental"] },
  hazcom:          { label: "Chemicals / HazCom / SDS management",        industries: ["chemical_manufacturing", "biotechnology", "healthcare", "construction", "food_beverage"] },
  silica:          { label: "Silica / dust / respiratory hazards",        industries: ["construction", "chemical_manufacturing", "oil_gas_mining"] },
  respiratory:     { label: "Respirators / fit testing",                  industries: ["chemical_manufacturing", "biotechnology", "construction", "healthcare"] },
  bsl_labs:        { label: "Biosafety labs (BSL-1 through BSL-4)",       industries: ["biotechnology", "healthcare"] },
  biohazard:       { label: "Biohazardous materials / bloodborne pathogens", industries: ["biotechnology", "healthcare"] },
  radiation:       { label: "Ionizing / non-ionizing radiation",          industries: ["healthcare", "biotechnology", "oil_gas_mining"] },
  machine_guarding:{ label: "Machine guarding / point of operation",      industries: ["general_industry", "food_beverage", "chemical_manufacturing"] },
  ergonomics:      { label: "Ergonomics / MSD prevention",                industries: ["healthcare", "food_beverage", "general_industry"] },
  fleet_dot:       { label: "Fleet / DOT / CDL vehicles",                 industries: ["transportation", "construction", "food_beverage"] },
  psm:             { label: "Process Safety Management (PSM / RMP)",      industries: ["chemical_manufacturing", "oil_gas_mining"] },
  ammonia:         { label: "Ammonia / refrigeration systems",            industries: ["food_beverage", "chemical_manufacturing"] },
  sub_tier:        { label: "Subcontractors / lower-tier vendors",        industries: ["construction", "general_industry"] },
  weather:         { label: "Heat, cold, lightning or severe weather",    industries: ["construction", "oil_gas_mining", "transportation", "environmental"] },
  public:          { label: "Public interface / occupied facilities",     industries: ["construction", "healthcare"] },
};

const REGULATORY_FRAMEWORKS = [
  "OSHA 29 CFR 1910 (General Industry)",
  "OSHA 29 CFR 1926 (Construction)",
  "MSHA (Mining)",
  "EPA / RCRA / TSCA",
  "DOT / FMCSA",
  "NRC (Nuclear)",
  "FDA / cGMP",
  "Cal-OSHA",
  "State plan OSHA (non-Cal)",
  "ISO 45001",
  "VPP / SHARP",
];

const EXISTING_PROGRAMS = [
  "Written Safety Manual / IIPP",
  "JHA / JSA / AHA process",
  "Incident reporting & investigation",
  "Corrective action / CAPA",
  "Emergency Action Plan",
  "Training matrix & records",
  "Inspection program",
  "Contractor management",
  "PPE assessment",
  "Safety committee / meetings",
  "Stop Work Authority policy",
  "Near-miss reporting",
];

const CERTIFICATIONS = [
  "ISO 45001",
  "OSHA VPP Star / Merit",
  "ISNetworld",
  "Avetta",
  "Veriforce",
  "PEC Premier",
  "RAVS / PICS",
  "SHARP",
  "MCAA Safety Program",
  "NUCA Safety Program",
];

const ROLES = ["EHS Manager", "EHS Coordinator", "Site Safety Officer", "Operations Manager", "Supervisor", "Executive Sponsor", "Viewer"];

const AGREEMENTS = [
  { id: "accuracy",        title: "Accuracy & Completeness Certification",         text: "I certify that all submitted information, documents, records, and safety data are accurate, current, and complete to the best of my knowledge. I agree not to omit, alter, or misrepresent material safety or compliance information." },
  { id: "responsibility",  title: "Client Responsibility Acknowledgment",          text: "My company remains solely responsible for its employees, subcontractors, means and methods, work planning, jobsite conditions, supervision, safety compliance, and regulatory obligations. This platform does not control the work or replace competent supervision." },
  { id: "ai_review",       title: "AI Assistance & Human Review Acknowledgment",   text: "I acknowledge that AI-generated outputs may assist with organization, risk identification, and document drafting, but must be reviewed and approved by competent personnel before being relied upon or implemented." },
  { id: "platform_terms",  title: "Platform Terms & Data Use Consent",             text: "I authorize use of submitted materials for platform configuration, compliance workflow setup, reporting, and related services. I have authority to bind my organization to these terms." },
];

const REQUIRED_DOCUMENTS = [
  { id: "coi",          label: "Certificate of Insurance (COI)",           required: true },
  { id: "safety_manual",label: "Current Company Safety Manual / IIPP",     required: true },
  { id: "osha_logs",    label: "OSHA 300 / 300A / 301 Logs (last 3 years)", required: true },
  { id: "emr_letter",   label: "Current EMR Letter",                       required: true },
  { id: "org_chart",    label: "Organization Chart / EHS Responsibilities", required: false },
  { id: "training",     label: "Training Matrix & Records",                 required: false },
  { id: "w9",           label: "W-9 / Tax Entity Information",              required: false },
];

// ─── Default State ───────────────────────────────────────────────────────────

const DEFAULT_DATA: OnboardingData = {
  legalName: "", dba: "", address: "", city: "", state: "", country: "US",
  employees: "", yearsInBusiness: "",
  primaryContactName: "", primaryContactTitle: "", primaryContactEmail: "", primaryContactPhone: "",
  industry: "", subIndustries: [], hazardTriggers: [], regulatoryFrameworks: [], numberOfSites: "1", statesOfOperation: "",
  emr: "", trir: "", dart: "", recordables: "",
  existingPrograms: [], certifications: [], recentIncidentsSummary: "", openCitations: "", safetyGoals: "",
  teamMembers: [{ name: "", title: "", email: "", role: "EHS Manager" }],
  documentsAcknowledged: [], additionalNotes: "",
  signerName: "", signerTitle: "", signerEmail: "", digitalSignature: "", dateSigned: "",
  agreementsChecked: [], signatureId: "", signatureTimestamp: "",
};

// ─── Helper Components ───────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-300">
        {label}{required && <span className="ml-1 text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", className = "" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition ${className}`}
    />
  );
}

function CheckPill({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-left transition ${
        checked
          ? "border-blue-500/60 bg-blue-600/20 text-blue-300"
          : "border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-500"
      }`}
    >
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${checked ? "border-blue-500 bg-blue-600" : "border-slate-600"}`}>
        {checked && <Check className="h-2.5 w-2.5 text-white" />}
      </span>
      {label}
    </button>
  );
}

// ─── Steps ───────────────────────────────────────────────────────────────────

function Step1Company({ data, set }: { data: OnboardingData; set: (k: keyof OnboardingData, v: string) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-base font-semibold text-white">Company Details</h3>
        <p className="text-xs text-slate-400">Enter your company&apos;s legal information exactly as it appears on your business registration.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Legal Company Name" required>
          <Input value={data.legalName} onChange={v => set("legalName", v)} placeholder="MACO Environmental Inc." />
        </Field>
        <Field label="DBA / Trade Name">
          <Input value={data.dba} onChange={v => set("dba", v)} placeholder="Optional" />
        </Field>
        <Field label="Business Address" required>
          <Input value={data.address} onChange={v => set("address", v)} placeholder="123 Safety Blvd" />
        </Field>
        <Field label="City" required>
          <Input value={data.city} onChange={v => set("city", v)} placeholder="City" />
        </Field>
        <Field label="State / Province" required>
          <Input value={data.state} onChange={v => set("state", v)} placeholder="e.g. TX" />
        </Field>
        <Field label="Country" required>
          <Input value={data.country} onChange={v => set("country", v)} placeholder="US" />
        </Field>
        <Field label="Number of Employees" required>
          <Input type="number" value={data.employees} onChange={v => set("employees", v)} placeholder="0" />
        </Field>
        <Field label="Years in Business">
          <Input type="number" value={data.yearsInBusiness} onChange={v => set("yearsInBusiness", v)} placeholder="0" />
        </Field>
      </div>

      <div className="border-t border-slate-700/50 pt-5">
        <h3 className="mb-1 text-base font-semibold text-white">Primary EHS Contact</h3>
        <p className="mb-4 text-xs text-slate-400">The main point of contact for EHS and compliance matters.</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full Name" required>
            <Input value={data.primaryContactName} onChange={v => set("primaryContactName", v)} placeholder="Jane Smith" />
          </Field>
          <Field label="Title / Role" required>
            <Input value={data.primaryContactTitle} onChange={v => set("primaryContactTitle", v)} placeholder="EHS Manager" />
          </Field>
          <Field label="Email Address" required>
            <Input type="email" value={data.primaryContactEmail} onChange={v => set("primaryContactEmail", v)} placeholder="jane@company.com" />
          </Field>
          <Field label="Phone">
            <Input value={data.primaryContactPhone} onChange={v => set("primaryContactPhone", v)} placeholder="(555) 000-0000" />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Step2Industry({ data, set, toggle }: {
  data: OnboardingData;
  set: (k: keyof OnboardingData, v: string) => void;
  toggle: (k: "hazardTriggers" | "regulatoryFrameworks", v: string) => void;
}) {
  const relevantHazards = Object.entries(HAZARD_TRIGGERS).filter(([, h]) =>
    !data.industry || h.industries.includes(data.industry) || h.industries.length > 3
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-base font-semibold text-white">Primary Industry</h3>
        <p className="mb-4 text-xs text-slate-400">Select your primary industry. This adapts the platform&apos;s hazard library, compliance requirements, and module defaults.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {INDUSTRIES.map(ind => (
            <button
              key={ind.id}
              type="button"
              onClick={() => set("industry", ind.id)}
              className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm transition ${
                data.industry === ind.id
                  ? "border-blue-500 bg-blue-600/20 text-white"
                  : "border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-500"
              }`}
            >
              <span className="text-xl">{ind.emoji}</span>
              <span className="font-medium">{ind.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-700/50 pt-5">
        <h3 className="mb-1 text-base font-semibold text-white">Hazard Triggers</h3>
        <p className="mb-4 text-xs text-slate-400">Select all hazard types present in your operations. This unlocks the relevant EHS modules and compliance libraries.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {relevantHazards.map(([id, h]) => (
            <CheckPill
              key={id}
              checked={data.hazardTriggers.includes(id)}
              label={h.label}
              onChange={() => toggle("hazardTriggers", id)}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-slate-700/50 pt-5">
        <h3 className="mb-1 text-base font-semibold text-white">Regulatory Frameworks</h3>
        <p className="mb-4 text-xs text-slate-400">Which regulatory standards govern your operations?</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {REGULATORY_FRAMEWORKS.map(rf => (
            <CheckPill
              key={rf}
              checked={data.regulatoryFrameworks.includes(rf)}
              label={rf}
              onChange={() => toggle("regulatoryFrameworks", rf)}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-slate-700/50 pt-5">
        <Field label="Number of Sites / Locations">
          <Input type="number" value={data.numberOfSites} onChange={v => set("numberOfSites", v)} placeholder="1" />
        </Field>
        <Field label="States / Regions of Operation">
          <Input value={data.statesOfOperation} onChange={v => set("statesOfOperation", v)} placeholder="TX, CA, OH..." />
        </Field>
      </div>
    </div>
  );
}

function Step3Safety({ data, set, toggle }: {
  data: OnboardingData;
  set: (k: keyof OnboardingData, v: string) => void;
  toggle: (k: "existingPrograms" | "certifications", v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-base font-semibold text-white">Safety Performance Metrics</h3>
        <p className="mb-4 text-xs text-slate-400">Enter your most recent full-year safety metrics. Leave blank if not yet tracked.</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Current EMR">
            <Input type="number" value={data.emr} onChange={v => set("emr", v)} placeholder="1.00" />
          </Field>
          <Field label="TRIR">
            <Input type="number" value={data.trir} onChange={v => set("trir", v)} placeholder="0.0" />
          </Field>
          <Field label="DART Rate">
            <Input type="number" value={data.dart} onChange={v => set("dart", v)} placeholder="0.0" />
          </Field>
          <Field label="OSHA Recordables">
            <Input type="number" value={data.recordables} onChange={v => set("recordables", v)} placeholder="0" />
          </Field>
        </div>
      </div>

      <div className="border-t border-slate-700/50 pt-5">
        <h3 className="mb-1 text-base font-semibold text-white">Existing Safety Programs</h3>
        <p className="mb-4 text-xs text-slate-400">Select all programs currently in place at your company.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {EXISTING_PROGRAMS.map(p => (
            <CheckPill
              key={p}
              checked={data.existingPrograms.includes(p)}
              label={p}
              onChange={() => toggle("existingPrograms", p)}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-slate-700/50 pt-5">
        <h3 className="mb-1 text-base font-semibold text-white">Safety Certifications</h3>
        <p className="mb-4 text-xs text-slate-400">Current third-party certifications or approved contractor registrations.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CERTIFICATIONS.map(c => (
            <CheckPill
              key={c}
              checked={data.certifications.includes(c)}
              label={c}
              onChange={() => toggle("certifications", c)}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-slate-700/50 pt-5 sm:grid-cols-2">
        <Field label="Recent Incidents / Issues Summary">
          <textarea
            value={data.recentIncidentsSummary}
            onChange={e => set("recentIncidentsSummary", e.target.value)}
            placeholder="Briefly describe any significant incidents, near-misses, or repeat issues in the past 3 years."
            className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition min-h-[90px] resize-y"
          />
        </Field>
        <Field label="Your Top EHS Goals for the Next 12 Months">
          <textarea
            value={data.safetyGoals}
            onChange={e => set("safetyGoals", e.target.value)}
            placeholder="e.g. Reduce TRIR by 25%, achieve ISO 45001, build a near-miss culture..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition min-h-[90px] resize-y"
          />
        </Field>
        <Field label="Open OSHA Citations / Enforcement Actions">
          <Input value={data.openCitations} onChange={v => set("openCitations", v)} placeholder="None, or describe briefly" />
        </Field>
      </div>
    </div>
  );
}

function Step4Team({ data, setTeam }: {
  data: OnboardingData;
  setTeam: (i: number, k: keyof TeamMember, v: string) => void;
  addTeam: () => void;
  removeTeam: (i: number) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-1 text-base font-semibold text-white">EHS Team Members</h3>
        <p className="text-xs text-slate-400">Add the people who will use SafetyIQ. They&apos;ll receive invite emails after onboarding is complete.</p>
      </div>
      {data.teamMembers.map((m, i) => (
        <div key={i} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
          <Field label="Full Name">
            <Input value={m.name} onChange={v => setTeam(i, "name", v)} placeholder="Jane Smith" />
          </Field>
          <Field label="Title">
            <Input value={m.title} onChange={v => setTeam(i, "title", v)} placeholder="EHS Coordinator" />
          </Field>
          <Field label="Email">
            <Input type="email" value={m.email} onChange={v => setTeam(i, "email", v)} placeholder="jane@company.com" />
          </Field>
          <Field label="Platform Role">
            <select
              value={m.role}
              onChange={e => setTeam(i, "role", e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60 transition"
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
        </div>
      ))}
      <p className="text-xs text-slate-500">Additional team members can be invited from Settings after onboarding.</p>
    </div>
  );
}

function Step5Documents({ data, toggle }: {
  data: OnboardingData;
  toggle: (k: "documentsAcknowledged", v: string) => void;
  set: (k: keyof OnboardingData, v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-1 text-base font-semibold text-white">Required Documents</h3>
        <p className="text-xs text-slate-400">Check each document you have ready to provide. Your Reliance onboarding rep will collect them via secure upload link.</p>
      </div>

      <div className="rounded-xl border border-slate-700/50 overflow-hidden">
        {REQUIRED_DOCUMENTS.map((doc, i) => (
          <div key={doc.id} className={`flex items-start gap-3 p-4 ${i > 0 ? "border-t border-slate-700/40" : ""}`}>
            <button
              type="button"
              onClick={() => toggle("documentsAcknowledged", doc.id)}
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                data.documentsAcknowledged.includes(doc.id)
                  ? "border-emerald-500 bg-emerald-600"
                  : "border-slate-600 bg-slate-800"
              }`}
            >
              {data.documentsAcknowledged.includes(doc.id) && <Check className="h-3 w-3 text-white" />}
            </button>
            <div>
              <div className="text-sm font-medium text-white">{doc.label}</div>
              {doc.required && (
                <span className="mt-1 inline-block rounded-full bg-red-900/40 px-2 py-0.5 text-[10px] font-semibold text-red-300 border border-red-800/50">
                  Required
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-blue-800/40 bg-blue-900/20 p-4 text-sm text-blue-300">
        <AlertCircle className="mb-2 h-4 w-4" />
        <strong className="text-blue-200">Document Upload</strong>
        <p className="mt-1 text-xs text-blue-300/70">
          Your onboarding representative will send a secure upload link within 1 business day.
          You do not need to upload files here — just confirm what you have available.
        </p>
      </div>
    </div>
  );
}

function Step6Legal({ data, set, toggle }: {
  data: OnboardingData;
  set: (k: keyof OnboardingData, v: string) => void;
  toggle: (k: "agreementsChecked", v: string) => void;
  onSign: () => void;
}) {
  const allChecked = AGREEMENTS.every(a => data.agreementsChecked.includes(a.id));

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-1 text-base font-semibold text-white">Legal Acknowledgments</h3>
        <p className="text-xs text-slate-400">Review and accept each acknowledgment. These are attorney-review-ready templates — final contract language should be reviewed by counsel before live use.</p>
      </div>

      {AGREEMENTS.map(a => (
        <div key={a.id} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
          <h4 className="mb-2 text-sm font-semibold text-white">{a.title}</h4>
          <p className="mb-3 text-xs text-slate-400 leading-relaxed">{a.text}</p>
          <CheckPill
            checked={data.agreementsChecked.includes(a.id)}
            label="I have authority to sign and agree to this acknowledgment."
            onChange={() => toggle("agreementsChecked", a.id)}
          />
        </div>
      ))}

      <div className="rounded-xl border border-slate-600 bg-slate-800/50 p-5">
        <h4 className="mb-4 text-sm font-semibold text-white">Electronic Signature</h4>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Authorized Signer Full Name" required>
            <Input value={data.signerName} onChange={v => set("signerName", v)} placeholder="Full legal name" />
          </Field>
          <Field label="Title / Authority" required>
            <Input value={data.signerTitle} onChange={v => set("signerTitle", v)} placeholder="e.g. President, EHS Director" />
          </Field>
          <Field label="Signer Email" required>
            <Input type="email" value={data.signerEmail} onChange={v => set("signerEmail", v)} placeholder="signer@company.com" />
          </Field>
          <Field label="Date Signed" required>
            <Input type="date" value={data.dateSigned} onChange={v => set("dateSigned", v)} />
          </Field>
          <div className="col-span-2">
            <Field label="Digital Signature — Type Your Full Legal Name" required>
              <Input value={data.digitalSignature} onChange={v => set("digitalSignature", v)} placeholder="Type full legal name to sign" />
            </Field>
          </div>
        </div>
        {data.signatureId && (
          <div className="mt-4 rounded-lg bg-emerald-900/30 border border-emerald-700/50 px-4 py-3 text-xs text-emerald-300">
            <strong>Signature recorded:</strong> {data.signatureId} — {data.signatureTimestamp}
          </div>
        )}
      </div>

      {!allChecked && (
        <p className="text-xs text-amber-400 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" />
          Please check all acknowledgment boxes above before submitting.
        </p>
      )}
    </div>
  );
}

// ─── Main Wizard ─────────────────────────────────────────────────────────────

export default function OnboardingWizard({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(DEFAULT_DATA);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(k: keyof OnboardingData, v: string) {
    setData(prev => ({ ...prev, [k]: v }));
  }

  function toggle(k: "hazardTriggers" | "regulatoryFrameworks" | "existingPrograms" | "certifications" | "documentsAcknowledged" | "agreementsChecked", v: string) {
    setData(prev => {
      const arr = prev[k] as string[];
      return { ...prev, [k]: arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v] };
    });
  }

  function setTeam(i: number, k: keyof TeamMember, v: string) {
    setData(prev => {
      const members = [...prev.teamMembers];
      members[i] = { ...members[i], [k]: v };
      return { ...prev, teamMembers: members };
    });
  }

  function addTeam() {
    setData(prev => ({ ...prev, teamMembers: [...prev.teamMembers, { name: "", title: "", email: "", role: "EHS Coordinator" }] }));
  }

  function removeTeam(i: number) {
    setData(prev => ({ ...prev, teamMembers: prev.teamMembers.filter((_, idx) => idx !== i) }));
  }

  function recordSignature() {
    const id = "SIG-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const ts = new Date().toLocaleString();
    setData(prev => ({ ...prev, signatureId: id, signatureTimestamp: ts }));
    return id;
  }

  async function saveToSupabase(finalData: OnboardingData) {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.from("tenants").update({
      onboarding_data: finalData,
      impl_status: "onboarding",
      name: finalData.legalName || undefined,
      sector: finalData.industry || undefined,
      country: finalData.country || undefined,
    }).eq("id", tenantId);
  }

  async function handleNext() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      await saveToSupabase(data);
    }
  }

  async function handleSubmit() {
    const allAgreed = AGREEMENTS.every(a => data.agreementsChecked.includes(a.id));
    if (!allAgreed || !data.signerName || !data.digitalSignature || !data.dateSigned) {
      setError("Please complete all signature fields and check all acknowledgments.");
      return;
    }
    setError("");
    setSaving(true);
    const sigId = recordSignature();
    const finalData = { ...data, signatureId: sigId, signatureTimestamp: new Date().toLocaleString() };

    const supabase = createClient();
    if (supabase) {
      await supabase.from("tenants").update({
        onboarding_data: finalData,
        impl_status: "onboarding",
        onboarding_completed_at: new Date().toISOString(),
        name: finalData.legalName || undefined,
        sector: finalData.industry || undefined,
        country: finalData.country || undefined,
      }).eq("id", tenantId);
    }
    setSaving(false);
    router.push("/dashboard?onboarding=complete");
  }

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">IQ</div>
              <span className="text-sm font-semibold text-white">SafetyIQ</span>
              <span className="text-slate-500">/</span>
              <span className="text-sm text-slate-400">Company Onboarding</span>
            </div>
            <div className="text-xs text-slate-500">{pct}% complete</div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>

          {/* Step tabs */}
          <div className="mt-3 flex gap-1 overflow-x-auto">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < step;
              const active = i === step;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => i < step && setStep(i)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition ${
                    active ? "bg-blue-600/20 text-blue-400 font-semibold" :
                    done  ? "text-slate-400 hover:text-white cursor-pointer" :
                    "text-slate-600 cursor-default"
                  }`}
                >
                  {done ? <Check className="h-3 w-3 text-emerald-400" /> : <Icon className="h-3 w-3" />}
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{i + 1}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">{STEPS[step].label}</h2>
          <p className="mt-1 text-sm text-slate-400">Step {step + 1} of {STEPS.length}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          {step === 0 && <Step1Company data={data} set={set} />}
          {step === 1 && <Step2Industry data={data} set={set} toggle={toggle} />}
          {step === 2 && <Step3Safety data={data} set={set} toggle={toggle} />}
          {step === 3 && <Step4Team data={data} setTeam={setTeam} addTeam={addTeam} removeTeam={removeTeam} />}
          {step === 4 && <Step5Documents data={data} toggle={toggle} set={set} />}
          {step === 5 && (
            <Step6Legal data={data} set={set} toggle={toggle} onSign={recordSignature} />
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Nav buttons */}
        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-700 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {saving ? "Submitting…" : "Complete Onboarding"}
              <CheckCircle className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Add team member button on Step 4 */}
        {step === 3 && (
          <button
            type="button"
            onClick={addTeam}
            className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition"
          >
            + Add another team member
          </button>
        )}
      </div>
    </div>
  );
}
