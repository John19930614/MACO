"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Lightbulb, ArrowRight, Zap, X, RefreshCw } from "lucide-react";
import {
  SUGGESTION_TYPE_LABEL,
  SUGGESTION_TYPE_TONE,
  SUGGESTION_EFFORT_LABEL,
  type PlatformSuggestion,
} from "@/lib/devcenter/suggestions";
import { dismissDailySuggestion, getNextDailySuggestion } from "@/lib/actions/devcenter";

export function DailySuggestionCard({
  initialSuggestion,
}: {
  initialSuggestion: PlatformSuggestion | null;
}) {
  const [suggestion, setSuggestion] = useState<PlatformSuggestion | null>(initialSuggestion);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDismiss() {
    if (!suggestion) return;
    const dismissedId = suggestion.id;
    setError(null);
    startTransition(async () => {
      const result = await dismissDailySuggestion(dismissedId);
      if (!result.ok) {
        setError(result.error ?? "Couldn't dismiss the suggestion.");
        return;
      }
      const next = await getNextDailySuggestion(dismissedId);
      if (!next.ok) {
        setError(next.error ?? "Couldn't load the next suggestion.");
        return;
      }
      setSuggestion(next.suggestion ?? null);
    });
  }

  function handleShowAnother() {
    setError(null);
    startTransition(async () => {
      const next = await getNextDailySuggestion(suggestion?.id);
      if (!next.ok) {
        setError(next.error ?? "Couldn't load the next suggestion.");
        return;
      }
      setSuggestion(next.suggestion ?? null);
    });
  }

  return (
    <div
      className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:border-blue-900/60 dark:from-blue-950/30 dark:to-indigo-950/30"
      aria-live="polite"
    >
      {error && (
        <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error} Please try again.</p>
      )}

      {!suggestion && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No suggestions available right now — check back later.
        </p>
      )}

      {suggestion && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                  Today&apos;s suggestion from the AI team
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SUGGESTION_TYPE_TONE[suggestion.type]}`}
                >
                  {SUGGESTION_TYPE_LABEL[suggestion.type]}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {suggestion.module}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{suggestion.title}</p>
              <p className="max-w-xl text-xs leading-relaxed text-slate-600 dark:text-slate-400">{suggestion.why}</p>
              <p className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                <Zap className="h-3 w-3" />
                {SUGGESTION_EFFORT_LABEL[suggestion.effort]}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 self-start sm:mt-1">
            <Link
              href={`/admin/dev-command/tasks/new?s=${encodeURIComponent(suggestion.id)}`}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              Turn into a task
              <ArrowRight className="h-3 w-3" />
            </Link>
            <button
              type="button"
              aria-label="Show another suggestion"
              disabled={isPending}
              onClick={handleShowAnother}
              className="flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50 dark:border-blue-900 dark:bg-transparent dark:text-blue-300 dark:hover:bg-blue-950/40"
            >
              <RefreshCw className={`h-3 w-3 ${isPending ? "animate-spin" : ""}`} />
              Show another
            </button>
            <button
              type="button"
              aria-label="Dismiss suggestion"
              disabled={isPending}
              onClick={handleDismiss}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-600 disabled:opacity-50 dark:hover:bg-blue-950/40 dark:hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
