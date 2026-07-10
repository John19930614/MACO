"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GENERATOR_CATEGORY_META, type GeneratorCategory } from "@/lib/waste/generator-category";
import type { HierarchySplit } from "@/lib/waste/hierarchy";
import { upsertMinimizationProgram } from "@/lib/actions/waste-minimization-program";

export interface SiteOption {
  id: string;
  name: string;
  current_generator_category: GeneratorCategory | null;
}

export interface ProgramRow {
  id: string;
  name: string;
  waste_stream: string | null;
  due_date: string;
  status: string;
  approval_status: string;
  reduction_target_pct: number | null;
  estimated_roi_pct: number | null;
}

interface Props {
  headlineCategory: GeneratorCategory | null;
  split: HierarchySplit;
  openActions: number;
  programs: ProgramRow[];
  sites: SiteOption[];
  wasteStreamOptions: string[];
}

const kg = (v: number) => `${Math.round(v).toLocaleString()} kg`;

// Curated fall-back suggestions. These are merged with the tenant's real waste
// streams so the dropdown is useful even before any data exists — and every one
// of these fields still accepts a typed-in value (native <datalist> combobox).
const COMMON_WASTE_STREAMS = [
  "Spent solvents",
  "Used oil",
  "Waste paint & thinner",
  "Aerosol cans",
  "Corrosive acids",
  "Corrosive bases",
  "Ignitable waste",
  "Contaminated rags & absorbents",
  "Lab-pack chemicals",
  "Heavy-metal sludge",
  "Spent batteries",
  "Universal-waste lamps",
  "Mercury-containing devices",
  "Electronic waste (e-waste)",
  "Cutting oils & coolants",
  "Plating / rinse waste",
];

const PROGRAM_NAME_SUGGESTIONS = [
  "Solvent reduction program",
  "Paint & thinner waste minimization",
  "Aerosol elimination initiative",
  "Used-oil recycling program",
  "Rag & absorbent reuse program",
  "Chemical substitution program",
  "Packaging reduction program",
  "Coolant recovery & reuse program",
];

const TARGET_PCT_SUGGESTIONS = ["5", "10", "15", "20", "25", "30", "40", "50"];

// A native combobox: a text input backed by a <datalist>. Users pick from the
// suggestions OR type their own value — the "dropdown, but manual entry too"
// pattern. `inputMode` lets numeric comboboxes show the number keypad on mobile.
function ComboField({
  label,
  listId,
  value,
  onChange,
  options,
  invalid,
  placeholder = "Pick from the list or type your own…",
  inputMode,
}: {
  label: string;
  listId: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  options: string[];
  invalid?: boolean;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <input
        list={listId}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputMode={inputMode}
        className={`w-full rounded-md border px-3 py-2 text-sm ${invalid ? "border-red-400 bg-red-50" : "border-slate-300"}`}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </label>
  );
}

function StatusBadge({ status, approval }: { status: string; approval: string }) {
  // Approval takes visual priority — an unapproved program isn't "active" yet.
  if (approval !== "approved") {
    const label = approval === "rejected" ? "Rejected" : approval === "pending_approval" ? "Awaiting approval" : "Draft";
    const icon = approval === "rejected" ? "✕" : "•";
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
        <span aria-hidden>{icon}</span> {label}
      </span>
    );
  }
  const map: Record<string, { label: string; icon: string; cls: string }> = {
    active: { label: "Active", icon: "✓", cls: "bg-emerald-100 text-emerald-800" },
    overdue: { label: "Overdue", icon: "!", cls: "bg-red-100 text-red-800" },
    completed: { label: "Completed", icon: "✓", cls: "bg-blue-100 text-blue-800" },
    cancelled: { label: "Cancelled", icon: "✕", cls: "bg-slate-100 text-slate-700" },
  };
  const m = map[status] ?? map.active;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>
      <span aria-hidden>{m.icon}</span> {m.label}
    </span>
  );
}

interface FormState {
  name: string;
  wasteStream: string;
  siteId: string;
  baselineYear: string;
  baselineQuantityKg: string;
  reductionTargetPct: string;
  dueDate: string;
  estimatedCost: string;
  estimatedSavings: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  wasteStream: "",
  siteId: "",
  baselineYear: String(new Date().getFullYear()),
  baselineQuantityKg: "",
  reductionTargetPct: "",
  dueDate: "",
  estimatedCost: "",
  estimatedSavings: "",
};

