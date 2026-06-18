"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select, Textarea } from "@/components/modals/Modal";
import { updateCapa } from "@/lib/actions/ehs";
import type { CapaAction } from "@/lib/types";

export function EditCapaForm({ capa }: { capa: CapaAction }) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setSaved(false);
    const res = await updateCapa(capa.id, new FormData(e.currentTarget));
    if (res.ok) { setSaved(true); router.refresh(); }
    setPending(false);
  }

  const dueDate = capa.due_date
    ? new Date(capa.due_date).toISOString().slice(0, 10)
    : "";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Changes saved successfully.
        </div>
      )}

      <Field label="Title" required>
        <Input name="title" defaultValue={capa.title} required />
      </Field>

      <Field label="Description">
        <Textarea name="description" defaultValue={capa.description ?? ""} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Kind">
          <Select name="kind" defaultValue={capa.kind}>
            <option value="corrective">Corrective</option>
            <option value="preventive">Preventive</option>
          </Select>
        </Field>
        <Field label="Severity">
          <Select name="severity" defaultValue={capa.severity}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Status">
          <Select name="status" defaultValue={capa.status}>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="closed">Closed</option>
            <option value="overdue">Overdue</option>
            <option value="rejected">Rejected</option>
          </Select>
        </Field>
        <Field label="Due Date">
          <Input name="due_date" type="date" defaultValue={dueDate} />
        </Field>
      </div>

      <Field label="Root Cause">
        <Textarea name="root_cause" defaultValue={capa.root_cause ?? ""} />
      </Field>

      <Field label="Verification Method">
        <Input name="verification_method" defaultValue={capa.verification_method ?? ""} placeholder="How will this be verified as complete?" />
      </Field>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">
          ID: {capa.id.slice(0, 8)}… · Source: {capa.source_type.replace(/_/g, " ")}
        </p>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
