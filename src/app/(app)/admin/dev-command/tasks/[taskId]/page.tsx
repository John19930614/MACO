import Link from "next/link";
import { notFound } from "next/navigation";
import { TaskStatusBadge, PriorityBadge, RiskLevelBadge } from "../../_components/badges";
import { TaskTimeline } from "../../_components/TaskTimeline";
import { AgentOutputPanel } from "../../_components/AgentOutputPanel";
import { FileChangePlanViewer } from "../../_components/FileChangePlanViewer";
import { ApprovalCenter } from "../../_components/ApprovalCenter";
import { TestResultsPanel } from "../../_components/TestResultsPanel";
import { SecurityReviewPanel } from "../../_components/SecurityReviewPanel";
import { ExperienceReviewPanel } from "../../_components/ExperienceReviewPanel";
import { DeploymentPanel } from "../../_components/DeploymentPanel";
import { taskBundle, SAMPLE_AGENTS } from "@/lib/devcenter/sample";
import { relativeTime } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const b = taskBundle(taskId);
  if (!b.task) notFound();
  const t = b.task;

  return (
    <div className="space-y-5">
      <Link href="/admin/dev-command/tasks" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400">
        <ArrowLeft className="h-4 w-4" /> Back to tasks
      </Link>

      {/* Task header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.title}</h2>
            {t.description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.description}</p>}
            <p className="mt-2 text-xs text-slate-400">{t.target_area ?? "Platform"} · created {relativeTime(t.created_at)} · updated {relativeTime(t.updated_at)}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <PriorityBadge priority={t.priority} />
            <RiskLevelBadge level={t.risk_level} />
            <TaskStatusBadge status={t.status} />
          </div>
        </div>
      </div>

      {/* Panels */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <TaskTimeline runs={b.runs} messages={b.messages} agents={SAMPLE_AGENTS} />
          <AgentOutputPanel artifacts={b.artifacts} />
          <FileChangePlanViewer plans={b.filePlans} />
        </div>
        <div className="space-y-5">
          <ApprovalCenter approvals={b.approvals} title="Approvals for this task" subtitle="Risky steps paused for your decision" />
          <TestResultsPanel results={b.testResults} />
          <SecurityReviewPanel reviews={b.securityReviews} />
          <ExperienceReviewPanel reviews={b.experienceReviews} />
          <DeploymentPanel deployments={b.deployments} />
        </div>
      </div>
    </div>
  );
}
