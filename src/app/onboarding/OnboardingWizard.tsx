"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check, ChevronRight, ChevronLeft, FileCheck, AlertCircle, Sparkles, Upload, X, Loader2, Brain, Database, Users, BookOpen, FlaskConical, Wrench, ShieldCheck, CheckCircle2, GraduationCap, Scale, AlertTriangle, ClipboardList, FileText, Microscope, MapPin } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingData {
  legalName: string;
  siteName: string;
  siteState: string;
  siteCountry: string;
  industry: string;
  headcountRange: string;
  emrValue: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  docsAvailable: string[];
  additionalNotes: string;
  agreedToTerms: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  { id: "construction",   emoji: "🏗️",  label: "Construction" },
  { id: "manufacturing",  emoji: "🏭",  label: "Manufacturing" },
  { id: "chemical",       emoji: "⚗️",  label: "Chemical / Process" },
  { id: "healthcare",     emoji: "🏥",  label: "Healthcare" },
  { id: "biotech",        emoji: "🔬",  label: "Biotech / Life Sciences" },
  { id: "oil_gas",        emoji: "🛢️",  label: "Oil & Gas / Energy" },
  { id: "logistics",      emoji: "🚛",  label: "Logistics / Transport" },
  { id: "utilities",      emoji: "⚡",  label: "Utilities / Infrastructure" },
  { id: "food",           emoji: "🍽️",  label: "Food & Beverage" },
  { id: "general",        emoji: "🏢",  label: "General Industry" },
];

const HEADCOUNT_RANGES = ["1–10", "11–25", "26–50", "51–100", "101–250", "251–500", "500+"];

const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "NZ", label: "New Zealand" },
  { code: "GB", label: "United Kingdom" },
  { code: "other", label: "Other" },
];

const DOCS = [
  // ── Compliance & Policy ──────────────────────────────────────────────────────
  { id: "safety_manual",       label: "Company Safety Manual / IIPP",              note: "AI seeds legal requirements, training courses, and risk register" },
  { id: "sop",                 label: "Company SOPs & Policies",                   note: "PDF or Word — AI extracts each procedure into your document library" },
  { id: "erp",                 label: "Emergency Response Plan",                   note: "ERP, evacuation, spill & fire procedures — seeds document library" },
  { id: "permits",             label: "Environmental Permits & Licences",          note: "EPA/state air, water, waste permits — seeds legal register with due dates" },
  // ── People & Training ────────────────────────────────────────────────────────
  { id: "employees",           label: "Employee / User Roster",                    note: "CSV or Excel — imports your team into SafetyIQ" },
  { id: "org_chart",           label: "Org Chart / EHS Responsibilities",          note: "AI extracts roles and department structure" },
  { id: "training_req",        label: "Training Requirements & Records",           note: "Matrix, completion records, or certificates" },
  // ── Incidents & Audits ───────────────────────────────────────────────────────
  { id: "osha_logs",           label: "OSHA 300 / 300A / 301 Logs",               note: "AI imports 3-year injury & illness history into your incident register" },
  { id: "near_miss_log",       label: "Historical Near-Miss / First-Aid Log",      note: "Past near-misses and first-aid records — builds your baseline incident history" },
  { id: "audit_reports",       label: "Past Audit / Inspection Reports",           note: "PDF reports — AI imports findings and generates baseline CAPA items" },
  // ── Risk & Hazards ───────────────────────────────────────────────────────────
  { id: "jsa",                 label: "Risk Assessments / JSAs",                   note: "Job Safety Analyses, HAZOP studies, existing risk registers" },
  { id: "chemicals",           label: "Chemical Inventory List",                   note: "CSV, Excel, or PDF — seeds your chemical register" },
  { id: "hazard_waste",        label: "Hazardous Waste Records / Manifests",       note: "Generator logs, disposal manifests" },
  { id: "sds",                 label: "Safety Data Sheets (SDSs)",                 note: "Individual SDS PDFs for your chemicals" },
  // ── Equipment & Monitoring ───────────────────────────────────────────────────
  { id: "equipment_register",  label: "Equipment & Calibration Register",          note: "Spreadsheet with serial #s and next cal/inspection dates — seeds monitoring module" },
  { id: "ih_monitoring",       label: "Air / Noise / IH Monitoring Data",          note: "Industrial hygiene sampling results — stored as monitoring reports" },
  // ── Biosafety (labs & life sciences) ────────────────────────────────────────
  { id: "biosafety_inventory", label: "Biosafety Lab Inventory",                   note: "Lab register, BSL levels, biohazard agents — seeds biosafety module" },
  // ── Insurance & Insurance ─────────────────────────────────────────────────────
  { id: "coi",                 label: "Certificate of Insurance (COI)",            note: "Current GL & WC — stored as reference document" },
  { id: "emr_letter",          label: "EMR Letter from Insurance Carrier",         note: "Current rating — stored as reference document" },
];

