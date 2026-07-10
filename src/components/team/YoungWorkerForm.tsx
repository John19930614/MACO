"use client";

import { useState, useTransition } from "react";
import { upsertYoungWorkerProfile } from "@/lib/actions/young-worker-profile";

// Adapted: keyed by profileId (a profiles row), not workerId. Grouped into short
// plain-English sections. State-overlay fields (WI/CA) are shown so managers can
// record the permits the gate enforces.
export function YoungWorkerForm({ profileId }: { profileId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    const payload = Object.fromEntries(formData.entries());
    startTransition(async () => {
      const res = await upsertYoungWorkerProfile({ ...payload, profileId });
      if (!res.ok) {
        setError(res.error ?? "Please check the highlighted fields.");
      } else {
        setSuccess(true);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6 max-w-2xl">
      <section>
        <h2 className="font-medium">Identity &amp; Date of Birth</h2>
        <p className="text-sm text-muted-foreground">
          Used to confirm the worker&apos;s age for every task assignment.
        </p>
        <input name="dob" type="date" required className="mt-2 w-full rounded border p-2" />
        <div className="grid grid-cols-2 gap-2 mt-2">
          <input name="homeState" maxLength={2} placeholder="Home state (e.g. WI)" required className="rounded border p-2 uppercase" />
          <input name="workState" maxLength={2} placeholder="Work state (e.g. CA)" required className="rounded border p-2 uppercase" />
        </div>
      </section>

      <section>
        <h2 className="font-medium">School Status</h2>
        <select name="schoolStatus" required className="mt-2 w-full rounded border p-2">
          <option value="enrolled">Enrolled in school</option>
          <option value="not_enrolled">Not enrolled</option>
          <option value="graduated">Graduated</option>
          <option value="ged">GED</option>
          <option value="homeschool">Homeschool</option>
        </select>
      </section>

      <section>
        <h2 className="font-medium">Work Permit</h2>
        <input name="workPermitNumber" placeholder="Permit number" className="mt-2 w-full rounded border p-2" />
        <div className="grid grid-cols-2 gap-2 mt-2">
          <label className="text-xs text-muted-foreground">
            Issue date
            <input name="workPermitIssueDate" type="date" className="mt-1 w-full rounded border p-2" />
          </label>
          <label className="text-xs text-muted-foreground">
            Expiry date
            <input name="workPermitExpiryDate" type="date" className="mt-1 w-full rounded border p-2" />
          </label>
        </div>
      </section>

      <section>
        <h2 className="font-medium">Parent / Guardian Authorization</h2>
        <input name="parentGuardianName" placeholder="Parent or guardian name" className="mt-2 w-full rounded border p-2" />
        <input name="parentGuardianRelationship" placeholder="Relationship (e.g. mother)" className="mt-2 w-full rounded border p-2" />
      </section>

      <section>
        <h2 className="font-medium">Classification</h2>
        <select name="classification" required className="mt-2 w-full rounded border p-2">
          <option value="paid_intern">Paid intern</option>
          <option value="unpaid_intern">Unpaid intern</option>
          <option value="student_learner">Student learner</option>
          <option value="youth_apprentice">Youth apprentice</option>
          <option value="job_shadow">Job shadow</option>
          <option value="volunteer">Volunteer</option>
          <option value="temp">Temp</option>
        </select>
      </section>

      <section>
        <h2 className="font-medium">California — Permit to Employ &amp; Work</h2>
        <p className="text-sm text-muted-foreground">
          Both must be on file before a California worker&apos;s first shift.
        </p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <input name="caPermitToEmployNumber" placeholder="Permit to Employ #" className="rounded border p-2" />
          <input name="caPermitToWorkNumber" placeholder="Permit to Work #" className="rounded border p-2" />
        </div>
      </section>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {success && <p className="text-sm text-green-700">Saved.</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <a href="/team/young-workers" className="rounded border px-4 py-2 text-sm">
          Cancel
        </a>
      </div>
    </form>
  );
}
