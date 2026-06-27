import { Card, CardHeader } from "@/components/ui/primitives";
import { RunStatusBadge } from "./badges";
import { EmptyStateCard } from "./states";
import { agentNameById } from "@/lib/devcenter/sample";
import { relativeTime } from "@/lib/utils";
import { MessageSquare, Brain, Wrench } from "lucide-react";
import type { DevAgent, DevAgentRun, DevAgentMessage } from "@/lib/devcenter/types";

const ROLE_ICON = {
  thought: Brain,
  tool: Wrench,
  assistant: MessageSquare,
  system: MessageSquare,
  user: MessageSquare,
} as const;

/**
 * A simple chronological story of what the team did on this task — agent
 * messages and thoughts, newest at the bottom, with the runs summarized at top.
 */
export function TaskTimeline({
  runs,
  messages,
  agents,
}: {
  runs: DevAgentRun[];
  messages: DevAgentMessage[];
  agents: DevAgent[];
}) {
  const ordered = [...messages].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  return (
    <Card>
      <CardHeader title="Activity timeline" subtitle="What the AI team has done on this task, in order" />
      <div className="p-4">
        {runs.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {runs.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800/60">
                <span className="font-medium text-slate-600 dark:text-slate-300">{agentNameById(r.agent_id, agents)}</span>
                <span className="text-slate-400">·</span>
                <span className="capitalize text-slate-500">{r.phase}</span>
                <RunStatusBadge status={r.status} />
              </span>
            ))}
          </div>
        )}

        {ordered.length === 0 ? (
          <EmptyStateCard title="No activity yet" description="Once the team starts, each step shows up here." />
        ) : (
          <ol className="space-y-4">
            {ordered.map((m) => {
              const Icon = ROLE_ICON[m.role] ?? MessageSquare;
              return (
                <li key={m.id} className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{agentNameById(m.agent_id, agents)}</span>
                      {m.role === "thought" && <span className="text-[10px] uppercase tracking-wide text-slate-400">thinking</span>}
                      <span className="text-[11px] text-slate-400">{relativeTime(m.created_at)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{m.content}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Card>
  );
}
