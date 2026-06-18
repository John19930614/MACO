"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select, Textarea } from "@/components/modals/Modal";
import { updateIncident } from "@/lib/actions/ehs";
import type { Incident } from "@/lib/types";

export function EditIncidentForm({ incident }: { incident: Incident }) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setSaved(false);
    const res = await updateIncident(incident.id, new FormData(e.currentTarget));
    if (res.ok) { setSaved(true); router.refresh(); }
    setPending(false);
  }

  const occurredDate = incident.occurred_at
    ? new Date(incident.occurred_at).toISOString().slice(0, 10)
    : "";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Changes saved successfully.
        </div>
      )}

      <Field label="Title" required>
        <Input name="title" defaultValue={incident.title} required />
      </Field>

      <Field label="Description">
        <Textarea name="description" defaultValue={incident.description ?? ""} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Incident Type">
          <Select name="incident_type" defaultValue={incident.incident_type}>
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
          <Select name="severity" defaultValue={incident.severity}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Status">
          <Select name="status" defaultValue={incident.status}>
            <option value="reported">Reported</option>
            <option value="under_investigation">Under Investigation</option>
            <option value="capa_open">CAPA Open</option>
            <option value="closed">Closed</option>
          </Select>
        </Field>
        <Field label="Location">
          <Input name="location" defaultValue={incident.location ?? ""} />
        </Field>
      </div>

      <Field label="Date of Occurrence">
        <Input name="occurred_at" type="date" defaultValue={occurredDate} />
      </Field>

      <Field label="Immediate Actions Taken">
        <Textarea name="immediate_actions" defaultValue={incident.immediate_actions ?? ""} />
      </Field>

      <Field label="Root Cause">
        <Textarea name="root_cause" defaultValue={incident.root_cause ?? ""} />
      </Field>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">
          ID: {incident.id.slice(0, 8)}… · Created {new Date(incident.created_at).toLocaleDateString()}
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
