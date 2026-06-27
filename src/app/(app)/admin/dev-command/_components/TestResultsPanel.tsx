import { Card, CardHeader } from "@/components/ui/primitives";
import { TestStatusBadge } from "./badges";
import { EmptyStateCard } from "./states";
import { TEST_STATUS_META } from "@/lib/devcenter/labels";
import { CheckCircle2, XCircle } from "lucide-react";
import type { DevTestResult, TestKind } from "@/lib/devcenter/types";

const KIND_LABEL: Record<TestKind, string> = {
  unit: "Unit tests",
  integration: "Integration tests",
  system: "Whole-app test",
  lint: "Code style check",
  typecheck: "Type check",
  qa: "Quality check",
  other: "Other check",
};

/**
 * Test, lint, typecheck and QA results for a task — in plain language so it's
 * clear what passed and what still needs work.
 */
export function TestResultsPanel({ results }: { results: DevTestResult[] }) {
  const anyFailed = results.some((r) => r.status === "failed" || r.status === "error");
  return (
    <Card>
      <CardHeader
        title="Test results"
        subtitle="Automated checks that run on the draft code"
        right={results.length > 0 ? (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${anyFailed ? "text-red-600" : "text-emerald-600"}`}>
            {anyFailed ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {anyFailed ? "Needs attention" : "All passing"}
          </span>
        ) : undefined}
      />
      <div className="p-4">
        {results.length === 0 ? (
          <EmptyStateCard title="No tests run yet" description="Once the QA agent runs checks, results show up here." />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {results.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{KIND_LABEL[r.kind]}</p>
                  {r.summary && <p className="text-xs text-slate-500 dark:text-slate-400">{r.summary}</p>}
                  {(r.passed + r.failed + r.skipped) > 0 && (
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {r.passed} passed · {r.failed} failed · {r.skipped} skipped
                    </p>
                  )}
                </div>
                <TestStatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
        {results.length > 0 && (
          <p className="mt-3 text-[11px] text-slate-400">{TEST_STATUS_META.passed.label} means the check ran cleanly.</p>
        )}
      </div>
    </Card>
  );
}
