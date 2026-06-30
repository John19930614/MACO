"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { createDevTask, type CreateTaskState } from "@/lib/actions/devcenter";
import { MessageSquare, ShieldCheck, Lock, AlertTriangle, Sparkles, CheckCircle2, ImagePlus, X, ChevronDown, ChevronUp } from "lucide-react";

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

const QUICK_STARTS = [
  { label: "Add a button or feature", title: "Add a [button / feature] to [page name]", goal: "Make it easier for users to [do something]", description: "I'd like a new button or feature added to [page]. When someone clicks it, it should [describe what happens]." },
  { label: "Change how something looks", title: "Update the look of [page or section]", goal: "Improve how it looks so it's easier to read and use", description: "I want [page or section] to look different. Right now it's [describe the problem]. I'd like it to [describe the improvement]." },
  { label: "Fix something that's broken", title: "Fix [describe the problem] on [page name]", goal: "Get this working correctly again", description: "Something isn't working right on [page]. When I [describe what I do], it [describe what goes wrong]. It should [describe what should happen instead]." },
  { label: "Show different information", title: "Show [type of info] on [page name]", goal: "Give users the information they need without extra steps", description: "I want [page] to display [type of information]. Right now that information isn't there, and users have to [describe the workaround]. Showing it here would [describe the benefit]." },
];

const PERMISSIONS = [
  {
    name: "database_changes_allowed",
    label: "The team can propose saving new information",
    hint: "Like adding a new field or storing a new type of record. You'll review and approve it before anything actually changes.",
  },
  {
    name: "file_changes_allowed",
    label: "The team can propose changes to the app's code",
    hint: "The lines of code that make the app work. You'll see exactly what they want to change before anything is saved.",
  },
  {
    name: "github_branch_allowed",
    label: "The team can set up a safe testing area",
    hint: "A separate copy of the code where changes are tested before going live. Nothing affects the real app until you say so.",
  },
  {
    name: "deployment_allowed",
    label: "The team can build a test version for you to look at",
    hint: "A private copy of the app you can click through and review before deciding to make it live.",
  },
];

interface Prefill {
  title?: string;
  business_goal?: string;
  feature_description?: string;
  module_affected?: string;
  who_uses_it?: string;
  priority?: string;
  risk_level?: string;
  ai_role?: string;
  data_involved?: string;
  success_criteria?: string;
  notes?: string;
}

