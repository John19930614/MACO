"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Modal, Field, Input, Select, SubmitRow } from "@/components/modals/Modal";
import { addWorkspaceTask } from "@/lib/actions/ehs";
import type { Profile } from "@/lib/types";

export function AddTaskButton({ currentProfileId, profiles }: { currentProfileId: string; profiles: Profile[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await addWorkspaceTask(null, new FormData(e.currentTarget));
    if (res.ok) { setOpen(false); router.refresh(); }
    setPending(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        <ClipboardList className="h-4 w-4" />
        New Task
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New Task">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Field label="Title" required>
              <Input name="title" placeholder="Describe the task…" required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Type">
                <Select name="type" defaultValue="General">
                  <option value="General">General</option>
                  <option value="CAPA">CAPA</option>
                  <option value="Audit">Audit</option>
                  <option value="Training">Training</option>
                  <option value="Documents">Documents</option>
                  <option value="Waste">Waste</option>
                  <option value="Chemical">Chemical</option>
                  <option value="Incident">Incident</option>
                </Select>
              </Field>
              <Field label="Priority">
                <Select name="priority" defaultValue="medium">
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Due Date">
                <Input name="due_date" type="date" />
              </Field>
              <Field label="Assign To">
                <Select name="profile_id" defaultValue={currentProfileId}>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.display_name}</option>
                  ))}
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
