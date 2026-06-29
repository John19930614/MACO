"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { createDevTask, type CreateTaskState } from "@/lib/actions/devcenter";
import { Info, ShieldCheck, Lock, AlertTriangle, Lightbulb, Target } from "lucide-react";

const MODULES = [
  "Dashboard",
  "Incidents",
  "CAPA",
  "OSHA Logs",
  "Risk Intelligence",
  "Audits & Assessments",
  "Training & Competency",
  "Documents & Programs",
  "Chemical Management",
  "Biosafety & Lab Safety",
  "Waste Management",
  "Ergonomics & MSD",
  "Monitoring & Equipment",
  "Legal Register",
  "AI Safety Assistant",
  "Reports & Analytics",
  "Workspace",
  "Team & Settings",
  "Admin Console",
  "AI Dev Command Center",
  "AI Gateway",
  "ARC Module",
  "Database",
  "Platform Operations",
  "Other",
];

// The four real opt-in permissions — all default OFF for safety.
const DANGEROUS = [
  { name: "database_changes_allowed", label: "Allow database changes", hint: "The team may propose changes to the database (still needs your approval)." },
  { name: "file_changes_allowed", label: "Allow file changes", hint: "The team may propose saving code to files (still needs your approval)." },
  { name: "github_branch_allowed", label: "Allow creating a code branch", hint: "The team may prepare a GitHub branch and pull request." },
  { name: "deployment_allowed", label: "Allow deploying a preview", hint: "The team may prepare a preview deployment to look at." },
];

export function DevTaskIntakeForm() {
  const [state, formAction, pending] = useActionState<CreateTaskState, FormData>(createDevTask, {});

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}

      {/* ── Basic Info ───────────────────────────────────────────────── */}
      <Section icon={<Info className="h-4 w-4" />} title="Basic info" hint="The essentials. Plain language is perfect.">
        <Field label="Task title" hint="One clear sentence." required>
          <input name="title" required placeholder="e.g. Add a CSV export button to the Incidents page" className={inputCls} />
        </Field>
        <Field label="Business goal" hint="Why does this matter? What's the point?">
          <input name="business_goal" placeholder="e.g. Save safety managers time pulling reports" className={inputCls} />
        </Field>
        <Field label="Feature description" hint="What should it do?">
          <textarea name="feature_description" rows={3} placeholder="Describe the feature in your own words…" className={inputCls} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Module affected" hint="Which part of the platform?">
            <select name="module_affected" defaultValue="" className={inputCls}>
              <option value="" disabled>Choose a module…</option>
              {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Who uses it" hint="Who is this for?">
            <input name="who_uses_it" placeholder="e.g. Safety managers" className={inputCls} />
          </Field>
          <Field label="Priority" hint="How urgent is it?">
            <select name="priority" defaultValue="medium" className={inputCls}>
              <option value="low">Low — whenever</option>
              <option value="medium">Medium — soon</option>
              <option value="high">High — this week</option>
              <option value="urgent">Urgent — right away</option>
            </select>
          </Field>
          <Field label="Risk level estimate" hint="Your best guess at how risky this is.">
            <select name="risk_level" defaultValue="low" className={inputCls}>
              <option value="low">Low — small, safe change</option>
              <option value="medium">Medium — touches important areas</option>
              <option value="high">High — logins, data, or money</option>
              <option value="critical">Critical — could break things</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* ── AI Instructions ──────────────────────────────────────────── */}
      <Section icon={<Lightbulb className="h-4 w-4" />} title="AI instructions" hint="Guidance for the AI team.">
        <Field label="AI's role in the feature" hint="What should the AI do here — or not do?">
          <textarea name="ai_role" rows={3} placeholder="e.g. Draft the button and the export logic, but don't touch how incidents are stored." className={inputCls} />
        </Field>
        <Field label="Data involved" hint="What information does this touch? Flag anything sensitive.">
          <input name="data_involved" placeholder="e.g. Incident records (no personal data)" className={inputCls} />
        </Field>
      </Section>

      {/* ── Safety Controls ──────────────────────────────────────────── */}
      <Section icon={<ShieldCheck className="h-4 w-4" />} title="Safety controls" hint="What the AI team is allowed to do. Everything risky is off until you turn it on.">
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Lock className="h-4 w-4 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">Your approval is always required</span> before any risky step. This can&apos;t be turned off.
          </div>
          <input type="checkbox" checked disabled className="h-4 w-4 accent-emerald-600" aria-label="Human approval always required" />
        </div>

        <p className="mt-1 text-xs text-slate-400">These are off by default. Turning one on only lets the team <em>propose</em> it — you still approve before anything happens.</p>
        <div className="space-y-2">
          {DANGEROUS.map((d) => (
            <label key={d.name} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
              <input type="checkbox" name={d.name} className="mt-0.5 h-4 w-4 accent-blue-600" />
              <div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{d.label}</span>
                <p className="text-xs text-slate-400">{d.hint}</p>
              </div>
            </label>
          ))}
        </div>
      </Section>

      {/* ── Success Criteria ─────────────────────────────────────────── */}
      <Section icon={<Target className="h-4 w-4" />} title="Success criteria" hint="How will we know it's done and done right?">
        <Field label="What does 'done' look like?" hint="List what must be true for this to be finished.">
          <textarea name="success_criteria" rows={3} placeholder="e.g. A working Export button that downloads the current list as a spreadsheet." className={inputCls} />
        </Field>
        <Field label="Notes" hint="Anything else the team should know. Optional.">
          <textarea name="notes" rows={2} placeholder="Optional notes…" className={inputCls} />
        </Field>
      </Section>

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
        <Link href="/admin/dev-command/tasks" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
          Cancel
        </Link>
        <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
          {pending ? "Creating…" : "Create task"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">{icon}</div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          <p className="text-xs text-slate-400">{hint}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {hint && <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