export function DevTaskIntakeForm({ prefill }: { prefill?: Prefill }) {
  const [state, formAction, pending] = useActionState<CreateTaskState, FormData>(createDevTask, {});
  const [preview, setPreview] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hiddenRef = useRef<HTMLTextAreaElement>(null);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5 MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      if (hiddenRef.current) hiddenRef.current.value = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function clearImage(e: React.MouseEvent) {
    e.preventDefault();
    setPreview(null);
    if (hiddenRef.current) hiddenRef.current.value = "";
  }

  function applyQuickStart(qs: typeof QUICK_STARTS[0]) {
    const form = document.querySelector("form") as HTMLFormElement | null;
    if (!form) return;
    const setField = (name: string, value: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el) {
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };
    setField("title", qs.title);
    setField("business_goal", qs.goal);
    setField("feature_description", qs.description);
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}

      {/* ── Welcome banner ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-4 dark:border-blue-900 dark:bg-blue-950/30">
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">How this works</p>
        <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
          Describe what you want in plain language — no technical knowledge needed. The AI team will figure out how to build it and come back to you at every step before making any changes.
        </p>
      </div>

      {/* ── Quick starts ─────────────────────────────────────────────── */}
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Start from a template</h3>
            <p className="text-xs text-slate-400">Pick the one that best matches what you want, then fill in the blanks.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {QUICK_STARTS.map((qs) => (
            <button
              key={qs.label}
              type="button"
              onClick={() => applyQuickStart(qs)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {qs.label}
            </button>
          ))}
        </div>
      </Card>

      {/* ── What do you want? ────────────────────────────────────────── */}
      <Section icon={<MessageSquare className="h-4 w-4" />} title="What do you want?" hint="Describe it the same way you'd explain it to a colleague. Plain language is perfect.">
        <Field label="Give this task a name" hint="One sentence is enough." required>
          <input name="title" required defaultValue={prefill?.title} placeholder="e.g. Add a CSV export button to the Incidents page" className={inputCls} />
        </Field>
        <Field label="Why does this matter?" hint="What problem does it solve, or what does it make easier?">
          <input name="business_goal" defaultValue={prefill?.business_goal} placeholder="e.g. Save safety managers time pulling reports" className={inputCls} />
        </Field>
        <Field label="Describe what you want in more detail" hint="Walk us through it like you're showing someone in person. No technical language needed.">
          <textarea name="feature_description" rows={4} defaultValue={prefill?.feature_description} placeholder="e.g. On the Incidents page there should be a button that says 'Export'. When I click it, it downloads the list of incidents as a spreadsheet I can open in Excel." className={inputCls} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Which part of the app is this about?" hint="Pick the closest match.">
            <select name="module_affected" defaultValue={prefill?.module_affected ?? ""} className={inputCls}>
              <option value="" disabled>Choose one…</option>
              {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Who will use this?" hint="Which type of user benefits most?">
            <input name="who_uses_it" defaultValue={prefill?.who_uses_it} placeholder="e.g. Safety managers, EHS coordinators" className={inputCls} />
          </Field>
          <Field label="How urgent is this?" hint="Pick the one that fits.">
            <select name="priority" defaultValue={prefill?.priority ?? "medium"} className={inputCls}>
              <option value="low">Whenever you get to it</option>
              <option value="medium">Soon — within the next few weeks</option>
              <option value="high">This week if possible</option>
              <option value="urgent">As soon as possible</option>
            </select>
          </Field>
          <Field label="How big of a change is this?" hint="Your best guess is fine — the team will double-check.">
            <select name="risk_level" defaultValue={prefill?.risk_level ?? "low"} className={inputCls}>
              <option value="low">Small — adding something minor or visual</option>
              <option value="medium">Medium — changing something that already exists</option>
              <option value="high">Larger — affects login, user accounts, or stored data</option>
              <option value="critical">Major — could affect how the whole app works</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* ── Screenshot / mockup ──────────────────────────────────────── */}
      <Section icon={<ImagePlus className="h-4 w-4" />} title="Show us what you mean (optional)" hint="Got a screenshot, sketch, or example from another app? Upload it here so the team knows exactly what you're going for.">
        <textarea ref={hiddenRef} name="visual_reference" className="hidden" readOnly />
        {preview ? (
          <div className="relative inline-block">
            <img src={preview} alt="Visual reference" className="max-h-64 rounded-lg border border-slate-200 object-contain shadow-sm" />
            <button
              onClick={clearImage}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-white shadow hover:bg-red-600 transition"
              title="Remove image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center transition hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-800/50">
            <ImagePlus className="h-8 w-8 text-slate-300" />
            <span className="text-sm font-medium text-slate-500">Click to upload a screenshot or sketch</span>
            <span className="text-xs text-slate-400">PNG, JPG, WebP — max 5 MB</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImageChange} className="hidden" />
          </label>
        )}
      </Section>

      {/* ── What does done look like? ────────────────────────────────── */}
      <Section icon={<CheckCircle2 className="h-4 w-4" />} title="How will we know it's finished?" hint="Describe what you'd check to confirm it's working the way you want.">
        <Field label="What does success look like?" hint="List the things that need to be true for you to say 'yes, this is done'.">
          <textarea name="success_criteria" rows={3} defaultValue={prefill?.success_criteria} placeholder="e.g. I can click the Export button and get a spreadsheet with all the incidents listed. It opens in Excel without any errors." className={inputCls} />
        </Field>
        <Field label="Anything else the team should know?" hint="Edge cases, things to avoid, or context that might help. Optional.">
          <textarea name="notes" rows={2} defaultValue={prefill?.notes} placeholder="e.g. Don't change the way incidents are saved — just the export part." className={inputCls} />
        </Field>
      </Section>

      {/* ── What can the team do? ─────────────────────────────────────── */}
      <Section icon={<ShieldCheck className="h-4 w-4" />} title="What can the team do?" hint="These are off by default. Turn something on to let the team propose it — you still approve before anything actually happens.">
        <div className="flex items-start gap-3 rounded-lg bg-emerald-50 px-3 py-3 dark:bg-emerald-950/40">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">You always have the final say</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">The team will pause and ask for your approval before doing anything that could change the app. This can&apos;t be turned off.</p>
          </div>
        </div>
        <p className="text-xs text-slate-400">Not sure? Leave everything off — the team will let you know if they need more permissions to complete your request.</p>
        <div className="space-y-2">
          {PERMISSIONS.map((p) => (
            <label key={p.name} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
              <input type="checkbox" name={p.name} className="mt-0.5 h-4 w-4 accent-blue-600" />
              <div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.label}</span>
                <p className="text-xs text-slate-400">{p.hint}</p>
              </div>
            </label>
          ))}
        </div>
      </Section>

      {/* ── Advanced / AI guidance (collapsed by default) ────────────── */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-600"
        >
          {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {showAdvanced ? "Hide" : "Show"} advanced options
        </button>
        {showAdvanced && (
          <Card className="mt-3 p-4 sm:p-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Guidance for the AI team</h3>
              <p className="text-xs text-slate-400">Use these if you want to give the team specific boundaries or instructions. Totally optional.</p>
            </div>
            <div className="space-y-4">
              <Field label="What should the team focus on — or stay away from?" hint="e.g. Only work on the export feature — don't touch anything else.">
                <textarea name="ai_role" rows={3} defaultValue={prefill?.ai_role} placeholder="e.g. Only change the export button — don't touch how incidents are saved or displayed." className={inputCls} />
              </Field>
              <Field label="Does this involve any sensitive information?" hint="e.g. Employee names, medical records, login details.">
                <input name="data_involved" defaultValue={prefill?.data_involved} placeholder="e.g. Incident records — no personal health information" className={inputCls} />
              </Field>
            </div>
          </Card>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
        <Link href="/admin/dev-command/tasks" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
          Cancel
        </Link>
        <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
          {pending ? "Sending to the team…" : "Send to the AI team"}
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
