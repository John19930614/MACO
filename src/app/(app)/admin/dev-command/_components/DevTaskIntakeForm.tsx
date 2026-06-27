"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/primitives";
import { CheckCircle2, Info } from "lucide-react";
import type { DevTaskPriority } from "@/lib/devcenter/types";

/**
 * Form for describing a new software task for the AI team.
 *
 * PHASE 2: this is the UI shell. Submitting shows a confirmation preview and does
 * NOT save anything yet — the team can't be started until a later phase. This
 * keeps the screen safe (no real action) while looking and feeling real.
 */
export function DevTaskIntakeForm() {
  const [submitted, setSubmitted] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<DevTaskPriority>("medium");

  if (submitted) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" />
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Task captured (preview)</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            “{title || "Your task"}” is ready. Starting the AI team turns on in a later phase — for now this is a preview so you can see how it will work.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => { setSubmitted(false); setTitle(""); }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              Add another
            </button>
            <Link href="/admin/dev-command/tasks" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
              Back to tasks
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Describe the task" subtitle="Plain language is fine — the AI team will turn it into a plan" />
      <form
        className="space-y-4 p-4"
        onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
      >
        <Field label="What do you want done?" hint="One clear sentence works best.">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Add a CSV export button to the Incidents page"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </Field>

        <Field label="Any extra detail?" hint="Optional. Context, examples, or what 'done' looks like.">
          <textarea
            rows={4}
            placeholder="Optional notes for the team…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Which part of the platform?" hint="Optional — helps the team focus.">
            <input
              placeholder="e.g. Reports, Login, Dashboard"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </Field>
          <Field label="How urgent is it?">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as DevTaskPriority)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="low">Low — whenever</option>
              <option value="medium">Medium — soon</option>
              <option value="high">High — this week</option>
              <option value="urgent">Urgent — right away</option>
            </select>
          </Field>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>The team always shows you a plan and asks for approval before doing anything risky. Nothing is built or changed without your say-so.</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
          <Link href="/admin/dev-command/tasks" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
            Cancel
          </Link>
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
            Capture task
          </button>
        </div>
      </form>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
