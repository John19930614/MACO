import { Card } from "@/components/ui/primitives";
import { Badge } from "./badges";
import { ShieldCheck, Crown, Circle } from "lucide-react";
import type { DevAgent } from "@/lib/devcenter/types";

const RESTRICTION_LABEL: Record<string, string> = {
  no_deploy: "Can't deploy",
  no_deploy_without_approval: "No deploy without approval",
  no_migrate: "Can't change the database",
  no_file_write: "Can't save files",
  no_auth_change: "Can't change logins",
  no_rls_change: "Can't change data-access rules",
  no_delete: "Can't delete",
};

const STATUS_DOT: Record<string, string> = {
  active: "text-emerald-500",
  inactive: "text-slate-300 dark:text-slate-600",
  error: "text-red-500",
};

export function AgentCard({ agent }: { agent: DevAgent }) {
  return (
    <Card className="flex flex-col gap-0 p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
            {agent.is_manager ? <Crown className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            <Circle
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-current ${STATUS_DOT[agent.status] ?? STATUS_DOT.inactive}`}
              strokeWidth={0}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{agent.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{agent.role}</p>
          </div>
        </div>
        {agent.is_manager
          ? <Badge label="Team lead" tone="violet" />
          : <Badge label={agent.status === "active" ? "Active" : "Inactive"} tone={agent.status === "active" ? "success" : "neutral"} />}
      </div>

      {/* Description */}
      {agent.description && (
        <p className="px-4 pb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{agent.description}</p>
      )}

      {/* What it can't do */}
      <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Safety rules
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(agent.restrictions.length ? agent.restrictions : ["no_deploy"]).map((r) => (
            <span
              key={r}
              className="inline-flex items-center rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:ring-slate-600"
            >
              {RESTRICTION_LABEL[r] ?? r}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
