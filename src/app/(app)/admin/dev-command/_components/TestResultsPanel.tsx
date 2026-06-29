import { Card, CardHeader } from "@/components/ui/primitives";
import { TestStatusBadge, Badge } from "./badges";
import { EmptyStateCard } from "./states";
import { TEST_TYPE_META } from "@/lib/devcenter/labels";
import { CheckCircle2, XCircle, FlaskConical } from "lucide-react";
import type { DevTestResult } from "@/lib/devcenter/types";

/**
 * The QA agent's test results — each with its type, expected vs actual result,
 * pass/fail, and a recommended fix. Failed tests block completion.
 */
export function TestResultsPanel({ results }: { results: DevTestResult[] }) {
  if (results.length === 0) {
    return (
      <Card>
        <CardHeader title="Test results" subtitle="Automated checks the QA agent records" right={<FlaskConical className="h-4 w-4 text-slate-300" />} />
        <div className="p-4"><EmptyStateCard title="No tests yet" description="The QA agent records the required tests at the testing stage." /></div>
      </Card>
    );
  }
  const failed = results.filter((r) => r.status === "failed" || r.status === "error").length;

  return (
    <Card>
      <CardHeader
        title="Test results"
        subtitle={`${results.length} tests — failed tests block completion`}
        right={
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${failed ? "text-red-600" : "text-emerald-600"}`}>
            {failed ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {failed ? `${failed} failing` : "All passing"}
          </span>
        }
      />
      <div className="space-y-2 p-4">
        {failed > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {failed} test{failed > 1 ? "s are" : " is"} failing. This task can&apos;t be marked complete until they pass.
          </div>
        )}
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.id} className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {r.test_type && <Badge label={TEST_TYPE_META[r.test_type]} tone="neutral" />}
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{r.test_name ?? r.summary ?? "Test"}</span>
                </div>
                <TestStatusBadge status={r.status} />
              </div>
              {(r.expected_result || r.actual_result) && (
                <div className="mt-1 grid grid-cols-1 gap-0.5 text-[11px] sm:grid-cols-2">
                  {r.expected_result && <p className="text-slate-400"><span className="font-semibold">Expected:</span> {r.expected_result}</p>}
                  {r.actual_result && <p className="text-slate-400"><span className="font-semibold">Actual:</span> {r.actual_result}</p>}
                </div>
              )}
              {r.recommended_fix && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300"><span className="font-semibold">Fix:</span> {r.recommended_fix}</p>}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
