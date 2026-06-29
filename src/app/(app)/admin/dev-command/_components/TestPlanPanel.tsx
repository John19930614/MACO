import { Card, CardHeader } from "@/components/ui/primitives";
import { ClipboardCheck, Bot, AlertTriangle } from "lucide-react";
import type { TestPlan } from "@/lib/devcenter/qa-tests";

/** The AI-generated test plan: manual checklist, automated ideas, regression risk. */
export function TestPlanPanel({ plan }: { plan: TestPlan }) {
  return (
    <Card>
      <CardHeader title="Test plan" subtitle="The QA agent's manual checklist, automated test ideas, and regression notes" right={<ClipboardCheck className="h-4 w-4 text-slate-300" />} />
      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
        <Section icon={<ClipboardCheck className="h-3.5 w-3.5" />} title="Manual test checklist" items={plan.manual_steps} />
        <Section icon={<Bot className="h-3.5 w-3.5" />} title="Automated test ideas" items={plan.automated_recommendations} />
        <Section icon={<AlertTriangle className="h-3.5 w-3.5" />} title="Regression risk notes" items={plan.regression_notes} tone="amber" />
      </div>
    </Card>
  );
}

function Section({ icon, title, items, tone }: { icon: React.ReactNode; title: string; items: string[]; tone?: "amber" }) {
  return (
    <div>
      <p className={`mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${tone === "amber" ? "text-amber-600" : "text-slate-400"}`}>{icon}{title}</p>
      <ul className="space-y-1">
        {items.map((s, i) => (
          <li key={i} className="flex gap-1.5 text-xs text-slate-600 dark:text-slate-300"><span className="text-slate-300">•</span> {s}</li>
        ))}
      </ul>
    </div>
  );
}
