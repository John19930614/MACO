import { Card, CardHeader } from "@/components/ui/primitives";
import { Badge } from "./badges";
import { Sparkles, ClipboardList } from "lucide-react";
import type { DevArtifact } from "@/lib/devcenter/types";

const HUMANIZE = (k: string) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Renders the structured outputs from the Phase 6 planning agents. Generic: it
 * shows each field of an artifact's `structured` payload — text, lists, ratings,
 * and the plain-English rewrite table — without per-agent UI code.
 */
export function PlanningOutputPanel({ artifacts }: { artifacts: DevArtifact[] }) {
  const plans = artifacts.filter((a) => {
    const s = a.structured as Record<string, unknown> | null;
    return s && typeof s._agent === "string";
  });
  if (plans.length === 0) return null;

  return (
    <Card>
      <CardHeader title="Planning outputs" subtitle="What the planning agents worked out for this task" right={<ClipboardList className="h-4 w-4 text-slate-300" />} />
      <div className="space-y-4 p-4">
        {plans.map((a) => {
          const s = a.structured as Record<string, unknown>;
          const label = String(s._label ?? "Plan");
          const aiBacked = s._ai === true;
          return (
            <div key={a.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</h4>
                {aiBacked && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    <Sparkles className="h-3 w-3" /> AI-written
                  </span>
                )}
              </div>
              <div className="space-y-2.5">
                {Object.entries(s)
                  .filter(([k]) => !k.startsWith("_"))
                  .map(([k, v]) => <Field key={k} label={HUMANIZE(k)} value={v} />)}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  // Rating (number) → badge
  if (typeof value === "number") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <Badge label={`${value} / 10`} tone={value >= 8 ? "success" : value >= 6 ? "warn" : "danger"} />
      </div>
    );
  }
  // Boolean → yes/no
  if (typeof value === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <Badge label={value ? "Yes" : "No"} tone={value ? "info" : "neutral"} />
      </div>
    );
  }
  // Array
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const isObjList = typeof value[0] === "object" && value[0] !== null;
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        {isObjList ? (
          <div className="mt-1 space-y-1.5">
            {(value as Record<string, unknown>[]).map((item, i) => (
              <div key={i} className="rounded bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                {Object.entries(item).map(([ik, iv]) => (
                  <span key={ik} className="mr-3"><span className="font-medium text-slate-500">{HUMANIZE(ik)}:</span> {String(iv)}</span>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {(value as unknown[]).map((item, i) => (
              <li key={i} className="flex gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                <span className="text-slate-300">•</span> {String(item)}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  // String / other
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{String(value)}</p>
    </div>
  );
}
