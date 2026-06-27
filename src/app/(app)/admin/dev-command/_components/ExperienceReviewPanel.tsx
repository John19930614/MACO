import { Card, CardHeader } from "@/components/ui/primitives";
import { ReviewVerdictBadge } from "./badges";
import { EmptyStateCard } from "./states";
import { PERSPECTIVE_LABEL } from "@/lib/devcenter/labels";
import { Smile } from "lucide-react";
import type { DevExperienceReview } from "@/lib/devcenter/types";

/**
 * Human-experience reviews — is the change easy to use, plainly worded,
 * accessible, and simple? Each review comes from a different point of view.
 */
export function ExperienceReviewPanel({ reviews }: { reviews: DevExperienceReview[] }) {
  return (
    <Card>
      <CardHeader
        title="Experience review"
        subtitle="Is it easy to use, clearly worded, and accessible?"
        right={<Smile className="h-4 w-4 text-slate-300" />}
      />
      <div className="p-4">
        {reviews.length === 0 ? (
          <EmptyStateCard title="No experience review yet" description="Reviews of ease-of-use and clarity will appear here." />
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{PERSPECTIVE_LABEL[r.perspective]}</p>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{r.summary}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <ReviewVerdictBadge verdict={r.verdict} />
                    {typeof r.score === "number" && (
                      <span className="text-[11px] font-medium text-slate-400">Score {r.score}/100</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
