"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, Input, Select, SubmitRow } from "@/components/modals/Modal";
import { addAudit } from "@/lib/actions/ehs";

export function AddAuditButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await addAudit(null, new FormData(e.currentTarget));
    if (res.ok) { setOpen(false); router.refresh(); }
    setPending(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        + Schedule Audit
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Schedule Audit">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Field label="Audit Title" required>
              <Input name="title" placeholder="e.g. BSL-2 Annual Safety Inspection" required />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Audit Type">
                <Select name="type">
                  <option value="internal">Internal</option>
                  <option value="external">External</option>
                  <option value="regulatory">Regulatory</option>
                  <option value="supplier">Supplier</option>
                  <option value="system">System</option>
                  <option value="process">Process</option>
                </Select>
              </Field>
              <Field label="Scheduled Date" required>
                <Input name="scheduled_date" type="date" required />
              </Field>
            </div>

            <Field label="Scope">
              <Input name="scope" placeholder="Areas, processes, or regulations covered…" />
            </Field>
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}