export function HazardousWasteGenerator({ headlineCategory, split, openActions, programs, sites, wasteStreamOptions }: Props) {
  const router = useRouter();

  // Tenant's real waste streams first, then curated common ones (de-duplicated).
  const streamOptions = Array.from(new Set([...wasteStreamOptions, ...COMMON_WASTE_STREAMS]));
  // Baseline year suggestions: current year back 15 years.
  const thisYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 16 }, (_, i) => String(thisYear - i));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function validate(): boolean {
    const errs: Record<string, boolean> = {};
    if (!form.name.trim()) errs.name = true;
    if (!form.baselineYear || Number.isNaN(Number(form.baselineYear))) errs.baselineYear = true;
    if (form.baselineQuantityKg === "" || Number(form.baselineQuantityKg) < 0) errs.baselineQuantityKg = true;
    const pct = Number(form.reductionTargetPct);
    if (form.reductionTargetPct === "" || Number.isNaN(pct) || pct < 0 || pct > 100) errs.reductionTargetPct = true;
    if (!form.dueDate) errs.dueDate = true;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function onSave() {
    setSubmitError(null);
    if (!validate()) {
      setFormError("Please check the highlighted fields.");
      return;
    }
    setFormError(null);
    startTransition(async () => {
      const res = await upsertMinimizationProgram({
        siteId: form.siteId || undefined,
        name: form.name.trim(),
        wasteStream: form.wasteStream.trim() || undefined,
        baselineYear: Number(form.baselineYear),
        baselineQuantityKg: Number(form.baselineQuantityKg),
        reductionTargetPct: Number(form.reductionTargetPct),
        dueDate: form.dueDate,
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined,
        estimatedSavings: form.estimatedSavings ? Number(form.estimatedSavings) : undefined,
      });
      if (!res.ok) {
        setSubmitError(res.error);
        return;
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      router.refresh();
    });
  }

  const errCls = (k: string) =>
    `w-full rounded-md border px-3 py-2 text-sm ${fieldErrors[k] ? "border-red-400 bg-red-50" : "border-slate-300"}`;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Generator category</p>
          {headlineCategory ? (
            <>
              <p className="text-lg font-semibold">{GENERATOR_CATEGORY_META[headlineCategory].long}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{GENERATOR_CATEGORY_META[headlineCategory].description}</p>
            </>
          ) : (
            <p className="text-lg font-semibold text-slate-500 dark:text-slate-400">— (not yet computed)</p>
          )}
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Prevented vs. recycled vs. landfilled (YTD)</p>
          <p className="text-lg font-semibold">
            {kg(split.prevented)} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">prevented</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {kg(split.recycled)} recycled · {kg(split.landfilled)} landfilled
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Open compliance actions</p>
          <p className={`text-lg font-semibold ${openActions > 0 ? "text-red-700" : ""}`}>{openActions}</p>
        </div>
      </div>

      {/* Minimization programs */}
      <div className="rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Minimization programs</h2>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-white"
            >
              Add program
            </button>
          )}
        </div>

        {programs.length === 0 && !showForm ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            <p>Nothing here yet.</p>
            <p className="mt-1">Start by adding your first waste-minimization program.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 rounded-md bg-primary px-3 py-1.5 text-sm text-white"
            >
              Add your first program
            </button>
          </div>
        ) : programs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Waste stream</th>
                  <th className="py-2 pr-3 font-medium">Target</th>
                  <th className="py-2 pr-3 font-medium">Due date</th>
                  <th className="py-2 pr-3 font-medium">ROI</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{p.name}</td>
                    <td className="py-2 pr-3 text-slate-500 dark:text-slate-400">{p.waste_stream ?? "—"}</td>
                    <td className="py-2 pr-3">{p.reduction_target_pct != null ? `${p.reduction_target_pct}%` : "—"}</td>
                    <td className="py-2 pr-3">{p.due_date}</td>
                    <td className="py-2 pr-3">{p.estimated_roi_pct != null ? `${Math.round(p.estimated_roi_pct)}%` : "—"}</td>
                    <td className="py-2">
                      <StatusBadge status={p.status} approval={p.approval_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Create form */}
        {showForm && (
          <div className="mt-4 space-y-4 rounded-md border bg-slate-50/50 p-4">
            {formError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">{formError}</div>
            )}
            {submitError && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">{submitError}</div>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Fields with a ▾ let you pick from the list or type your own value.
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <ComboField
                label="Program name ▾"
                listId="program-name-options"
                value={form.name}
                onChange={set("name")}
                options={PROGRAM_NAME_SUGGESTIONS}
                invalid={!!fieldErrors.name}
              />
              <ComboField
                label="Waste stream ▾ (optional)"
                listId="waste-stream-options"
                value={form.wasteStream}
                onChange={set("wasteStream")}
                options={streamOptions}
              />
              {sites.length > 0 && (
                <label className="block">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Site (optional)</span>
                  <select className={errCls("siteId")} value={form.siteId} onChange={set("siteId")}>
                    <option value="">All sites</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <ComboField
                label="Baseline year ▾"
                listId="baseline-year-options"
                value={form.baselineYear}
                onChange={set("baselineYear")}
                options={yearOptions}
                invalid={!!fieldErrors.baselineYear}
                placeholder="e.g. 2025"
                inputMode="numeric"
              />
              <label className="block">
                <span className="text-xs text-slate-500 dark:text-slate-400">Baseline quantity (kg)</span>
                <input className={errCls("baselineQuantityKg")} value={form.baselineQuantityKg} onChange={set("baselineQuantityKg")} inputMode="decimal" placeholder="e.g. 1200" />
              </label>
              <ComboField
                label="Reduction target ▾ (%)"
                listId="reduction-target-options"
                value={form.reductionTargetPct}
                onChange={set("reductionTargetPct")}
                options={TARGET_PCT_SUGGESTIONS}
                invalid={!!fieldErrors.reductionTargetPct}
                placeholder="e.g. 20"
                inputMode="decimal"
              />
              <label className="block">
                <span className="text-xs text-slate-500 dark:text-slate-400">Due date</span>
                <input type="date" className={errCls("dueDate")} value={form.dueDate} onChange={set("dueDate")} />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500 dark:text-slate-400">Estimated cost (optional)</span>
                <input className={errCls("estimatedCost")} value={form.estimatedCost} onChange={set("estimatedCost")} inputMode="decimal" placeholder="e.g. 5000" />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500 dark:text-slate-400">Estimated savings (optional)</span>
                <input className={errCls("estimatedSavings")} value={form.estimatedSavings} onChange={set("estimatedSavings")} inputMode="decimal" placeholder="e.g. 8000" />
              </label>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onSave}
                disabled={pending}
                className="rounded-md bg-primary px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setFieldErrors({});
                  setFormError(null);
                  setSubmitError(null);
                }}
                disabled={pending}
                className="rounded-md border px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              New programs start as a draft. An EHS or safety manager approves them before they count as active.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
