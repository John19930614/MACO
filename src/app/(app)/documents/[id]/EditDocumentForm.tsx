"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select } from "@/components/modals/Modal";
import { updateDocument } from "@/lib/actions/ehs";
import type { Document } from "@/lib/types";

export function EditDocumentForm({ doc }: { doc: Document }) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setSaved(false);
    const res = await updateDocument(doc.id, new FormData(e.currentTarget));
    if (res.ok) { setSaved(true); router.refresh(); }
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Changes saved successfully.
        </div>
      )}

      <Field label="Title" required>
        <Input name="title" defaultValue={doc.title} required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Category">
          <Select name="category" defaultValue={doc.category}>
            <option value="sop">SOP</option>
            <option value="policy">Policy</option>
            <option value="procedure">Procedure</option>
            <option value="form">Form</option>
            <option value="permit">Permit</option>
            <option value="msds">SDS</option>
            <option value="plan">Plan</option>
            <option value="guideline">Guideline</option>
          </Select>
        </Field>
        <Field label="Version">
          <Input name="version" defaultValue={doc.version} placeholder="e.g. 1.0" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Effective Date" required>
          <Input name="effective_date" type="date" defaultValue={doc.effective_date.slice(0, 10)} required />
        </Field>
        <Field label="Review Date" required>
          <Input name="review_date" type="date" defaultValue={doc.review_date.slice(0, 10)} required />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Status">
          <Select name="status" defaultValue={doc.status}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="under_review">Under Review</option>
            <option value="superseded">Superseded</option>
            <option value="obsolete">Obsolete</option>
          </Select>
        </Field>
        <Field label="Acknowledgment Required">
          <Select name="acknowledgment_required" defaultValue={doc.acknowledgment_required ? "true" : "false"}>
            <option value="false">No</option>
            <option value="true">Yes</option>
          </Select>
        </Field>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">
          ID: {doc.id.slice(0, 8)}… · Updated {new Date(doc.updated_at).toLocaleDateString()}
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
