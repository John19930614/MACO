"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select, Textarea } from "@/components/modals/Modal";
import { updateLegalRequirement } from "@/lib/actions/ehs";
import type { LegalRequirement } from "@/lib/types";

export function EditLegalForm({ req }: { req: LegalRequirement }) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setSaved(false);
    const res = await updateLegalRequirement(req.id, new FormData(e.currentTarget));
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

      <Field label="Regulation Reference" required>
        <Input name="regulation_ref" defaultValue={req.regulation_ref} required />
      </Field>
      <Field label="Title" required>
        <Input name="title" defaultValue={req.title} required />
      </Field>
      <Field label="Description">
        <Textarea name="description" defaultValue={req.description} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Jurisdiction" required>
          <Input name="jurisdiction" defaultValue={req.jurisdiction} required />
        </Field>
        <Field label="Category">
          <Select name="category" defaultValue={req.category}>
            <option value="chemical">Chemical</option>
            <option value="training">Training</option>
            <option value="emergency">Emergency</option>
            <option value="waste">Waste</option>
            <option value="air">Air</option>
            <option value="water">Water</option>
            <option value="biosafety">Biosafety</option>
            <option value="general">General</option>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Next Review Date" required>
          <Input name="next_review_date" type="date" defaultValue={req.next_review_date.slice(0, 10)} required />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={req.status}>
            <option value="compliant">Compliant</option>
            <option value="minor_gap">Minor Gap</option>
            <option value="major_gap">Major Gap</option>
            <option value="non_compliant">Non-Compliant</option>
            <option value="not_assessed">Not Assessed</option>
            <option value="not_applicable">Not Applicable</option>
          </Select>
        </Field>
      </div>

      <Field label="Compliance Notes">
        <Textarea name="compliance_notes" defaultValue={req.compliance_notes ?? ""} />
      </Field>

      <Field label="Evidence / Document Reference">
        <Input
          name="evidence_url"
          defaultValue={req.evidence_url ?? ""}
          placeholder="URL, SharePoint path, or document reference (e.g. SOP-CHEM-01-v3)"
        />
      </Field>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">
          ID: {req.id.slice(0, 8)}… · Last updated {new Date(req.updated_at).toLocaleDateString()}
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
