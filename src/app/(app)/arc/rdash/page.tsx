import { getCells, getProofs, getBehaviors, getEvents, getActions } from "@/lib/data/repo";
import { PageHeader, Card, CardHeader, Stat } from "@/components/ui/primitives";

export const metadata = { title: "Risk Dashboard — SafetyIQ" };

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#94a3b8",
};

const CELL_TYPE_COLORS: Record<string, string> = {
  precursor: "#eab308", control: "#22c55e", failure: "#ef4444", behavior: "#a855f7", event: "#3b82f6", learning: "#14b8a6",
};

const BAD_PROOF_STATUSES = new Set(["missing", "expired", "conflicting", "not_checked"]);

export default async function RDashPage() {
  const [cells, proofs, behaviors, events, actions] = await Promise.all([
    getCells(), getProofs(), getBehaviors(), getEvents(), getActions(),
  ]);

  const totalCells    = cells.length;
  const criticalCells = cells.filter(c => c.severity === "critical").length;
  const highCells     = cells.filter(c => c.severity === "high").length;
  const badProofs     = proofs.filter(p => BAD_PROOF_STATUSES.has(p.status)).length;
  const openActions   = actions.filter(a => a.status === "open" || a.status === "in_progress").length;

  const top5 = [...cells].sort((a, b) => b.risk_score - a.risk_score).slice(0, 5);

  const gapCounts: Record<string, number> = {};
  for (const c of cells) {
    const gap = c.hazard_genome?.controlGap ?? "unknown";
    gapCounts[gap] = (gapCounts[gap] ?? 0) + 1;
  }
  const gapEntries = Object.entries(gapCounts).sort((a, b) => b[1] - a[1]);
  const maxGap = Math.max(...Object.values(gapCounts), 1);

  const sevCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const c of cells) if (c.severity in sevCounts) sevCounts[c.severity]++;
  const maxSev = Math.max(...Object.values(sevCounts), 1);

  const recentEvents = [...events]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 5);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Risk Dashboard" subtitle="System-wide risk intelligence at a glance." />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Total Cells"        value={totalCells}                           strip="#94a3b8" />
          <Stat label="Critical / High"    value={`${criticalCells} / ${highCells}`}    accent="#ef4444" strip="#ef4444" />
          <Stat label="Controls w/o Proof" value={badProofs}                             accent="#f97316" strip="#f97316" />
          <Stat label="Open Actions"       value={openActions}                           accent="#eab308" strip="#eab308" />
          <Stat label="Behavior Clusters"  value={behaviors.length}                      accent="#a855f7" strip="#a855f7" />
          <Stat label="Events Logged"      value={events.length}                         accent="#3b82f6" strip="#3b82f6" />
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Top 5 Highest-Risk Cells" />
            <div className="space-y-2 px-4 pb-4">
              {top5.length === 0 && <p className="text-xs text-slate-400">No safety cells yet.</p>}
              {top5.map((cell, i) => {
                const typeColor = CELL_TYPE_COLORS[cell.cell_type ?? "precursor"] ?? "#94a3b8";
                const sevColor  = SEVERITY_COLORS[cell.severity] ?? "#94a3b8";
                return (
                  <div key={cell.id} className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="mt-0.5 shrink-0 text-[11px] font-bold text-slate-400">#{i + 1}</span>
                        <p className="text-xs font-semibold text-slate-800 leading-snug">{cell.title}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize" style={{ background: `${typeColor}18`, color: typeColor }}>{cell.cell_type ?? "—"}</span>
                        <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize" style={{ background: `${sevColor}18`, color: sevColor }}>{cell.severity}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200">
                        <div className="h-full rounded-full" style={{ width: `${cell.risk_score}%`, background: sevColor }} />
                      </div>
                      <span className="shrink-0 text-[11px] font-bold text-slate-500">{cell.risk_score}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Control Gap Distribution" />
              <div className="space-y-2 px-4 pb-4">
                {gapEntries.length === 0 && <p className="text-xs text-slate-400">No data yet.</p>}
                {gapEntries.map(([gap, count]) => (
                  <div key={gap} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-[11px] text-slate-500 capitalize">{gap}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.round((count / maxGap) * 100)}%` }} />
                    </div>
                    <span className="w-5 shrink-0 text-right text-[11px] font-semibold text-slate-600">{count}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Severity Distribution" />
              <div className="space-y-2 px-4 pb-4">
                {(["critical", "high", "medium", "low"] as const).map(sev => {
                  const count = sevCounts[sev] ?? 0;
                  return (
                    <div key={sev} className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-[11px] font-semibold capitalize" style={{ color: SEVERITY_COLORS[sev] }}>{sev}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${Math.round((count / maxSev) * 100)}%`, background: SEVERITY_COLORS[sev] }} />
                      </div>
                      <span className="w-5 shrink-0 text-right text-[11px] font-semibold text-slate-600">{count}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader title="Recent Events" subtitle={`${recentEvents.length} most recent`} />
          {recentEvents.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No events recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentEvents.map(evt => {
                const sevColor = SEVERITY_COLORS[evt.severity] ?? "#94a3b8";
                const date = new Date(evt.occurred_at).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
                return (
                  <div key={evt.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize" style={{ background: `${sevColor}18`, color: sevColor }}>{evt.severity}</span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{evt.title}</p>
                        <p className="text-[11px] text-slate-500 capitalize">{evt.kind.replace(/_/g, " ")}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">{date}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
