"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { backfillCspValidations } from "@/lib/actions/csp";

// Validates every existing incident that doesn't yet have a run, so the panel
// populates immediately instead of waiting for new records to be created.
export default function BackfillButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-[11px] text-slate-400">{msg}</span>}
      <button
        onClick={() => start(async () => {
          const r = await backfillCspValidations();
          setMsg(r.ok ? `Validated ${r.created} new · ${r.skipped} already done` : "Backfill failed");
          router.refresh();
        })}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-700/50 bg-blue-900/30 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-900/50 disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Validating…" : "Validate existing records"}
      </button>
    </div>
  );
}
