"use client";

import { useState, useTransition } from "react";
import { Rocket, Check, Loader2, AlertCircle } from "lucide-react";
import { triggerVercelDeploy } from "@/lib/actions/deployToVercel";

interface Props {
  taskId?: string;
}

export function DeployButton({ taskId }: Props) {
  const [phase, setPhase] = useState<"idle" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function deploy() {
    setError(null);
    startTransition(async () => {
      const result = await triggerVercelDeploy(taskId);
      if (result.ok) {
        setPhase("done");
      } else {
        setError(result.error ?? "Deploy failed.");
        setPhase("error");
      }
    });
  }

  if (phase === "done") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
        <Check className="h-4 w-4 text-emerald-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">Deploy triggered</p>
          <p className="text-xs text-emerald-600">
            Vercel is building now — live in ~2 minutes at{" "}
            <a href="https://safetyiq-platform.vercel.app" target="_blank" rel="noreferrer" className="underline">
              safetyiq-platform.vercel.app
            </a>
          </p>
        </div>
        <button
          onClick={() => setPhase("idle")}
          className="ml-auto text-xs text-emerald-600 underline hover:no-underline"
        >
          Deploy again
        </button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
        <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
        <p className="text-sm text-red-700 flex-1">{error}</p>
        <button
          onClick={() => { setPhase("idle"); setError(null); }}
          className="text-xs text-red-600 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={deploy}
      disabled={isPending}
      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-60 transition"
    >
      {isPending
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <Rocket className="h-4 w-4" />}
      {isPending ? "Triggering deploy…" : "Push to Production"}
    </button>
  );
}
