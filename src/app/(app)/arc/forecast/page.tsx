import { CELLS, PROOFS, EVENT_CELLS, BEHAVIOR_CELLS, ACTIONS, SITES, LOCATIONS, HSL_READINGS } from "@/lib/data/mock";
import { buildForecast } from "@/lib/risk/forecast";
import { PageHeader, Card } from "@/components/ui/primitives";
import type { LocationForecast, ForecastBand } from "@/lib/risk/forecast";

const BAND_STYLES: Record<
  ForecastBand,
  { bg: string; border: string; text: string; bar: string; badge: string; label: string }
> = {
  red: {
    bg:     "bg-red-50",
    border: "border-red-200",
    text:   "text-red-600",
    bar:    "bg-red-500",
    badge:  "bg-red-100 text-red-700",
    label:  "Critical",
  },
  orange: {
    bg:     "bg-orange-50",
    border: "border-orange-200",
    text:   "text-orange-600",
    bar:    "bg-orange-500",
    badge:  "bg-orange-100 text-orange-700",
    label:  "High",
  },
  amber: {
    bg:     "bg-amber-50",
    border: "border-amber-200",
    text:   "text-amber-600",
    bar:    "bg-amber-500",
    badge:  "bg-amber-100 text-amber-700",
    label:  "Elevated",
  },
  green: {
    bg:     "bg-emerald-50",
    border: "border-emerald-200",
    text:   "text-emerald-600",
    bar:    "bg-emerald-500",
    badge:  "bg-emerald-100 text-emerald-700",
    label:  "Managed",
  },
};

function DriverBar({
  label,
  contribution,
  maxContribution,
  barColor,
}: {
  label: string;
  contribution: number;
  maxContribution: number;
  barColor: string;
}) {
  const widthPct = maxContribution > 0 ? Math.round((contribution / maxContribution) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="tabular-nums font-semibold text-slate-700">{contribution}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}

function severityColor(severity: string): string {
  switch (severity) {
    case "critical": return "text-red-600";
    case "high":     return "text-orange-600";
    case "medium":   return "text-amber-600";
    default:         return "text-slate-500";
  }
}

export default function ForecastPage() {
  const forecast = buildForecast({
    locations:  LOCATIONS,
    cells:      CELLS,
    proofs:     PROOFS,
    events:     EVENT_CELLS,
    behaviors:  BEHAVIOR_CELLS,
    actions:    ACTIONS,
    hsl:        HSL_READINGS,
    sites:      SITES,
    now:        Date.now(),
  });

  const byCounts = { red: 0, orange: 0, amber: 0, green: 0 };
  for (const f of forecast) byCounts[f.band]++;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Risk Forecast"
        subtitle="P-CLSS · Anticipate / Forecast — leading indicators only, fully explainable."
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* Band legend strip */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-500 mr-1">Risk bands:</span>
          {(["red", "orange", "amber", "green"] as ForecastBand[]).map((band) => {
            const style = BAND_STYLES[band];
            const thresholds: Record<ForecastBand, string> = {
              red: "≥ 76", orange: "≥ 56", amber: "≥ 31", green: "< 31",
            };
            return (
              <span
                key={band}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-medium border ${style.badge} ${style.border}`}
              >
                {style.label}
                <span>{thresholds[band]}</span>
                <span className="font-bold">{byCounts[band]}</span>
              </span>
            );
          })}
          <span className="ml-auto text-xs text-slate-400 tabular-nums">
            {forecast.length} locations scored
          </span>
        </div>

        {/* Forecast cards */}
        <div className="space-y-4">
          {forecast.length === 0 && (
            <Card>
              <div className="py-10 text-center text-sm text-slate-400">
                No locations with open cells to forecast.
              </div>
            </Card>
          )}

          {forecast.map((item: LocationForecast) => {
            const style = BAND_STYLES[item.band];
            const maxDriverContrib = item.drivers[0]?.contribution ?? 1;

            return (
              <div
                key={item.locationId}
                className={`rounded-xl border p-5 space-y-4 ${style.bg} ${style.border}`}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-slate-900">{item.label}</h3>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-500">
                        {SITES.find((s) => s.id === item.siteId)?.name ?? item.siteId}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 font-mono">
                        {item.vertical}
                      </span>
                    </div>
                    {item.predictedExposure && (
                      <div className="text-xs text-slate-500">
                        Predicted exposure:{" "}
                        <span className="text-slate-700 font-medium">
                          {item.predictedExposure.replace(/_/g, " ")}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 text-right space-y-0.5">
                    <div className={`text-3xl font-bold tabular-nums ${style.text}`}>{item.score}</div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>
                      {style.label}
                    </span>
                  </div>
                </div>

                {/* Two-column: drivers + cells */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Top drivers</div>
                    {item.drivers.slice(0, 4).map((driver) => (
                      <DriverBar
                        key={driver.key}
                        label={driver.label}
                        contribution={driver.contribution}
                        maxContribution={maxDriverContrib}
                        barColor={style.bar}
                      />
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Contributing cells</div>
                    {item.cells.slice(0, 3).map((cell) => (
                      <div
                        key={cell.id}
                        className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <span
                          className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${
                            cell.severity === "critical" ? "bg-red-500"
                            : cell.severity === "high"   ? "bg-orange-500"
                            : cell.severity === "medium" ? "bg-amber-500"
                            : "bg-slate-400"
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-xs text-slate-700 leading-snug truncate">{cell.title}</div>
                          <div className={`text-xs font-medium mt-0.5 ${severityColor(cell.severity)}`}>
                            {cell.severity}
                          </div>
                        </div>
                      </div>
                    ))}
                    {item.cells.length === 0 && (
                      <div className="text-xs text-slate-400 italic">No open cells at this location</div>
                    )}
                  </div>
                </div>

                {/* Recommendation */}
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 flex gap-3 items-start">
                  <span className="shrink-0 mt-0.5 text-amber-500 text-sm">→</span>
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">Pre-empt recommendation</div>
                    <p className="text-sm text-slate-700 leading-relaxed">{item.recommendation}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-slate-400 border-t border-slate-100 pt-4">
          Forecast is deterministic — same inputs produce the same output. Each score is a weighted blend
          of open control failures, recent events, behavior patterns, open high-severity cells, overdue
          actions, and site HSL pressure.
        </p>
      </div>
    </div>
  );
}
