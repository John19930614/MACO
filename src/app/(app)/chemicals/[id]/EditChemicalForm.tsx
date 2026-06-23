"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select, Textarea } from "@/components/modals/Modal";
import { updateChemical } from "@/lib/actions/ehs";
import type { Chemical } from "@/lib/types";

export function EditChemicalForm({ chemical }: { chemical: Chemical }) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setSaved(false);
    const res = await updateChemical(chemical.id, new FormData(e.currentTarget));
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

      <Field label="Chemical Name" required>
        <Input name="name" defaultValue={chemical.name} required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="CAS Number">
          <Input name="cas_number" defaultValue={chemical.cas_number ?? ""} placeholder="e.g. 7647-01-0" />
        </Field>
        <Field label="Supplier">
          <Input name="supplier" defaultValue={chemical.supplier ?? ""} placeholder="Supplier name" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Quantity">
          <Input name="quantity" type="number" step="0.001" defaultValue={chemical.quantity} />
        </Field>
        <Field label="Unit">
          <Select name="unit" defaultValue={chemical.unit}>
            <option value="L">L (litres)</option>
            <option value="mL">mL (millilitres)</option>
            <option value="kg">kg (kilograms)</option>
            <option value="g">g (grams)</option>
            <option value="t">t (tonnes)</option>
            <option value="m³">m³</option>
            <option value="drums">drums</option>
            <option value="units">units</option>
          </Select>
        </Field>
      </div>

      <Field label="Storage Location">
        <Input name="storage_location" defaultValue={chemical.storage_location ?? ""} placeholder="e.g. Lab 3, Chemical Store Room A" />
      </Field>

      <Field label="GHS Hazard Codes">
        <Input name="hazard_codes" defaultValue={chemical.hazard_statements.join(", ")} placeholder="e.g. H225, H319, H350" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Scheduled / Regulated">
          <Select name="is_scheduled" defaultValue={chemical.is_scheduled ? "true" : "false"}>
            <option value="false">No</option>
            <option value="true">Yes — regulated substance</option>
          </Select>
        </Field>
        <Field label="SDS Expiry / Review">
          <Input name="sds_expiry" type="date" defaultValue={chemical.sds_expiry ?? ""} />
        </Field>
      </div>

      <Field label="Schedule Reference">
        <Input name="schedule_ref" defaultValue={chemical.schedule_ref ?? ""} placeholder="e.g. OSHA 29 CFR 1910.1048" />
      </Field>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">
          ID: {chemical.id.slice(0, 8)}… · Added {new Date(chemical.created_at).toLocaleDateString()}
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
