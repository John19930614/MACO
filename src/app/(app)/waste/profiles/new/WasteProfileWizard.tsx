"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FlaskConical, Beaker, ClipboardList, Sparkles, CheckCircle2, Search,
  ChevronLeft, ChevronRight, AlertTriangle, Loader2, ShieldCheck,
} from "lucide-react";
import { Card, CardHeader, Pill } from "@/components/ui/primitives";
import { Field, Input, Select, Textarea } from "@/components/modals/Modal";
import { draftWasteProfileFromChemicals, submitWasteProfileFromWizard } from "@/lib/actions/ehs";
import { playCreateSound } from "@/lib/sounds";
import { WASTE_CLASSIFICATIONS } from "@/lib/constants";
import type { Chemical, WasteStream, WasteProfileConstituent, WasteProfileAiSuggestions } from "@/lib/types";

const STEPS = ["Select chemicals", "Composition", "Characterization", "AI draft", "Review & submit"];

const PHYSICAL_STATES = [
  { value: "solid", label: "Solid" },
  { value: "liquid", label: "Liquid" },
  { value: "sludge", label: "Sludge / Semi-solid" },
  { value: "gas", label: "Gas / Aerosol" },
];

interface Answers {
  generation_process: string;
  physical_state: string;
  free_liquids: string;
  ph: string;
  ignitable: string;
  monthly_volume: string;
  container_type: string;
}

const EMPTY_ANSWERS: Answers = {
  generation_process: "",
  physical_state: "liquid",
  free_liquids: "no",
  ph: "",
  ignitable: "unsure",
  monthly_volume: "",
  container_type: "",
};

