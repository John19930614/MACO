import { getCells, getProofs, getEdges } from "@/lib/data/repo";
import { PageHeader, Card, CardHeader, Stat } from "@/components/ui/primitives";

export const metadata = { title: "Trends — SafetyIQ" };

const BAD_PROOF_STATUSES = new Set(["missing", "expired", "conflicting", "not_checked"]);

type DistEntry = { key: string; count: number };

function distribute(values: string[]): DistEntry[] {
  const counts: Record<string, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }));
}

function BarList({ entries, color, total }: { entries: DistEntry[]; color: string; total: number }) {
  const max = entries[0]?.count ?? 1;
  return (
    <div className="space-y-1.5">
      {entries.map(({ key, count }) => (
        <div key={key} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-[11px] text-slate-500 capitalize">{key.replace(/_/g, " ")}</span>
          <div className="flex-1 h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${Math.round((count / max) * 100)}%`, background: color }} />
          </div>
          <span className="w-6 shrink-0 text-right text-[11px] font-semibold text-slate-600">{count}</span>
          <span className="w-9 shrink-0 text-right text-[11px] text-slate-400">{Math.round((count / total) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

export default async function TrendsPage() {
  const [cells, proofs, edges] = await Promise.all([getCells(), getProofs(), getEdges()]);

  const total        = cells.length;
  const open         = cells.filter(c => c.status === "open").length;
  const closed       = cells.filter(c => c.status === "closed").length;
  const critical     = cells.filter(c => c.severity === "critical").length;
  const missingProof = proofs.filter(p => BAD_PROOF_STATUSES.has(p.status)).length;

  const controlGapDist   = distribute(cells.map(c => c.hazard_genome?.controlGap   ?? "unknown"));
  const exposureTypeDist = distribute(cells.map(c => c.hazard_genome?.exposureType  ?? "unknown"));
  const energySourceDist = distribute(cells.map(c => c.hazard_genome?.energySource  ?? "unknown"));
  const statusDist       = distribute(cells.map(c => c.status));

  const locationCounts: Record<string, number> = {};
  for (const c of cells) locationCounts[c.location_id] = (locationCounts[c.location_id] ?? 0) + 1;
  const topLocations = Object.entries(locationCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxLocCount  = topLocations[0]?.[1] ?? 1;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Trends" subtitle="Patterns across every Safety Cell — the system-wide view." />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Total Cells"        value={total}        strip="#94a3b8" />
          <Stat label="Open Cells"         value={open}         accent="#f97316" strip="#f97316" />
          <Stat label="Closed Cells"       value={closed}       accent="#22c55e" strip="#22c55e" />
          <Stat label="Critical"           value={critical}     accent="#ef4444" strip="#ef4444" />
          <Stat label="Controls w/o Proof" value={missingProof} accent="#eab308" strip="#eab308" />
          <Stat label="Causal Edges"       value={edges.length} accent="#6366f1" strip="#6366f1" />
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader title="Control Gap" />
            <div className="px-4 pb-4"><BarList entries={controlGapDist} color="#f97316" total={total} /></div>
          </Card>
          <Card>
            <CardHeader title="Exposure Type" />
            <div className="px-4 pb-4"><BarList entries={exposureTypeDist} color="#3b82f6" total={total} /></div>
          </Card>
          <Card>
            <CardHeader title="Energy Source" />
            <div className="px-4 pb-4"><BarList entries={energySourceDist} color="#a855f7" total={total} /></div>
          </Card>
          <Card>
            <CardHeader title="Cell Status" />
            <div className="px-4 pb-4">
              <div className="space-y-1.5">
                {statusDist.map(({ key, count }) => {
                  const colorMap: Record<string, string> = { open: "#f97316", investigating: "#eab308", controlled: "#22c55e", closed: "#14b8a6" };
                  const color = colorMap[key] ?? "#94a3b8";
                  const max   = statusDist[0]?.count ?? 1;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-[11px] font-semibold capitalize" style={{ color }}>{key.replace(/_/g, " ")}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${Math.round((count / max) * 100)}%`, background: color }} />
                      </div>
                      <span className="w-6 shrink-0 text-right text-[11px] font-semibold text-slate-600">{count}</span>
                      <span className="w-9 shrink-0 text-right text-[11px] text-slate-400">{Math.round((count / total) * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Top Locations by Cell Count" />
          <div className="space-y-2 px-4 pb-4">
            {topLocations.length === 0 && <p className="text-xs text-slate-400">No location data yet.</p>}
            {topLocations.map(([locId, count], i) => (
              <div key={locId} className="flex items-center gap-4">
                <span className="shrink-0 w-5 text-center text-[11px] font-bold text-slate-400">#{i + 1}</span>
                <span className="w-36 shrink-0 text-[11px] font-mono text-slate-500 truncate">{locId}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.round((count / maxLocCount) * 100)}%` }} />
                </div>
                <span className="w-6 shrink-0 text-right text-[11px] font-semibold text-slate-600">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
