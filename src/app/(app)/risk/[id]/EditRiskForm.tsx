"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select, Textarea } from "@/components/modals/Modal";
import { updateRisk } from "@/lib/actions/ehs";
import type { RiskAssessment } from "@/lib/types";

export function EditRiskForm({ risk }: { risk: RiskAssessment }) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lScore, setLScore] = useState(risk.likelihood_score);
  const [cScore, setCScore] = useState(risk.consequence_score);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setSaved(false);
    const res = await updateRisk(risk.id, new FormData(e.currentTarget));
    if (res.ok) { setSaved(true); router.refresh(); }
    setPending(false);
  }

  const preview = lScore * cScore;
  const level = preview >= 20 ? "Extreme" : preview >= 15 ? "High" : preview >= 10 ? "Medium" : preview >= 5 ? "Low" : "Negligible";
  const levelColor = preview >= 20 ? "text-red-700 bg-red-100" : preview >= 15 ? "text-orange-700 bg-orange-100" : preview >= 10 ? "text-amber-700 bg-amber-100" : "text-emerald-700 bg-emerald-100";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Changes saved successfully.
        </div>
      )}

      <Field label="Title" required>
        <Input name="title" defaultValue={risk.title} required />
      </Field>
      <Field label="Description">
        <Textarea name="description" defaultValue={risk.description ?? ""} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Category">
          <Select name="category" defaultValue={risk.category}>
            <option value="chemical">Chemical</option>
            <option value="physical">Physical</option>
            <option value="biological">Biological</option>
            <option value="ergonomic">Ergonomic</option>
            <option value="fire">Fire</option>
          </Select>
        </Field>
        <Field label="Activity">
          <Input name="activity" defaultValue={risk.activity ?? ""} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Likelihood (1–5)">
          <Select name="likelihood_score" defaultValue={String(risk.likelihood_score)}
            onChange={(e) => setLScore(Number(e.target.value))}>
            <option value="1">1 — Rare</option>
            <option value="2">2 — Unlikely</option>
            <option value="3">3 — Possible</option>
            <option value="4">4 — Likely</option>
            <option value="5">5 — Almost Certain</option>
          </Select>
        </Field>
        <Field label="Consequence (1–5)">
          <Select name="consequence_score" defaultValue={String(risk.consequence_score)}
            onChange={(e) => setCScore(Number(e.target.value))}>
            <option value="1">1 — Negligible</option>
            <option value="2">2 — Minor</option>
            <option value="3">3 — Moderate</option>
            <option value="4">4 — Major</option>
            <option value="5">5 — Catastrophic</option>
          </Select>
        </Field>
      </div>

      <div className={`flex items-center gap-3 rounded-lg px-4 py-2.5 ${levelColor}`}>
        <span className="text-sm font-semibold">Risk Score: {preview}/25 — {level}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Status">
          <Select name="status" defaultValue={risk.status}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="under_review">Under Review</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>
        <Field label="Next Review Date">
          <Input name="review_date" type="date"
            defaultValue={risk.review_date ? new Date(risk.review_date).toISOString().slice(0, 10) : ""} />
        </Field>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">ID: {risk.id.slice(0, 8)}…</p>
        <button type="submit" disabled={pending}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
