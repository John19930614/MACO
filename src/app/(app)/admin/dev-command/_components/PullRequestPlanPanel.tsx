import { Card, CardHeader } from "@/components/ui/primitives";
import { GitPullRequest } from "lucide-react";
import type { PrSection } from "@/lib/devcenter/github-plan";

/**
 * The prepared pull-request text (10 sections, incl. the required Experience
 * review and Rollback plan). Display only — no pull request is created.
 */
export function PullRequestPlanPanel({ title, sections }: { title: string; sections: PrSection[] }) {
  return (
    <Card>
      <CardHeader title="Pull request plan" subtitle="The pull-request text the team prepared — created only after your approval" right={<GitPullRequest className="h-4 w-4 text-slate-300" />} />
      <div className="p-4">
        <div className="mb-3 rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Title</p>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
        </div>
        <div className="space-y-3">
          {sections.map((s) => (
            <div key={s.label}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
              {s.lines.length === 1 ? (
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{s.lines[0]}</p>
              ) : (
                <ul className="mt-0.5 space-y-0.5">
                  {s.lines.map((l, i) => (
                    <li key={i} className="flex gap-1.5 text-sm text-slate-600 dark:text-slate-300"><span className="text-slate-300">•</span> {l}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
