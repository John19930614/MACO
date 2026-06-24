"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal, Field, Input, Select, Textarea, SubmitRow } from "@/components/modals/Modal";
import { addErgonomicsWorkstation } from "@/lib/actions/ehs";
import { playCreateSound } from "@/lib/sounds";

export function AddWorkstationButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await addErgonomicsWorkstation(null, new FormData(e.currentTarget));
    if (res.ok) {
      playCreateSound();
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error ?? "Could not add workstation.");
    }
    setPending(false);
  }

  return (
    <>
      <button
        onClick={() => { setError(null); setOpen(true); }}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <Plus className="h-4 w-4" />
        Add Workstation
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Register Workstation" width="max-w-xl">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Field label="Workstation Name" required>
              <Input name="name" placeholder="e.g. Packing Line Station 4" required />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Department">
                <Input name="department" placeholder="e.g. Warehouse" />
              </Field>
              <Field label="Worker Count">
                <Input name="worker_count" type="number" min="0" placeholder="0" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Risk Level">
                <Select name="risk_level" defaultValue="low">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </Select>
              </Field>
              <Field label="Status">
                <Select name="status" defaultValue="assessment_due">
                  <option value="assessment_due">Assessment Due</option>
                  <option value="compliant">Compliant</option>
                  <option value="needs_improvement">Needs Improvement</option>
                  <option value="non_compliant">Non-compliant</option>
                </Select>
              </Field>
            </div>

            <Field label="Next Assessment Date">
              <Input name="next_assessment" type="date" />
            </Field>

            <Field label="Primary Hazards">
              <Input name="primary_hazards" placeholder="e.g. awkward posture, repetitive motion" />
            </Field>
            <p className="-mt-2 text-[10px] text-slate-400">Separate multiple hazards with commas.</p>

            <Field label="Notes">
              <Textarea name="notes" placeholder="Optional context for this workstation…" />
            </Field>

            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}
