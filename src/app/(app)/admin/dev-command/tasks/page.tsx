import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { TaskStatusBadge, PriorityBadge, RiskLevelBadge } from "../_components/badges";
import { EmptyStateCard } from "../_components/states";
import { getDevTasks } from "@/lib/devcenter/repo";
import { SAMPLE_TASKS } from "@/lib/devcenter/sample";
import { CLOSED_TASK_STATUSES } from "@/lib/devcenter/labels";
import { relativeTime } from "@/lib/utils";
import { Plus, Info, FolderOpen, CheckCircle2 } from "lucide-react";

export const metadata = { title: "Tasks · AI Dev Command Center" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "closed" ? "closed" : "open";

  const real = await getDevTasks();
  const usingSample = real.length === 0;
  const allTasks = (usingSample ? SAMPLE_TASKS : real)
    .slice()
    .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));

  const openTasks   = allTasks.filter((t) => !CLOSED_TASK_STATUSES.includes(t.status));
  const closedTasks = allTasks.filter((t) =>  CLOSED_TASK_STATUSES.includes(t.status));
  const tasks = activeTab === "open" ? openTasks : closedTasks;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Tasks</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {openTasks.length} open · {closedTasks.length} closed. Click a task to see what the team is doing.
          </p>
        </div>
        <Link
          href="/admin/dev-command/tasks/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> New task
        </Link>
      </div>

      {usingSample && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>These are example tasks. Create your first real task and this list switches to your live tasks.</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/50">
        <Link
          href="/admin/dev-command/tasks?tab=open"
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${
            activeTab === "open"
              ? "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-white"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <FolderOpen className="h-4 w-4" />
          Open
          {openTasks.length > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              activeTab === "open"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
            }`}>
              {openTasks.length}
            </span>
          )}
        </Link>
        <Link
          href="/admin/dev-command/tasks?tab=closed"
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${
            activeTab === "closed"
              ? "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-white"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Closed
          {closedTasks.length > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              activeTab === "closed"
                ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
            }`}>
              {closedTasks.length}
            </span>
          )}
        </Link>
      </div>

      {/* Task list */}
      {tasks.length > 0 ? (
        <Card>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {tasks.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/admin/dev-command/tasks/${t.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{t.title}</p>
                    <p className="text-xs text-slate-400">{t.target_area ?? "Platform"} · updated {relativeTime(t.updated_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <PriorityBadge priority={t.priority} />
                    <RiskLevelBadge level={t.risk_level} />
                    <TaskStatusBadge status={t.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyStateCard
          title={activeTab === "open" ? "No open tasks" : "No closed tasks yet"}
          description={activeTab === "open" ? "Hand your first job to the AI team." : "Completed tasks will show up here."}
          action={activeTab === "open" ? { label: "New task", href: "/admin/dev-command/tasks/new" } : undefined}
        />
      )}
    </div>
  );
}
