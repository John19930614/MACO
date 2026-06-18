import { getCells, getSites, getProofs, getActions, getRiskGraph } from "@/lib/data/repo";
import { timelineByWeek, distribution, byVertical, kpis } from "@/lib/analytics/trends";
import { PageHeader, Stat, Card, CardHeader } from "@/components/ui/primitives";
import { StackedTimeline, BarList } from "@/components/analytics/Charts";
import { RISK_OBJECT_TYPES, RISK_OBJECT_META } from "@/lib/constants";

// Trends — system-wide patterns across ALL Safety Cells (and all platforms).
export default async function TrendsPage() {
  const [cells, sites, proofs, actions, riskGraph] = await Promise.all([getCells(), getSites(), getProofs(), getActions(), getRiskGraph()]);

  const riskObjects = RISK_OBJECT_TYPES.map((t) => ({ label: RISK_OBJECT_META[t].label, count: riskGraph.counts[t] }));
  const riskObjectColor = new Map(RISK_OBJECT_TYPES.map((t) => [RISK_OBJECT_META[t].label, RISK_OBJECT_META[t].color]));

  const k = kpis(cells, actions, proofs);
  const timeline = timelineByWeek(cells);
  const byGap = distribution(cells, (c) => c.hazard_genome.controlGap);
  const byExposure = distribution(cells, (c) => c.hazard_genome.exposureType);
  const byEnergy = distribution(cells, (c) => c.hazard_genome.energySource);
  const byStatus = distribution(cells, (c) => c.status);
  const byTask = distribution(cells, (c) => c.task).slice(0, 8);
  const verticals = byVertical(cells, sites);
  const maxVertCount = Math.max(1, ...verticals.map((v) => v.count));

  return (
    <>
      <PageHeader title="Trends" subtitle="Patterns across every Safety Cell and every platform — the system-wide view." />
      <div className="amaya-scroll flex-1 overflow-auto p-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Stat label="Total cells" value={k.total} />
          <Stat label="Open" value={k.open} accent="var(--color-pclss)" />
          <Stat label="High-risk open" value={k.highOpen} accent="var(--color-sev-high)" />
          <Stat label="Proof-gap rate" value={`${k.gapRate}%`} accent="var(--color-hsl)" />
          <Stat label="Action closure" value={`${k.actionClosure}%`} accent="var(--color-curve)" />
          <Stat label="Closed w/ proof" value={k.closedWithProof} accent="var(--color-sev-low)" />
        </div>

        {/* Timeline */}
        <Card className="mt-5">
          <CardHeader title="Cells over time" subtitle="Weekly, stacked by severity" />
          <div className="p-4">
            <StackedTimeline buckets={timeline} />
          </div>
        </Card>

        {/* Distributions */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="By control gap" subtitle="The dominant failure modes" />
            <div className="p-4"><BarList data={byGap} color="var(--color-hsl)" /></div>
          </Card>
          <Card>
            <CardHeader title="By exposure type" subtitle="How people/assets get harmed" />
            <div className="p-4"><BarList data={byExposure} color="var(--color-pclss)" /></div>
          </Card>
          <Card>
            <CardHeader title="By energy source" subtitle="Hazard genome" />
            <div className="p-4"><BarList data={byEnergy} color="var(--color-exp)" /></div>
          </Card>
          <Card>
            <CardHeader title="By status" subtitle="Where cells sit in the workflow" />
            <div className="p-4"><BarList data={byStatus} color="#64748b" /></div>
          </Card>
        </div>

        {/* Risk Intelligence Framework composition */}
        <Card className="mt-4">
          <CardHeader title="By risk object" subtitle="Composition across the six-object framework (§6)" />
          <div className="p-4"><BarList data={riskObjects} colorFor={(l) => riskObjectColor.get(l)} /></div>
        </Card>

        {/* Cross-platform comparison */}
        <Card className="mt-4">
          <CardHeader title="Cross-platform comparison" subtitle="One row per vertical — how the platforms differ (VELA's raw material)" />
          <div className="overflow-x-auto p-4">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="pb-2">Vertical</th>
                  <th className="pb-2">Cells</th>
                  <th className="pb-2">Avg risk</th>
                  <th className="pb-2">% high/critical</th>
                  <th className="pb-2">% open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {verticals.map((v) => (
                  <tr key={v.vertical}>
                    <td className="py-2 font-medium capitalize text-slate-700">{v.vertical.replace(/-/g, " ")}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded bg-slate-100">
                          <div className="h-full rounded bg-[var(--color-pclss)]" style={{ width: `${(v.count / maxVertCount) * 100}%` }} />
                        </div>
                        <span className="font-semibold text-slate-700">{v.count}</span>
                      </div>
                    </td>
                    <td className="py-2 text-slate-600">{v.avgRisk}</td>
                    <td className="py-2 text-slate-600">{v.pctHigh}%</td>
                    <td className="py-2 text-slate-600">{v.pctOpen}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recurrence */}
        <Card className="mt-4">
          <CardHeader title="Most recurring tasks" subtitle="Where risk concentrates by activity" />
          <div className="p-4"><BarList data={byTask} color="var(--color-curve)" /></div>
        </Card>
      </div>
    </>
  );
}
