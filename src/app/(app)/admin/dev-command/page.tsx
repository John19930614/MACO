import { DevCommandDashboard } from "./_components/DevCommandDashboard";
import {
  dashboardMetrics, SAMPLE_TASKS, SAMPLE_APPROVALS, SAMPLE_AUDIT,
} from "@/lib/devcenter/sample";

export const metadata = { title: "AI Dev Command Center" };

export default function DevCommandHomePage() {
  const metrics = dashboardMetrics();
  const pendingApprovals = SAMPLE_APPROVALS.filter((a) => a.status === "pending");
  const recentTasks = [...SAMPLE_TASKS]
    .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
    .slice(0, 6);
  const recentAudit = SAMPLE_AUDIT.slice(0, 6);

  return (
    <DevCommandDashboard
      metrics={metrics}
      pendingApprovals={pendingApprovals}
      recentTasks={recentTasks}
      recentAudit={recentAudit}
    />
  );
}
