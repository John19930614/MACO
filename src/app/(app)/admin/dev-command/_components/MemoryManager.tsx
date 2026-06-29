"use client";

import { useActionState, useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { Badge } from "./badges";
import { EmptyStateCard } from "./states";
import { addMemory, deleteMemory, toggleMemory } from "@/lib/actions/devcenter-learning";
import { MEMORY_KIND_LABEL, MEMORY_KIND_TONE } from "@/lib/devcenter/labels";
import { Brain, Trash2, Power, Plus, AlertTriangle, Loader2 } from "lucide-react";
import type { AgentMemoryKind, DevAgentMemory } from "@/lib/devcenter/types";

const KINDS = Object.keys(MEMORY_KIND_LABEL) as AgentMemoryKind[];

/**
 * Admin memory management — what the AI team has learned. Add by hand, disable
 * (so agents stop using it), or delete. Rejected patterns are highlighted as
 * warnings to future agents. Memory holds no customer data.
 */
export function MemoryManager({ memory }: { memory: DevAgentMemory[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [state, formAction, adding] = useActionState(addMemory, { ok: false } as { ok: boolean; error?: string; message?: string });

  return (
    <Card>
      <CardHeader
        title="What the team has learned"
        subtitle="Reusable platform lessons the agents apply to new tasks. No customer data is stored here."
        right={<button type="button" onClick={() => setShowAdd((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"><Plus className="h-3 w-3" /> Add</button>}
      />
      <div className="space-y-3 p-4">
        {showAdd && (
          <form action={formAction} className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select name="kind" defaultValue="platform_standard" className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {KINDS.map((k) => <option key={k} value={k}>{MEMORY_KIND_LABEL[k]}</option>)}
              </select>
              <input name="title" placeholder="Short title" className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </div>
            <textarea name="content" rows={2} placeholder="The lesson (optional)" className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            <div className="flex items-center justify-end gap-2">
              {state.error && <span className="text-[11px] text-red-500">{state.error}</span>}
              {state.ok && <span className="text-[11px] text-emerald-600">{state.message}</span>}
              <button type="submit" disabled={adding} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{adding ? "Adding…" : "Add memory"}</button>
            </div>
          </form>
        )}

        {memory.length === 0 ? (
          <EmptyStateCard icon={<Brain className="h-6 w-6" />} title="Nothing learned yet" description="As you approve and reject work, the team builds up lessons here." />
        ) : (
          <ul className="space-y-2">
            {memory.map((m) => <MemoryRow key={m.id} item={m} />)}
          </ul>
        )}
      </div>
    </Card>
  );
}

function MemoryRow({ item: m }: { item: DevAgentMemory }) {
  const [pending, start] = useTransition();
  const disabled = m.status !== "active";
  const rejected = m.kind === "rejected_pattern";
  return (
    <li className={`rounded-lg border p-3 ${rejected ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30" : "border-slate-200 dark:border-slate-700"} ${disabled ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {rejected && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
          <Badge label={MEMORY_KIND_LABEL[m.kind]} tone={MEMORY_KIND_TONE[m.kind]} />
          {disabled && <Badge label="Disabled" tone="neutral" />}
        </div>
        <div className="flex items-center gap-1.5">
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          <button type="button" onClick={() => start(() => toggleMemory(m.id).then(() => {}))} title={disabled ? "Enable" : "Disable"}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"><Power className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => start(() => deleteMemory(m.id).then(() => {}))} title="Delete"
            className="rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{m.title}</p>
      {m.content && <p className="text-xs text-slate-500 dark:text-slate-400">{m.content}</p>}
    </li>
  );
}
