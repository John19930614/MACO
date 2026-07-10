"use client";

import { useState } from "react";
import { YoungWorkerForm } from "./YoungWorkerForm";

// Wraps the existing YoungWorkerForm with the employee picker it was missing.
// The form needs a profileId; this dropdown supplies it. Manager-gated upstream.
export function NewYoungWorkerClient({
  profiles,
}: {
  profiles: { id: string; display_name: string }[];
}) {
  const [profileId, setProfileId] = useState("");

  return (
    <div className="max-w-2xl space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Which employee is this profile for?</span>
        <select
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
        >
          <option value="">Select an employee…</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
          Pick the under-18 employee, then fill in their details below.
        </span>
      </label>

      {profileId ? (
        <YoungWorkerForm key={profileId} profileId={profileId} />
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Choose an employee above to enter their details.
        </p>
      )}
    </div>
  );
}
