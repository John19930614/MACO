"use client";

import { useState } from "react";

// Mobile-friendly, one-step-at-a-time immediate-response checklist. Progress is
// kept in component state (client-persisted per session); each step is confirmed
// before the next is revealed so it stays usable under stress on a phone.

const STEPS = [
  { title: "Secure the scene", detail: "Keep people away and make the area safe before anything else." },
  { title: "Control hazards", detail: "Shut off energy, isolate chemicals, stop the source of harm." },
  { title: "Identify affected people and witnesses", detail: "Note who was hurt and who saw what happened." },
  { title: "Determine if this must be reported", detail: "Open the Reporting Status panel and answer the quick yes/no questions." },
  { title: "Start the reporting clock", detail: "If reporting is required, start the countdown now — the deadline is short." },
  { title: "Notify required people", detail: "Tell your manager and the people your site's plan requires." },
  { title: "Preserve evidence", detail: "Save permits, JSA, training records, video/photos, and equipment data." },
  { title: "Assign a lead investigator", detail: "Name who will own the investigation from here." },
] as const;

export function ImmediateResponseChecklist({ incidentId }: { incidentId: string }) {
  const [done, setDone] = useState<boolean[]>(() => STEPS.map(() => false));
  const currentIdx = done.findIndex((d) => !d);
  const allDone = currentIdx === -1;
  const completed = done.filter(Boolean).length;

  function toggle(i: number) {
    setDone((prev) => prev.map((d, idx) => (idx === i ? !d : d)));
  }

  return (
    <div className="space-y-3" data-incident={incidentId}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Immediate response</h2>
        <span className="text-xs font-medium text-slate-500">
          {completed} of {STEPS.length} done
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${(completed / STEPS.length) * 100}%` }}
        />
      </div>

      <ol className="space-y-2">
        {STEPS.map((step, i) => {
          const isDone = done[i];
          const isCurrent = i === currentIdx;
          const locked = !isDone && !isCurrent && !allDone;
          return (
            <li
              key={step.title}
              className={`rounded-md border p-3 ${
                isCurrent ? "border-blue-300 bg-blue-50" : isDone ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white"
              } ${locked ? "opacity-50" : ""}`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  disabled={locked}
                  aria-label={isDone ? "Mark step not done" : "Mark step done"}
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    isDone ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {isDone ? "✓" : i + 1}
                </button>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800">{step.title}</div>
                  {(isCurrent || isDone) && (
                    <div className="mt-0.5 text-sm text-slate-500">{step.detail}</div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {allDone && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          Immediate response complete. Continue the investigation below.
        </div>
      )}
    </div>
  );
}
