import { NextResponse } from "next/server";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { getTenantModuleAccess } from "@/lib/modules/moduleAccess";

/**
 * Effective module access for the CALLER'S OWN tenant — combines the
 * per-tenant toggle (Company > Modules tab) with platform-wide Module Control
 * Panel maintenance. Consumed by LeftNav (hide disabled modules from the nav)
 * and ModuleGateClient (block direct-link access with a friendly message).
 * No superadmin gate: any authenticated user may read their own tenant's
 * status (RLS additionally scopes tenant_module_access reads the same way).
 */
export async function GET() {
  const tenantId = await getEffectiveTenantId();
  const statuses = await getTenantModuleAccess(tenantId);
  return NextResponse.json(statuses);
}
