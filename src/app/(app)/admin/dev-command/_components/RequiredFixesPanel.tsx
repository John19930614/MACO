import { Card, CardHeader } from "@/components/ui/primitives";
import { REVIEW_GATE_META } from "@/lib/devcenter/labels";
import { Wrench } from "lucide-react";
import type { DevReviewGate } from "@/lib/devcenter/types";

/** All required fixes across the reviews, gathered in one place. */
export function RequiredFixesPanel({ gates }: { gates: DevReviewGate[] }) {
  const fixes = gates.flatMap((g) => g.required_fixes.map((f) => ({ gate: g.gate_type, text: f })));
  if (fixes.length === 0) return null;
  return (
    <Card>
      <CardHeader title="Required fixes" subtitle="What needs improving before this can be released" right={<Wrench className="h-4 w-4 text-amber-300" />} />
      <ul className="space-y-1.5 p-4">
        {fixes.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">{REVIEW_GATE_META[f.gate].label}</span>
            <span>{f.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
