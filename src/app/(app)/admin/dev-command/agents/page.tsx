import { AgentProfileCard } from "../_components/AgentProfileCard";
import { agentsByGroup, GROUP_META, AGENT_PROFILES } from "@/lib/devcenter/agent-registry";
import { Sparkles } from "lucide-react";

export const metadata = { title: "AI Team · AI Dev Command Center" };

export default function AgentsPage() {
  const groups = agentsByGroup();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Your AI team</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {AGENT_PROFILES.length} agents, each with a focused job. Click any agent to see its skills, what it&apos;s allowed to do, and the limits it can never cross.
        </p>
      </div>

      {groups.map(({ group, agents }) => {
        if (!agents.length) return null;
        const meta = GROUP_META[group];
        const isExperience = group === "experience";
        return (
          <section key={group}>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{meta.label}</h3>
              {isExperience && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                  <Sparkles className="h-3 w-3" /> First-class
                </span>
              )}
            </div>
            <p className="mb-3 text-xs text-slate-400">{meta.hint}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((a) => <AgentProfileCard key={a.key} agent={a} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
