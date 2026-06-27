import { Card, CardHeader } from "@/components/ui/primitives";
import { DeploymentStatusBadge } from "./badges";
import { EmptyStateCard } from "./states";
import { relativeTime } from "@/lib/utils";
import { GitBranch, GitPullRequest, Rocket } from "lucide-react";
import type { DevDeployment, DeploymentEnvironment } from "@/lib/devcenter/types";

const ENV_LABEL: Record<DeploymentEnvironment, string> = {
  preview: "Preview", staging: "Staging", production: "Production",
};

/**
 * Branch / pull request / preview / release info for a task. Read-only here —
 * the Command Center does not create branches or deploy in this phase.
 */
export function DeploymentPanel({ deployments }: { deployments: DevDeployment[] }) {
  return (
    <Card>
      <CardHeader
        title="Branches & releases"
        subtitle="Code branches, pull requests, previews and releases"
        right={<Rocket className="h-4 w-4 text-slate-300" />}
      />
      <div className="p-4">
        {deployments.length === 0 ? (
          <EmptyStateCard title="Nothing deployed yet" description="When a task is ready, its branch and pull request show up here." />
        ) : (
          <ul className="space-y-3">
            {deployments.map((d) => (
              <li key={d.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <GitBranch className="h-4 w-4 text-slate-400" />
                    <span className="font-mono text-xs">{d.branch ?? "—"}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">{ENV_LABEL[d.environment]}</span>
                  </div>
                  <DeploymentStatusBadge status={d.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  {d.pr_number && (
                    <span className="inline-flex items-center gap-1"><GitPullRequest className="h-3.5 w-3.5" /> Pull request #{d.pr_number}</span>
                  )}
                  {d.release_tag && <span>Release {d.release_tag}</span>}
                  <span>Updated {relativeTime(d.updated_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
