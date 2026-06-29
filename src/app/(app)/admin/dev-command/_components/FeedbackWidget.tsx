"use client";

import { useActionState } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { submitFeedback } from "@/lib/actions/devcenter-learning";
import { FEEDBACK_TYPE_META } from "@/lib/devcenter/labels";
import { MessageSquarePlus, CheckCircle2 } from "lucide-react";
import type { FeedbackType } from "@/lib/devcenter/types";

const TYPES = Object.keys(FEEDBACK_TYPE_META) as FeedbackType[];

/** Send feedback (the 8 quick types) — feeds the learning loop. */
export function FeedbackWidget({ pageRoute = "/admin/dev-command" }: { pageRoute?: string }) {
  const [state, formAction, pending] = useActionState(submitFeedback, { ok: false } as { ok: boolean; error?: string; message?: string });

  return (
    <Card>
      <CardHeader title="Send feedback" subtitle="Tell the team what's confusing, wrong, or could be better — it helps the AI improve" right={<MessageSquarePlus className="h-4 w-4 text-slate-300" />} />
      <form action={formAction} className="space-y-3 p-4">
        <input type="hidden" name="page_route" value={pageRoute} />
        {state.ok ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> {state.message ?? "Thanks — recorded."}</p>
        ) : null}
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">What kind of feedback?</span>
          <select name="feedback_type" defaultValue="confusing" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            {TYPES.map((t) => <option key={t} value={t}>{FEEDBACK_TYPE_META[t].label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Message</span>
          <textarea name="message" rows={3} placeholder="What happened, or what would be better?" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        </label>
        <div className="flex items-center justify-end gap-2">
          {state.error && <span className="text-[11px] text-red-500">{state.error}</span>}
          <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
            {pending ? "Sending…" : "Send feedback"}
          </button>
        </div>
      </form>
    </Card>
  );
}
