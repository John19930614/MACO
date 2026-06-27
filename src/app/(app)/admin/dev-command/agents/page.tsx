import { AgentTeamBoard } from "../_components/AgentTeamBoard";
import { getAgentsOrSample } from "@/lib/devcenter/sample";
import { Info } from "lucide-react";

export const metadata = { title: "AI Team · AI Dev Command Center" };

export default async function AgentsPage() {
  const { agents, usingSample } = await getAgentsOrSample();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Your AI team</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {agents.length} agents, each with a focused job. None of them can deploy, delete, or change logins or the database on their own.
        </p>
      </div>

      {usingSample && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>Showing the sample roster. The live team is read from the database when this runs on the server.</p>
        </div>
      )}

      <AgentTeamBoard agents={agents} />
    </div>
  );
}
