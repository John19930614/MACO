import Link from "next/link";
import { Stat, Card, CardHeader } from "@/components/ui/primitives";
import { TONE_DOT } from "@/lib/devcenter/labels";
import { TaskStatusBadge, PriorityBadge } from "./badges";
import { ApprovalCenter } from "./ApprovalCenter";
import { AuditLogTable } from "./AuditLogTable";
import { EmptyStateCard } from "./states";
import { relativeTime } from "@/lib/utils";
import {
  ListTodo, ShieldCheck, Activity, AlertTriangle, ShieldAlert,
  Smile, FileCode2, GitPullRequest, Rocket, History, ArrowRight,
} from "lucide-react";
import type { DashboardMetric } from "@/lib/devcenter/sample";
import type { DevTask, DevApproval, DevAuditEntry } from "@/lib/devcenter/types";

const ICONS: Record<string, typeof ListTodo> = {
  open_tasks: ListTodo, need_approval: ShieldCheck, runs_today: Activity,
  failed_runs: AlertTriangle, security_warnings: ShieldAlert, xp_failures: Smile,
  draft_plans: FileCode2, active_prs: GitPullRequest, recent_deploys: Rocket,
  audit_today: History,
};

/**
 * The Command Center home: ten plain-English status cards, then the things that
 * most need attention — approvals waiting, recent tasks, and recent activity.
 */
export function DevCommandDashboard({
  metrics,
  pendingApprovals,
  recentTasks,
  recentAudit,
}: {
  metrics: DashboardMetric[];
  pendingApprovals: DevApproval[];
  recentTasks: DevTask[];
  recentAudit: DevAuditEntry[];
}) {
  return (
    <div className="space-y-6">
      {/* 10 status cards */}
      <section>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {metrics.map((m) => {
            const Icon = ICONS[m.key] ?? Activity;
            return (
              <Link key={m.key} href={m.href} className="block focus:outline-none focus:ring-2 focus:ring-blue-200 rounded-xl">
                <Stat
                  label={m.label}
                  value={m.value}
                  hint={m.hint}
                  icon={<Icon className="h-5 w-5" />}
                  accent={TONE_DOT[m.tone]}
                  strip={TONE_DOT[m.tone]}
                />
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Approvals waiting */}
        <ApprovalCenter approvals={pendingApprovals} title="Waiting for your approval" subtitle="Risky steps the team paused on until you decide" />

        {/* Recent tasks */}
        <Card>
          <CardHeader
            title="Recent tasks"
            subtitle="The latest work you've handed to the team"
            right={<Link href="/admin/dev-command/tasks" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">View all <ArrowRight className="h-3 w-3" /></Link>}
          />
          <div className="p-4">
            {recentTasks.length === 0 ? (
              <EmptyStateCard title="No tasks yet" description="Create your first task to get started." action={{ label: "New task", href: "/admin/dev-command/tasks/new" }} />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {recentTasks.map((t) => (
                  <li key={t.id}>
                    <Link href={`/admin/dev-command/tasks/${t.id}`} className="flex items-center justify-between gap-3 py-2.5 transition hover:opacity-80 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{t.title}</p>
                        <p className="text-[11px] text-slate-400">{t.target_area ?? "Platform"} · updated {relativeTime(t.updated_at)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <PriorityBadge priority={t.priority} />
                        <TaskStatusBadge status={t.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <AuditLogTable entries={recentAudit} />
    </div>
  );
}
