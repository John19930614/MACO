import Link from "next/link";
import { Stat, Card, CardHeader } from "@/components/ui/primitives";
import { TONE_DOT } from "@/lib/devcenter/labels";
import { TaskStatusBadge, PriorityBadge, RiskLevelBadge } from "./badges";
import { ApprovalCenter } from "./ApprovalCenter";
import { AuditLogTable } from "./AuditLogTable";
import { EmptyStateCard } from "./states";
import { relativeTime } from "@/lib/utils";
import {
  ListTodo, ShieldCheck, Activity, AlertTriangle, ShieldAlert,
  Smile, FileCode2, GitPullRequest, Rocket, History, ArrowRight,
  Info, XCircle, FileUp,
} from "lucide-react";
import type { DashboardMetric } from "@/lib/devcenter/sample";
import type { DevTask, DevApproval, DevAuditEntry } from "@/lib/devcenter/types";
import type { LiveDashboardData } from "@/lib/devcenter/repo";

const ICONS: Record<string, typeof ListTodo> = {
  open_tasks: ListTodo, need_approval: ShieldCheck, runs_today: Activity,
  failed_runs: AlertTriangle, security_warnings: ShieldAlert, xp_failures: Smile,
  draft_plans: FileCode2, active_prs: GitPullRequest, recent_deploys: Rocket,
  audit_today: History,
};

type Counts = LiveDashboardData["counts"] | null;

export function DevCommandDashboard({
  metrics, pendingApprovals, recentTasks, recentAudit,
  counts, securityBlockerTasks, experienceBlockerTasks, failedRunTasks, isSample,
}: {
  metrics: DashboardMetric[];
  pendingApprovals: DevApproval[];
  recentTasks: DevTask[];
  recentAudit: DevAuditEntry[];
  counts: Counts;
  securityBlockerTasks: DevTask[];
  experienceBlockerTasks: DevTask[];
  failedRunTasks: DevTask[];
  isSample?: boolean;
}) {
  const hasBlockers = (counts?.securityBlockers ?? 0) > 0 || (counts?.experienceBlockers ?? 0) > 0 || (counts?.failedRuns ?? 0) > 0;

  return (
    <div className="space-y-6">

      {/* Sample-data notice */}
      {isSample && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            These are example tasks — the system is ready but no real tasks exist yet.{" "}
            <Link href="/admin/dev-command/tasks/new" className="font-semibold underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-100">
              Create your first task
            </Link>{" "}
            or{" "}
            <Link href="/admin/dev-command/import" className="font-semibold underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-100">
              import from meeting notes
            </Link>{" "}
            to see live data here.
          </span>
        </div>
      )}

      {/* 10 stat cards */}
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {metrics.map((m) => {
            const Icon = ICONS[m.key] ?? Activity;
            return (
              <Link key={m.key} href={m.href} className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200">
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

      {/* Blockers — only show if there are real blockers */}
      {hasBlockers && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
            <XCircle className="h-4 w-4" /> Needs attention before tasks can complete
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {securityBlockerTasks.length > 0 && (
              <BlockerCard
                title="Security blockers"
                description="Critical security findings blocking these tasks"
                tone="danger"
                tasks={securityBlockerTasks}
              />
            )}
            {experienceBlockerTasks.length > 0 && (
              <BlockerCard
                title="Experience issues"
                description="Ease-of-use problems that must be fixed"
                tone="warn"
                tasks={experienceBlockerTasks}
              />
            )}
            {failedRunTasks.length > 0 && (
              <BlockerCard
                title="Failed reviews"
                description="Agent runs that errored and need attention"
                tone="danger"
                tasks={failedRunTasks}
              />
            )}
          </div>
        </section>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Approvals waiting */}
        <ApprovalCenter
          approvals={pendingApprovals}
          title="Waiting for your approval"
          subtitle="Risky steps the AI team paused on — decide to continue or stop"
        />

        {/* Recent active tasks */}
        <Card>
          <CardHeader
            title="Active tasks"
            subtitle="Latest work you've handed to the AI team"
            right={
              <div className="flex items-center gap-3">
                <Link href="/admin/dev-command/import" className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
                  <FileUp className="h-3.5 w-3.5" /> Import notes
                </Link>
                <Link href="/admin/dev-command/tasks" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
                  All tasks <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            }
          />
          <div className="p-4">
            {recentTasks.length === 0 ? (
              <EmptyStateCard
                title="No tasks yet"
                description="Create your first task to get the AI team started."
                action={{ label: "New task", href: "/admin/dev-command/tasks/new" }}
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {recentTasks.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/admin/dev-command/tasks/${t.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 transition hover:opacity-80 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{t.title}</p>
                        <p className="text-[11px] text-slate-400">
                          {t.target_area ?? "Platform"} · updated {relativeTime(t.updated_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
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

      {/* Recent audit activity */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recent activity</h2>
          <Link href="/admin/dev-command/audit-log" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
            Full log <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <AuditLogTable entries={recentAudit} />
      </div>
    </div>
  );
}

function BlockerCard({ title, description, tone, tasks }: { title: string; description: string; tone: "danger" | "warn"; tasks: DevTask[] }) {
  const cls = tone === "danger"
    ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
    : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30";
  const titleCls = tone === "danger" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300";
  const descCls = tone === "danger" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400";

  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <p className={`text-xs font-semibold ${titleCls}`}>{title}</p>
      <p className={`mt-0.5 text-[11px] ${descCls}`}>{description}</p>
      <ul className="mt-2 space-y-1.5">
        {tasks.slice(0, 4).map((t) => (
          <li key={t.id}>
            <Link href={`/admin/dev-command/tasks/${t.id}`} className="flex items-center justify-between gap-2 rounded-md hover:opacity-80">
              <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{t.title}</span>
              <RiskLevelBadge level={t.risk_level} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
