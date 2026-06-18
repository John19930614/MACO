"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, Input, Select, SubmitRow } from "@/components/modals/Modal";
import { addEquipment } from "@/lib/actions/ehs";

export function AddEquipmentButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await addEquipment(null, new FormData(e.currentTarget));
    if (res.ok) { setOpen(false); router.refresh(); }
    setPending(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        + Add Equipment
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Register Equipment">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Field label="Equipment Name" required>
              <Input name="name" placeholder="e.g. Gas Detector Unit 3" required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Type">
                <Select name="type">
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
              <Field label="Serial Number">
                <Input name="serial_number" placeholder="SN-001" />
              </Field>
            </div>
            <Field label="Location" required>
              <Input name="location" placeholder="e.g. Lab 3, Storage Room B" required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Next Calibration Date">
                <Input name="next_calibration_date" type="date" />
              </Field>
              <Field label="Next Inspection Date">
                <Input name="next_inspection_date" type="date" />
              </Field>
            </div>
            <Field label="Calibration Interval (days)">
              <Input name="calibration_interval_days" type="number" placeholder="e.g. 365" />
            </Field>
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}
