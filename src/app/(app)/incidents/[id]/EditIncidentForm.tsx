"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select, Textarea } from "@/components/modals/Modal";
import { updateIncident } from "@/lib/actions/ehs";
import { INCIDENT_TYPES, INCIDENT_TYPE_META } from "@/lib/constants";
import type { Incident } from "@/lib/types";

export function EditIncidentForm({ incident }: { incident: Incident }) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setSaved(false);
    setError(null);
    const res = await updateIncident(incident.id, new FormData(e.currentTarget));
    if (res.ok) { setSaved(true); router.refresh(); }
    else { setError(res.error ?? "Couldn't save changes. Please try again."); }
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

      {error && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
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
            {INCIDENT_TYPES.map((t) => (
              <option key={t} value={t}>{INCIDENT_TYPE_META[t].label}</option>
            ))}
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

      {/* CSP validation evidence — completing these clears the agent's flags. */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Validation Evidence</p>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Affected Person">
              <Input name="injured_party" defaultValue={incident.injured_party ?? ""} />
            </Field>
            <Field label="Contractor / Company">
              <Input name="contractor_or_company" defaultValue={incident.contractor_or_company ?? ""} />
            </Field>
          </div>

          <Field label="Injury / Illness Description">
            <Textarea name="injuries_description" defaultValue={incident.injuries_description ?? ""} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Medical Treatment">
              <Select name="medical_treatment" defaultValue={incident.medical_treatment_required ? "medical" : ""}>
                <option value="">Not determined</option>
                <option value="none">None</option>
                <option value="first_aid">First aid only</option>
                <option value="medical">Medical treatment beyond first aid</option>
              </Select>
            </Field>
            <Field label="Witnesses">
              <Input name="witnesses" defaultValue={incident.witnesses ?? ""} />
            </Field>
          </div>

          <Field label="Final Corrective Action">
            <Textarea name="final_corrective_action" defaultValue={incident.final_corrective_action ?? ""} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Supervisor Review">
              <Input name="supervisor_review" defaultValue={incident.supervisor_review ?? ""} placeholder="Reviewer name / sign-off" />
            </Field>
            <Field label="Safety Review">
              <Input name="safety_review" defaultValue={incident.safety_review ?? ""} placeholder="Reviewer name / sign-off" />
            </Field>
          </div>

          <Field label="Recordability Decision (human)">
            <Select name="recordability_decision" defaultValue={incident.recordability_decision ?? ""}>
              <option value="">Not yet determined</option>
              <option value="not_recordable">Not recordable</option>
              <option value="recordable">OSHA recordable</option>
              <option value="first_aid_only">First aid only — not recordable</option>
            </Select>
          </Field>
        </div>
      </div>

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
