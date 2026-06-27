import { Card, CardHeader } from "@/components/ui/primitives";
import { EmptyStateCard } from "../_components/states";
import { MEMORY_KIND_LABEL, FEEDBACK_CATEGORY_LABEL } from "@/lib/devcenter/labels";
import { SAMPLE_MEMORY, SAMPLE_FEEDBACK } from "@/lib/devcenter/sample";
import { relativeTime } from "@/lib/utils";
import { ShieldCheck, Lock, Lightbulb, MessageSquarePlus } from "lucide-react";

export const metadata = { title: "Settings · AI Dev Command Center" };

// The hard safety rules that apply to every agent (read-only here).
const SAFETY_RULES = [
  "Never deploy to production on its own",
  "Never delete data",
  "Never change logins or permissions without your approval",
  "Never change data-access rules without your approval",
  "Never run a database change without your approval",
  "Never change production settings or secrets",
  "Always ask before doing anything risky",
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Settings</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">How the AI team behaves and what it remembers. Editing turns on in a later phase.</p>
      </div>

      {/* Safety rules */}
      <Card>
        <CardHeader
          title="Safety rules"
          subtitle="Built-in limits that apply to every agent"
          right={<span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Lock className="h-3 w-3" /> Locked</span>}
        />
        <ul className="divide-y divide-slate-100 p-4 dark:divide-slate-700">
          {SAFETY_RULES.map((r) => (
            <li key={r} className="flex items-center gap-2 py-2 text-sm text-slate-600 first:pt-0 last:pb-0 dark:text-slate-300">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" /> {r}
            </li>
          ))}
        </ul>
      </Card>

      {/* What the team remembers */}
      <Card>
        <CardHeader title="What the team remembers" subtitle="Your preferences and the patterns it has learned" right={<Lightbulb className="h-4 w-4 text-slate-300" />} />
        <div className="p-4">
          {SAMPLE_MEMORY.length === 0 ? (
            <EmptyStateCard title="Nothing remembered yet" description="As you approve and reject work, the team builds up preferences here." />
          ) : (
            <ul className="space-y-2">
              {SAMPLE_MEMORY.map((m) => (
                <li key={m.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{m.title}</p>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{MEMORY_KIND_LABEL[m.kind]}</span>
                  </div>
                  {m.content && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{m.content}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Feedback */}
      <Card>
        <CardHeader title="Your feedback" subtitle="Notes about confusing screens or wrong recommendations" right={<MessageSquarePlus className="h-4 w-4 text-slate-300" />} />
        <div className="p-4">
          {SAMPLE_FEEDBACK.length === 0 ? (
            <EmptyStateCard title="No feedback yet" description="Tell the team what's confusing or wrong and it shows up here." />
          ) : (
            <ul className="space-y-2">
              {SAMPLE_FEEDBACK.map((f) => (
                <li key={f.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{FEEDBACK_CATEGORY_LABEL[f.category]}</span>
                    <span className="text-[11px] text-slate-400">{relativeTime(f.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{f.message}</p>
                  {f.screen && <p className="mt-0.5 font-mono text-[11px] text-slate-400">{f.screen}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
