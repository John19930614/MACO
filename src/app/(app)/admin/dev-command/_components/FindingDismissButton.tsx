"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { X, RotateCcw } from "lucide-react";
import { setFindingDismissed } from "@/lib/actions/devcenter";

/**
 * Dismiss a Platform Review finding you don't want to act on (or restore one).
 * Soft and reversible — the finding moves to the "Dismissed" list, it is never
 * deleted, and the decision is recorded in the audit log.
 */
export function FindingDismissButton({
  findingId,
  dismissed = false,
}: {
  findingId: string;
  dismissed?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const res = await setFindingDismissed(findingId, !dismissed);
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong — please try again.");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className={
          dismissed
            ? "flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            : "flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-300"
        }
        title={dismissed ? "Put this finding back on the review list" : "Hide this finding — you can restore it any time"}
      >
        {dismissed ? <RotateCcw className="h-3 w-3" /> : <X className="h-3 w-3" />}
        {pending ? "Saving…" : dismissed ? "Restore" : "Dismiss"}
      </button>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
