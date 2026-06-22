import {
  getComplianceScores,
  overallComplianceScore,
  getPredictabilityRuns,
  getProfiles,
  getCapaActions,
  getIncidents,
  getAiFindings,
  getTrainingRecords,
  getChemicals,
} from "@/lib/data/ehsRepo";
import { getServerTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import { PlatformAnalysisDashboard } from "./PlatformAnalysisDashboard";

export default async function SAAnalyticsPage() {
  const tenantId = (await getServerTenantId()) ?? MOCK_TENANT_ID;

  const [
    moduleScores, overall, runs, profiles,
    capas, incidents, aiFindings, trainingRecords, chemicals,
  ] = await Promise.all([
    getComplianceScores(tenantId),
    overallComplianceScore(tenantId),
    getPredictabilityRuns(tenantId),
    getProfiles(tenantId),
    getCapaActions(tenantId),
    getIncidents(tenantId),
    getAiFindings(tenantId),
    getTrainingRecords(tenantId),
    getChemicals(tenantId),
  ]);

  return (
    <PlatformAnalysisDashboard
      moduleScores={moduleScores}
      overall={overall}
      runs={runs}
      profiles={profiles}
      capas={capas}
      incidents={incidents}
      aiFindings={aiFindings}
      trainingRecords={trainingRecords}
      chemicals={chemicals}
    />
  );
}
