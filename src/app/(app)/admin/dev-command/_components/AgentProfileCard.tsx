import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { Crown, ArrowRight } from "lucide-react";
import type { AgentProfile } from "@/lib/devcenter/agent-registry";

/** Role card for one agent — name, role, a few skills, and a link to its profile. */
export function AgentProfileCard({ agent }: { agent: AgentProfile }) {
  return (
    <Link href={`/admin/dev-command/agents/${agent.key}`} className="group block focus:outline-none">
      <Card className="h-full p-4 transition group-hover:-translate-y-px group-hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
              {agent.group === "lead" ? <Crown className="h-5 w-5" /> : <span className="text-sm font-bold">{initials(agent.name)}</span>}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{agent.name}</h3>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-blue-500" />
        </div>

        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{agent.role}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {agent.skills.slice(0, 3).map((s) => (
            <span key={s} className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {s}
            </span>
          ))}
          {agent.skills.length > 3 && (
            <span className="text-[11px] font-medium text-slate-400">+{agent.skills.length - 3} more</span>
          )}
        </div>
      </Card>
    </Link>
  );
}

function initials(name: string): string {
  return name.replace(/Agent$/, "").trim().split(/[\s/]+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
