"use client";

import { useState, useTransition } from "react";
import type { ExpCapture } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface HazardGenome {
  energySource: string;
  exposureType: string;
  trigger: string;
  controlGap: string;
}

interface ExtractedCell {
  title: string;
  genome: HazardGenome;
  severity: "low" | "medium" | "high" | "critical";
  likelihood: number;
}

interface SiteOption {
  id: string;
  name: string;
}

interface ExpIntakeFormProps {
  sites: SiteOption[];
  recentCaptures: ExpCapture[];
}

// ── Deterministic extraction logic ────────────────────────────────────────────

function extractGenome(text: string): HazardGenome {
  const lower = text.toLowerCase();

  // energySource
  let energySource = "mechanical";
  if (/electrical|electr|voltage|current|panel|wiring|loto|lockout/.test(lower))
    energySource = "electrical";
  else if (/fire|hot work|weld|grind|flame|thermal|heat|burn|ignit/.test(lower))
    energySource = "thermal";
  else if (/chemical|fume|vapour|vapor|solvent|acid|caustic|gas|toxic|inhale/.test(lower))
    energySource = "chemical";
  else if (/pressure|vessel|boiler|compressor|hydraulic|pneumatic/.test(lower))
    energySource = "pressure";
  else if (/fall|height|roof|scaffold|ladder|overhead|drop/.test(lower))
    energySource = "gravitational";
  else if (/noise|radiation|vibration/.test(lower)) energySource = "physical";

  // exposureType
  let exposureType = "contact";
  if (/inhale|inhalation|breathe|fume|vapour|vapor|gas/.test(lower))
    exposureType = "inhalation";
  else if (/struck|hit|falling object|dropped/.test(lower)) exposureType = "struck_by";
  else if (/slip|trip|fall/.test(lower)) exposureType = "fall";
  else if (/spill|splash|skin contact/.test(lower)) exposureType = "skin_contact";
  else if (/caught|entangle|caught in/.test(lower)) exposureType = "caught_in";

  // trigger
  let trigger = "Procedure not followed";
  if (/bypass|shortcut|speed|pressure|deadline|rush/.test(lower))
    trigger = "Schedule pressure — safety step bypassed";
  else if (/not trained|training|inexperienced|unaware/.test(lower))
    trigger = "Training gap — crew not competent for task";
  else if (/no permit|without permit|permit not/.test(lower))
    trigger = "Permit-to-work not obtained before work start";
  else if (/broken|fail|defect|malfunction|overdue|expired/.test(lower))
    trigger = "Equipment failure or overdue maintenance";
  else if (/contractor|sub|visitor|new worker/.test(lower))
    trigger = "Contractor unfamiliar with site hazard";
  else if (/no guard|guard removed|missing guard/.test(lower))
    trigger = "Physical guard absent or removed";

  // controlGap
  let controlGap = "inadequate";
  if (/no control|missing|not in place|absent|none/.test(lower)) controlGap = "missing";
  else if (/expired|overdue|out of date|lapsed/.test(lower)) controlGap = "expired";
  else if (/partial|weak|sometimes|not always/.test(lower)) controlGap = "inadequate";

  return { energySource, exposureType, trigger, controlGap };
}

function deriveSeverity(text: string): ExtractedCell["severity"] {
  const lower = text.toLowerCase();
  if (/death|fatal|catastrophic|explosion|fire|critical/.test(lower)) return "critical";
  if (/serious|significant|hospital|injury|high risk/.test(lower)) return "high";
  if (/moderate|medium|minor injury|first aid/.test(lower)) return "medium";
  return "low";
}

function deriveLikelihood(text: string): number {
  const lower = text.toLowerCase();
  if (/always|every day|constant|frequent|regularly/.test(lower)) return 5;
  if (/often|common|usually|several times/.test(lower)) return 4;
  if (/sometimes|occasional|could happen/.test(lower)) return 3;
  if (/unlikely|rare|once in/.test(lower)) return 2;
  return 3;
}

