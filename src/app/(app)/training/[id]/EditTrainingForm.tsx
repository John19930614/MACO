"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select, Textarea } from "@/components/modals/Modal";
import { updateTrainingRecord } from "@/lib/actions/ehs";
import type { TrainingRecord, TrainingCourse, Profile } from "@/lib/types";

export function EditTrainingForm({ record, courses, profiles }: {
  record: TrainingRecord;
  courses: TrainingCourse[];
  profiles: Profile[];
}) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setSaved(false);
    const res = await updateTrainingRecord(record.id, new FormData(e.currentTarget));
    if (res.ok) { setSaved(true); router.refresh(); }
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Changes saved successfully.
        </div>
      )}

      <Field label="Employee" required>
        <Select name="profile_id" defaultValue={record.profile_id} required>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.display_name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Course" required>
        <Select name="course_id" defaultValue={record.course_id} required>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Completed Date" required>
          <Input name="completed_date" type="date" defaultValue={record.completed_date.slice(0, 10)} required />
        </Field>
        <Field label="Expiry Date">
          <Input name="expiry_date" type="date" defaultValue={record.expiry_date?.slice(0, 10) ?? ""} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Score (%)">
          <Input
            name="score"
            type="number"
            min="0"
            max="100"
            defaultValue={record.score?.toString() ?? ""}
            placeholder="e.g. 85"
          />
        </Field>
        <Field label="Result">
          <Select name="passed" defaultValue={record.passed ? "true" : "false"}>
            <option value="true">Passed</option>
            <option value="false">Failed</option>
          </Select>
        </Field>
      </div>

      <Field label="Delivery Method">
        <Select name="delivery_method" defaultValue={record.delivery_method}>
          <option value="classroom">Classroom</option>
          <option value="online">Online</option>
          <option value="on_the_job">On the Job</option>
          <option value="toolbox_talk">Toolbox Talk</option>
          <option value="simulation">Simulation</option>
          <option value="external">External</option>
        </Select>
      </Field>

      <Field label="Notes">
        <Textarea name="notes" defaultValue={record.notes ?? ""} />
      </Field>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">
          ID: {record.id.slice(0, 8)}… · Logged {new Date(record.created_at).toLocaleDateString()}
        </p>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
