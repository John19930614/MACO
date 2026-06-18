"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Wand2, ArrowRight } from "lucide-react";
import type { Site, SafetyLocation } from "@/lib/types";
import type { CellDraft, ExtractResult } from "@/lib/ai/extract";
import { SEVERITIES, SEVERITY_META, ENERGY_SOURCES, EXPOSURE_TYPES, CONTROL_GAPS } from "@/lib/constants";

const SAMPLE =
  "On the morning shift a forklift was unloading containers near the dock blind corner. The assigned spotter wasn't present and pedestrians were cutting through. The segregation was just movable cones, so it had drifted open.";

export function ExpIntake({ sites, locations }: { sites: Site[]; locations: SafetyLocation[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const siteLocations = locations.filter((l) => l.site_id === siteId);
  const [locationId, setLocationId] = useState(siteLocations[0]?.id ?? "");
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [draft, setDraft] = useState<CellDraft | null>(null);

  async function extract() {
    setExtracting(true);
    const res = await fetch("/api/ai/extract-cell", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (res.ok) {
      const { result } = await res.json();
      setResult(result);
      setDraft(result.draft);
    }
    setExtracting(false);
  }

  function set<K extends keyof CellDraft>(k: K, v: CellDraft[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  }
  function setGenome(k: keyof CellDraft["hazard_genome"], v: string) {
    setDraft((d) => (d ? { ...d, hazard_genome: { ...d.hazard_genome, [k]: v } } : d));
  }

  async function submit() {
    if (!draft) return;
    setSubmitting(true);
    const res = await fetch("/api/cells", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site_id: siteId,
        location_id: locationId,
        title: draft.title,
        description: draft.description,
        task: draft.task,
        severity: draft.severity,
        likelihood: draft.likelihood,
        status: "open",
        hazard_genome: draft.hazard_genome,
      }),
    });
    if (res.ok) {
      const { cell } = await res.json();
      // Log the EXP knowledge-ghost capture that produced this cell.
      await fetch("/api/arc/exp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: siteId, source: "ai_interview", subject: "EXP intake", summary: draft.title, hazard_memory: draft.hazard_genome }),
      });
      router.push(`/cells/${cell.id}`);
      router.refresh();
    } else {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      {/* Step 1: capture */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-exp)] text-xs font-bold text-white">1</span>
          <h2 className="text-sm font-semibold text-slate-800">Describe what you saw</h2>
          <button onClick={() => setText(SAMPLE)} className="ml-auto text-[11px] text-slate-400 hover:text-slate-700">try a sample</button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Plain language or a paste of an interview/debrief. EXP converts it into a structured Safety Cell.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="e.g. A forklift was unloading near the blind corner with no spotter and pedestrians cutting through…"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[var(--color-exp)] focus:outline-none focus:ring-1 focus:ring-[var(--color-exp)]"
        />
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select value={siteId} onChange={(e) => { setSiteId(e.target.value); const l = locations.find((x) => x.site_id === e.target.value); setLocationId(l?.id ?? ""); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {siteLocations.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </div>
        <button
          onClick={extract}
          disabled={text.trim().length < 8 || extracting}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-exp)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Extract with AI
        </button>
      </div>

      {/* Step 2: review draft */}
      {draft && result && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-exp)] text-xs font-bold text-white">2</span>
            <h2 className="text-sm font-semibold text-slate-800">Review the draft</h2>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
              <Sparkles className="h-3 w-3" /> {Math.round(result.confidence * 100)}% confidence
            </span>
          </div>
          {result.signals.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {result.signals.map((s, i) => <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{s}</span>)}
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Title" full>
              <input value={draft.title} onChange={(e) => set("title", e.target.value)} className={input} />
            </Field>
            <Field label="Task"><input value={draft.task} onChange={(e) => set("task", e.target.value)} className={input} /></Field>
            <Field label="Severity">
              <select value={draft.severity} onChange={(e) => set("severity", e.target.value as CellDraft["severity"])} className={input}>
                {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_META[s].label}</option>)}
              </select>
            </Field>
            <Field label="Likelihood (1-5)"><input type="number" min={1} max={5} value={draft.likelihood} onChange={(e) => set("likelihood", Number(e.target.value))} className={input} /></Field>
            <Field label="Energy source">
              <select value={draft.hazard_genome.energySource} onChange={(e) => setGenome("energySource", e.target.value)} className={input}>
                {ENERGY_SOURCES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Exposure type">
              <select value={draft.hazard_genome.exposureType} onChange={(e) => setGenome("exposureType", e.target.value)} className={input}>
                {EXPOSURE_TYPES.map((v) => <option key={v} value={v}>{v.replace(/_/g, " ")}</option>)}
              </select>
            </Field>
            <Field label="Trigger"><input value={draft.hazard_genome.trigger} onChange={(e) => setGenome("trigger", e.target.value)} className={input} /></Field>
            <Field label="Control gap">
              <select value={draft.hazard_genome.controlGap} onChange={(e) => setGenome("controlGap", e.target.value)} className={input}>
                {CONTROL_GAPS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
          </div>

          <button onClick={submit} disabled={submitting} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-pclss)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Create Safety Cell + log capture
          </button>
        </div>
      )}
    </div>
  );
}

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[var(--color-exp)] focus:outline-none focus:ring-1 focus:ring-[var(--color-exp)]";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={full ? "sm:col-span-2" : ""}>
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
