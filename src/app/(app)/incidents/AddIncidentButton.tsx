"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, Input, Select, Textarea, SubmitRow } from "@/components/modals/Modal";
import { addIncident } from "@/lib/actions/ehs";
import { playCreateSound } from "@/lib/sounds";

export function AddIncidentButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await addIncident(null, new FormData(e.currentTarget));
    if (res.ok) { playCreateSound(); setOpen(false); router.refresh(); }
    setPending(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        + Report Incident
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Report Incident">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Field label="Title" required>
              <Input name="title" placeholder="Short description of what happened" required />
            </Field>

            <Field label="Description">
              <Textarea name="description" placeholder="What happened? Where? Who was involved?" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Incident Type">
                <Select name="incident_type">
                  <option value="near_miss">Near Miss</option>
                  <option value="first_aid">First Aid</option>
                  <option value="medical_treatment">Medical Treatment</option>
                  <option value="lost_time_injury">Lost Time Injury</option>
                  <option value="property_damage">Property Damage</option>
                  <option value="environmental_spill">Environmental Spill</option>
                  <option value="chemical_release">Chemical Release</option>
                  <option value="fire_explosion">Fire / Explosion</option>
                  <option value="regulatory_breach">Regulatory Breach</option>
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
              <Field label="Location" required>
                <Input name="location" placeholder="Lab 3, Loading Dock…" required />
              </Field>
              <Field label="Date / Time">
                <Input name="occurred_at" type="date" />
              </Field>
            </div>

            <Field label="Immediate Actions Taken">
              <Textarea name="immediate_actions" placeholder="Evacuation, first aid administered, spill contained…" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Affected Person">
                <Input name="injured_party" placeholder="Name or role" />
              </Field>
              <Field label="Contractor / Company">
                <Input name="contractor_or_company" placeholder="Employer or contractor" />
              </Field>
            </div>

            <Field label="Injury / Illness Description">
              <Textarea name="injuries_description" placeholder="Nature of injury or illness, if any" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Medical Treatment">
                <Select name="medical_treatment">
                  <option value="">Not determined</option>
                  <option value="none">None</option>
                  <option value="first_aid">First aid only</option>
                  <option value="medical">Medical treatment beyond first aid</option>
                </Select>
              </Field>
              <Field label="Witnesses">
                <Input name="witnesses" placeholder="Names, or 'none'" />
              </Field>
            </div>
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}

