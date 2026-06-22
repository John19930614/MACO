import {
  getIncidents,
  getCapaActions,
  getChemicals,
  getAudits,
  getAuditFindings,
  getWasteStreams,
  getEquipment,
  getRiskAssessments,
} from "@/lib/data/ehsRepo";
import { getServerTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import { EhsGatewayDashboard } from "./EhsGatewayDashboard";

export default async function EhsGatewayPage() {
  const tenantId = (await getServerTenantId()) ?? MOCK_TENANT_ID;

  const [
    incidents, capas, chemicals, audits, findings,
    wasteStreams, equipment, riskAssessments,
  ] = await Promise.all([
    getIncidents(tenantId),
    getCapaActions(tenantId),
    getChemicals(tenantId),
    getAudits(tenantId),
    getAuditFindings(tenantId),
    getWasteStreams(tenantId),
    getEquipment(tenantId),
    getRiskAssessments(tenantId),
  ]);

  return (
    <EhsGatewayDashboard
      incidents={incidents}
      capas={capas}
      chemicals={chemicals}
      audits={audits}
      findings={findings}
      wasteStreams={wasteStreams}
      equipment={equipment}
      riskAssessments={riskAssessments}
    />
  );
}
