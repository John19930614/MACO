"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Check } from "lucide-react";

/**
 * One-click ARC "Pre-empt": turn a forecast recommendation into a tracked
 * preventive Safety Action against the location's highest-risk open cell.
 */
export function PreemptButton({ cellId, recommendation, canCreate = true }: { cellId: string; recommendation: string; canCreate?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function create() {
    setBusy(true);
    const res = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cell_id: cellId, title: recommendation, kind: "preventive", owner_id: null, due_date: null }),
    });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      router.refresh();
    }
  }

  if (done) {
    return (
      <span role="status" className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--color-curve)]">
        <Check className="h-3.5 w-3.5" /> Action created
      </span>
    );
  }

  return (
    <button
      onClick={create}
      disabled={busy || !canCreate}
      aria-busy={busy}
      title={canCreate ? "Create a tracked preventive action from this forecast" : "Requires supervisor role or above"}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-curve)] px-2.5 py-1 text-xs font-medium text-[var(--color-curve)] hover:bg-[var(--color-curve-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-curve)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create pre-empt action
    </button>
  );
}
