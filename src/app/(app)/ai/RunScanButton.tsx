"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { runPredictabilityScan } from "@/lib/actions/ehs";

export function RunScanButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");

  async function handleScan() {
    setStatus("running");
    try {
      await runPredictabilityScan();
      router.refresh();
      setStatus("done");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("idle");
    }
  }

  if (status === "running") {
    return (
      <button disabled className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white opacity-80">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        Scanning…
      </button>
    );
  }

  if (status === "done") {
    return (
      <button disabled className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
        ✓ Scan Complete
      </button>
    );
  }

  return (
    <button
      onClick={handleScan}
      className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition"
    >
      Run P-Engine Scan
    </button>
  );
}
