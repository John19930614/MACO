import Link from "next/link";
import { Lightbulb, ArrowRight, Zap } from "lucide-react";
import {
  getDailySuggestion,
  SUGGESTION_TYPE_LABEL,
  SUGGESTION_TYPE_TONE,
  SUGGESTION_EFFORT_LABEL,
} from "@/lib/devcenter/suggestions";

export function DailySuggestion() {
  const s = getDailySuggestion();
  const href = `/admin/dev-command/tasks/new?s=${encodeURIComponent(s.id)}`;

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:border-blue-900/60 dark:from-blue-950/30 dark:to-indigo-950/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                Today&apos;s suggestion from the AI team
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SUGGESTION_TYPE_TONE[s.type]}`}
              >
                {SUGGESTION_TYPE_LABEL[s.type]}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {s.module}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.title}</p>
            <p className="max-w-xl text-xs leading-relaxed text-slate-600 dark:text-slate-400">{s.why}</p>
            <p className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
              <Zap className="h-3 w-3" />
              {SUGGESTION_EFFORT_LABEL[s.effort]}
            </p>
          </div>
        </div>
        <Link
          href={href}
          className="flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 sm:mt-1"
        >
          Turn into a task
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
