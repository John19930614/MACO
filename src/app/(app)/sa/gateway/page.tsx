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
import { getEffectiveTenantId } from "@/lib/auth/session";
import { runGatewayHealthCheck, getGatewayHealthSnapshots, getGatewaySettings, getGatewayVersions, getGatewayNotes, getGatewayQualifications, GATEWAY_POSITIONING } from "@/lib/gateway/agent";
import { EhsGatewayDashboard } from "./EhsGatewayDashboard";
import GatewayAgentPanel from "./GatewayAgentPanel";
import ModelBenchmarkPanel from "./ModelBenchmarkPanel";

export default async function EhsGatewayPage() {
  // Canonical tenant resolution — real tenant in live, NIL_UUID (safe empty) when
  // unresolved, never the demo tenant. Matches the gateway pipeline.
  const tenantId = await getEffectiveTenantId();

  const [
    incidents, capas, chemicals, audits, findings,
    wasteStreams, equipment, riskAssessments, health, history,
  ] = await Promise.all([
    getIncidents(tenantId),
    getCapaActions(tenantId),
    getChemicals(tenantId),
    getAudits(tenantId),
    getAuditFindings(tenantId),
    getWasteStreams(tenantId),
    getEquipment(tenantId),
    getRiskAssessments(tenantId),
    runGatewayHealthCheck({ persist: false }).catch(() => null),
    getGatewayHealthSnapshots(12).catch(() => []),
  ]);
  const [settings, versions, notes, qualifications] = await Promise.all([
    getGatewaySettings().catch(() => null),
    getGatewayVersions().catch(() => []),
    getGatewayNotes(20).catch(() => []),
    getGatewayQualifications().catch(() => []),
  ]);

  return (
    <>
      <EhsGatewayDashboard
        incidents={incidents}
        capas={capas}
        chemicals={chemicals}
        audits={audits}
        findings={findings}
        wasteStreams={wasteStreams}
        equipment={equipment}
        riskAssessments={riskAssessments}
        topSlot={<GatewayAgentPanel live={health} history={history} settings={settings} versions={versions} notes={notes} qualifications={qualifications} positioning={GATEWAY_POSITIONING} />}
      />
      <div className="mt-6">
        <ModelBenchmarkPanel />
      </div>
    </>
  );
}
