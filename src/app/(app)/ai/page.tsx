import {
  getAiFindings, getPredictabilityRuns, latestPredictabilityRun,
  getChemicals, getTrainingCourses, getTrainingRecords, getProfiles,
  getCapaActions, getIncidents, getLegalRequirements, getAudits, getWasteStreams,
} from "@/lib/data/ehsRepo";
import { getServerTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import { PageHeader } from "@/components/ui/primitives";
import { RunScanButton } from "./RunScanButton";
import { AmayaDashboard } from "./AmayaDashboard";

export default async function AiPage() {
  const tenantId = (await getServerTenantId()) ?? MOCK_TENANT_ID;
  const [
    findings, runs, latestRun,
    chemicals, courses, records, profiles,
    capas, incidents, legal, audits, waste,
  ] = await Promise.all([
    getAiFindings(tenantId),
    getPredictabilityRuns(tenantId),
    latestPredictabilityRun(tenantId),
    getChemicals(tenantId),
    getTrainingCourses(tenantId),
    getTrainingRecords(tenantId),
    getProfiles(tenantId),
    getCapaActions(tenantId),
    getIncidents(tenantId),
    getLegalRequirements(tenantId),
    getAudits(tenantId),
    getWasteStreams(tenantId),
  ]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="AI Safety Assistant"
        subtitle="Powered by P-Engine — query your live EHS data or review compliance forecasts and AI findings"
        actions={<RunScanButton />}
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <AmayaDashboard
          findings={findings}
          runs={runs}
          latestRun={latestRun}
          chemicals={chemicals}
          courses={courses}
          records={records}
          profiles={profiles}
          capas={capas}
          incidents={incidents}
          legal={legal}
          audits={audits}
          waste={waste}
        />
      </div>
    </div>
  );
}
