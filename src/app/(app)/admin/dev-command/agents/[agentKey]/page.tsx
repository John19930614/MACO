import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/primitives";
import {
  getAgentProfile, GROUP_META, CORE_FORBIDDEN, OUTPUT_SCHEMA, EXPERIENCE_REVIEW,
} from "@/lib/devcenter/agent-registry";
import { ArrowLeft, Crown, Check, Ban, Lock, ClipboardList, Smile, Wrench } from "lucide-react";

export default async function AgentProfilePage({ params }: { params: Promise<{ agentKey: string }> }) {
  const { agentKey } = await params;
  const agent = getAgentProfile(agentKey);
  if (!agent) notFound();
  const meta = GROUP_META[agent.group];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/admin/dev-command/agents" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400">
        <ArrowLeft className="h-4 w-4" /> Back to the team
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
            {agent.group === "lead" ? <Crown className="h-6 w-6" /> : <span className="text-base font-bold">{initials(agent.name)}</span>}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{agent.name}</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{meta.label}</span>
            </div>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">{agent.role}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{agent.summary}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Skills */}
        <Card>
          <CardHeader title="Skills" subtitle="What this agent is good at" />
          <ul className="space-y-2 p-4">
            {agent.skills.map((s) => (
              <li key={s} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {s}
              </li>
            ))}
          </ul>
        </Card>

        {/* Allowed tools */}
        <Card>
          <CardHeader title="What it's allowed to do" subtitle="Its tools" right={<Wrench className="h-4 w-4 text-slate-300" />} />
          <ul className="space-y-2 p-4">
            {agent.allowedTools.map((tool) => (
              <li key={tool} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" /> {tool}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Forbidden actions */}
      <Card>
        <CardHeader title="What it can never do" subtitle="Hard limits — these never happen without your approval" right={<Ban className="h-4 w-4 text-red-300" />} />
        <div className="p-4">
          {agent.forbiddenActions.length > 0 && (
            <ul className="mb-3 space-y-2">
              {agent.forbiddenActions.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Ban className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /> {f}
                </li>
              ))}
            </ul>
          )}
          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <Lock className="h-3.5 w-3.5" /> Hard limits for every agent
            </p>
            <ul className="space-y-1.5">
              {CORE_FORBIDDEN.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /> {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* Required output */}
      <Card>
        <CardHeader title="What it must report back" subtitle="Every agent returns these nine things on every run" right={<ClipboardList className="h-4 w-4 text-slate-300" />} />
        <ol className="divide-y divide-slate-100 p-4 dark:divide-slate-700">
          {OUTPUT_SCHEMA.map((o, i) => (
            <li key={o.field} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{i + 1}</span>
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{o.field}</p>
                <p className="text-xs text-slate-400">{o.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {/* Experience impact review */}
      <Card>
        <CardHeader title="Experience impact review" subtitle="Every agent must answer these before a feature ships" right={<Smile className="h-4 w-4 text-violet-300" />} />
        <ul className="space-y-2 p-4">
          {EXPERIENCE_REVIEW.map((q) => (
            <li key={q} className="flex items-start gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
              <Smile className="mt-0.5 h-4 w-4 shrink-0" /> {q}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function initials(name: string): string {
  return name.replace(/Agent$/, "").trim().split(/[\s/]+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