export function WasteProfileWizard({ chemicals, streams }: { chemicals: Chemical[]; streams: WasteStream[] }) {
  const router = useRouter();
  const [submitting, startSubmit] = useTransition();

  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pct, setPct] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Answers>({ ...EMPTY_ANSWERS });

  // Reviewed/editable profile fields (seeded by the AI draft).
  const [name, setName] = useState("");
  const [wasteStreamId, setWasteStreamId] = useState("");
  const [wasteCode, setWasteCode] = useState("");
  const [classification, setClassification] = useState("hazardous");
  const [processDescription, setProcessDescription] = useState("");
  const [hazardSummary, setHazardSummary] = useState("");
  const [aiDraft, setAiDraft] = useState<WasteProfileAiSuggestions | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => Object.fromEntries(chemicals.map((c) => [c.id, c])), [chemicals]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chemicals;
    return chemicals.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.cas_number ?? "").toLowerCase().includes(q),
    );
  }, [chemicals, search]);

  const total = useMemo(
    () => selectedIds.reduce((sum, id) => sum + (parseFloat(pct[id]) || 0), 0),
    [selectedIds, pct],
  );

  const constituents: WasteProfileConstituent[] = useMemo(
    () =>
      selectedIds.map((id) => {
        const c = byId[id];
        return {
          chemical_id: id,
          name: c?.name ?? "Unknown",
          cas_number: c?.cas_number ?? null,
          percentage: parseFloat(pct[id]) || 0,
          ghs_classes: c?.ghs_classes ?? [],
          hazard_statements: c?.hazard_statements ?? [],
          physical_state: c?.physical_state ?? null,
        };
      }),
    [selectedIds, pct, byId],
  );

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // ── Per-step validation ────────────────────────────────────────────────────
  function canAdvance(): string | null {
    if (step === 0) return selectedIds.length === 0 ? "Select at least one chemical." : null;
    if (step === 1) {
      if (total <= 0) return "Enter a percentage for at least one chemical.";
      if (total > 100.0001) return "Total composition exceeds 100%. Adjust the percentages.";
      return null;
    }
    if (step === 2) {
      if (!answers.generation_process.trim()) return "Describe how this waste is generated.";
      if (!answers.physical_state) return "Select the physical state.";
      return null;
    }
    if (step === 3) return !name.trim() ? "Generate the draft and give the profile a name." : null;
    return null;
  }

  function next() {
    const err = canAdvance();
    if (err) { setError(err); return; }
    setError(null);
    const target = step + 1;
    setStep(target);
    if (target === 3 && !aiDraft) void runDraft();
  }
  function back() { setError(null); setStep((s) => Math.max(0, s - 1)); }

  // ── AI / rules draft ─────────────────────────────────────────────────────────
  async function runDraft() {
    setAiPending(true);
    setAiError(null);
    try {
      const res = await draftWasteProfileFromChemicals({ constituents, answers: answers as unknown as Record<string, string> });
      if (res.ok) {
        const d = res.draft;
        setAiDraft(d);
        setClassification(d.classification || "hazardous");
        setWasteCode(d.waste_code || "");
        setProcessDescription(d.process_description || answers.generation_process || "");
        setHazardSummary(d.hazard_summary || "");
        if (!name.trim()) {
          const lead = constituents[0]?.name ?? "Chemical";
          setName(constituents.length > 1 ? `${lead} mixture waste` : `${lead} waste`);
        }
      } else {
        setAiError(res.error);
      }
    } catch {
      setAiError("Draft failed — you can still fill the fields in manually.");
    } finally {
      setAiPending(false);
    }
  }

  // ── Submit for approval ───────────────────────────────────────────────────────
  function submit() {
    if (!name.trim()) { setError("Profile name is required."); return; }
    setError(null);
    startSubmit(async () => {
      const res = await submitWasteProfileFromWizard({
        name,
        waste_stream_id: wasteStreamId || null,
        waste_code: wasteCode || null,
        classification,
        physical_state: answers.physical_state || null,
        process_description: processDescription || null,
        hazard_summary: hazardSummary || null,
        composition: constituents,
        questionnaire: answers as unknown as Record<string, string>,
        ai_suggestions: aiDraft,
      });
      if (res.ok) {
        playCreateSound();
        router.push("/waste");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const totalTone =
    total > 100.0001 ? "text-red-600" : total === 100 ? "text-emerald-600" : "text-amber-600";
  const totalBar =
    total > 100.0001 ? "bg-red-500" : total === 100 ? "bg-emerald-500" : "bg-amber-400";

  if (chemicals.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <FlaskConical className="h-7 w-7 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">No active chemicals in inventory</p>
          <p className="max-w-md text-xs text-slate-500">
            Add chemicals in the Chemical Management module first — the waste profile wizard builds
            from your active inventory.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                i < step ? "bg-emerald-500 text-white" : i === step ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span className={`text-xs font-medium ${i === step ? "text-slate-800" : "text-slate-400"}`}>{label}</span>
            {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
          </li>
        ))}
      </ol>

      <Card>
        {/* ── Step 0: select chemicals ─────────────────────────────────────── */}
        {step === 0 && (
          <>
            <CardHeader
              title="Select chemicals from inventory"
              subtitle="CAS numbers and GHS hazards are pulled in automatically"
              right={<Pill className="bg-blue-100 text-blue-700">{selectedIds.length} selected</Pill>}
            />
            <div className="p-4">
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or CAS number…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="max-h-[24rem] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {filtered.map((c) => {
                  const on = selectedIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(c.id)}
                      className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 ${on ? "bg-blue-50/60" : ""}`}
                    >
                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"}`}>
                        {on && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium text-slate-800">{c.name}</span>
                          {c.cas_number && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">CAS {c.cas_number}</span>}
                          {c.physical_state && <span className="text-[10px] text-slate-400">{c.physical_state}</span>}
                        </span>
                        {(c.hazard_statements?.length ?? 0) > 0 && (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {c.hazard_statements.slice(0, 6).map((h) => (
                              <span key={h} className="rounded bg-amber-50 px-1.5 py-0.5 font-mono text-[9.5px] text-amber-700">{h}</span>
                            ))}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="px-3 py-8 text-center text-sm text-slate-400">No chemicals match “{search}”.</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Step 1: composition ──────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <CardHeader title="Set the composition" subtitle="Enter the approximate weight percentage of each chemical" right={<Beaker className="h-4 w-4 text-slate-300" />} />
            <div className="p-4">
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {constituents.map((c) => (
                  <div key={c.chemical_id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{c.name}</p>
                      <p className="font-mono text-[10px] text-slate-400">{c.cas_number ? `CAS ${c.cas_number}` : "no CAS"}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number" min="0" max="100" step="0.1" inputMode="decimal"
                        value={pct[c.chemical_id] ?? ""}
                        onChange={(e) => setPct((p) => ({ ...p, [c.chemical_id]: e.target.value }))}
                        placeholder="0"
                        className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                      />
                      <span className="text-sm text-slate-400">%</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Live total */}
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-500">Total composition</span>
                  <span className={`font-bold ${totalTone}`}>{total.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full transition-all ${totalBar}`} style={{ width: `${Math.min(100, total)}%` }} />
                </div>
                {total > 100.0001 ? (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600"><AlertTriangle className="h-3 w-3" /> Over 100% — reduce one or more values.</p>
                ) : total > 0 && total < 100 ? (
                  <p className="mt-1.5 text-[11px] text-amber-600">Remaining {(100 - total).toFixed(1)}% will be recorded as water / inert balance.</p>
                ) : total === 100 ? (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Fully characterized.</p>
                ) : null}
              </div>
            </div>
          </>
        )}

        {/* ── Step 2: guided questions ─────────────────────────────────────── */}
        {step === 2 && (
          <>
            <CardHeader title="A few questions" subtitle="These guide the classification — answer what you know" right={<ClipboardList className="h-4 w-4 text-slate-300" />} />
            <div className="flex flex-col gap-4 p-4">
              <Field label="How is this waste generated?" required>
                <Textarea
                  value={answers.generation_process}
                  onChange={(e) => setAnswers((a) => ({ ...a, generation_process: e.target.value }))}
                  placeholder="e.g. Spent solvent from HPLC column cleaning in Lab A"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Physical state" required>
                  <Select value={answers.physical_state} onChange={(e) => setAnswers((a) => ({ ...a, physical_state: e.target.value }))}>
                    {PHYSICAL_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Select>
                </Field>
                <Field label="Contains free liquids?">
                  <Select value={answers.free_liquids} onChange={(e) => setAnswers((a) => ({ ...a, free_liquids: e.target.value }))}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </Select>
                </Field>
                {(answers.physical_state === "liquid" || answers.physical_state === "sludge") && (
                  <Field label="pH (if known)">
                    <Input value={answers.ph} onChange={(e) => setAnswers((a) => ({ ...a, ph: e.target.value }))} placeholder="e.g. 2.5" />
                  </Field>
                )}
                <Field label="Ignitable / flammable?">
                  <Select value={answers.ignitable} onChange={(e) => setAnswers((a) => ({ ...a, ignitable: e.target.value }))}>
                    <option value="unsure">Not sure</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </Select>
                </Field>
                <Field label="Approx. monthly volume">
                  <Input value={answers.monthly_volume} onChange={(e) => setAnswers((a) => ({ ...a, monthly_volume: e.target.value }))} placeholder="e.g. 20 L/month" />
                </Field>
                <Field label="Container type">
                  <Input value={answers.container_type} onChange={(e) => setAnswers((a) => ({ ...a, container_type: e.target.value }))} placeholder="e.g. 5-gal carboy" />
                </Field>
              </div>
            </div>
          </>
        )}

        {/* ── Step 3: AI draft ─────────────────────────────────────────────── */}
        {step === 3 && (
          <>
            <CardHeader
              title="Drafted profile"
              subtitle="SafetyIQ drafted this from your chemicals and answers — review and edit every field"
              right={
                <button type="button" onClick={() => void runDraft()} disabled={aiPending} className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50">
                  <Sparkles className="h-3.5 w-3.5" /> {aiPending ? "Drafting…" : "Regenerate"}
                </button>
              }
            />
            <div className="flex flex-col gap-4 p-4">
              {aiPending && (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-violet-100 bg-violet-50/60 py-8 text-sm text-violet-700">
                  <Loader2 className="h-4 w-4 animate-spin" /> Drafting characterization…
                </div>
              )}
              {!aiPending && aiError && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{aiError}</div>
              )}
              {!aiPending && aiDraft && (
                <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2 text-xs text-violet-800">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div>
                    <span className="font-semibold">{aiDraft.generated_by === "ai" ? "AI suggestion" : "Rules-based suggestion"}: </span>
                    {aiDraft.rationale}
                  </div>
                </div>
              )}

              <Field label="Profile name" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Halogenated solvents waste" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Classification">
                  <Select value={classification} onChange={(e) => setClassification(e.target.value)}>
                    {WASTE_CLASSIFICATIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                  </Select>
                </Field>
                <Field label="EPA / waste code">
                  <Input value={wasteCode} onChange={(e) => setWasteCode(e.target.value)} placeholder="D001 / F003" />
                </Field>
              </div>
              <Field label="Link to waste stream (optional)">
                <Select value={wasteStreamId} onChange={(e) => setWasteStreamId(e.target.value)}>
                  <option value="">— Not linked —</option>
                  {streams.map((s) => <option key={s.id} value={s.id}>{s.waste_name}{s.waste_code ? ` (${s.waste_code})` : ""}</option>)}
                </Select>
              </Field>
              <Field label="Process description">
                <Textarea value={processDescription} onChange={(e) => setProcessDescription(e.target.value)} />
              </Field>
              <Field label="Hazard summary">
                <Textarea value={hazardSummary} onChange={(e) => setHazardSummary(e.target.value)} />
              </Field>
            </div>
          </>
        )}

        {/* ── Step 4: review & submit ──────────────────────────────────────── */}
        {step === 4 && (
          <>
            <CardHeader title="Review & submit for approval" subtitle="Nothing is finalized until an EHS reviewer approves it" right={<ShieldCheck className="h-4 w-4 text-slate-300" />} />
            <div className="flex flex-col gap-4 p-4">
              <div className="rounded-lg border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-800">{name || "Untitled profile"}</span>
                  <span className="flex items-center gap-1.5">
                    <Pill className="bg-slate-100 text-slate-600">{classification.replace(/_/g, " ")}</Pill>
                    {wasteCode && <Pill className="bg-red-50 text-red-700">{wasteCode}</Pill>}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-1.5 text-left">Constituent</th>
                      <th className="px-3 py-1.5 text-left">CAS</th>
                      <th className="px-3 py-1.5 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {constituents.map((c) => (
                      <tr key={c.chemical_id}>
                        <td className="px-3 py-1.5 text-slate-700">{c.name}</td>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-slate-400">{c.cas_number ?? "—"}</td>
                        <td className="px-3 py-1.5 text-right text-slate-700">{c.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hazardSummary && (
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Hazard summary</p>
                  <p className="mt-0.5 text-sm text-slate-600">{hazardSummary}</p>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                Submitting sends this profile to <strong>EHS Review</strong>. A reviewer must approve it before it can be activated for container assignment.
              </div>
            </div>
          </>
        )}

        {/* Footer / nav */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <div className="min-h-[1rem] text-xs text-red-600">{error}</div>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" onClick={back} disabled={submitting} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={next} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={submitting} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {submitting ? "Submitting…" : "Submit for approval"}
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
