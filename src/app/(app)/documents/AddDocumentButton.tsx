"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, Input, Select, SubmitRow } from "@/components/modals/Modal";
import { addDocument } from "@/lib/actions/ehs";
import type { Profile } from "@/lib/types";
import { playCreateSound } from "@/lib/sounds";

export function AddDocumentButton({ profiles = [] }: { profiles?: Profile[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await addDocument(null, new FormData(e.currentTarget));
    if (res.ok) { playCreateSound(); setOpen(false); router.refresh(); }
    setPending(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        + Add Document
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Document">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Field label="Title" required>
              <Input name="title" placeholder="Document title" required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                <Select name="category" defaultValue="sop">
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
                <Input name="version" placeholder="e.g. 1.0" defaultValue="1.0" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Effective Date" required>
                <Input name="effective_date" type="date" required />
              </Field>
              <Field label="Review Date" required>
                <Input name="review_date" type="date" required />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Status">
                <Select name="status" defaultValue="draft">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="under_review">Under Review</option>
                  <option value="superseded">Superseded</option>
                  <option value="obsolete">Obsolete</option>
                </Select>
              </Field>
              <Field label="Acknowledgment Required">
                <Select name="acknowledgment_required" defaultValue="false">
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </Select>
              </Field>
            </div>
            <Field label="Document Owner">
              <Select name="owner_id">
                <option value="">Unassigned</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </Select>
            </Field>
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}

