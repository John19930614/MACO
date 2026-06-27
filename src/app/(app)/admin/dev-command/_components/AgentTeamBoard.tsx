import { AgentCard } from "./AgentCard";
import { EmptyStateCard } from "./states";
import { Users } from "lucide-react";
import type { DevAgent } from "@/lib/devcenter/types";

/**
 * The full AI team, grouped as the lead + the specialists. Read-only in Phase 2.
 */
export function AgentTeamBoard({ agents }: { agents: DevAgent[] }) {
  if (!agents.length) {
    return <EmptyStateCard title="No agents yet" description="The AI team hasn't been set up." />;
  }
  const lead = agents.filter((a) => a.is_manager);
  const team = agents.filter((a) => !a.is_manager);

  return (
    <div className="space-y-6">
      {lead.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Users className="h-4 w-4 text-slate-400" /> Team lead
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lead.map((a) => <AgentCard key={a.id} agent={a} />)}
          </div>
        </section>
      )}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Specialists</h2>
        <p className="mb-3 text-xs text-slate-400">Each agent has a narrow job and a list of things it is not allowed to do.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((a) => <AgentCard key={a.id} agent={a} />)}
        </div>
      </section>
    </div>
  );
}
