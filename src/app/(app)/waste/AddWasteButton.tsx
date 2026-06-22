"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, Input, Select, Textarea, SubmitRow } from "@/components/modals/Modal";
import { addWasteStream } from "@/lib/actions/ehs";
import { playCreateSound } from "@/lib/sounds";

export function AddWasteButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await addWasteStream(null, new FormData(e.currentTarget));
    if (res.ok) { playCreateSound(); setOpen(false); router.refresh(); }
    setPending(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        + Add Waste Stream
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Waste Stream">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Field label="Waste Name" required>
              <Input name="waste_name" placeholder="e.g. Spent Formaldehyde Solution" required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Waste Code">
                <Input name="waste_code" placeholder="e.g. D002, F001" />
              </Field>
              <Field label="Classification">
                <Select name="classification">
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
                <Input name="quantity" type="number" step="0.01" placeholder="0.0" />
              </Field>
              <Field label="Unit">
                <Select name="unit">
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
                <Select name="disposal_method">
                  <option value="incineration">Incineration</option>
                  <option value="landfill">Landfill</option>
                  <option value="recycling">Recycling</option>
                  <option value="treatment">Treatment</option>
                  <option value="neutralisation">Neutralisation</option>
                </Select>
              </Field>
              <Field label="Disposal Contractor">
                <Input name="disposal_contractor" placeholder="Contractor name" />
              </Field>
            </div>
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}

