import {
  getRiskAssessments, getCapaActions, getComplianceScores,
  getAiFindings, getIncidents, getProfiles, latestPredictabilityRun,
} from "@/lib/data/ehsRepo";
import { getServerTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import { PageHeader, Card, CardHeader } from "@/components/ui/primitives";
import { AddRiskButton } from "./AddRiskButton";
import { RiskExportButton } from "./RiskExportButton";
import { RiskDashboard } from "./RiskDashboard";

function riskLevelOrder(level: string): number {
  return level === "extreme" ? 4 : level === "high" ? 3 : level === "medium" ? 2 : 1;
}

function riskBarColor(worstLevel: string): string {
  return worstLevel === "extreme" ? "#dc2626"
    : worstLevel === "high"    ? "#ea580c"
    : worstLevel === "medium"  ? "#d97706"
    : "#10b981";
}

export default async function RiskPage() {
  const tenantId = (await getServerTenantId()) ?? MOCK_TENANT_ID;
  const [assessments, capas, scores, findings, incidents, profiles, latestRun] = await Promise.all([
    getRiskAssessments(tenantId),
    getCapaActions(tenantId),
    getComplianceScores(tenantId),
    getAiFindings(tenantId),
    getIncidents(tenantId),
    getProfiles(tenantId),
    latestPredictabilityRun(tenantId),
  ]);

  // â”€â”€ Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Risk by category â€” count + worst level per category
  const byCategory: Record<string, { count: number; worstLevel: string }> = {};
  for (const a of assessments) {
    if (!byCategory[a.category]) byCategory[a.category] = { count: 0, worstLevel: "low" };
    byCategory[a.category].count++;
    if (riskLevelOrder(a.risk_level) > riskLevelOrder(byCategory[a.category].worstLevel)) {
      byCategory[a.category].worstLevel = a.risk_level;
    }
  }
  const catRows = Object.entries(byCategory)
    .map(([cat, { count, worstLevel }]) => ({ cat, count, worstLevel }))
    .sort((a, b) => b.count - a.count);
  const maxCat = Math.max(...catRows.map((r) => r.count), 1);

  // Controls effectiveness â€” assessments with residual scores
  const withResidual = assessments.filter((a) => a.residual_risk_score != null);
  const avgInitial = withResidual.length > 0
    ? Math.round(withResidual.reduce((s, a) => s + a.risk_score, 0) / withResidual.length * 10) / 10 : null;
  const avgResidual = withResidual.length > 0
    ? Math.round(withResidual.reduce((s, a) => s + (a.residual_risk_score ?? 0), 0) / withResidual.length * 10) / 10 : null;
  const maxScore = 25; // 5Ã—5
  const reduction = avgInitial != null && avgResidual != null
    ? Math.round(((avgInitial - avgResidual) / avgInitial) * 100) : null;

  // Owner workload â€” open assessments (active status) by owner
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));
  const openByOwner: Record<string, number> = {};
  for (const a of assessments.filter((a) => a.status === "active")) {
    if (a.owner_id) openByOwner[a.owner_id] = (openByOwner[a.owner_id] ?? 0) + 1;
  }
  const ownerRows = Object.entries(openByOwner)
    .map(([id, count]) => ({ name: profileMap[id] ?? "Unassigned", count }))
    .sort((a, b) => b.count - a.count);
  const maxOwner = Math.max(...ownerRows.map((r) => r.count), 1);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Risk Intelligence"
        subtitle="Risk heat map, predictive compliance trends, AI-scored findings, and risk register"
        actions={
          <div className="flex gap-2">
            <RiskExportButton assessments={assessments} profiles={profiles} />
            <AddRiskButton />
          </div>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">

        {/* Analytics strip */}
        <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Risk by category */}
          <Card>
            <CardHeader title="Risk by Category" subtitle="Count Â· worst level shown" />
            <div className="space-y-2 px-4 pb-4">
              {catRows.map((r) => (
                <div key={r.cat} className="flex items-center gap-2">
                  <div className="w-24 shrink-0 truncate text-[10px] capitalize text-slate-500 dark:text-slate-400">
                    {r.cat.replace(/_/g, " ")}
                  </div>
                  <div className="flex-1 h-3.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max((r.count / maxCat) * 100, 8)}%`,
                        backgroundColor: riskBarColor(r.worstLevel),
                      }}
                    />
                  </div>
                  <div className="w-5 text-right text-xs font-bold text-slate-700 dark:text-slate-200">{r.count}</div>
                </div>
              ))}
              {catRows.length === 0 && <div className="text-xs text-slate-400">No assessments.</div>}
            </div>
          </Card>

          {/* Controls effectiveness */}
          <Card>
            <CardHeader
              title="Controls Effectiveness"
              subtitle={`${withResidual.length} of ${assessments.length} assessments have residual scores`}
            />
            <div className="px-4 pb-4">
              {avgInitial != null && avgResidual != null ? (
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                      <span>Initial Risk</span>
                      <span className="font-bold text-orange-600">{avgInitial} / {maxScore}</span>
                    </div>
                    <div className="h-3.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-orange-400 transition-all"
                        style={{ width: `${(avgInitial / maxScore) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                      <span>Residual Risk</span>
                      <span className="font-bold text-emerald-600">{avgResidual} / {maxScore}</span>
                    </div>
                    <div className="h-3.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-emerald-400 transition-all"
                        style={{ width: `${(avgResidual / maxScore) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-center">
                    <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{reduction}%</span>
                    <span className="ml-1.5 text-[10px] text-emerald-600 dark:text-emerald-500">avg risk reduction</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  No residual scores entered yet. Add residual likelihood &amp; consequence to assessments to track control effectiveness.
                </div>
              )}
            </div>
          </Card>

          {/* Owner workload */}
          <Card>
            <CardHeader title="Owner Workload" subtitle="Active assessments per owner" />
            <div className="space-y-2 px-4 pb-4">
              {ownerRows.slice(0, 6).map((r) => (
                <div key={r.name} className="flex items-center gap-2">
                  <div className="w-28 shrink-0 truncate text-[10px] text-slate-500 dark:text-slate-400">{r.name}</div>
                  <div className="flex-1 h-3.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-violet-400 transition-all"
                      style={{ width: `${Math.max((r.count / maxOwner) * 100, 8)}%` }}
                    />
                  </div>
                  <div className="w-4 text-right text-xs font-bold text-slate-700 dark:text-slate-200">{r.count}</div>
                </div>
              ))}
              {ownerRows.length === 0 && (
                <div className="text-xs text-slate-400">No active assessments assigned.</div>
              )}
            </div>
          </Card>

        </div>

        <RiskDashboard
          assessments={assessments}
          capas={capas}
          scores={scores}
          findings={findings}
          incidents={incidents}
          profiles={profiles}
          latestRun={latestRun}
        />
      </div>
    </div>
  );
}

