"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, Input, Select, Textarea, SubmitRow } from "@/components/modals/Modal";
import { addTrainingCourse } from "@/lib/actions/ehs";

export function AddCourseButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await addTrainingCourse(null, new FormData(e.currentTarget));
    if (res.ok) { setOpen(false); router.refresh(); }
    setPending(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        + Add Course
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Training Course">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Field label="Course Title" required>
              <Input name="title" placeholder="e.g. Bloodborne Pathogens (Annual)" required />
            </Field>
            <Field label="Description">
              <Textarea name="description" placeholder="What the course covers…" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Course Type">
                <Select name="course_type" defaultValue="safety">
                  <option value="safety">Safety</option>
                  <option value="hazmat">Hazmat</option>
                  <option value="emergency-response">Emergency Response</option>
                  <option value="regulatory">Regulatory</option>
                  <option value="equipment">Equipment</option>
                  <option value="general">General</option>
                </Select>
              </Field>
              <Field label="Duration (minutes)">
                <Input name="duration_minutes" type="number" min="0" placeholder="60" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Validity (days)">
                <Input name="validity_period_days" type="number" min="0" placeholder="365 (blank = no expiry)" />
              </Field>
              <Field label="Regulatory Reference">
                <Input name="regulatory_ref" placeholder="e.g. OSHA 29 CFR 1910.1030" />
              </Field>
            </div>
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}
