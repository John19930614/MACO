"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Radar } from "lucide-react";
import { dispatchPlatformReviewScan, getScanRunStatus } from "@/lib/actions/devcenter";

const POLL_INTERVAL_MS = 4_000;
const MAX_POLLS = 30; // ~2 minutes

/** Launches the platform-review GitHub workflow (codified audits + Claude
 * pass, nightly-only) and polls for its outcome so the operator sees a real
 * completion state instead of a message that never resolves. Only rendered
 * when the dispatch token is configured. */
export function RunDeepScanButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function poll(dispatchedAt: string) {
    timerRef.current = setTimeout(async () => {
      pollCount.current += 1;
      const result = await getScanRunStatus(dispatchedAt);
      setMessage(result.message);
      if (result.done) {
        setPolling(false);
        return;
      }
      if (pollCount.current >= MAX_POLLS) {
        setMessage("Scan is taking longer than expected — check GitHub Actions or refresh in a bit.");
        setPolling(false);
        return;
      }
      poll(dispatchedAt);
    }, POLL_INTERVAL_MS);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending || polling}
        onClick={() =>
          startTransition(async () => {
            const dispatchedAt = new Date().toISOString();
            const result = await dispatchPlatformReviewScan();
            setMessage(result.message);
            if (result.ok) {
              pollCount.current = 0;
              setPolling(true);
              poll(dispatchedAt);
            }
          })
        }
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-600 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 disabled:opacity-60 dark:hover:bg-blue-950"
      >
        <Radar className={`h-3.5 w-3.5 ${pending || polling ? "animate-pulse" : ""}`} />
        {pending ? "Starting…" : polling ? "Checking…" : "Run deep scan"}
      </button>
      {message && (
        <p className="max-w-56 text-right text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          {message}
        </p>
      )}
    </div>
  );
}
