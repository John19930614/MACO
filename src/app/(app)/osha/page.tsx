import { getOshaCases, getIncidents, getEstablishment, getTenantSettings } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { resolveOshaHours, OSHA_FTE } from "@/lib/osha";
import { OshaClient } from "./OshaClient";

export default async function OshaPage() {
  const tenantId = await getEffectiveTenantId();
  const [cases, incidents, establishment, settings] = await Promise.all([
    getOshaCases(tenantId), getIncidents(tenantId), getEstablishment(tenantId), getTenantSettings(tenantId),
  ]);
  const oshaHours = resolveOshaHours(settings);
  const oshaEstablishment = {
    ein:       String(settings.oshaEin ?? ""),
    naics:     String(settings.oshaNaics ?? ""),
    employees: Number(settings.oshaAvgEmployees) || OSHA_FTE,
  };
  return (
    <OshaClient
      initialCases={cases}
      incidents={incidents}
      establishment={establishment}
      tenantId={tenantId}
      oshaHours={oshaHours}
      oshaEstablishment={oshaEstablishment}
    />
  );
}
