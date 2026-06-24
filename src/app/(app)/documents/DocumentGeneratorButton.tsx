"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDemoUser } from "@/lib/context/demo-user";
import {
  X, Wand2, ChevronRight, ChevronLeft, Check, FileText,
  Shield, AlertCircle, FlaskConical, Leaf, BookOpen, ClipboardList,
} from "lucide-react";
import { addDocument } from "@/lib/actions/ehs";
import { DOCUMENT_LIBRARY, LIBRARY_GROUPS, type LibraryDocument } from "./libraryTemplates";
import type { Chemical, Profile } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const SITE_ADDRESSES: Record<string, string> = {
  "t-biostar-001": "1200 Research Drive, Suite 400, San Francisco, CA 94105",
  "t-novabio-001": "900 Innovation Way, Suite 200, San Diego, CA 92121",
};

const GROUP_META: Record<string, { icon: React.ReactNode; color: string }> = {
  "EHS Programs":               { icon: <Shield className="h-5 w-5" />,       color: "bg-blue-50 text-blue-600 border-blue-200" },
  "Emergency Plans":            { icon: <AlertCircle className="h-5 w-5" />,  color: "bg-red-50 text-red-600 border-red-200" },
  "Biosafety":                  { icon: <FlaskConical className="h-5 w-5" />, color: "bg-purple-50 text-purple-600 border-purple-200" },
  "Waste Management":           { icon: <Leaf className="h-5 w-5" />,         color: "bg-green-50 text-green-600 border-green-200" },
  "Lab SOPs":                   { icon: <BookOpen className="h-5 w-5" />,     color: "bg-indigo-50 text-indigo-600 border-indigo-200" },
  "Regulatory & Recordkeeping": { icon: <ClipboardList className="h-5 w-5" />,color: "bg-amber-50 text-amber-600 border-amber-200" },
  "Forms & Checklists":         { icon: <FileText className="h-5 w-5" />,     color: "bg-teal-50 text-teal-600 border-teal-200" },
};

const CATEGORY_LABEL: Record<string, string> = {
  sop: "SOP", policy: "Policy", procedure: "Procedure",
  form: "Form", permit: "Permit", msds: "SDS",
  plan: "Plan", guideline: "Guideline",
};

const PRIORITY_STYLE: Record<string, string> = {
  required:    "bg-red-50 text-red-700 border border-red-200",
  recommended: "bg-amber-50 text-amber-700 border border-amber-200",
  optional:    "bg-slate-50 text-slate-500 border border-slate-200",
};

const REVIEW_PERIODS = [
  { value: 6,  label: "6 months" },
  { value: 12, label: "1 year" },
  { value: 24, label: "2 years" },
];

const STEPS = ["Choose Category", "Select Template", "Preview", "Finalize"];

// ── Substitution engine ───────────────────────────────────────────────────────

function applySubstitutions(
  text: string,
  chemicals: Chemical[],
  userInfo: { company: string; display_name: string; job_title: string; email: string; site_address: string },
): string {
  const phs = chemicals
    .filter((c) => c.status === "active" && c.ghs_classes.some((g) =>
      ["H300", "H310", "H330", "H340", "H350", "H351", "H361"].includes(g)
    ))
    .map((c) => c.name);

  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const nextYr = new Date();
  nextYr.setFullYear(nextYr.getFullYear() + 1);
  const nextYrStr = nextYr.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return text
    .replace(/\[COMPANY NAME\]/gi, userInfo.company)
    .replace(/\[COMPANY\]/gi, userInfo.company)
    .replace(/\[SITE ADDRESS\]/gi, userInfo.site_address)
    .replace(/\[CHO NAME\], \[TITLE\]/gi, `${userInfo.display_name}, ${userInfo.job_title}`)
    .replace(/\[CHO NAME\]/gi, userInfo.display_name)
    .replace(/\[TITLE\]/gi, userInfo.job_title)
    .replace(/\[PHONE\/EMAIL\]/gi, `(415) 555-0190 / ${userInfo.email}`)
    .replace(/\[PHONE\]/gi, "(415) 555-0190")
    .replace(/\[EMAIL\]/gi, userInfo.email)
    .replace(/\[LIST PHS CHEMICALS[^\]]*\]/gi,
      phs.length > 0 ? phs.join(", ") : "Formaldehyde, Xylene, Chloroform (see current inventory)")
    .replace(/\[DATE \+ 12 MONTHS\]/gi, nextYrStr)
    .replace(/\[DATE\]/gi, today);
}

// ── Main component ────────────────────────────────────────────────────────────

