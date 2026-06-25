"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Lock, ShieldCheck, Award, Wrench, GraduationCap, Brain, Plus, Trash2,
  CheckCircle2, XCircle, Power, RotateCcw,
} from "lucide-react";
import {
  toggleGuardrail, updateGuardrailThreshold, grantQualification,
  revokeQualification, reinstateQualification, toggleMemoryLesson, removeMemoryLesson,
} from "@/lib/actions/csp";
import type { CspGuardrail, CspQualification, CspMemoryLesson, CspQualKind } from "@/lib/csp/types";

const RECORD_TYPE_OPTIONS = [
  "incident", "audit_finding", "near_miss", "chemical_sds", "chemical_inventory",
  "permit", "training_record", "corrective_action",
] as const;

const KIND_ICON: Record<CspQualKind, React.ReactNode> = {
  certification: <Award className="h-4 w-4 text-amber-300" />,
  skill: <Wrench className="h-4 w-4 text-blue-300" />,
  qualification: <GraduationCap className="h-4 w-4 text-violet-300" />,
};

const DIRECTIVE_META: Record<string, { label: string; cls: string }> = {
  raise_confidence: { label: "↑ confidence", cls: "bg-emerald-900/50 text-emerald-300" },
  lower_confidence: { label: "↓ confidence", cls: "bg-orange-900/50 text-orange-300" },
  escalate: { label: "escalate", cls: "bg-red-900/50 text-red-300" },
  note: { label: "note", cls: "bg-slate-800 text-slate-300" },
};

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 rounded-2xl border border-white/8 bg-slate-900/40">
      <div className="border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">{icon}{title}</div>
        <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function AgentProfileClient({
  guardrails, qualifications, memory,
}: {
  guardrails: CspGuardrail[];
  qualifications: CspQualification[];
  memory: CspMemoryLesson[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div>
      {/* ── Guardrails ── */}
      <Section
        icon={<ShieldCheck className="h-4 w-4 text-emerald-300" />}
        title="Guardrails"
        subtitle="What the agent is allowed to do on its own, and what it must learn from. Locked rules are platform-enforced."
      >
        <div className="space-y-2">
          {guardrails.map((g) => (
            <GuardrailRow key={g.key} g={g} onToggle={() => run(() => toggleGuardrail(g.key, !g.enabled))}
              onThreshold={(v) => run(() => updateGuardrailThreshold(g.key, v))} />
          ))}
          {guardrails.length === 0 && <Empty text="No guardrails configured." />}
        </div>
      </Section>

      {/* ── Qualifications / certifications / skills ── */}
      <Section
        icon={<Award className="h-4 w-4 text-amber-300" />}
        title="Qualifications, Certifications &amp; Skills"
        subtitle="What the agent is credentialed to do. A qualification that grants autonomy lets the agent auto-accept clean records of that type."
      >
        <AddQualificationForm />
        <div className="mt-4 space-y-2">
          {qualifications.map((q) => (
            <QualRow key={q.id} q={q}
              onRevoke={() => run(() => revokeQualification(q.id))}
              onReinstate={() => run(() => reinstateQualification(q.id))} />
          ))}
          {qualifications.length === 0 && <Empty text="No qualifications yet." />}
        </div>
      </Section>

      {/* ── Memory bank ── */}
      <Section
        icon={<Brain className="h-4 w-4 text-violet-300" />}
        title="Memory Bank"
        subtitle="Lessons the agent learned from human sign-offs (when the matching learn-from guardrail is on). Disable or delete any lesson."
      >
        <div className="space-y-2">
          {memory.map((m) => (
            <MemoryRow key={m.id} m={m}
              onToggle={() => run(() => toggleMemoryLesson(m.id, !m.active))}
              onDelete={() => run(() => removeMemoryLesson(m.id))} />
          ))}
          {memory.length === 0 && (
            <Empty text="No lessons yet. As reviewers approve or reject records, the agent records what it learns here." />
          )}
        </div>
      </Section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-white/8 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-400">{text}</div>;
}

function GuardrailRow({ g, onToggle, onThreshold }: { g: CspGuardrail; onToggle: () => void; onThreshold: (v: number) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-white/8 bg-slate-900/40 px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-100">
          {g.locked && <Lock className="h-3.5 w-3.5 text-slate-500" />}
          {g.label}
        </div>
        {g.description && <p className="mt-0.5 text-xs text-slate-400">{g.description}</p>}
        {g.threshold != null && (
          <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
            Threshold:
            <input
              type="number" min={0} max={100} defaultValue={g.threshold}
              onBlur={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v) && v !== g.threshold) onThreshold(v); }}
              className="w-16 rounded border border-white/10 bg-slate-900 px-1.5 py-0.5 text-xs text-white"
            />%
          </label>
        )}
      </div>
      <button
        onClick={onToggle}
        disabled={g.locked}
        title={g.locked ? "Platform-enforced — cannot be changed" : ""}
        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${g.enabled ? "bg-emerald-700 text-white" : "bg-slate-700 text-slate-300"} ${g.locked ? "cursor-not-allowed opacity-70" : "hover:opacity-90"}`}
      >
        {g.enabled ? "ON" : "OFF"}
      </button>
    </div>
  );
}

function QualRow({ q, onRevoke, onReinstate }: { q: CspQualification; onRevoke: () => void; onReinstate: () => void }) {
  const active = q.status === "active";
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 ${active ? "border-white/8 bg-slate-900/40" : "border-white/5 bg-slate-900/20 opacity-70"}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {KIND_ICON[q.kind]}
          <span className="text-sm font-medium text-slate-100">{q.title}</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">{q.kind}</span>
          {q.grants_autonomy && <span className="rounded bg-emerald-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">grants autonomy</span>}
          {!active && <span className="rounded bg-red-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">revoked</span>}
        </div>
        {q.description && <p className="mt-0.5 text-xs text-slate-400">{q.description}</p>}
        {q.scope_record_types.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {q.scope_record_types.map((s) => (
              <span key={s} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{s.replace(/_/g, " ")}</span>
            ))}
          </div>
        )}
      </div>
      {active ? (
        <button onClick={onRevoke} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-800/50 px-2.5 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-900/30">
          <XCircle className="h-3.5 w-3.5" /> Revoke
        </button>
      ) : (
        <button onClick={onReinstate} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-800/50 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-900/30">
          <RotateCcw className="h-3.5 w-3.5" /> Reinstate
        </button>
      )}
    </div>
  );
}

function MemoryRow({ m, onToggle, onDelete }: { m: CspMemoryLesson; onToggle: () => void; onDelete: () => void }) {
  const d = DIRECTIVE_META[m.directive] ?? DIRECTIVE_META.note;
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 ${m.active ? "border-white/8 bg-slate-900/40" : "border-white/5 bg-slate-900/20 opacity-60"}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${d.cls}`}>{d.label}</span>
          {m.record_type && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{m.record_type.replace(/_/g, " ")}</span>}
          {m.finding_category && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{m.finding_category.replace(/_/g, " ")}</span>}
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">{m.source.replace(/_/g, " ")}</span>
        </div>
        <p className="mt-1 text-sm text-slate-200">{m.lesson}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">weight {m.weight} · applied {m.times_applied}× · {new Date(m.created_at).toLocaleDateString()}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button onClick={onToggle} title={m.active ? "Disable" : "Enable"} className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-white">
          <Power className={`h-4 w-4 ${m.active ? "text-emerald-400" : "text-slate-500"}`} />
        </button>
        <button onClick={onDelete} title="Delete" className="rounded p-1.5 text-slate-400 hover:bg-red-900/30 hover:text-red-300">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AddQualificationForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(grantQualification, null as null | { ok: boolean; error?: string });

  useEffect(() => {
    if (state?.ok) { setOpen(false); router.refresh(); }
  }, [state, router]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-700/50 bg-blue-900/30 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-900/50">
        <Plus className="h-3.5 w-3.5" /> Add qualification / certification / skill
      </button>
    );
  }

  return (
    <form action={action} className="rounded-lg border border-blue-800/40 bg-blue-950/10 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select name="kind" defaultValue="certification" className="rounded-md border border-white/10 bg-slate-900 px-2.5 py-1.5 text-sm text-white">
          <option value="certification">Certification</option>
          <option value="skill">Skill</option>
          <option value="qualification">Qualification</option>
        </select>
        <input name="title" placeholder="Title (e.g. DOT HMR 49 CFR)" required className="rounded-md border border-white/10 bg-slate-900 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500 sm:col-span-2" />
      </div>
      <input name="description" placeholder="Description (optional)" className="mt-2 w-full rounded-md border border-white/10 bg-slate-900 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500" />
      <input type="hidden" name="granted_by" value="Reliance Admin" />
      <div className="mt-2">
        <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">Applies to record types</div>
        <div className="flex flex-wrap gap-2">
          {RECORD_TYPE_OPTIONS.map((rt) => (
            <label key={rt} className="inline-flex items-center gap-1 rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-300">
              <input type="checkbox" name="scope" value={rt} className="accent-blue-500" /> {rt.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" name="grants_autonomy" className="accent-emerald-500" />
        Grants autonomy (agent may auto-accept clean records of these types)
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-50">
          {pending ? "Granting…" : <><CheckCircle2 className="h-3.5 w-3.5" /> Grant</>}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-200">Cancel</button>
        {state?.error && <span className="text-xs text-red-400">{state.error}</span>}
      </div>
    </form>
  );
}
