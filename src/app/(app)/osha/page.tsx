import { getOshaCases, getIncidents } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import { OshaClient } from "./OshaClient";

export default async function OshaPage() {
  const tenantId = await getEffectiveTenantId();
  const [cases, incidents] = await Promise.all([getOshaCases(tenantId), getIncidents(tenantId)]);
  return <OshaClient initialCases={cases} incidents={incidents} />;
}
