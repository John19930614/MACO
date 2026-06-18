"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select } from "@/components/modals/Modal";
import { updateWasteStream } from "@/lib/actions/ehs";
import type { WasteStream } from "@/lib/types";

export function EditWasteForm({ stream }: { stream: WasteStream }) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setSaved(false);
    const res = await updateWasteStream(stream.id, new FormData(e.currentTarget));
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

      <Field label="Waste Name" required>
        <Input name="waste_name" defaultValue={stream.waste_name} required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Waste Code">
          <Input name="waste_code" defaultValue={stream.waste_code ?? ""} placeholder="e.g. D002" />
        </Field>
        <Field label="Classification">
          <Select name="classification" defaultValue={stream.classification}>
            <option value="hazardous">Hazardous</option>
            <option value="clinical">Clinical / Biohazardous</option>
            <option value="radioactive">Radioactive</option>
            <option value="non_hazardous">Non-Hazardous</option>
            <option value="recyclable">Recyclable</option>
            <option value="general">General</option>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Quantity">
          <Input name="quantity" type="number" step="0.01" defaultValue={stream.quantity} />
        </Field>
        <Field label="Unit">
          <Select name="unit" defaultValue={stream.unit}>
            <option value="kg">kg</option>
            <option value="L">L</option>
            <option value="t">t (tonnes)</option>
            <option value="m³">m³</option>
            <option value="drums">drums</option>
            <option value="units">units</option>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Disposal Method">
          <Select name="disposal_method" defaultValue={stream.disposal_method}>
            <option value="incineration">Incineration</option>
            <option value="landfill">Landfill</option>
            <option value="recycling">Recycling</option>
            <option value="treatment">Treatment</option>
            <option value="neutralisation">Neutralisation</option>
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={stream.status}>
            <option value="pending">Pending</option>
            <option value="manifested">Manifested</option>
            <option value="disposed">Disposed</option>
            <option value="reported">Reported</option>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Disposal Contractor">
          <Input name="disposal_contractor" defaultValue={stream.disposal_contractor ?? ""} />
        </Field>
        <Field label="Manifest Number">
          <Input name="manifest_number" defaultValue={stream.manifest_number ?? ""} />
        </Field>
      </div>

      <Field label="Disposal Date">
        <Input name="disposal_date" type="date"
          defaultValue={stream.disposal_date ? new Date(stream.disposal_date).toISOString().slice(0, 10) : ""} />
      </Field>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">ID: {stream.id.slice(0, 8)}…</p>
        <button type="submit" disabled={pending}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
