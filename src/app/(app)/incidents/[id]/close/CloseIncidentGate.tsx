"use client";

import { useEffect, useState } from "react";
import { canCloseIncident, type OutstandingClock } from "@/lib/actions/regulatoryIncidentReportingClocks";
import { plainLanguageTimeRemaining } from "@/lib/regulatory/notifications";

// Closure UI. If reporting is outstanding, shows a clear, non-punishing
// explanation of exactly which reports are missing and what to do — never a bare
// disabled button. Actual closure is submitted through the incident edit form
// (status → closed), which is also gated server-side in updateIncident.

export function CloseIncidentGate({ incidentId }: { incidentId: string }) {
  const [state, setState] = useState<{ canClose: boolean; outstandingClocks: OutstandingClock[] } | null>(null);

  useEffect(() => {
    let alive = true;
    canCloseIncident(incidentId).then((r) => {
      if (alive) setState(r);
    });
    return () => {
      alive = false;
    };
  }, [incidentId]);

  if (!state) return <div className="text-sm text-slate-500">Checking reporting status…</div>;

  if (state.canClose) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
        All regulatory reporting is documented. You can close this incident from the edit form.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
      <p className="font-medium text-amber-900">This incident can&apos;t be closed yet.</p>
      <p className="mt-1 text-sm text-amber-800">
        The following regulatory reports still need to be documented before closing:
      </p>
      <ul className="mt-2 space-y-1.5">
        {state.outstandingClocks.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-sm text-amber-900">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            <span>
              <span className="font-medium">{c.description}</span> — {plainLanguageTimeRemaining(c.deadlineAt)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-amber-800">
        Open the <span className="font-medium">Reporting Status</span> panel above and enter the
        confirmation number once you&apos;ve reported — or, if it turns out not to be reportable,
        mark it as not reportable with a short explanation.
      </p>
    </div>
  );
}
