"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  startReportingClocks,
  recordConfirmationNumber,
  markNotReportableWithJustification,
} from "@/lib/actions/regulatoryIncidentReportingClocks";
import { DECISION_QUESTIONS } from "@/lib/regulatory/jurisdictionEngine";
import { colorBand, plainLanguageTimeRemaining } from "@/lib/regulatory/notifications";
import type { ClockRow } from "@/lib/regulatory/read";

// Single "Reporting Status" panel. Plain-language countdown visuals + confirmation
// entry + a yes/no decision helper. No internal jargon ("jurisdiction engine")
// is ever shown to the user.

const BAND_STYLES: Record<"green" | "amber" | "red", { bar: string; text: string; chip: string }> = {
  green: { bar: "bg-emerald-500", text: "text-emerald-700", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  amber: { bar: "bg-amber-500", text: "text-amber-700", chip: "bg-amber-50 text-amber-700 border-amber-200" },
  red: { bar: "bg-red-500", text: "text-red-700", chip: "bg-red-50 text-red-700 border-red-200" },
};

function progressPct(startedAt: string, deadlineAt: string): number {
  const start = new Date(startedAt).getTime();
  const end = new Date(deadlineAt).getTime();
  const now = Date.now();
  if (end <= start) return 100;
  return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
}

export function RegulatoryIncidentReporting({
  incidentId,
  clocks,
  showDecisionHelper = true,
}: {
  incidentId: string;
  clocks: ClockRow[];
  // The environmental-release panel hides the generic injury decision helper so
  // OSHA injury clocks can't be started from the "Environmental release" section.
  showDecisionHelper?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showHelper, setShowHelper] = useState(showDecisionHelper && clocks.length === 0);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [confirmation, setConfirmation] = useState<Record<string, string>>({});
  const [justifyFor, setJustifyFor] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const activeClocks = useMemo(
    () => clocks.filter((c) => c.status !== "not_applicable"),
    [clocks],
  );

  function submitHelper() {
    setMessage(null);
    startTransition(async () => {
      const res = await startReportingClocks({ incidentId, answers });
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      const data = res.data as { started?: number; message?: string } | undefined;
      setMessage(
        data?.message ??
          (data?.started
            ? `${data.started} reporting deadline(s) started.`
            : "Saved."),
      );
      setShowHelper(false);
      setAnswers({});
      router.refresh();
    });
  }

  function saveConfirmation(clockId: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await recordConfirmationNumber({ clockId, confirmationNumber: confirmation[clockId] ?? "" });
      if (res.ok) {
        setConfirmation((v) => { const next = { ...v }; delete next[clockId]; return next; });
        router.refresh();
      }
      setMessage(res.ok ? "Confirmation number saved." : res.error);
    });
  }

  function saveJustification(clockId: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await markNotReportableWithJustification({ clockId, justification });
      if (res.ok) {
        setJustifyFor(null);
        setJustification("");
        router.refresh();
      }
      setMessage(res.ok ? "Marked as not reportable." : res.error);
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Reporting Status</h2>
          <p className="text-sm text-slate-500">Here is what you must report, and by when.</p>
        </div>
        {showDecisionHelper && (
          <button
            type="button"
            onClick={() => setShowHelper((s) => !s)}
            className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700 underline"
          >
            {showHelper ? "Hide questions" : "Answer a few quick questions"}
          </button>
        )}
      </div>

      {message && (
        <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700">
          {message}
        </div>
      )}

      {/* Decision helper — plain yes/no questions, no OSHA jargon */}
      {showHelper && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-3">
          <p className="text-sm font-medium text-slate-700">
            Answer these so we can work out what must be reported:
          </p>
          <div className="space-y-2">
            {DECISION_QUESTIONS.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white px-3 py-2">
                <span className="text-sm text-slate-700">{q.question}</span>
                <div className="flex shrink-0 gap-1">
                  {[
                    { label: "Yes", val: true },
                    { label: "No", val: false },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt.val }))}
                      className={`rounded px-2.5 py-1 text-xs font-medium border ${
                        answers[q.id] === opt.val
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={submitHelper}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Working…" : "Start the right reporting clocks"}
          </button>
        </div>
      )}

      {activeClocks.length === 0 && !showHelper && (
        <div className="text-sm text-slate-500">
          No reporting requirements identified yet.
        </div>
      )}

      {/* Live clocks */}
      {activeClocks.map((c) => {
        const reported = c.status === "reported";
        const closed = c.status === "closed_no_report_required";
        const band = colorBand(c.status);
        const s = BAND_STYLES[band];
        const pct = progressPct(c.started_at, c.deadline_at);
        return (
          <div key={c.id} className="rounded-md border border-slate-200 p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-slate-800">{c.description}</div>
                {reported ? (
                  <div className="text-sm text-emerald-700">
                    Reported{c.confirmation_number ? ` · confirmation ${c.confirmation_number}` : ""}
                  </div>
                ) : closed ? (
                  <div className="text-sm text-slate-500">Marked not reportable</div>
                ) : (
                  <div className={`text-sm font-medium ${s.text}`}>
                    {plainLanguageTimeRemaining(c.deadline_at)}
                  </div>
                )}
              </div>
              {!reported && !closed && (
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.chip}`}>
                  {band === "red" ? "Urgent" : band === "amber" ? "Soon" : "On track"}
                </span>
              )}
            </div>

            {!reported && !closed && (
              <>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full ${s.bar}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <input
                    placeholder="Confirmation number"
                    value={confirmation[c.id] ?? ""}
                    onChange={(e) => setConfirmation((v) => ({ ...v, [c.id]: e.target.value }))}
                    className="flex-1 min-w-[10rem] rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    disabled={pending || !(confirmation[c.id] ?? "").trim()}
                    onClick={() => saveConfirmation(c.id)}
                    className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setJustifyFor((v) => (v === c.id ? null : c.id))}
                    className="text-xs text-slate-500 underline hover:text-slate-700"
                  >
                    Not reportable?
                  </button>
                </div>
                {justifyFor === c.id && (
                  <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
                    <textarea
                      placeholder="Briefly explain why this does not need to be reported…"
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      rows={2}
                    />
                    <button
                      type="button"
                      disabled={pending || justification.trim().length < 10}
                      onClick={() => saveJustification(c.id)}
                      className="rounded bg-slate-700 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      Mark not reportable
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