const STEPS = ["Company Info", "Your Documents", "Launch"];

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function OnboardingWizard({ tenantId }: { tenantId: string }) {
  const router = useRouter();

  const [step, setStep]         = useState(0);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [summaryData, setSummaryData] = useState<Record<string, number> | null>(null);

  // Lifted from Step2Documents so handleSubmit can access the file paths
  const [uploads, setUploads]   = useState<UploadState>({});

  const [data, setData] = useState<OnboardingData>({
    legalName: "", siteName: "", siteState: "", siteCountry: "US",
    industry: "", headcountRange: "", emrValue: "",
    contactName: "", contactTitle: "", contactEmail: "", contactPhone: "",
    docsAvailable: [], additionalNotes: "",
    agreedToTerms: false,
  });

  function set<K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) {
    setData(prev => ({ ...prev, [k]: v }));
  }

  function toggleDoc(id: string) {
    setData(prev => ({
      ...prev,
      docsAvailable: prev.docsAvailable.includes(id)
        ? prev.docsAvailable.filter(d => d !== id)
        : [...prev.docsAvailable, id],
    }));
  }

  async function saveProgress() {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.from("tenants").update({ onboarding_data: data }).eq("id", tenantId);
  }

  async function handleNext() {
    setError("");
    if (step === 0) {
      if (!data.legalName.trim())    { setError("Please enter your company name."); return; }
      if (!data.industry)            { setError("Please select your industry."); return; }
      if (!data.headcountRange)      { setError("Please select your team size."); return; }
      if (!data.contactEmail.trim()) { setError("Please enter a contact email."); return; }
    }
    await saveProgress();
    setStep(s => s + 1);
  }

  async function handleSubmit() {
    if (!data.agreedToTerms) { setError("Please check the agreement box to continue."); return; }
    setSaving(true);
    setError("");

    const supabase = createClient();
    if (supabase) {
      // Save tenant record
      await supabase.from("tenants").update({
        onboarding_data: { ...data, emr_value: data.emrValue || null },
        impl_status: "onboarding",
        onboarding_completed_at: new Date().toISOString(),
        name: data.legalName || undefined,
        sector: data.industry || undefined,
      }).eq("id", tenantId);

      // Update the primary site with name, location, and headcount
      if (data.siteName.trim()) {
        await supabase.from("sites").update({
          name: data.siteName.trim(),
          address: data.siteState.trim() || null,
          country: data.siteCountry || "US",
        }).eq("tenant_id", tenantId);
      }
    }
    setSaving(false);

    // Collect uploaded files
    const uploadMap: Record<string, { name: string; path: string }[]> = {};
    for (const [docId, state] of Object.entries(uploads)) {
      if (state.files.length > 0) {
        uploadMap[docId] = state.files.map(f => ({ name: f.name, path: f.path }));
      }
    }

    const hasUploads = Object.keys(uploadMap).length > 0;
    if (hasUploads) {
      setProcessing(true);
      const steps = [0, 1, 2, 3, 4, 5, 6];
      let i = 0;
      const ticker = setInterval(() => {
        i = Math.min(i + 1, steps.length - 1);
        setProcessingStep(i);
      }, 2500);

      try {
        const resp = await fetch("/api/onboarding/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploads: uploadMap }),
        });
        const result = resp.ok ? await resp.json() : {};
        setSummaryData(result.seeded ?? {});
      } catch {
        setSummaryData({});
      } finally {
        clearInterval(ticker);
        setProcessing(false);
      }
    } else {
      // No uploads — skip processing, go straight to summary
      setSummaryData({});
    }
  }

  const pct = Math.round(((step + 0.5) / STEPS.length) * 100);

  // ── Processing overlay ──────────────────────────────────────────────────────
  if (processing) {
    const PROCESSING_STEPS = [
      { icon: Brain,        label: "Reading your documents & manuals…",          color: "text-blue-400"   },
      { icon: BookOpen,     label: "Extracting SOPs, procedures & policies…",    color: "text-violet-400" },
      { icon: FlaskConical, label: "Processing chemical & waste inventory…",     color: "text-purple-400" },
      { icon: Users,        label: "Extracting employee roster & org structure…", color: "text-emerald-400"},
      { icon: ShieldCheck,  label: "Importing audit & incident history…",        color: "text-rose-400"   },
      { icon: Wrench,       label: "Seeding equipment & monitoring data…",       color: "text-cyan-400"   },
      { icon: Database,     label: "Finalizing your platform setup…",            color: "text-amber-400"  },
    ];
    const active = PROCESSING_STEPS[processingStep] ?? PROCESSING_STEPS[0];
    const ActiveIcon = active.icon;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600/20 border border-blue-600/30">
            <ActiveIcon className={`h-10 w-10 ${active.color} animate-pulse`} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">AI is analyzing your documents</h2>
          <p className={`text-sm font-medium mb-8 transition-all duration-700 ${active.color}`}>{active.label}</p>
          <div className="space-y-2">
            {PROCESSING_STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className={`flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all ${
                  i < processingStep  ? "bg-emerald-900/20 border border-emerald-700/30" :
                  i === processingStep ? "bg-blue-900/30 border border-blue-700/40" :
                                         "bg-slate-800/30 border border-slate-700/20"
                }`}>
                  <Icon className={`h-4 w-4 shrink-0 ${
                    i < processingStep ? "text-emerald-400" : i === processingStep ? s.color : "text-slate-600"
                  }`} />
                  <span className={`text-sm ${
                    i < processingStep ? "text-emerald-300" : i === processingStep ? "text-white font-medium" : "text-slate-600"
                  }`}>{s.label}</span>
                  {i < processingStep && <Check className="ml-auto h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                  {i === processingStep && <Loader2 className="ml-auto h-3.5 w-3.5 text-blue-400 shrink-0 animate-spin" />}
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-xs text-slate-500">This usually takes 10–30 seconds</p>
        </div>
      </div>
    );
  }

  // ── Summary screen (shown after AI processing completes) ───────────────────
  if (summaryData !== null && !processing) {
    return (
      <SummaryScreen
        seeded={summaryData}
        companyName={data.legalName}
        onContinue={() => router.push("/dashboard?onboarding=complete")}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12">

      {/* Logo */}
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white select-none">IQ</div>
        <span className="text-lg font-bold text-white">SafetyIQ</span>
        <span className="text-slate-400 text-sm">by Reliance Predictive Safety Technologies</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">

        {/* Progress header */}
        <div className="border-b border-slate-800 px-8 pt-7 pb-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    i < step   ? "bg-emerald-500 text-white" :
                    i === step ? "bg-blue-600 text-white" :
                                 "bg-slate-800 text-slate-500"
                  }`}>
                    {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium mr-1 hidden sm:inline ${
                    i === step ? "text-white" : i < step ? "text-emerald-400" : "text-slate-500"
                  }`}>{s}</span>
                  {i < STEPS.length - 1 && (
                    <div className={`h-px w-8 mr-1 ${i < step ? "bg-emerald-500" : "bg-slate-700"}`} />
                  )}
                </div>
              ))}
            </div>
            <span className="text-xs text-slate-400 tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Step content */}
        <div className="px-8 py-7">
          {step === 0 && <Step1Company data={data} set={set} />}
          {step === 1 && <Step2Documents data={data} toggleDoc={toggleDoc} set={set} tenantId={tenantId} uploads={uploads} setUploads={setUploads} />}
          {step === 2 && <Step3Launch data={data} set={set} />}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-8 mb-4 flex items-center gap-2 rounded-xl border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {/* Nav */}
        <div className="flex items-center justify-between border-t border-slate-800 px-8 py-5">
          <button
            type="button"
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-[0.99]"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !data.agreedToTerms}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="h-4 w-4" />
              {saving ? "Launching…" : "Launch SafetyIQ"}
            </button>
          )}
        </div>
      </div>

      {/* Rep card */}
      <div className="mt-6 w-full max-w-xl flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-700/30 text-xs font-bold text-blue-300">RP</div>
        <div>
          <div className="text-sm font-semibold text-white">Your Reliance Safety Representative</div>
          <div className="mt-0.5 text-xs text-slate-300">
            We do the heavy lifting. Your rep will reach out within 1 business day to complete your EHS profile, configure your modules, and get your team set up — no extra work needed from you.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Company Info ─────────────────────────────────────────────────────

