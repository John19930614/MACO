import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/primitives";
import { getAiUsageSummary } from "@/lib/data/aiUsageRepo";

function formatCost(usd: number) {
  return `~$${usd.toFixed(2)}`;
}

export async function AiUsagePanel() {
  const { today, month } = await getAiUsageSummary();

  return (
    <Card>
      <CardHeader
        title="AI Usage"
        subtitle="Platform-wide AI Gateway activity"
        right={
          <Link
            href="/sa/ai"
            className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            View detailed AI usage →
          </Link>
        }
      />
      <div className="space-y-2 px-4 py-3">
        {!today.hasData ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No AI usage recorded yet today.</p>
        ) : (
          <p className="text-sm text-slate-700 dark:text-slate-200">
            <span className="font-semibold">{today.runCount}</span> AI run{today.runCount === 1 ? "" : "s"} today (UTC)
            {today.estimatedCostUsd != null && <> · {formatCost(today.estimatedCostUsd)} estimated cost</>}
          </p>
        )}

        <p className="text-xs text-slate-400 dark:text-slate-500">
          {month.runCount} run{month.runCount === 1 ? "" : "s"} this month
          {month.estimatedCostUsd != null && <> · {formatCost(month.estimatedCostUsd)} estimated</>}
        </p>

        {today.estimatedCostUsd != null && (
          <p className="text-[11px] italic text-slate-400 dark:text-slate-500">
            Cost is a rough estimate from tracked token usage — actual billing may vary.
          </p>
        )}
      </div>
    </Card>
  );
}
