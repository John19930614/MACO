"use client";

import { RegulatoryIncidentReporting } from "../reporting/RegulatoryIncidentReporting";
import type { ClockRow } from "@/lib/regulatory/read";

// Environmental-release investigation view. Uses the same Reporting Status panel
// pattern, scoped to the EPA/state clocks — tracked separately from injury
// reporting so an environmental deadline never blocks (or is blocked by) an
// unrelated injury report.

export function EnvironmentalReleaseInvestigation({
  incidentId,
  clocks,
}: {
  incidentId: string;
  clocks: ClockRow[];
}) {
  const envClocks = clocks.filter((c) => c.jurisdiction === "epa_environmental_release");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Environmental release</h1>
        <p className="text-sm text-slate-500">
          Track EPA and state environmental reporting deadlines separately from injury reporting.
        </p>
      </div>
      <RegulatoryIncidentReporting incidentId={incidentId} clocks={envClocks} showDecisionHelper={false} />
    </div>
  );
}