function generateTitle(genome: HazardGenome, siteLabel: string): string {
  const energy = genome.energySource.charAt(0).toUpperCase() + genome.energySource.slice(1);
  const exposure = genome.exposureType.replace(/_/g, " ");
  return `${energy} ${exposure} — ${siteLabel}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// ── Source label helper ───────────────────────────────────────────────────────

function sourceLabel(source: ExpCapture["source"]): string {
  const map: Record<ExpCapture["source"], string> = {
    interview: "Interview",
    ai_interview: "AI Interview",
    walk_floor: "Floor Walk",
    incident_debrief: "Incident Debrief",
    manual: "Manual Entry",
  };
  return map[source] ?? source;
}

// ── Severity badge ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "bg-red-500/15 text-red-400 border border-red-500/30",
    high: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
    medium: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    low: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[severity] ?? "bg-slate-700 text-slate-400"}`}>
      {severity}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExpIntakeForm({ sites, recentCaptures }: ExpIntakeFormProps) {
  const [text, setText] = useState("");
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [result, setResult] = useState<ExtractedCell | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedSite = sites.find((s) => s.id === siteId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    setIsProcessing(true);
    setResult(null);
    setSaved(false);

    // Simulate AI processing delay
    await sleep(1500);

    const genome = extractGenome(text);
    const derivedSeverity = deriveSeverity(text);
    const effectiveSeverity =
      severity === derivedSeverity ? severity : (severity as ExtractedCell["severity"]);
    const likelihood = deriveLikelihood(text);
    const title = generateTitle(genome, selectedSite?.name ?? "Unknown site");

    setResult({
      title,
      genome,
      severity: effectiveSeverity,
      likelihood,
    });
    setIsProcessing(false);
  }

  function handleSave() {
    startTransition(() => {
      // In production this would call a server action. For now show success.
      setSaved(true);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* ── Main form ── */}
      <div className="lg:col-span-2 space-y-6">
        {/* Form card */}
        <div className="rounded-xl border border-white/8 bg-slate-900/60 p-5 space-y-5">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-white">Capture observation</h2>
            <p className="text-xs text-slate-500">
              Describe what you observed in plain language. The AI will extract the hazard genome and
              draft a Safety Cell.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Observation textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400" htmlFor="observation">
                What did you observe?
              </label>
              <textarea
                id="observation"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder="e.g. Workers were welding near the LPG storage without a hot work permit. I saw at least two of the contractors hadn't done the site induction — they didn't know where the exclusion zone was…"
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-500/60 focus:outline-none focus:ring-1 focus:ring-blue-500/40 resize-none transition-colors"
              />
            </div>

            {/* Site + severity row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400" htmlFor="site">
                  Site
                </label>
                <select
                  id="site"
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-white focus:border-blue-500/60 focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-colors"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400" htmlFor="severity">
                  Severity (your estimate)
                </label>
                <select
                  id="severity"
                  value={severity}
                  onChange={(e) =>
                    setSeverity(e.target.value as "low" | "medium" | "high" | "critical")
                  }
                  className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-white focus:border-blue-500/60 focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-colors"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!text.trim() || isProcessing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Converting to Safety Cell…
                </>
              ) : (
                "Convert to Safety Cell"
              )}
            </button>
          </form>
        </div>

        {/* ── Extraction result ── */}
        {result && !isProcessing && (
          <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-5 space-y-5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                  AI extraction complete
                </span>
              </div>
              <SeverityBadge severity={result.severity} />
            </div>

            {/* Draft title */}
            <div className="space-y-1">
              <div className="text-xs text-slate-500">Draft cell title</div>
              <div className="text-base font-semibold text-white">{result.title}</div>
            </div>

            {/* Hazard genome grid */}
            <div className="space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Hazard genome</div>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["Energy source", result.genome.energySource],
                    ["Exposure type", result.genome.exposureType.replace(/_/g, " ")],
                    ["Trigger", result.genome.trigger],
                    ["Control gap", result.genome.controlGap],
                  ] as [string, string][]
                ).map(([key, val]) => (
                  <div
                    key={key}
                    className="rounded-lg border border-white/8 bg-slate-900/60 px-3 py-2.5 space-y-0.5"
                  >
                    <div className="text-xs text-slate-400">{key}</div>
                    <div className="text-sm font-medium text-white capitalize">{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Severity + likelihood row */}
            <div className="flex items-center gap-4">
              <div className="space-y-0.5">
                <div className="text-xs text-slate-500">Severity</div>
                <SeverityBadge severity={result.severity} />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs text-slate-500">Likelihood</div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className={`w-4 h-4 rounded-sm ${
                        n <= result.likelihood ? "bg-blue-500" : "bg-slate-700"
                      }`}
                    />
                  ))}
                  <span className="ml-1.5 text-sm font-semibold text-white">
                    {result.likelihood} / 5
                  </span>
                </div>
              </div>
            </div>

            {/* Save button or success */}
            {saved ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <span>✓</span>
                Safety Cell saved and queued for EHS review.
              </div>
            ) : (
              <button
                onClick={handleSave}
                disabled={isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
              >
                {isPending ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Review & Save"
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Sidebar: recent captures ── */}
      <div className="space-y-4">
        <div className="rounded-xl border border-white/8 bg-slate-900/60 p-5 space-y-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-white">Recent captures</h3>
            <p className="text-xs text-slate-500">Latest EXP records across all sites</p>
          </div>

          {recentCaptures.length === 0 && (
            <p className="text-xs text-slate-400 italic">No captures yet.</p>
          )}

          <div className="space-y-3">
            {recentCaptures.map((capture) => (
              <div
                key={capture.id}
                className="rounded-lg border border-white/5 bg-slate-800/40 p-3 space-y-2"
              >
                {/* Status + date */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      capture.embedded
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-700/60 text-slate-400 border border-white/8"
                    }`}
                  >
                    {capture.embedded ? "Embedded" : "Capturing"}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(capture.created_at).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>

                {/* Subject */}
                <div className="text-xs font-medium text-slate-300 leading-snug">
                  {capture.subject}
                </div>

                {/* Summary */}
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                  {capture.summary}
                </p>

                {/* Source */}
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-500">
                  {sourceLabel(capture.source)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick-start tips */}
        <div className="rounded-xl border border-white/8 bg-slate-900/60 p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Tips for better extraction
          </div>
          <ul className="space-y-2 text-xs text-slate-500">
            {[
              "Name the energy source: electrical, thermal, chemical, pressure, gravitational",
              "Describe what was missing or failing — the control gap",
              "Mention what triggered the exposure — deadline, training gap, no permit",
              "Include the task being performed and who was involved",
            ].map((tip, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 text-blue-500 mt-0.5">·</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
