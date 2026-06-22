"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, Input, Select, Textarea, SubmitRow } from "@/components/modals/Modal";
import { addRisk } from "@/lib/actions/ehs";
import { playCreateSound } from "@/lib/sounds";

export function AddRiskButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await addRisk(null, new FormData(e.currentTarget));
    if (res.ok) { playCreateSound(); setOpen(false); router.refresh(); }
    setPending(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        + New Assessment
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New Risk Assessment">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Field label="Title" required>
              <Input name="title" placeholder="Brief description of the risk" required />
            </Field>
            <Field label="Description">
              <Textarea name="description" placeholder="What is the risk and why does it matter?" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                <Select name="category">
                  <option value="chemical">Chemical</option>
                  <option value="physical">Physical</option>
                  <option value="biological">Biological</option>
                  <option value="ergonomic">Ergonomic</option>
                  <option value="fire">Fire</option>
                </Select>
              </Field>
              <Field label="Activity">
                <Input name="activity" placeholder="e.g. Lab work, Maintenance" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Likelihood (1–5)">
                <Select name="likelihood_score" defaultValue="3">
                  <option value="1">1 — Rare</option>
                  <option value="2">2 — Unlikely</option>
                  <option value="3">3 — Possible</option>
                  <option value="4">4 — Likely</option>
                  <option value="5">5 — Almost Certain</option>
                </Select>
              </Field>
              <Field label="Consequence (1–5)">
                <Select name="consequence_score" defaultValue="3">
                  <option value="1">1 — Negligible</option>
                  <option value="2">2 — Minor</option>
                  <option value="3">3 — Moderate</option>
                  <option value="4">4 — Major</option>
                  <option value="5">5 — Catastrophic</option>
                </Select>
              </Field>
            </div>
            <Field label="Next Review Date">
              <Input name="review_date" type="date" />
            </Field>
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}

