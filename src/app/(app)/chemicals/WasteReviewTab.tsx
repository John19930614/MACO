"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Chemical, WasteReviewFlag, WasteFlagStatus } from "@/lib/types";
import { Pill } from "@/components/ui/primitives";
import { Trash2, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { flagChemicalForWasteReview, updateWasteFlagStatus } from "@/lib/actions/wasteFlags";

// ── Suggested waste concern derived from GHS hazard statements ────────────────
// Review PROMPTS only — never a legal waste-code determination.
interface WasteSuggestion { area: string; concern: string; triggerValue: string; }

function suggestWaste(c: Chemical): WasteSuggestion | null {
  const h = c.hazard_statements ?? [];
  const find = (re: RegExp) => h.find((x) => re.test(x));
  let m: string | undefined;

  if ((m = find(/^H4/)))
    return { area: "Environmental / aquatic", triggerValue: m,
      concern: "Aquatic toxicity — review for environmental hazardous-waste characterization before disposal or discharge." };
  if ((m = find(/^H2[2-6]/)))
    return { area: "Ignitable", triggerValue: m,
      concern: "Flammable / combustible — review for the ignitability characteristic (RCRA D001) before disposal." };
  if ((m = find(/^H314/)) || (m = find(/^H290/)))
    return { area: "Corrosive", triggerValue: m,
      concern: "Corrosive — review for the corrosivity characteristic (RCRA D002) before disposal." };
  if ((m = find(/^H(300|301|310|311|330|331)/)))
    return { area: "Toxic", triggerValue: m,
      concern: "Acute toxicity — review for the toxicity characteristic / acute hazardous-waste listing before disposal." };
  if ((m = find(/^H27/)))
    return { area: "Reactive / oxidizer", triggerValue: m,
      concern: "Oxidizer — review for reactivity (RCRA D003) and segregation before disposal." };
  return null;
}

const STATUS_CFG: Record<WasteFlagStatus, { label: string; cls: string; Icon: React.ElementType }> = {
  open:           { label: "Open",           cls: "bg-amber-100 text-amber-700",   Icon: AlertTriangle },
  under_review:   { label: "Under Review",   cls: "bg-blue-100 text-blue-700",     Icon: Clock },
  confirmed:      { label: "Confirmed",      cls: "bg-red-100 text-red-700",       Icon: CheckCircle2 },
  not_applicable: { label: "Not Applicable", cls: "bg-slate-100 text-slate-600",   Icon: XCircle },
  closed:         { label: "Closed",         cls: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 },
};

const ACTIVE = new Set<WasteFlagStatus>(["open", "under_review", "confirmed"]);

export function WasteReviewTab({ chemicals, flags }: { chemicals: Chemical[]; flags: WasteReviewFlag[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flaggedChemIds = new Set(flags.filter((f) => ACTIVE.has(f.status)).map((f) => f.chemical_id));
  const candidates = chemicals
    .map((c) => ({ chem: c, sug: suggestWaste(c) }))
    .filter((x): x is { chem: Chemical; sug: WasteSuggestion } => x.sug !== null && !flaggedChemIds.has(x.chem.id));

  async function raise(c: Chemical, sug: WasteSuggestion) {
    setBusy(`flag-${c.id}`); setError(null);
    const res = await flagChemicalForWasteReview({
      chemicalId: c.id,
      triggerSource: "H-code",
      triggerValue: sug.triggerValue,
      potentialWasteConcern: sug.concern,
      suggestedReviewArea: sug.area,
    });
    setBusy(null);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  async function advance(flagId: string, status: WasteFlagStatus, finalDetermination?: string) {
    setBusy(`flag-${flagId}`); setError(null);
    const res = await updateWasteFlagStatus({ flagId, status, finalDetermination });
    setBusy(null);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  const openFlags = flags.filter((f) => ACTIVE.has(f.status));
  const resolved  = flags.filter((f) => !ACTIVE.has(f.status));

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
        <span className="font-semibold">Waste review flags are prompts, not determinations.</span>{" "}
        They surface chemicals whose GHS hazards may make them regulated waste. A qualified reviewer must confirm the
        actual classification — the platform never auto-assigns a legal waste code (RCRA / state).
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</div>
      )}

      {/* ── Suggested flags ── */}
      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Suggested for review ({candidates.length})
        </div>
        {candidates.length === 0 ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
            No unflagged chemicals with waste-relevant GHS hazards.
          </div>
        ) : (
          <div className="space-y-2">
            {candidates.map(({ chem, sug }) => (
              <div key={chem.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                  <Trash2 className="h-4 w-4 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{chem.name}</span>
                    <Pill className="bg-amber-100 text-amber-700">{sug.area}</Pill>
                    <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{sug.triggerValue}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{sug.concern}</div>
                </div>
                <button
                  onClick={() => raise(chem, sug)}
                  disabled={busy === `flag-${chem.id}`}
                  className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-50"
                >
                  {busy === `flag-${chem.id}` ? "Flagging…" : "Flag for review"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Open flags ── */}
      {openFlags.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Review queue ({openFlags.length})
          </div>
          <div className="space-y-2">
            {openFlags.map((f) => {
              const cfg = STATUS_CFG[f.status];
              const isBusy = busy === `flag-${f.id}`;
              return (
                <div key={f.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{f.chemical_name ?? "Chemical"}</span>
                    <Pill className={cfg.cls}><cfg.Icon className="mr-1 inline h-3 w-3" />{cfg.label}</Pill>
                    {f.suggested_review_area && <Pill className="bg-slate-100 text-slate-600">{f.suggested_review_area}</Pill>}
                    <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{f.trigger_value}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{f.potential_waste_concern}</div>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {f.status === "open" && (
                      <button onClick={() => advance(f.id, "under_review")} disabled={isBusy}
                        className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                        Start review
                      </button>
                    )}
                    {(f.status === "open" || f.status === "under_review") && (
                      <>
                        <button onClick={() => advance(f.id, "confirmed", "Confirmed as regulated waste pending disposal handling.")} disabled={isBusy}
                          className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                          Confirm regulated
                        </button>
                        <button onClick={() => advance(f.id, "not_applicable", "Reviewed — not a regulated waste concern.")} disabled={isBusy}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                          Not applicable
                        </button>
                      </>
                    )}
                    {f.status === "confirmed" && (
                      <button onClick={() => advance(f.id, "closed", "Disposal handled per regulated-waste procedure.")} disabled={isBusy}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                        Mark closed
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Resolved flags ── */}
      {resolved.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Resolved ({resolved.length})
          </div>
          <div className="space-y-1.5">
            {resolved.map((f) => {
              const cfg = STATUS_CFG[f.status];
              return (
                <div key={f.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <Pill className={cfg.cls}><cfg.Icon className="mr-1 inline h-3 w-3" />{cfg.label}</Pill>
                  <span className="text-xs font-medium text-slate-700">{f.chemical_name ?? "Chemical"}</span>
                  {f.final_determination && <span className="truncate text-[11px] text-slate-400">— {f.final_determination}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
