"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, Input, Select, Textarea, SubmitRow } from "@/components/modals/Modal";
import { addLegalRequirement } from "@/lib/actions/ehs";
import { playCreateSound } from "@/lib/sounds";

export function AddLegalButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await addLegalRequirement(null, new FormData(e.currentTarget));
    if (res.ok) { playCreateSound(); setOpen(false); router.refresh(); }
    setPending(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        + Add Requirement
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Legal Requirement">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Field label="Regulation Reference" required>
              <Input name="regulation_ref" placeholder="e.g. OSHA 1910.119" required />
            </Field>
            <Field label="Title" required>
              <Input name="title" placeholder="Requirement title" required />
            </Field>
            <Field label="Description">
              <Textarea name="description" placeholder="Describe the regulatory obligation…" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Jurisdiction" required>
                <Input name="jurisdiction" placeholder="e.g. Federal US" required />
              </Field>
              <Field label="Category">
                <Select name="category" defaultValue="general">
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
                <Input name="next_review_date" type="date" required />
              </Field>
              <Field label="Status">
                <Select name="status" defaultValue="not_assessed">
                  <option value="compliant">Compliant</option>
                  <option value="minor_gap">Minor Gap</option>
                  <option value="major_gap">Major Gap</option>
                  <option value="non_compliant">Non-Compliant</option>
                  <option value="not_assessed">Not Assessed</option>
                  <option value="not_applicable">Not Applicable</option>
                </Select>
              </Field>
            </div>
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}

