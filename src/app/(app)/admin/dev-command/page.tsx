import { getLiveDashboardData } from "@/lib/devcenter/repo";
import {
  dashboardMetrics, SAMPLE_TASKS, SAMPLE_APPROVALS, SAMPLE_AUDIT, SAMPLE_RUNS,
} from "@/lib/devcenter/sample";
import { DevCommandDashboard } from "./_components/DevCommandDashboard";
import { DailySuggestion } from "./_components/DailySuggestion";
import { AiUsagePanel } from "./AiUsagePanel";
import { MOCK_MODE } from "@/lib/env";

export const metadata = { title: "AI Dev Command Center" };

export default async function DevCommandHomePage() {
  if (MOCK_MODE) {
    return (
      <div className="space-y-4">
        <DailySuggestion />
        <AiUsagePanel />
        <DevCommandDashboard
          metrics={dashboardMetrics()}
          pendingApprovals={SAMPLE_APPROVALS.filter((a) => a.status === "pending")}
          recentTasks={[...SAMPLE_TASKS].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)).slice(0, 6)}
          recentAudit={SAMPLE_AUDIT.slice(0, 10)}
          counts={null}
          securityBlockerTasks={[]}
          experienceBlockerTasks={[]}
          failedRunTasks={SAMPLE_RUNS.filter((r) => r.status === "failed").map(() => SAMPLE_TASKS[5]).filter(Boolean)}
          isSample
        />
      </div>
    );
  }

  const live = await getLiveDashboardData().catch(() => ({
    openTasks: [], pendingApprovals: [], recentAudit: [],
    counts: { openTasks: 0, needApproval: 0, failedRuns: 0, securityBlockers: 0, experienceBlockers: 0, draftArtifacts: 0, runningAgents: 0 },
    securityBlockerTasks: [], experienceBlockerTasks: [], failedRunTasks: [],
  }));
  const hasTasks = live.openTasks.length > 0;
  const metrics = dashboardMetrics({
    open_tasks: live.counts.openTasks,
    need_approval: live.counts.needApproval,
    runs_today: live.counts.runningAgents,
    failed_runs: live.counts.failedRuns,
    security_warnings: live.counts.securityBlockers,
    xp_failures: live.counts.experienceBlockers,
    draft_plans: live.counts.draftArtifacts,
  });

  return (
    <div className="space-y-4">
      <DailySuggestion />
      <AiUsagePanel />
      <DevCommandDashboard
        metrics={metrics}
        pendingApprovals={hasTasks ? live.pendingApprovals : SAMPLE_APPROVALS.filter((a) => a.status === "pending")}
        recentTasks={hasTasks ? live.openTasks.slice(0, 6) : [...SAMPLE_TASKS].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)).slice(0, 6)}
        recentAudit={hasTasks ? live.recentAudit : SAMPLE_AUDIT.slice(0, 10)}
        counts={live.counts}
        securityBlockerTasks={live.securityBlockerTasks}
        experienceBlockerTasks={live.experienceBlockerTasks}
        failedRunTasks={live.failedRunTasks}
        isSample={!hasTasks}
      />
    </div>
  );
}
