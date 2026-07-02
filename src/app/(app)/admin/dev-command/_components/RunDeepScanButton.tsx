"use client";

import { useState, useTransition } from "react";
import { Radar } from "lucide-react";
import { dispatchPlatformReviewScan } from "@/lib/actions/devcenter";

/** Launches the platform-review GitHub workflow (codified audits + Claude
 * pass). Only rendered when the dispatch token is configured. */
export function RunDeepScanButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await dispatchPlatformReviewScan();
            setMessage(result.message);
          })
        }
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-600 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 disabled:opacity-60 dark:hover:bg-blue-950"
      >
        <Radar className={`h-3.5 w-3.5 ${pending ? "animate-pulse" : ""}`} />
        {pending ? "Starting…" : "Run deep scan"}
      </button>
      {message && (
        <p className="max-w-56 text-right text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          {message}
        </p>
      )}
    </div>
  );
}
