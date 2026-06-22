"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, Input, Select, Textarea, SubmitRow } from "@/components/modals/Modal";
import { addCapa } from "@/lib/actions/ehs";
import type { Profile } from "@/lib/types";
import { playCreateSound } from "@/lib/sounds";

export function AddCapaButton({ profiles = [] }: { profiles?: Profile[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await addCapa(null, new FormData(e.currentTarget));
    if (res.ok) { playCreateSound(); setOpen(false); router.refresh(); }
    setPending(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        + Create CAPA
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Create CAPA Action">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Field label="Title" required>
              <Input name="title" placeholder="Brief description of the action required" required />
            </Field>

            <Field label="Description">
              <Textarea name="description" placeholder="Detailed description, root cause, expected outcome…" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Type">
                <Select name="kind">
                  <option value="corrective">Corrective</option>
                  <option value="preventive">Preventive</option>
                </Select>
              </Field>
              <Field label="Severity">
                <Select name="severity">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Assigned Owner">
                <Select name="owner_id">
                  <option value="">Unassigned</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.display_name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Due Date">
                <Input name="due_date" type="date" />
              </Field>
            </div>
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}

