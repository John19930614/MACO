"use client";

import { useState, useTransition } from "react";
import { runNextStep } from "@/lib/actions/devcenter";
import { Play, Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";

/**
 * Manual workflow advance. One click runs the next stage (Dev Manager assigns an
 * agent, records the run + timeline + audit). At a gate it pauses for approval.
 */
export function RunNextStepButton({ taskId }: { taskId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ text: string; paused?: boolean; ok?: boolean } | null>(null);

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await runNextStep(taskId);
            setResult({ text: r.message ?? "", paused: r.paused, ok: r.ok });
          })
        }
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {pending ? "Running…" : "Run Next Agent Step"}
      </button>
      {result && (
        <p className={`inline-flex items-center gap-1.5 text-xs ${result.paused ? "text-violet-600" : result.ok ? "text-emerald-600" : "text-slate-500"}`}>
          {result.paused ? <ShieldAlert className="h-3.5 w-3.5" /> : result.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
          {result.text}
        </p>
      )}
    </div>
  );
}
