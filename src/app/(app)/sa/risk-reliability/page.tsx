// Risk Score Reliability — Reliance superadmin only.
//
// Answers "Is the risk model working well right now?" in plain English. Reads
// cross-tenant reliability data via the service-role client (a superadmin has
// no tenant, so tenant RLS would return nothing). Renamed from "model-health
// monitoring" per UX feedback — nothing here uses that phrase.

import { redirect } from "next/navigation";
import { isSuperadmin } from "@/lib/auth/session";
import { getRiskReliabilityData } from "@/lib/actions/phase-3-ai-agent";
import { RiskReliabilityView } from "./RiskReliabilityView";

export default async function RiskReliabilityPage() {
  // Server-side gate — a client tenant must never reach this screen.
  if (!(await isSuperadmin())) {
    redirect("/dashboard");
  }

  const res = await getRiskReliabilityData();
  if (!res.ok) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          {res.error} Please try again, or contact platform engineering if this keeps happening.
        </div>
      </div>
    );
  }

  return <RiskReliabilityView data={res.data} />;
}
