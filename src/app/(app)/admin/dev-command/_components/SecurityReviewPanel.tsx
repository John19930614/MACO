import { Card, CardHeader } from "@/components/ui/primitives";
import { SecurityVerdictBadge, RiskLevelBadge } from "./badges";
import { EmptyStateCard } from "./states";
import { ShieldCheck } from "lucide-react";
import type { DevSecurityReview } from "@/lib/devcenter/types";

interface Finding { category?: string; severity?: string; note?: string }

/**
 * Security review findings — does this change create a login, data-access, or
 * secret risk? Written so a non-engineer can act on it.
 */
export function SecurityReviewPanel({ reviews }: { reviews: DevSecurityReview[] }) {
  return (
    <Card>
      <CardHeader
        title="Security review"
        subtitle="Checks for login, data-access, and secret risks"
        right={<ShieldCheck className="h-4 w-4 text-slate-300" />}
      />
      <div className="p-4">
        {reviews.length === 0 ? (
          <EmptyStateCard title="No security review yet" description="The security agent reviews changes that touch logins or data access." />
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-slate-600 dark:text-slate-300">{r.summary}</p>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <SecurityVerdictBadge verdict={r.verdict} />
                    <RiskLevelBadge level={r.risk_level} />
                  </div>
                </div>
                {Array.isArray(r.findings) && r.findings.length > 0 && (
                  <ul className="mt-2 space-y-1.5 border-t border-slate-100 pt-2 dark:border-slate-700">
                    {(r.findings as Finding[]).map((f, i) => (
                      <li key={i} className="text-xs text-slate-500 dark:text-slate-400">
                        {f.category && <span className="font-semibold text-slate-600 dark:text-slate-300">{f.category}: </span>}
                        {f.note}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
