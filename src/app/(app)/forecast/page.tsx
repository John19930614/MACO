import Link from "next/link";
import { getForecast, getSites, currentUser } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/primitives";
import { PreemptButton } from "@/components/risk/PreemptButton";
import { SEVERITY_META, canCreateActions, type Severity } from "@/lib/constants";
import type { ForecastBand } from "@/lib/risk/forecast";

const BAND: Record<ForecastBand, { label: string; color: string; action: string }> = {
  red: { label: "Red", color: "#b80a0a", action: "Consider work stoppage + investigation" },
  orange: { label: "Orange", color: "#b45309", action: "Mandatory toolbox talk + targeted inspection" },
  amber: { label: "Amber", color: "#d9a400", action: "Alert supervisor; increase observation" },
  green: { label: "Green", color: "#1f9d55", action: "Monitor — no intervention required" },
};
const ORDER: ForecastBand[] = ["red", "orange", "amber", "green"];

// ARC P-CLSS — Anticipate / Forecast. A forward-looking, explainable prediction
// of what is likely to fail next at each location, ranked by forecast score.
export default async function ForecastPage() {
  const [forecast, sites] = await Promise.all([getForecast(), getSites()]);
  const canPreempt = canCreateActions(currentUser().role);
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id;
  const counts = ORDER.map((b) => ({ b, n: forecast.filter((f) => f.band === b).length }));

  return (
    <>
      <PageHeader
        title="Risk Forecast"
        subtitle="ARC P-CLSS · Anticipate / Forecast — what is likely to fail next, and why. Leading indicators only, fully explainable."
      />
      <div className="amaya-scroll flex-1 overflow-auto p-6">
        {/* Band summary */}
        <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:grid-cols-4">
          {counts.map(({ b, n }) => (
            <div key={b} className="bg-white px-4 py-3">
              <div className="text-2xl font-bold" style={{ color: BAND[b].color }}>{n}</div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <span className="h-2 w-2 rounded-full" style={{ background: BAND[b].color }} />
                {BAND[b].label}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {forecast.map((f) => (
            <div key={f.locationId} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-stretch">
                {/* Score rail */}
                <div className="flex w-24 shrink-0 flex-col items-center justify-center px-3 py-3 text-white" style={{ background: BAND[f.band].color }}>
                  <div className="text-3xl font-black leading-none">{f.score}</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide">{BAND[f.band].label}</div>
                </div>
                <div className="min-w-0 flex-1 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">{f.label}</h3>
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      {siteName(f.siteId)}
                      <span className="rounded-full bg-[var(--color-pclss-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-pclss-deep)]">weighted: {f.vertical}</span>
                    </span>
                  </div>
                  {f.predictedExposure && (
                    <div className="mt-0.5 text-xs text-slate-500">
                      Predicted failure mode: <span className="font-medium text-slate-700">{f.predictedExposure.replace(/_/g, " ")}</span>
                    </div>
                  )}

                  {/* Top drivers */}
                  <div className="mt-2 space-y-1">
                    {f.drivers.slice(0, 4).map((d) => (
                      <div key={d.key} className="flex items-center gap-2">
                        <span className="w-40 shrink-0 truncate text-[11px] text-slate-500">{d.label}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, d.contribution * 3)}%`, background: BAND[f.band].color }} />
                        </div>
                        <span className="w-6 shrink-0 text-right text-[11px] font-semibold text-slate-500">+{d.contribution}</span>
                      </div>
                    ))}
                  </div>

                  {f.cells.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">Contributing cells:</span>
                      {f.cells.map((c) => (
                        <Link
                          key={c.id}
                          href={`/cells/${c.id}`}
                          className="inline-flex max-w-[240px] items-center gap-1.5 truncate rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SEVERITY_META[c.severity as Severity].color }} />
                          <span className="truncate">{c.title}</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-1.5">
                    <p className="min-w-0 flex-1 text-xs text-slate-600">
                      <span className="font-semibold" style={{ color: BAND[f.band].color }}>Pre-empt:</span> {f.recommendation}
                    </p>
                    {f.topCellId && <PreemptButton cellId={f.topCellId} recommendation={f.recommendation} canCreate={canPreempt} />}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {forecast.length === 0 && <p className="text-sm text-slate-400">No locations to forecast yet.</p>}
        </div>
      </div>
    </>
  );
}
