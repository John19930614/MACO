import { getOshaCases, getIncidents, getEstablishment } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { OshaClient } from "./OshaClient";

export default async function OshaPage() {
  const tenantId = await getEffectiveTenantId();
  const [cases, incidents, establishment] = await Promise.all([
    getOshaCases(tenantId), getIncidents(tenantId), getEstablishment(tenantId),
  ]);
  return <OshaClient initialCases={cases} incidents={incidents} establishment={establishment} tenantId={tenantId} />;
}