export function DocumentGeneratorButton({
  chemicals,
  profiles,
}: {
  chemicals: Chemical[];
  profiles: Profile[];
}) {
  const router = useRouter();
  const { user } = useDemoUser();
  const [open, setOpen]     = useState(false);
  const [step, setStep]     = useState<1 | 2 | 3 | 4>(1);
  const [group, setGroup]   = useState<string | null>(null);
  const [template, setTemplate] = useState<LibraryDocument | null>(null);
  const [ownerId, setOwnerId]   = useState("");
  const [reviewMonths, setReviewMonths] = useState(12);
  const [adding, setAdding] = useState(false);
  const [done, setDone]     = useState(false);

  const employees = profiles.filter((p) => p.active && p.tenant_id !== null);

  function reset() {
    setStep(1); setGroup(null); setTemplate(null);
    setOwnerId(""); setReviewMonths(12); setAdding(false); setDone(false);
  }

  function handleClose() { setOpen(false); reset(); }

  const groupTemplates = useMemo(
    () => (group ? DOCUMENT_LIBRARY.filter((d) => d.group === group) : []),
    [group],
  );

  async function handleGenerate() {
    if (!template) return;
    setAdding(true);
    const today    = new Date().toISOString().slice(0, 10);
    const reviewMs = new Date().setMonth(new Date().getMonth() + reviewMonths);
    const reviewDate = new Date(reviewMs).toISOString().slice(0, 10);
    // Persist the actual document body (template sections with the company's data
    // substituted in) — not just metadata. This is what gets stored + rendered.
    const siteAddress = SITE_ADDRESSES[user.tenant_id ?? ""] ?? `${user.company} Main Campus`;
    const content = template.sections.map((s) => ({
      heading: s.heading,
      body: applySubstitutions(s.body, chemicals, { ...user, site_address: siteAddress }),
    }));
    const fd = new FormData();
    fd.set("title",                    template.title);
    fd.set("category",                 template.category);
    fd.set("version",                  "1.0");
    fd.set("effective_date",           today);
    fd.set("review_date",              reviewDate);
    fd.set("status",                   "draft");
    fd.set("acknowledgment_required",  template.acknowledgmentRequired ? "true" : "false");
    fd.set("content",                  JSON.stringify(content));
    if (template.regulatoryBasis) fd.set("regulation_ref", template.regulatoryBasis);
    if (ownerId) fd.set("owner_id", ownerId);
    await addDocument(null, fd);
    setAdding(false);
    setDone(true);
    router.refresh();
  }

  function reviewLabel(months: number) {
    const d = new Date(Date.now() + months * 30.5 * 86400000);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700"
      >
        <Wand2 className="h-4 w-4" />
        Generate Document
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10">
          <div className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">

            {/* Header */}
            <div className="sticky top-0 z-10 rounded-t-2xl border-b border-slate-100 bg-white px-6 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-purple-600" />
                    <h2 className="text-base font-bold text-slate-900">Document Generator</h2>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Generate a customized EHS document pre-filled with {user.company}&apos;s regulatory context and chemical inventory.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Step indicator */}
              <div className="mt-4 flex items-center">
                {STEPS.map((s, i) => {
                  const n = i + 1;
                  const active = n === step;
                  const past   = n < step;
                  return (
                    <div key={s} className="flex items-center">
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        past ? "bg-emerald-500 text-white" : active ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-400"
                      }`}>
                        {past ? <Check className="h-3 w-3" /> : n}
                      </div>
                      <span className={`ml-1.5 text-xs font-medium ${active ? "text-slate-800" : "text-slate-400"}`}>{s}</span>
                      {i < STEPS.length - 1 && <ChevronRight className="mx-2 h-3.5 w-3.5 shrink-0 text-slate-300" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Step 1: Category ── */}
            {step === 1 && (
              <div className="p-6">
                <h3 className="mb-1 text-sm font-semibold text-slate-800">What type of document do you need?</h3>
                <p className="mb-4 text-xs text-slate-500">Choose from {user.company}&apos;s EHS document library categories.</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {LIBRARY_GROUPS.map((g) => {
                    const count = DOCUMENT_LIBRARY.filter((d) => d.group === g).length;
                    const meta  = GROUP_META[g] ?? { icon: <FileText className="h-5 w-5" />, color: "bg-slate-50 text-slate-600 border-slate-200" };
                    const sel   = group === g;
                    return (
                      <button
                        key={g}
                        onClick={() => setGroup(g)}
                        className={`flex flex-col items-center rounded-xl border-2 p-4 text-center transition ${
                          sel ? "border-purple-500 bg-purple-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl border ${
                          sel ? "bg-purple-100 text-purple-600 border-purple-200" : meta.color
                        }`}>
                          {meta.icon}
                        </div>
                        <span className={`text-xs font-semibold leading-tight ${sel ? "text-purple-700" : "text-slate-700"}`}>{g}</span>
                        <span className="mt-0.5 text-[10px] text-slate-400">{count} templates</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Step 2: Template ── */}
            {step === 2 && group && (
              <div className="p-6">
                <h3 className="mb-1 text-sm font-semibold text-slate-800">{group}</h3>
                <p className="mb-4 text-xs text-slate-500">{groupTemplates.length} templates — select one to generate.</p>
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {groupTemplates.map((doc) => {
                    const sel = template?.id === doc.id;
                    return (
                      <button
                        key={doc.id}
                        onClick={() => setTemplate(doc)}
                        className={`w-full rounded-xl border-2 p-4 text-left transition ${
                          sel ? "border-purple-500 bg-purple-50" : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                            sel ? "border-purple-500 bg-purple-500" : "border-slate-300"
                          }`}>
                            {sel && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">{doc.title}</span>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_STYLE[doc.priority]}`}>
                                {doc.priority}
                              </span>
                            </div>
                            <p className="mb-1 text-xs font-medium text-blue-600">{doc.regulatoryBasis}</p>
                            <p className="text-xs text-slate-500 line-clamp-2">{doc.description}</p>
                          </div>
                          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                            {CATEGORY_LABEL[doc.category] ?? doc.category}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Step 3: Preview ── */}
            {step === 3 && template && (
              <div className="p-6">
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                  <p className="text-xs text-emerald-800">
                    <strong>Pre-filled for {user.company}</strong> — company name, site address, EHS contact, and PHS chemical list substituted throughout.
                  </p>
                </div>
                <div className="max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-inner">
                  {/* Document header */}
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {user.company}
                    </div>
                    <h2 className="text-base font-bold text-slate-900">{template.title}</h2>
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
                      <span>Version: <strong className="text-slate-700">1.0</strong></span>
                      <span>Effective: <strong className="text-slate-700">{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong></span>
                      <span>Next Review: <strong className="text-slate-700">{reviewLabel(reviewMonths)}</strong></span>
                      <span>Regulatory Basis: <strong className="text-blue-600">{template.regulatoryBasis}</strong></span>
                    </div>
                  </div>
                  {/* Sections */}
                  <div className="divide-y divide-slate-50 px-5">
                    {template.sections.map((section, idx) => (
                      <div key={idx} className="py-4">
                        <h3 className="mb-2 text-sm font-semibold text-slate-900">{section.heading}</h3>
                        <div className="space-y-2">
                          {applySubstitutions(section.body, chemicals, {
                            ...user,
                            site_address: SITE_ADDRESSES[user.tenant_id ?? ""] ?? `${user.company} Main Campus`,
                          })
                            .split("\n\n")
                            .map((para, pi) => (
                              <p key={pi} className="whitespace-pre-line text-xs leading-relaxed text-slate-600">
                                {para}
                              </p>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 4: Finalize ── */}
            {step === 4 && template && (
              <div className="p-6">
                {done ? (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-12 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500">
                      <Check className="h-6 w-6 text-white" />
                    </div>
                    <div className="text-base font-bold text-emerald-800">Document Added to Register</div>
                    <p className="mt-1 text-sm text-emerald-700">
                      <strong>{template.title}</strong> has been added as a draft. Open the Document Register to review and publish it.
                    </p>
                    <button
                      onClick={handleClose}
                      className="mt-4 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Selected Template</div>
                      <div className="text-sm font-semibold text-slate-800">{template.title}</div>
                      <div className="mt-0.5 text-xs font-medium text-blue-600">{template.regulatoryBasis}</div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">Document Owner</label>
                      <select
                        value={ownerId}
                        onChange={(e) => setOwnerId(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                      >
                        <option value="">— No owner assigned —</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.display_name} ({e.role.replace(/_/g, " ")})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">Review Period</label>
                      <div className="flex gap-2">
                        {REVIEW_PERIODS.map((r) => (
                          <button
                            key={r.value}
                            onClick={() => setReviewMonths(r.value)}
                            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                              reviewMonths === r.value
                                ? "border-purple-500 bg-purple-50 text-purple-700"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Document will be created with:
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                        {[
                          ["Status",         "Draft"],
                          ["Version",        "1.0"],
                          ["Effective Date", new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })],
                          ["Review Date",    reviewLabel(reviewMonths)],
                        ].map(([k, v]) => (
                          <div key={k} className="flex items-center gap-2">
                            <span className="text-slate-400">{k}:</span>
                            <span className="font-semibold text-slate-700">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer nav */}
            {!done && (
              <div className="sticky bottom-0 flex items-center justify-between rounded-b-2xl border-t border-slate-100 bg-white px-6 py-4">
                <button
                  onClick={() => { if (step === 1) handleClose(); else setStep((s) => (s - 1) as 1 | 2 | 3 | 4); }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {step === 1 ? "Cancel" : "Back"}
                </button>

                {step < 4 ? (
                  <button
                    disabled={(step === 1 && !group) || (step === 2 && !template)}
                    onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
                    className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleGenerate}
                    disabled={adding}
                    className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-60"
                  >
                    {adding ? (
                      <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Generating…</>
                    ) : (
                      <><Wand2 className="h-4 w-4" /> Generate & Add to Register</>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