function Step1Company({ data, set }: {
  data: OnboardingData;
  set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Welcome — let&apos;s get you set up</h2>
        <p className="mt-1 text-sm text-slate-300">Just a few quick details. Our team handles the rest.</p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-200">
          Legal Company Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={data.legalName}
          onChange={e => set("legalName", e.target.value)}
          placeholder="e.g. MACO Environmental Inc."
          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition"
        />
      </div>

      {/* Primary location */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-200">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          Primary Location <span className="text-slate-500 font-normal">(optional)</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={data.siteName}
            onChange={e => set("siteName", e.target.value)}
            placeholder="Site name (e.g. Headquarters)"
            className="col-span-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition"
          />
          <input
            type="text"
            value={data.siteState}
            onChange={e => set("siteState", e.target.value)}
            placeholder="State / Province"
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition"
          />
          <select
            value={data.siteCountry}
            onChange={e => set("siteCountry", e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition"
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold text-slate-200">
          Primary Industry <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {INDUSTRIES.map(ind => (
            <button
              key={ind.id}
              type="button"
              onClick={() => set("industry", ind.id)}
              className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm font-medium transition ${
                data.industry === ind.id
                  ? "border-blue-500 bg-blue-600/20 text-white"
                  : "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-500 hover:text-white"
              }`}
            >
              <span className="text-lg leading-none">{ind.emoji}</span>
              <span className="flex-1">{ind.label}</span>
              {data.industry === ind.id && <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold text-slate-200">
          Team Size <span className="text-red-400">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {HEADCOUNT_RANGES.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => set("headcountRange", r)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                data.headcountRange === r
                  ? "border-blue-500 bg-blue-600/20 text-white"
                  : "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-500"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* EMR */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-200">
          Experience Modification Rate (EMR) <span className="text-slate-500 font-normal">— optional</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={data.emrValue}
            onChange={e => set("emrValue", e.target.value)}
            placeholder="e.g. 0.78"
            className="w-36 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition"
          />
          <p className="text-xs text-slate-400">Found on your EMR letter. Below 1.0 is better than industry average.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
        <div className="mb-3 text-xs font-semibold text-slate-200">
          Primary EHS Contact <span className="text-red-400">*</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {([
            { k: "contactName",  ph: "Full name",        t: "text"  },
            { k: "contactTitle", ph: "Job title",        t: "text"  },
            { k: "contactEmail", ph: "Email address",    t: "email" },
            { k: "contactPhone", ph: "Phone (optional)", t: "tel"   },
          ] as const).map(({ k, ph, t }) => (
            <input
              key={k}
              type={t}
              value={data[k]}
              onChange={e => set(k, e.target.value)}
              placeholder={ph}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Documents ────────────────────────────────────────────────────────

type UploadState = Record<string, { files: { name: string; size: number; path: string }[]; uploading: boolean; error: string }>;

function Step2Documents({ data, toggleDoc, set, tenantId, uploads, setUploads }: {
  data: OnboardingData;
  toggleDoc: (id: string) => void;
  set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;
  tenantId: string;
  uploads: UploadState;
  setUploads: React.Dispatch<React.SetStateAction<UploadState>>;
}) {
  function setUpload(docId: string, patch: Partial<UploadState[string]>) {
    setUploads(prev => ({
      ...prev,
      [docId]: { ...{ files: [], uploading: false, error: "" }, ...prev[docId], ...patch },
    }));
  }

  async function handleFiles(docId: string, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUpload(docId, { uploading: true, error: "" });

    const supabase = createClient();
    const uploaded: { name: string; size: number; path: string }[] = [
      ...(uploads[docId]?.files ?? []),
    ];

    for (const file of Array.from(fileList)) {
      if (file.size > 50 * 1024 * 1024) {
        setUpload(docId, { uploading: false, error: `${file.name} exceeds 50 MB limit.` });
        return;
      }
      const path = `${tenantId}/${docId}/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
      if (supabase) {
        const { error } = await supabase.storage
          .from("client-documents")
          .upload(path, file, { upsert: false });
        if (error) {
          setUpload(docId, { uploading: false, error: error.message });
          return;
        }
      }
      uploaded.push({ name: file.name, size: file.size, path });
    }

    setUpload(docId, { files: uploaded, uploading: false });
    if (!data.docsAvailable.includes(docId)) toggleDoc(docId);
  }

  function removeFile(docId: string, path: string) {
    const supabase = createClient();
    supabase?.storage.from("client-documents").remove([path]);
    const remaining = (uploads[docId]?.files ?? []).filter(f => f.path !== path);
    setUpload(docId, { files: remaining });
    if (remaining.length === 0 && data.docsAvailable.includes(docId)) toggleDoc(docId);
  }

  function fmtSize(bytes: number) {
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Upload your documents</h2>
        <p className="mt-1 text-sm text-slate-300">
          Upload whatever you have now — our team handles the rest. All files are securely stored and only accessible to your rep.
        </p>
      </div>

      <div className="space-y-3">
        {DOCS.map(doc => {
          const checked = data.docsAvailable.includes(doc.id);
          const up = uploads[doc.id];
          const hasFiles = (up?.files.length ?? 0) > 0;

          return (
            <div key={doc.id} className={`rounded-xl border transition ${
              hasFiles ? "border-emerald-600/50 bg-emerald-900/20" : "border-slate-700 bg-slate-800/30"
            }`}>
              {/* Header row */}
              <div className="flex items-center gap-3 p-3.5">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                  hasFiles ? "border-emerald-500 bg-emerald-600" : "border-slate-600 bg-slate-800"
                }`}>
                  {hasFiles && <Check className="h-3 w-3 text-white" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${hasFiles ? "text-white" : "text-slate-200"}`}>{doc.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{doc.note}</div>
                </div>
                {/* Upload button */}
                <label className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  up?.uploading
                    ? "border-slate-700 text-slate-500 cursor-not-allowed"
                    : "border-slate-600 text-slate-300 hover:border-blue-500 hover:text-blue-300"
                }`}>
                  {up?.uploading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Upload className="h-3.5 w-3.5" />}
                  {up?.uploading ? "Uploading…" : hasFiles ? "Add more" : "Upload"}
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
                    disabled={up?.uploading}
                    className="sr-only"
                    onChange={e => handleFiles(doc.id, e.target.files)}
                  />
                </label>
              </div>

              {/* Uploaded files */}
              {hasFiles && (
                <div className="border-t border-emerald-700/30 px-3.5 pb-3 pt-2 space-y-1.5">
                  {up!.files.map(f => (
                    <div key={f.path} className="flex items-center gap-2">
                      <FileCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span className="flex-1 truncate text-xs text-slate-200">{f.name}</span>
                      <span className="text-xs text-slate-500 shrink-0">{fmtSize(f.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(doc.id, f.path)}
                        className="shrink-0 text-slate-500 hover:text-red-400 transition"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload error */}
              {up?.error && (
                <div className="border-t border-red-800/40 px-3.5 pb-2.5 pt-2 text-xs text-red-400">
                  {up.error}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-200">
          Anything else we should know? <span className="text-slate-500 font-normal">(optional)</span>
        </label>
        <textarea
          value={data.additionalNotes}
          onChange={e => set("additionalNotes", e.target.value)}
          placeholder="e.g. We recently completed an OSHA inspection, our EMR is 0.78, we operate in 3 states..."
          rows={3}
          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition resize-none"
        />
      </div>

      <div className="rounded-xl border border-blue-800/40 bg-blue-900/15 px-4 py-3.5">
        <p className="text-sm text-blue-200">
          <span className="font-semibold">Don&apos;t have everything?</span>{" "}
          <span className="text-blue-300">Upload what you have now and skip the rest. Your rep will follow up for anything missing after launch.</span>
        </p>
      </div>
    </div>
  );
}

// ─── Summary Screen ───────────────────────────────────────────────────────────

const SUMMARY_STATS: { key: string; label: string; icon: React.ElementType; color: string }[] = [
  { key: "chemicals",          label: "Chemicals imported",        icon: FlaskConical,   color: "text-purple-400 bg-purple-900/30 border-purple-700/40"  },
  { key: "training_courses",   label: "Training courses",          icon: GraduationCap,  color: "text-emerald-400 bg-emerald-900/30 border-emerald-700/40"},
  { key: "legal_requirements", label: "Legal requirements",        icon: Scale,          color: "text-blue-400 bg-blue-900/30 border-blue-700/40"        },
  { key: "risk_assessments",   label: "Risk assessments",          icon: ShieldCheck,    color: "text-amber-400 bg-amber-900/30 border-amber-700/40"     },
  { key: "incidents",          label: "Historical incidents",      icon: AlertTriangle,  color: "text-red-400 bg-red-900/30 border-red-700/40"           },
  { key: "equipment",          label: "Equipment items",           icon: Wrench,         color: "text-cyan-400 bg-cyan-900/30 border-cyan-700/40"        },
  { key: "audits",             label: "Past audits imported",      icon: ClipboardList,  color: "text-violet-400 bg-violet-900/30 border-violet-700/40"  },
  { key: "sop_documents",      label: "Documents & SOPs",          icon: FileText,       color: "text-slate-300 bg-slate-800/60 border-slate-600/40"     },
  { key: "employees",          label: "Employees extracted",       icon: Users,          color: "text-emerald-400 bg-emerald-900/30 border-emerald-700/40"},
  { key: "biosafety_labs",     label: "Biosafety labs",            icon: Microscope,     color: "text-teal-400 bg-teal-900/30 border-teal-700/40"        },
];

function SummaryScreen({ seeded, companyName, onContinue }: {
  seeded: Record<string, number>;
  companyName: string;
  onContinue: () => void;
}) {
  const populated = SUMMARY_STATS.filter(s => (seeded[s.key] ?? 0) > 0);
  const total = Object.values(seeded).reduce((a, b) => a + b, 0);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-lg text-center">

        {/* Success icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-600/20 border border-emerald-600/30">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">
          {companyName ? `${companyName} is ready!` : "Your platform is ready!"}
        </h1>
        <p className="text-sm text-slate-400 mb-8">
          {total > 0
            ? `We imported ${total.toLocaleString()} records across your modules — your team can start working right away.`
            : "Your workspace is activated. Upload documents later to auto-populate your modules."}
        </p>

        {/* Seeded stats grid */}
        {populated.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-8 text-left">
            {populated.map(({ key, label, icon: Icon, color }) => (
              <div key={key} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${color}`}>
                <Icon className="h-4 w-4 shrink-0" />
                <div>
                  <div className="text-lg font-bold text-white leading-none">{(seeded[key] ?? 0).toLocaleString()}</div>
                  <div className="text-xs mt-0.5 opacity-80">{label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* What's next */}
        {total === 0 && (
          <div className="mb-8 space-y-2 text-left">
            {["Your dashboard is live and ready to explore.", "Upload documents from Settings to auto-populate your modules.", "Your Reliance rep will follow up within 1 business day."].map((t, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg bg-slate-800/30 px-4 py-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600/30 text-[10px] font-bold text-blue-300">{i + 1}</span>
                <span className="text-sm text-slate-200">{t}</span>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onContinue}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-500 active:scale-[0.99]"
        >
          <Sparkles className="h-4 w-4" />
          Go to my dashboard
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Launch ───────────────────────────────────────────────────────────

function Step3Launch({ data, set }: {
  data: OnboardingData;
  set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;
}) {
  const industry = INDUSTRIES.find(i => i.id === data.industry);
  const docCount = data.docsAvailable.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">You&apos;re almost in</h2>
        <p className="mt-1 text-sm text-slate-300">Review your details and launch your workspace.</p>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/40 divide-y divide-slate-700/60">
        {([
          ["Company",        data.legalName || "—"],
          ["Industry",       industry ? `${industry.emoji} ${industry.label}` : "—"],
          ["Team size",      data.headcountRange ? `${data.headcountRange} employees` : "—"],
          ["EHS contact",    data.contactEmail || "—"],
          ["Docs confirmed", docCount > 0 ? `${docCount} confirmed` : "None yet — that's fine"],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
            <span className="text-sm font-medium text-white">{value}</span>
          </div>
        ))}
      </div>

      {/* What happens next */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">What happens next</div>
        {[
          "Your SafetyIQ workspace is activated immediately.",
          "A Reliance rep contacts you within 1 business day to complete your EHS profile.",
          "We configure your compliance modules, hazard library, and team access — you don't lift a finger.",
        ].map((text, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg bg-slate-800/30 px-4 py-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600/30 text-[10px] font-bold text-blue-300">{i + 1}</span>
            <span className="text-sm text-slate-200">{text}</span>
          </div>
        ))}
      </div>

      {/* Agreement */}
      <button
        type="button"
        onClick={() => set("agreedToTerms", !data.agreedToTerms)}
        className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
          data.agreedToTerms
            ? "border-emerald-600/50 bg-emerald-900/15"
            : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
        }`}
      >
        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
          data.agreedToTerms ? "border-emerald-500 bg-emerald-600" : "border-slate-600 bg-slate-800"
        }`}>
          {data.agreedToTerms && <Check className="h-3 w-3 text-white" />}
        </span>
        <span className="text-sm text-slate-200 leading-relaxed">
          I confirm the information above is accurate and authorize Reliance Predictive Safety Technologies to configure our SafetyIQ platform. I understand a representative will contact me to complete setup.
        </span>
      </button>
    </div>
  );
}
