"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Radar } from "lucide-react";

const AUTO_INTERVAL_MS = 90_000; // proactive cadence while "Auto" is on

export function PclssRunButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [auto, setAuto] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    const res = await fetch("/api/arc/pclss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const j = await res.json();
      setResult(`${j.signals} signals · ${j.queued} queued`);
      router.refresh();
    } else {
      setResult("run failed");
    }
    setRunning(false);
  }, [router]);

  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => runRef.current(), AUTO_INTERVAL_MS);
    return () => clearInterval(id);
  }, [auto]);

  return (
    <div className="flex items-center gap-2">
      <span role="status" aria-live="polite" className="text-[11px] text-slate-400">{result}</span>
      <label className="flex items-center gap-1 text-[11px] text-slate-500" title="Re-run automatically every 90s (production uses a Vercel cron)">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-[var(--color-pclss)]" />
        Auto
      </label>
      <button
        onClick={run}
        disabled={running}
        aria-busy={running}
        className="inline-flex items-center gap-1 rounded-md bg-[var(--color-pclss)] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-pclss)] focus-visible:ring-offset-1 disabled:opacity-50"
      >
        {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Radar className="h-3 w-3" />}
        Run engine now
      </button>
    </div>
  );
}
