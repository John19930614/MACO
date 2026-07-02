"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, FilePlus2, XCircle } from "lucide-react";
import { Card, CardHeader, Pill } from "@/components/ui/primitives";
import { Modal, Field, Textarea } from "@/components/modals/Modal";
import { transitionWasteProfile } from "@/lib/actions/ehs";
import { type WasteProfileState } from "@/lib/constants";
import type { WasteProfile, WasteStream } from "@/lib/types";

function fmt(d: string | null): string {
  if (!d) return "—";
  return new Date(d.includes("T") ? d : d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATE_STYLE: Record<WasteProfileState, string> = {
  draft:      "bg-slate-100 text-slate-600",
  ehs_review: "bg-amber-100 text-amber-700",
  approved:   "bg-blue-100 text-blue-700",
  active:     "bg-emerald-100 text-emerald-700",
  rejected:   "bg-red-100 text-red-700",
  retired:    "bg-slate-100 text-slate-400",
};

const STATE_LABEL: Record<WasteProfileState, string> = {
  draft: "Draft",
  ehs_review: "EHS Review",
  approved: "Approved",
  active: "Active",
  rejected: "Rejected",
  retired: "Retired",
};

const btnBase = "rounded-lg px-2.5 py-1 text-[10px] font-semibold transition disabled:opacity-50";

export function WasteProfilePipeline({ profiles }: { profiles: WasteProfile[]; streams?: WasteStream[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState<WasteProfile | null>(null);

  function run(id: string, action: Parameters<typeof transitionWasteProfile>[1], reason?: string) {
    startTransition(async () => {
      const res = await transitionWasteProfile(id, action, reason);
      if (res.ok) {
        router.refresh();
        setRejecting(null);
      } else {
        alert(res.error ?? "Could not update the profile.");
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Waste Profile Review Pipeline"
        subtitle="Draft → EHS Review → Approved → Active · Reviewer approval is required before a profile can be activated for container assignment"
        right={
          <Link
            href="/waste/profiles/new"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            <FilePlus2 className="h-3.5 w-3.5" /> New Profile
          </Link>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5 text-left">Profile Name</th>
              <th className="px-4 py-2.5 text-left">Code</th>
              <th className="px-4 py-2.5 text-left">Ver.</th>
              <th className="px-4 py-2.5 text-left">Submitted</th>
              <th className="px-4 py-2.5 text-left">State</th>
              <th className="px-4 py-2.5 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {profiles.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-800">
                  {p.name}
                  {p.state === "rejected" && p.reject_reason && (
                    <div className="mt-0.5 text-[10px] font-normal text-red-500">Rejected: {p.reject_reason}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.waste_code
                    ? <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-700">{p.waste_code}</span>
                    : <span className="text-[10px] text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.version}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{fmt(p.submitted_at)}</td>
                <td className="px-4 py-3">
                  <Pill className={STATE_STYLE[p.state]}>{STATE_LABEL[p.state]}</Pill>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {p.state === "draft" && (
                      <button disabled={pending} onClick={() => run(p.id, "submit")} className={`${btnBase} border border-amber-200 bg-amber-50 text-amber-700`}>
                        Submit for Review
                      </button>
                    )}
                    {p.state === "ehs_review" && (
                      <>
                        <button disabled={pending} onClick={() => run(p.id, "approve")} className={`${btnBase} bg-emerald-600 text-white`}>
                          Approve
                        </button>
                        <button disabled={pending} onClick={() => setRejecting(p)} className={`${btnBase} border border-red-200 bg-red-50 text-red-700`}>
                          Reject
                        </button>
                      </>
                    )}
                    {p.state === "approved" && (
                      <>
                        <button disabled={pending} onClick={() => run(p.id, "activate")} className={`${btnBase} bg-blue-600 text-white`}>
                          Activate
                        </button>
                        <button disabled={pending} onClick={() => run(p.id, "retire")} className={`${btnBase} border border-slate-200 text-slate-500`}>
                          Retire
                        </button>
                      </>
                    )}
                    {p.state === "active" && (
                      <>
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" /> {p.approved_at ? `Approved ${fmt(p.approved_at)}` : "Active"}
                        </span>
                        <button disabled={pending} onClick={() => run(p.id, "retire")} className={`${btnBase} border border-slate-200 text-slate-500`}>
                          Retire
                        </button>
                      </>
                    )}
                    {p.state === "rejected" && (
                      <button disabled={pending} onClick={() => run(p.id, "revise")} className={`${btnBase} border border-slate-200 text-slate-600`}>
                        Revise to Draft
                      </button>
                    )}
                    {p.state === "retired" && (
                      <span className="text-[10px] text-slate-400">Retired {fmt(p.updated_at)}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {profiles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                  No waste profiles yet — create one with “New Profile” to start the approval pipeline.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-50 bg-slate-50/50 px-5 py-3 text-[10.5px] text-slate-400">
        Approved profiles lock for container assignment · Version history and reviewer are retained on every state transition · A rejected profile can be revised and resubmitted
      </div>

      {/* Reject modal */}
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title={`Reject Profile — ${rejecting?.name ?? ""}`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            if (rejecting) run(rejecting.id, "reject", (fd.get("reason") as string) || "");
          }}
        >
          <div className="flex flex-col gap-4 px-6 py-5">
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Rejecting returns the profile to the submitter. Provide a clear reason so it can be corrected.
            </div>
            <Field label="Rejection Reason" required>
              <Textarea name="reason" required placeholder="e.g. Constituent concentrations missing; attach SDS and resubmit." />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={() => setRejecting(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60">
              {pending ? "Rejecting…" : "Reject Profile"}
            </button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

// Profile creation now uses the guided wizard at /waste/profiles/new
// (inventory selection → composition → guided questions → AI draft → approval).
