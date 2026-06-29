"use client";

import { useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { Badge } from "./badges";
import { EmptyStateCard } from "./states";
import { resolveFeedback } from "@/lib/actions/devcenter-learning";
import { FEEDBACK_TYPE_META } from "@/lib/devcenter/labels";
import { relativeTime } from "@/lib/utils";
import { MessageSquare } from "lucide-react";
import type { DevFeedback } from "@/lib/devcenter/types";

const STATUS_TONE = { open: "violet", triaged: "info", in_progress: "info", resolved: "success", wontfix: "neutral" } as const;
const STATUSES = ["open", "triaged", "in_progress", "resolved", "wontfix"] as const;

export function FeedbackList({ feedback }: { feedback: DevFeedback[] }) {
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader title="Feedback" subtitle="What you and the team flagged — feeds the learning loop" right={<MessageSquare className="h-4 w-4 text-slate-300" />} />
      <div className="p-4">
        {feedback.length === 0 ? (
          <EmptyStateCard title="No feedback yet" description="Use the feedback box to tell the team what's confusing or wrong." />
        ) : (
          <ul className="space-y-2">
            {feedback.map((f) => {
              const t = f.feedback_type ? FEEDBACK_TYPE_META[f.feedback_type] : null;
              return (
                <li key={f.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {t && <Badge label={t.label} tone={t.tone} />}
                      <Badge label={f.status.replace("_", " ")} tone={STATUS_TONE[f.status]} />
                    </div>
                    <form action={(fd) => start(() => resolveFeedback({ ok: false }, fd).then(() => {}))}>
                      <input type="hidden" name="feedback_id" value={f.id} />
                      <select name="status" defaultValue={f.status} disabled={pending}
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                      </select>
                    </form>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{f.message}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{f.screen ?? "—"} · {f.created_by ?? "someone"} · {relativeTime(f.created_at)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
