import { CELLS, PROOFS, ACTIONS, SITES, LOCATIONS } from "@/lib/data/mock";
import { ReportView, type ReportData } from "@/components/arc/ReportView";
import { PageHeader } from "@/components/ui/primitives";

export default function ReportsPage() {
  const siteName    = (id: string) => SITES.find((s) => s.id === id)?.name ?? id;
  const locationName = (id: string) => LOCATIONS.find((l) => l.id === id)?.label ?? id;
  const cellTitle   = (id: string) => CELLS.find((c) => c.id === id)?.title ?? id;

  const openCells  = CELLS.filter((c) => c.status !== "closed");
  const highOpen   = openCells.filter((c) => c.severity === "high" || c.severity === "critical");
  const gapProofs  = PROOFS.filter((p) => ["missing", "expired", "conflicting", "weak_proof"].includes(p.status));
  const gapRate    = PROOFS.length ? Math.round((gapProofs.length / PROOFS.length) * 100) : 0;

  const closedActions  = ACTIONS.filter((a) => a.status === "closed");
  const actionClosure  = ACTIONS.length ? Math.round((closedActions.length / ACTIONS.length) * 100) : 0;

  const now = new Date().toISOString();
  const topRisks = [...CELLS]
    .filter((c) => c.status !== "closed")
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 8)
    .map((c) => ({ id: c.id, title: c.title, severity: c.severity, risk: c.risk_score, site: siteName(c.site_id) }));

  const missingProof = gapProofs.map((p) => ({ control: p.control, status: p.status, cell: cellTitle(p.cell_id) }));

  const overdueActions = ACTIONS.filter((a) => a.status !== "closed" && a.due_date && new Date(a.due_date).getTime() < Date.now())
    .map((a) => ({ title: a.title, due: a.due_date ?? "", cell: cellTitle(a.cell_id) }));

  const byGapMap = new Map<string, number>();
  for (const c of CELLS) {
    const gap = c.hazard_genome.controlGap ?? "unknown";
    byGapMap.set(gap, (byGapMap.get(gap) ?? 0) + 1);
  }
  const byGap      = [...byGapMap.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  const gapClusters = [...byGapMap.entries()].map(([gap, cells]) => ({ gap, cells, covered: overdueActions.length === 0 }));

  const data: ReportData = {
    generatedAt: now,
    kpis: { total: CELLS.length, open: openCells.length, highOpen: highOpen.length, gapRate, actionClosure },
    topRisks,
    missingProof,
    overdueActions,
    clusters: gapClusters,
    byGap,
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Reports"
        subtitle="Full platform safety intelligence report — printable, exportable."
      />
      <ReportView data={data} title="SafetyIQ Platform Report" />
    </div>
  );
}
