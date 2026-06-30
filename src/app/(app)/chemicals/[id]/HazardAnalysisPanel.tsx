"use client";

import { useState, useTransition } from "react";
import {
  FlaskConical, Zap, AlertTriangle, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Info, ShieldAlert, Clock,
} from "lucide-react";
import { runHazardAnalysis, saveHazardReview } from "@/lib/actions/chemicalHazard";
import type { HazardAnalysisResult, PhysicalState } from "@/lib/chemicals/hazardEngine";
import type { Chemical } from "@/lib/types";

// ── Hazard band colours ────────────────────────────────────────────────────────

const BAND_CONFIG = {
  none:     { label: "No significant hazard",   bg: "bg-slate-50",    border: "border-slate-200",  badge: "bg-slate-100 text-slate-600",   icon: CheckCircle2, iconCls: "text-slate-400" },
  low:      { label: "Low hazard",               bg: "bg-emerald-50",  border: "border-emerald-200",badge: "bg-emerald-100 text-emerald-700",icon: CheckCircle2, iconCls: "text-emerald-500" },
  medium:   { label: "Medium hazard",            bg: "bg-amber-50",    border: "border-amber-200",  badge: "bg-amber-100 text-amber-700",   icon: AlertTriangle,iconCls: "text-amber-500" },
  high:     { label: "High hazard",              bg: "bg-orange-50",   border: "border-orange-200", badge: "bg-orange-100 text-orange-700", icon: ShieldAlert,  iconCls: "text-orange-500" },
  critical: { label: "Critical hazard",          bg: "bg-red-50",      border: "border-red-200",    badge: "bg-red-100 text-red-700",       icon: XCircle,      iconCls: "text-red-500" },
};

