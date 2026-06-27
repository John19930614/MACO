import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { TaskStatusBadge, PriorityBadge, RiskLevelBadge } from "../_components/badges";
import { EmptyStateCard } from "../_components/states";
import { SAMPLE_TASKS } from "@/lib/devcenter/sample";
import { relativeTime } from "@/lib/utils";
import { Plus } from "lucide-react";

export const metadata = { title: "Tasks · AI Dev Command Center" };

export default function TasksPage() {
  const tasks = [...SAMPLE_TASKS].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
  const openCount = tasks.filter((t) => !["done", "rejected", "cancelled"].includes(t.status)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">All tasks</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{openCount} open · {tasks.length} total. Click a task to see what the team is doing.</p>
        </div>
        <Link href="/admin/dev-command/tasks/new" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
          <Plus className="h-4 w-4" /> New task
        </Link>
      </div>

      {tasks.length === 0 ? (
        <EmptyStateCard title="No tasks yet" description="Hand your first job to the AI team." action={{ label: "New task", href: "/admin/dev-command/tasks/new" }} />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {tasks.map((t) => (
              <li key={t.id}>
                <Link href={`/admin/dev-command/tasks/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
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
      )}
    </div>
  );
}
