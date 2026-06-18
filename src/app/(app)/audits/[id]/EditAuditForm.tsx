"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select, Textarea } from "@/components/modals/Modal";
import { updateAudit } from "@/lib/actions/ehs";
import type { Audit } from "@/lib/types";

export function EditAuditForm({ audit }: { audit: Audit }) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setSaved(false);
    const res = await updateAudit(audit.id, new FormData(e.currentTarget));
    if (res.ok) { setSaved(true); router.refresh(); }
    setPending(false);
  }

  const scheduledDate = audit.scheduled_date
    ? new Date(audit.scheduled_date).toISOString().slice(0, 10)
    : "";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Changes saved successfully.
        </div>
      )}

      <Field label="Title" required>
        <Input name="title" defaultValue={audit.title} required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Audit Type">
          <Select name="type" defaultValue={audit.type}>
            <option value="internal">Internal</option>
            <option value="external">External</option>
            <option value="regulatory">Regulatory</option>
            <option value="supplier">Supplier</option>
            <option value="system">System</option>
            <option value="process">Process</option>
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={audit.status}>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </Field>
      </div>

      <Field label="Scheduled Date">
        <Input name="scheduled_date" type="date" defaultValue={scheduledDate} />
      </Field>

      <Field label="Scope">
        <Textarea name="scope" defaultValue={audit.scope ?? ""} placeholder="What areas, processes, or regulations does this audit cover?" />
      </Field>

      <Field label="Notes">
        <Textarea name="notes" defaultValue={audit.notes ?? ""} placeholder="Additional notes, observations, or outcomes…" />
      </Field>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">
          ID: {audit.id.slice(0, 8)}… · Created {new Date(audit.created_at).toLocaleDateString()}
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
