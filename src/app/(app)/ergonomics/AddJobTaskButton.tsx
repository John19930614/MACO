"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal, Field, Input, Select, Textarea, SubmitRow } from "@/components/modals/Modal";
import { addErgonomicsJobTask } from "@/lib/actions/ehs";
import { playCreateSound } from "@/lib/sounds";

export function AddJobTaskButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await addErgonomicsJobTask(null, new FormData(e.currentTarget));
    if (res.ok) {
      playCreateSound();
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error ?? "Could not add job task.");
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
        Add Job Task / JHA
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New Job Hazard Analysis" width="max-w-xl">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Field label="Task Title" required>
              <Input name="task_title" placeholder="e.g. Manual pallet loading" required />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Department">
                <Input name="department" placeholder="e.g. Shipping" />
              </Field>
              <Field label="Primary Hazard">
                <Select name="hazard_type" defaultValue="repetitive_motion">
                  <option value="repetitive_motion">Repetitive Motion</option>
                  <option value="awkward_posture">Awkward Posture</option>
                  <option value="forceful_exertion">Forceful Exertion</option>
                  <option value="vibration">Vibration</option>
                  <option value="contact_stress">Contact Stress</option>
                  <option value="static_posture">Static Posture</option>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Risk Score">
                <Input name="risk_score" type="number" min="0" max="25" placeholder="0–25" />
              </Field>
              <Field label="Status">
                <Select name="status" defaultValue="review_required">
                  <option value="review_required">Review Required</option>
                  <option value="controls_pending">Controls Pending</option>
                  <option value="controlled">Controlled</option>
                </Select>
              </Field>
            </div>

            <Field label="Controls">
              <Input name="controls" placeholder="e.g. lift assist device, job rotation" />
            </Field>
            <p className="-mt-2 text-[10px] text-slate-400">Separate multiple controls with commas.</p>

            <Field label="Notes">
              <Textarea name="notes" placeholder="Optional details about the task or assessment…" />
            </Field>

            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}
