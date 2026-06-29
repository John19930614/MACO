import { Card, CardHeader } from "@/components/ui/primitives";
import { FeedbackWidget } from "../_components/FeedbackWidget";
import { FeedbackList } from "../_components/FeedbackList";
import { MemoryManager } from "../_components/MemoryManager";
import { getAllFeedback, getAllMemory } from "@/lib/devcenter/repo";
import { ShieldCheck, Lock } from "lucide-react";

export const metadata = { title: "Settings · AI Dev Command Center" };

// The hard safety rules that apply to every agent (read-only).
const SAFETY_RULES = [
  "Never deploy to production on its own",
  "Never delete data",
  "Never change logins or permissions without your approval",
  "Never change data-access rules without your approval",
  "Never run a database change without your approval",
  "Never change production settings or secrets",
  "Always ask before doing anything risky",
];

export default async function SettingsPage() {
  const [feedback, memory] = await Promise.all([getAllFeedback(), getAllMemory()]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Settings</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Safety rules, your feedback, and what the AI team has learned.</p>
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

      {/* Learning loop (Phase 14) */}
      <FeedbackWidget pageRoute="/admin/dev-command/settings" />
      <FeedbackList feedback={feedback} />
      <MemoryManager memory={memory} />
    </div>
  );
}