const SEVERITY_CONFIG = {
  info:     { cls: "bg-blue-50 text-blue-700 border-blue-100" },
  warning:  { cls: "bg-amber-50 text-amber-700 border-amber-100" },
  danger:   { cls: "bg-orange-50 text-orange-700 border-orange-100" },
  critical: { cls: "bg-red-50 text-red-700 border-red-100" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-emerald-400" : value >= 60 ? "bg-amber-400" : "bg-red-400";
  const label = value >= 80 ? "High confidence" : value >= 60 ? "AI is uncertain — human review required" : "Low confidence — human review required";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-slate-500">Confidence</span>
        <span className={`text-[10px] font-semibold ${value >= 80 ? "text-emerald-600" : value >= 60 ? "text-amber-600" : "text-red-600"}`}>{label}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function HazardBadge({ band }: { band: keyof typeof BAND_CONFIG }) {
  const cfg = BAND_CONFIG[band];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.badge}`}>
      <Icon className={`h-3.5 w-3.5 ${cfg.iconCls}`} />
      {cfg.label}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function HazardAnalysisPanel({ chemical }: { chemical: Chemical }) {
  const [concentrationPct, setConcentrationPct] = useState<number>(chemical.concentration_pct ?? 100);
  const [physicalState, setPhysicalState] = useState<PhysicalState>((chemical.physical_state as PhysicalState) ?? "liquid");
  const [dilutionNotes, setDilutionNotes] = useState("");
  const [result, setResult] = useState<HazardAnalysisResult | null>(null);
  const [phase, setPhase] = useState<"idle" | "result" | "review" | "done" | "error">("idle");
  const [reviewReason, setReviewReason] = useState("");
  const [reviewDecision, setReviewDecision] = useState<"accepted" | "overridden">("accepted");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showFactors, setShowFactors] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Estimate quantity in kg from chemical record
  const estimatedKg: number | null = (() => {
    if (!chemical.quantity || !chemical.unit) return null;
    const q = chemical.quantity;
    const u = chemical.unit.toLowerCase();
    if (u === "kg") return q;
    if (u === "g") return q / 1000;
    if (u === "l" || u === "liters" || u === "litres") return q * 0.8;  // ~0.8 kg/L average
    if (u === "ml") return q * 0.0008;
    if (u === "t" || u === "tonnes") return q * 1000;
    return q;
  })();

  function handleAnalyze() {
    startTransition(async () => {
      try {
        const res = await runHazardAnalysis({
          chemicalId: chemical.id,
          chemicalName: chemical.name,
          casNumber: chemical.cas_number,
          hStatements: chemical.hazard_statements ?? [],
          concentrationPct,
          physicalState,
          quantityKg: estimatedKg,
          storageLocation: chemical.storage_location,
          sdsExpiry: chemical.sds_expiry,
          dilutionNotes,
        });
        if (!res.ok || !res.result) {
          setErrorMsg(res.error ?? "Analysis failed — please try again.");
          setPhase("error");
          return;
        }
        setResult(res.result);
        setPhase("result");
        setShowFactors(false);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Unexpected error.");
        setPhase("error");
      }
    });
  }

  function handleSave() {
    if (!result) return;
    if (!reviewReason.trim()) {
      setErrorMsg("Please enter a reason before saving.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await saveHazardReview({
          chemicalId: chemical.id,
          chemicalName: chemical.name,
          casNumber: chemical.cas_number,
          hStatements: chemical.hazard_statements ?? [],
          concentrationPct,
          physicalState,
          quantityKg: estimatedKg,
          storageLocation: chemical.storage_location,
          sdsExpiry: chemical.sds_expiry,
          dilutionNotes,
          result,
          reviewDecision,
          reviewReason,
        });
        if (!res.ok) {
          setErrorMsg(res.error ?? "Save failed — please try again.");
          return;
        }
        setPhase("done");
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Unexpected error.");
      }
    });
  }

  function handleReset() {
    setPhase("idle");
    setResult(null);
    setReviewReason("");
    setErrorMsg(null);
    setShowFactors(false);
  }

  // ── Done state ──────────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Classification saved to audit log</p>
            <p className="mt-0.5 text-xs text-emerald-700">
              The hazard classification for this chemical at {concentrationPct}% concentration has been recorded.
            </p>
            <button
              onClick={handleReset}
              className="mt-3 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-200 transition"
            >
              Run another analysis
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <XCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Something went wrong</p>
            <p className="mt-0.5 text-xs text-red-600">{errorMsg}</p>
            <button onClick={handleReset} className="mt-3 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-200 transition">Try again</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Last saved classification summary */}
      {chemical.hazard_band && phase === "idle" && (
        <div className={`rounded-xl border px-4 py-3 flex flex-wrap items-center gap-3 ${BAND_CONFIG[chemical.hazard_band as keyof typeof BAND_CONFIG]?.border ?? "border-slate-200"} ${BAND_CONFIG[chemical.hazard_band as keyof typeof BAND_CONFIG]?.bg ?? "bg-slate-50"}`}>
          <span className="text-xs text-slate-500">Last saved classification:</span>
          <HazardBadge band={chemical.hazard_band as keyof typeof BAND_CONFIG} />
          {chemical.concentration_pct != null && (
            <span className="text-xs text-slate-500">at {chemical.concentration_pct}%</span>
          )}
          {chemical.hazard_band_reviewed_at && (
            <span className="ml-auto text-[10px] text-slate-400">
              {new Date(chemical.hazard_band_reviewed_at).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {/* Input form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
            <FlaskConical className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Concentration hazard analysis</p>
            <p className="text-xs text-slate-500">Enter the concentration you are working with to get a hazard classification for that specific dilution.</p>
          </div>
        </div>

        {/* Concentration slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700">Concentration</label>
            <span className="text-sm font-bold text-violet-700">{concentrationPct}%</span>
          </div>
          <input
            type="range"
            min={0.01}
            max={100}
            step={0.1}
            value={concentrationPct}
            onChange={(e) => setConcentrationPct(parseFloat(e.target.value))}
            className="w-full accent-violet-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>0.01% (trace)</span>
            <span>50% (half strength)</span>
            <span>100% (pure)</span>
          </div>
          <div className="flex gap-2">
            {[1, 5, 10, 25, 50, 100].map((v) => (
              <button
                key={v}
                onClick={() => setConcentrationPct(v)}
                className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${concentrationPct === v ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {v}%
              </button>
            ))}
          </div>
        </div>

        {/* Physical state */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Form (liquid, gas, solid)</label>
          <div className="flex gap-2">
            {(["liquid", "gas", "solid", "unknown"] as PhysicalState[]).map((s) => (
              <button
                key={s}
                onClick={() => setPhysicalState(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${physicalState === s ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {s === "liquid" ? "Liquid" : s === "gas" ? "Gas / vapour" : s === "solid" ? "Solid" : "Unknown"}
              </button>
            ))}
          </div>
        </div>

        {/* Dilution notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Dilution notes <span className="font-normal text-slate-400">(optional)</span></label>
          <input
            type="text"
            value={dilutionNotes}
            onChange={(e) => setDilutionNotes(e.target.value)}
            placeholder="e.g. 10% solution in water, diluted from stock concentrate"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none"
          />
        </div>

        {/* CAS number hint */}
        {chemical.cas_number && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <Info className="h-3 w-3 shrink-0" />
            CAS {chemical.cas_number} · {chemical.hazard_statements?.length ?? 0} H-statement{chemical.hazard_statements?.length !== 1 ? "s" : ""} on file
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
        >
          <Zap className="h-4 w-4" />
          {isPending ? "Analysing…" : "Analyse hazard at this concentration"}
        </button>
      </div>

      {/* Result panel */}
      {phase === "result" && result && (() => {
        const cfg = BAND_CONFIG[result.band];
        const BandIcon = cfg.icon;
        return (
          <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-5 space-y-4`}>

            {/* Band + headline */}
            <div className="flex items-start gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${cfg.border} bg-white`}>
                <BandIcon className={`h-5 w-5 ${cfg.iconCls}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-slate-800">Hazard level & what it means</p>
                  <HazardBadge band={result.band} />
                </div>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">{result.plainEnglishSummary}</p>
              </div>
            </div>

            {/* Hazard types */}
            {result.hazardTypes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {result.hazardTypes.map((ht) => (
                  <span key={ht} className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">{ht}</span>
                ))}
              </div>
            )}

            {/* Confidence */}
            <ConfidenceBar value={result.confidence} />

            {/* SDS warning */}
            {result.sdsWarning && (
              <div className="flex items-start gap-2 rounded-lg bg-white border border-amber-200 px-3 py-2">
                <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
                <p className="text-xs text-amber-700">{result.sdsWarning}</p>
              </div>
            )}

            {/* Factors toggle */}
            <button
              onClick={() => setShowFactors((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
            >
              {showFactors ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showFactors ? "Hide details" : `Show ${result.factors.length} contributing factor${result.factors.length !== 1 ? "s" : ""}`}
            </button>

            {showFactors && (
              <div className="space-y-2">
                {result.factors.map((f, i) => (
                  <div key={i} className={`rounded-lg border px-3 py-2 text-xs ${SEVERITY_CONFIG[f.severity].cls}`}>
                    <p className="font-semibold">{f.name}</p>
                    <p className="mt-0.5 leading-relaxed">{f.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Needs-review gate (RequireAReason pattern) */}
            {result.requiresReview ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Needs your review before saving</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {result.confidence < 70
                        ? "We're not sure about this one — the AI confidence is below the safe threshold. Please review the SDS document and confirm the classification manually before storing or using this chemical."
                        : "This chemical is high-hazard at this concentration. A written reason is required before this classification can be recorded."}
                    </p>
                  </div>
                </div>

                {/* Accept vs Override */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setReviewDecision("accepted")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${reviewDecision === "accepted" ? "bg-amber-600 text-white" : "bg-white border border-amber-200 text-amber-700 hover:bg-amber-50"}`}
                  >
                    I confirm this classification
                  </button>
                  <button
                    onClick={() => setReviewDecision("overridden")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${reviewDecision === "overridden" ? "bg-slate-700 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                  >
                    I want to override it
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-amber-800">
                    {reviewDecision === "accepted" ? "Reason for confirming (required)" : "Reason for override (required)"}
                  </label>
                  <textarea
                    rows={3}
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    placeholder={
                      reviewDecision === "accepted"
                        ? "e.g. Reviewed SDS rev. 3. Classification matches SDS section 2 — confirmed as medium hazard at 10% dilution."
                        : "e.g. Overriding to high hazard — dilution was approximate and SDS section 9 lists flash point as 23°C which is within our ignition-risk zone."
                    }
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none resize-none"
                  />
                </div>

                {errorMsg && (
                  <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">{errorMsg}</p>
                )}

                <button
                  onClick={handleSave}
                  disabled={isPending || !reviewReason.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {isPending ? "Saving…" : "Save classification to audit log"}
                </button>
              </div>
            ) : (
              /* Low/medium bands with no uncertainty — simple save */
              <div className="flex items-center gap-3 border-t border-slate-200 pt-4">
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Save note <span className="font-normal text-slate-400">(optional for low/medium hazard)</span></label>
                  <input
                    type="text"
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    placeholder="e.g. Routine check — classification confirmed"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => { if (!reviewReason.trim()) setReviewReason("Classification confirmed — no concerns."); handleSave(); }}
                  disabled={isPending}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {isPending ? "Saving…" : "Save"}
                </button>
              </div>
            )}

            <button
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-slate-600 transition"
            >
              ← Run another analysis
            </button>
          </div>
        );
      })()}
    </div>
  );
}
