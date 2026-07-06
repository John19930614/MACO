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
  const rawAvgEmployees = Number(settings.oshaAvgEmployees);
  const rawAnnualHours = Number(settings.oshaAnnualHours);
  const oshaEstablishment = {
    ein:       String(settings.oshaEin ?? ""),
    naics:     String(settings.oshaNaics ?? ""),
    employees: rawAvgEmployees || OSHA_FTE,
    // Whether the tenant actually entered these in Settings, vs. the platform falling back to a default.
    // resolveOshaHours() also derives hours from avg-employees, so hours count as "configured" either way.
    employeesConfigured: Number.isFinite(rawAvgEmployees) && rawAvgEmployees > 0,
    hoursConfigured:
      (Number.isFinite(rawAnnualHours) && rawAnnualHours > 0) ||
      (Number.isFinite(rawAvgEmployees) && rawAvgEmployees > 0),
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
