import { redirect } from "next/navigation";
import { MOCK_MODE } from "@/lib/env";
import { resolveCallerRole } from "@/lib/auth/resolve-role";
import { COORDINATOR_ROLES } from "@/lib/constants";
import { getCtx } from "@/lib/actions/ehs-shared";
import { EvacuationDrillCompliance } from "./EvacuationDrillCompliance";

export const dynamic = "force-dynamic";

export default async function DrillCalendarPage() {
  // Coordinator+ only (managers/admins included). Wardens are data, not a role,
  // so the standard company-nav roles gate access — matching the LeftNav entry.
  const role = await resolveCallerRole();
  if (!role || !COORDINATOR_ROLES.includes(role)) redirect("/");

  // Demo mode has no live tables — render the shell with empty data; the server
  // actions themselves return a friendly "requires a live database" message.
  if (MOCK_MODE) {
    return (
      <EvacuationDrillCompliance
        siteId={null}
        profile={null}
        calendar={[]}
        requirements={[]}
        wardens={[]}
        actions={[]}
        demo
      />
    );
  }

  const ctx = await getCtx();
  const siteId = ctx?.siteId ?? null;

  /* eslint-disable @typescript-eslint/no-explicit-any -- rows are loosely-typed
     jsonb columns; the presentational component reads known fields off them. */
  let profile: Record<string, any> | null = null;
  let calendar: Record<string, any>[] = [];
  let requirements: Record<string, any>[] = [];
  let wardens: Record<string, any>[] = [];
  let actions: Record<string, any>[] = [];
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (ctx && siteId) {
    const { client, tenantId } = ctx;
    const [p, c, r, w, a] = await Promise.all([
      client.from("facility_profiles").select("*").eq("tenant_id", tenantId).eq("site_id", siteId).maybeSingle(),
      client
        .from("drill_calendar_events")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("site_id", siteId)
        .order("due_date", { ascending: true }),
      client
        .from("drill_frequency_requirements")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("site_id", siteId)
        .order("event_type", { ascending: true }),
      client
        .from("drill_wardens")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("site_id", siteId)
        .eq("active", true),
      client
        .from("drill_compliance_action")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("site_id", siteId)
        .eq("resolved", false)
        .order("created_at", { ascending: false }),
    ]);
    profile = p.data ?? null;
    calendar = c.data ?? [];
    requirements = r.data ?? [];
    wardens = w.data ?? [];
    actions = a.data ?? [];
  }

  return (
    <EvacuationDrillCompliance
      siteId={siteId}
      profile={profile}
      calendar={calendar}
      requirements={requirements}
      wardens={wardens}
      actions={actions}
    />
  );
}
