import { getSites, getComputedHsl } from "@/lib/data/repo";
import { PageHeader, Card } from "@/components/ui/primitives";
import { HSL_DIMENSIONS } from "@/lib/arc/arc";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default async function HslPage() {
  const sites = await getSites();
  const perSite = await Promise.all(sites.map(async (s) => ({ site: s, readings: await getComputedHsl(s.id) })));
  const dimByKey = new Map(HSL_DIMENSIONS.map((d) => [d.key, d]));

  return (
    <>
      <PageHeader
        title="Human Signal Layer"
        subtitle="The six human dimensions conventional safety systems ignore — computed live from each platform's data, not an annual survey."
      />
      <div className="amaya-scroll flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {perSite.map(({ site, readings: siteReadings }) => {
            return (
              <div key={site.id}>
                <h2 className="mb-2 text-sm font-semibold text-slate-700">
                  {site.name} <span className="font-normal text-slate-400">· {site.vertical}</span>
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {siteReadings.map((r) => {
                    const dim = dimByKey.get(r.dimension)!;
                    // For "worseWhen high" dims, a high value is bad (red). For
                    // "worseWhen low" (knowledge ghost), low value is bad.
                    const risk = dim.worseWhen === "high" ? r.value : 100 - r.value;
                    const color = risk > 66 ? "var(--color-sev-high)" : risk > 40 ? "var(--color-sev-medium)" : "var(--color-sev-low)";
                    const Trend = r.trend === "up" ? TrendingUp : r.trend === "down" ? TrendingDown : Minus;
                    return (
                      <Card key={r.dimension} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="text-sm font-semibold text-slate-800">{dim.name}</div>
                          <Trend className="h-4 w-4 text-slate-400" />
                        </div>
                        <div className="mt-2 flex items-end gap-2">
                          <span className="text-2xl font-bold" style={{ color }}>{Math.round(r.value)}</span>
                          <span className="pb-1 text-[11px] text-slate-400">/ 100</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full" style={{ width: `${r.value}%`, background: color }} />
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{dim.detail}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                          {dim.worseWhen === "high" ? "Higher = more risk" : "Lower = more risk"}
                        </p>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
