import { getCells, getProofs, getActions, getSites, getLocations } from "@/lib/data/repo";
import { ReportView, type ReportData } from "@/components/arc/ReportView";
import { PageHeader } from "@/components/ui/primitives";

export default async function ReportsPage() {
  const [cells, proofs, actions, sites, locations] = await Promise.all([
    getCells(), getProofs(), getActions(), getSites(), getLocations(),
  ]);

  const siteName     = (id: string) => sites.find(s => s.id === id)?.name ?? id;
  const cellTitle    = (id: string) => cells.find(c => c.id === id)?.title ?? id;

  const openCells = cells.filter(c => c.status !== "closed");
  const highOpen  = openCells.filter(c => c.severity === "high" || c.severity === "critical");
  const gapProofs = proofs.filter(p => ["missing", "expired", "conflicting", "weak_proof"].includes(p.status));
  const gapRate   = proofs.length ? Math.round((gapProofs.length / proofs.length) * 100) : 0;

  const closedActions = actions.filter(a => a.status === "closed");
  const actionClosure = actions.length ? Math.round((closedActions.length / actions.length) * 100) : 0;

  const now = new Date().toISOString();
  const topRisks = [...cells]
    .filter(c => c.status !== "closed")
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 8)
    .map(c => ({ id: c.id, title: c.title, severity: c.severity, risk: c.risk_score, site: siteName(c.site_id) }));

  const missingProof = gapProofs.map(p => ({ control: p.control, status: p.status, cell: cellTitle(p.cell_id) }));

  const overdueActions = actions
    .filter(a => a.status !== "closed" && a.due_date && new Date(a.due_date).getTime() < Date.now())
    .map(a => ({ title: a.title, due: a.due_date ?? "", cell: cellTitle(a.cell_id) }));

  const byGapMap = new Map<string, number>();
  for (const c of cells) {
    const gap = c.hazard_genome.controlGap ?? "unknown";
    byGapMap.set(gap, (byGapMap.get(gap) ?? 0) + 1);
  }
  const byGap       = [...byGapMap.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  const gapClusters = [...byGapMap.entries()].map(([gap, cnt]) => ({ gap, cells: cnt, covered: overdueActions.length === 0 }));

  const data: ReportData = {
    generatedAt: now,
    kpis: { total: cells.length, open: openCells.length, highOpen: highOpen.length, gapRate, actionClosure },
    topRisks,
    missingProof,
    overdueActions,
    clusters: gapClusters,
    byGap,
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Reports" subtitle="Full platform safety intelligence report — printable, exportable." />
      <ReportView data={data} title="SafetyIQ Platform Report" />
    </div>
  );
}
