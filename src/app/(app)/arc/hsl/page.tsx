import { HSL_DIMENSIONS } from "@/lib/arc/arc";
import { getHslReadings, getSites } from "@/lib/data/repo";
import { PageHeader, Card } from "@/components/ui/primitives";
import type { HslDimension } from "@/lib/arc/arc";
import type { HslReading } from "@/lib/types";

export const metadata = { title: "Human Signal Layer — SafetyIQ" };

function dimensionColor(dim: HslDimension, value: number): { bar: string; badge: string; label: string } {
  let level: "red" | "amber" | "green";
  if (dim.worseWhen === "high") {
    if (value > 60) level = "red";
    else if (value > 40) level = "amber";
    else level = "green";
  } else {
    if (value < 40) level = "red";
    else if (value < 60) level = "amber";
    else level = "green";
  }
  switch (level) {
    case "red":   return { bar: "bg-red-400",     badge: "bg-red-100 text-red-700",       label: "Elevated" };
    case "amber": return { bar: "bg-amber-400",   badge: "bg-amber-100 text-amber-700",   label: "Watch"    };
    default:      return { bar: "bg-emerald-400", badge: "bg-emerald-100 text-emerald-700", label: "Healthy" };
  }
}

function riskNormalized(dim: HslDimension, value: number): number {
  return dim.worseWhen === "high" ? value : 100 - value;
}

function trendArrow(dim: HslDimension, value: number): { icon: string; color: string } {
  const risk = riskNormalized(dim, value);
  if (risk >= 65) return { icon: "↑", color: "text-red-500" };
  if (risk >= 45) return { icon: "→", color: "text-amber-500" };
  return { icon: "↓", color: "text-emerald-600" };
}

function overallBandBadge(score: number): string {
  if (score >= 65) return "bg-red-100 text-red-700";
  if (score >= 45) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

export default async function HslPage() {
  const [hslReadings, sites] = await Promise.all([getHslReadings(), getSites()]);

  const readingsBySite = new Map<string, Record<string, HslReading>>();
  for (const r of hslReadings) {
    if (!readingsBySite.has(r.site_id)) readingsBySite.set(r.site_id, {});
    readingsBySite.get(r.site_id)![r.dimension] = r;
  }

  const siteData = sites.map(site => {
    const readings = readingsBySite.get(site.id) ?? {};
    const riskValues = HSL_DIMENSIONS.map(dim => riskNormalized(dim, readings[dim.key]?.value ?? 50));
    const overallRisk = Math.round(riskValues.reduce((a, b) => a + b, 0) / Math.max(riskValues.length, 1));
    return { siteId: site.id, siteName: site.name, readings, overallRisk };
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Human Signal Layer"
        subtitle="Six human dimensions conventional safety systems ignore — computed live, not an annual survey."
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mb-5 flex flex-wrap gap-2">
          {HSL_DIMENSIONS.map(dim => (
            <div key={dim.key} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm">
              <span className="font-semibold text-slate-800">{dim.name}</span>
              <span className="ml-2 text-slate-500">· {dim.blurb}</span>
            </div>
          ))}
        </div>

        {siteData.length === 0 && (
          <p className="text-sm text-slate-400">No sites configured. Add sites in Settings to see HSL data.</p>
        )}

        <div className="space-y-8">
          {siteData.map(site => (
            <section key={site.siteId} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h2 className="text-base font-semibold text-slate-900">{site.siteName}</h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">Overall HSL risk</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-sm font-semibold ${overallBandBadge(site.overallRisk)}`}>
                    {site.overallRisk}
                    <span className="text-xs font-normal opacity-70">/ 100</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {HSL_DIMENSIONS.map(dim => {
                  const reading = site.readings[dim.key];
                  const value   = reading?.value ?? 50;
                  const colors  = dimensionColor(dim, value);
                  const trend   = trendArrow(dim, value);

                  return (
                    <Card key={dim.key}>
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 min-w-0">
                            <div className="text-sm font-semibold text-slate-800 leading-snug truncate">{dim.name}</div>
                            <div className="text-xs text-slate-500">{dim.blurb}</div>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${colors.badge}`}>{colors.label}</span>
                        </div>

                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold tabular-nums text-slate-900">{value}</span>
                          <span className="text-sm text-slate-400">/ 100</span>
                          <span className={`ml-auto text-base font-bold ${trend.color}`}>{trend.icon}</span>
                        </div>

                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${colors.bar}`} style={{ width: `${value}%` }} />
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed">{dim.detail}</p>

                        <div className="pt-0.5 flex items-center gap-1.5 text-xs">
                          <span className="text-slate-500">Worse when</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">
                            {dim.worseWhen === "high" ? "high ↑" : "low ↓"}
                          </span>
                          {!reading && <span className="ml-auto text-slate-400 italic">no reading</span>}
                          {reading && (
                            <span className="ml-auto text-slate-400">
                              {new Date(reading.recorded_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-6 text-xs text-slate-400 border-t border-slate-100 pt-4">
          HSL readings refresh each P-CLSS Anticipate run. Values shown are the most recent recorded
          reading per site. Dimensions without a reading default to 50 (neutral).
        </p>
      </div>
    </div>
  );
}
