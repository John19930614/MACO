"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeWorkspaceTask } from "@/lib/actions/ehs";

export function TaskCheckbox({ taskId }: { taskId: string }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleClick() {
    if (done || busy) return;
    setBusy(true);
    setDone(true);
    await completeWorkspaceTask(taskId);
    router.refresh();
    setBusy(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      aria-label="Mark complete"
      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition ${
        done
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-slate-300 hover:border-blue-400"
      }`}
    >
      {done && (
        <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
