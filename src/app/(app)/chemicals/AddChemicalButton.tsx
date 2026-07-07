"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, Input, Select, SubmitRow } from "@/components/modals/Modal";
import { GhsCodePicker } from "./GhsCodePicker";
import { PpePicker } from "./PpePicker";
import { ChemicalNamePicker } from "./ChemicalNamePicker";
import { STORAGE_CLASSES, type CommonChemical } from "@/lib/chemicalRefData";
import { addChemical } from "@/lib/actions/ehs";
import { playCreateSound } from "@/lib/sounds";

export function AddChemicalButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  // Controlled fields so the common-chemical Quick Fill can populate them.
  const [name, setName] = useState("");
  const [cas, setCas] = useState("");
  const [storageClass, setStorageClass] = useState("");
  const [isScheduled, setIsScheduled] = useState("false");
  const [scheduleRef, setScheduleRef] = useState("");
  // Prefill for the code/PPE pickers; bumping prefillKey remounts them with new defaults.
  const [prefill, setPrefill] = useState<{ hazards: string[]; precautions: string[]; ppe: string[] }>({ hazards: [], precautions: [], ppe: [] });
  const [prefillKey, setPrefillKey] = useState(0);
  const [filledFrom, setFilledFrom] = useState<string | null>(null);

  function applyChemical(chem: CommonChemical) {
    setName(chem.name);
    setCas(chem.cas);
    setStorageClass(chem.storageClass);
    setIsScheduled(chem.scheduled ? "true" : "false");
    setScheduleRef(chem.scheduleRef ?? "");
    setPrefill({ hazards: chem.hazardCodes, precautions: chem.precautionCodes, ppe: chem.ppe });
    setPrefillKey((k) => k + 1);
    setFilledFrom(chem.name);
  }

  function resetForm() {
    setName("");
    setCas("");
    setStorageClass("");
    setIsScheduled("false");
    setScheduleRef("");
    setPrefill({ hazards: [], precautions: [], ppe: [] });
    setPrefillKey((k) => k + 1);
    setFilledFrom(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await addChemical(null, new FormData(e.currentTarget));
    if (res.ok) { playCreateSound(); setOpen(false); resetForm(); router.refresh(); }
    setPending(false);
  }

  function handleClose() {
    setOpen(false);
    resetForm();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        + Add Chemical
      </button>

      <Modal open={open} onClose={handleClose} title="Add Chemical to Inventory" width="max-w-xl">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Field label="Quick Fill — Common Chemical">
              <ChemicalNamePicker onSelect={applyChemical} />
              <p className="mt-1 text-xs text-slate-400">
                Pick a common chemical to auto-fill name, CAS, storage class, hazard codes, and PPE below —
                then <span className="font-medium text-slate-500">verify against the supplier SDS</span> before saving.
              </p>
            </Field>

            <Field label="Chemical Name" required>
              <Input name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hydrochloric Acid" required />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="CAS Number">
                <Input name="cas_number" value={cas} onChange={(e) => setCas(e.target.value)} placeholder="e.g. 7647-01-0" />
              </Field>
              <Field label="Supplier">
                <Input name="supplier" placeholder="Sigma-Aldrich, Merck…" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Quantity" required>
                <Input name="quantity" type="number" min="0" step="0.01" placeholder="0.00" required />
              </Field>
              <Field label="Unit">
                <Select name="unit">
                  <option value="L">L (Litres)</option>
                  <option value="mL">mL</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="t">t (Tonnes)</option>
                  <option value="m³">m³</option>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Container Capacity (single container — sets GHS label size)">
                <Input name="container_capacity" type="number" min="0" step="0.001" placeholder="e.g. 20" />
              </Field>
              <Field label="Container Unit">
                <Select name="container_capacity_unit" defaultValue="L">
                  <option value="mL">mL (millilitres)</option>
                  <option value="L">L (litres)</option>
                  <option value="gal">gal (US gallons)</option>
                  <option value="g">g (grams)</option>
                  <option value="kg">kg (kilograms)</option>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Storage Location" required>
                <Input name="storage_location" placeholder="Lab 3 — Flammables Cabinet A" required />
              </Field>
              <Field label="Storage Class">
                <Select name="storage_class" value={storageClass} onChange={(e) => setStorageClass(e.target.value)}>
                  <option value="">— Select class —</option>
                  {STORAGE_CLASSES.map((s) => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Container Label / ID (optional)">
              <Input name="container_label" placeholder="e.g. Bottle 1, Cabinet A-3 — distinguishes this container from other containers of the same chemical" />
            </Field>

            <Field label="Recommended PPE">
              <PpePicker key={`ppe-${prefillKey}`} name="recommended_ppe" defaultCodes={prefill.ppe} />
            </Field>

            <Field label="GHS Hazard Codes (H-statements)">
              <GhsCodePicker key={`h-${prefillKey}`} name="hazard_codes" mode="hazard" defaultCodes={prefill.hazards} />
            </Field>

            <Field label="Precautionary Codes (P-statements)">
              <GhsCodePicker key={`p-${prefillKey}`} name="precaution_codes" mode="precaution" defaultCodes={prefill.precautions} />
            </Field>

            {filledFrom && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Auto-filled from starter data for <span className="font-semibold">{filledFrom}</span>. Confirm every
                field against the current supplier SDS before saving — concentrations and classifications vary by vendor.
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Scheduled / Regulated">
                <Select name="is_scheduled" value={isScheduled} onChange={(e) => setIsScheduled(e.target.value)}>
                  <option value="false">No</option>
                  <option value="true">Yes — regulated substance</option>
                </Select>
              </Field>
              <Field label="SDS Expiry / Review">
                <Input name="sds_expiry" type="date" />
              </Field>
            </div>

            <Field label="Schedule Reference">
              <Input name="schedule_ref" value={scheduleRef} onChange={(e) => setScheduleRef(e.target.value)} placeholder="e.g. OSHA 29 CFR 1910.1048" />
            </Field>
          </div>
          <SubmitRow onClose={handleClose} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}
