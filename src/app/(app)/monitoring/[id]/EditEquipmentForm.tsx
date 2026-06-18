"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select } from "@/components/modals/Modal";
import { updateEquipment } from "@/lib/actions/ehs";
import type { Equipment } from "@/lib/types";

export function EditEquipmentForm({ equipment }: { equipment: Equipment }) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setSaved(false);
    const res = await updateEquipment(equipment.id, new FormData(e.currentTarget));
    if (res.ok) { setSaved(true); router.refresh(); }
    setPending(false);
  }

  function toDate(s: string | null) {
    return s ? new Date(s).toISOString().slice(0, 10) : "";
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Changes saved successfully.
        </div>
      )}

      <Field label="Equipment Name" required>
        <Input name="name" defaultValue={equipment.name} required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Type">
          <Select name="type" defaultValue={equipment.type}>
            <option value="gas_detector">Gas Detector</option>
            <option value="air_monitor">Air Monitor</option>
            <option value="pressure_vessel">Pressure Vessel</option>
            <option value="ppe">PPE</option>
            <option value="fire_extinguisher">Fire Extinguisher</option>
            <option value="eyewash">Eyewash / Shower</option>
            <option value="autoclave">Autoclave</option>
            <option value="fume_hood">Fume Hood</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={equipment.status}>
            <option value="operational">Operational</option>
            <option value="calibration_due">Calibration Due</option>
            <option value="inspection_due">Inspection Due</option>
            <option value="out_of_service">Out of Service</option>
            <option value="decommissioned">Decommissioned</option>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Serial Number">
          <Input name="serial_number" defaultValue={equipment.serial_number ?? ""} />
        </Field>
        <Field label="Location">
          <Input name="location" defaultValue={equipment.location} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Last Calibration Date">
          <Input name="last_calibration_date" type="date" defaultValue={toDate(equipment.last_calibration_date)} />
        </Field>
        <Field label="Next Calibration Date">
          <Input name="next_calibration_date" type="date" defaultValue={toDate(equipment.next_calibration_date)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Next Inspection Date">
          <Input name="next_inspection_date" type="date" defaultValue={toDate(equipment.next_inspection_date)} />
        </Field>
        <Field label="Calibration Interval (days)">
          <Input name="calibration_interval_days" type="number"
            defaultValue={equipment.calibration_interval_days ?? ""} placeholder="e.g. 365" />
        </Field>
      </div>

      <Field label="Notes">
        <Input name="notes" defaultValue={equipment.notes ?? ""} placeholder="Additional notes…" />
      </Field>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">
          ID: {equipment.id.slice(0, 8)}… · Added {new Date(equipment.created_at).toLocaleDateString()}
        </p>
        <button type="submit" disabled={pending}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
