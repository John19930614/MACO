"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, Input, Select, SubmitRow } from "@/components/modals/Modal";
import { addChemical } from "@/lib/actions/ehs";
import { playCreateSound } from "@/lib/sounds";

export function AddChemicalButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await addChemical(null, new FormData(e.currentTarget));
    if (res.ok) { playCreateSound(); setOpen(false); router.refresh(); }
    setPending(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        + Add Chemical
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Chemical to Inventory" width="max-w-xl">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Field label="Chemical Name" required>
              <Input name="name" placeholder="e.g. Hydrochloric Acid" required />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="CAS Number">
                <Input name="cas_number" placeholder="e.g. 7647-01-0" />
              </Field>
              <Field label="Supplier">
                <Input name="supplier" placeholder="Sigma-Aldrich, Merck…" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Quantity" required>
                <Input name="quantity" type="number" min="0" step="0.01" placeholder="0.00" required />
              </Field>
              <Field label="Unit">
                <Select name="unit">
                  <option value="L">L (Litres)</option>
                  <option value="mL">mL</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="t">t (Tonnes)</option>
                  <option value="m³">m³</option>
                </Select>
              </Field>
            </div>

            <Field label="Storage Location" required>
              <Input name="storage_location" placeholder="Lab 3 — Flammables Cabinet A" required />
            </Field>
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}

