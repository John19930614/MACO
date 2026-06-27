import { Card } from "@/components/ui/primitives";
import { Badge } from "./badges";
import { ShieldCheck, Crown } from "lucide-react";
import type { DevAgent } from "@/lib/devcenter/types";

/** Friendly labels for the restriction codes stored on each agent. */
const RESTRICTION_LABEL: Record<string, string> = {
  no_deploy: "Can't deploy",
  no_deploy_without_approval: "No deploy without approval",
  no_migrate: "Can't change the database",
  no_file_write: "Can't save files",
  no_auth_change: "Can't change logins",
  no_rls_change: "Can't change data-access rules",
  no_delete: "Can't delete",
};

export function AgentCard({ agent }: { agent: DevAgent }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
            {agent.is_manager ? <Crown className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{agent.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{agent.role}</p>
          </div>
        </div>
        {agent.is_manager && <Badge label="Team lead" tone="violet" />}
      </div>

      {agent.description && (
        <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{agent.description}</p>
      )}

      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">What it can&apos;t do</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(agent.restrictions.length ? agent.restrictions : ["no_deploy"]).map((r) => (
            <span
              key={r}
              className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            >
              {RESTRICTION_LABEL[r] ?? r}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
