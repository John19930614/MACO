"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, Input, Select, Textarea, SubmitRow } from "@/components/modals/Modal";
import { addTrainingRecord } from "@/lib/actions/ehs";
import type { TrainingCourse, Profile } from "@/lib/types";

export function AddTrainingButton({ courses, profiles }: {
  courses: TrainingCourse[];
  profiles: Profile[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await addTrainingRecord(null, new FormData(e.currentTarget));
    if (res.ok) { setOpen(false); router.refresh(); }
    setPending(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        + Log Training
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Log Training Record">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Field label="Employee" required>
              <Select name="profile_id" required defaultValue="">
                <option value="" disabled>Select employee…</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Course" required>
              <Select name="course_id" required defaultValue="">
                <option value="" disabled>Select course…</option>
                {courses.filter((c) => c.active).map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Completed Date" required>
                <Input name="completed_date" type="date" required />
              </Field>
              <Field label="Delivery Method">
                <Select name="delivery_method" defaultValue="classroom">
                  <option value="classroom">Classroom</option>
                  <option value="online">Online</option>
                  <option value="on_the_job">On the Job</option>
                  <option value="toolbox_talk">Toolbox Talk</option>
                  <option value="simulation">Simulation</option>
                  <option value="external">External</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Score (%)">
                <Input name="score" type="number" min="0" max="100" placeholder="e.g. 85" />
              </Field>
              <Field label="Result">
                <Select name="passed" defaultValue="true">
                  <option value="true">Passed</option>
                  <option value="false">Failed</option>
                </Select>
              </Field>
            </div>
            <Field label="Notes">
              <Textarea name="notes" placeholder="Optional notes…" />
            </Field>
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}
