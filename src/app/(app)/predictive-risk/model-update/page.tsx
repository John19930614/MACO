// EHS-lead-facing "Review & Approve Risk Model Update" page.
//
// Shows the latest pending reweighting proposal in plain English, gated to
// managers/admins (the real "EHS lead" tier) and Reliance superadmins. Reweight-
// ing is PLATFORM-WIDE reference data, so this is intentionally not tenant-scoped.

import { canManage } from "@/lib/constants";
import { resolveCallerRole } from "@/lib/auth/resolve-role";
import { isSuperadmin } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { RiskModelReviewClient, type ProposalRow } from "./RiskModelReviewClient";

export const dynamic = "force-dynamic";

async function loadPendingProposal(): Promise<
  { proposal: ProposalRow | null; error: string | null }
> {
  const client = createServiceRoleClient();
  // Mock/demo or no service-role key: nothing to review, render the empty state.
  if (!client) return { proposal: null, error: null };

  const { data, error } = await client
    .from("risk_model_validation_runs")
    .select("*")
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { proposal: null, error: "Couldn't load the latest validation results. Please try again." };
  return { proposal: (data as ProposalRow | null) ?? null, error: null };
}

export default async function RiskModelReviewPage() {
  const role = await resolveCallerRole();
  const allowed = (role && canManage(role)) || (await isSuperadmin());

  if (!allowed) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="font-semibold text-slate-800">Access restricted</p>
          <p className="mt-1 text-sm text-slate-600">
            Reviewing and approving risk-model updates is limited to EHS managers and administrators.
            Contact your administrator if you need access.
          </p>
        </div>
      </div>
    );
  }

  const { proposal, error } = await loadPendingProposal();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Review &amp; Approve Risk Model Update</h1>
        <p className="mt-1 text-sm text-slate-600">
          Checks whether the risk score actually matches what happened in real incidents, and how often
          it raised a false alarm — before any change to the scoring is applied.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          {error} If it keeps happening, contact an administrator.
        </div>
      ) : (
        <RiskModelReviewClient proposal={proposal} />
      )}
    </div>
  );
}
