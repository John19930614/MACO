import { NextResponse } from "next/server";
import { getStore } from "@/lib/data/store";
import { MOCK_MODE } from "@/lib/env";
import { getAuthUser, getAuthProfile } from "@/lib/supabase/server";
import { currentUser } from "@/lib/data/repo";

/**
 * Platform module toggles are a Reliance-superadmin surface. Require an
 * authenticated user whose profile has no tenant (tenant_id IS NULL) — the same
 * "Reliance admin" gate the /sa routes use in middleware. A tenant-scoped client
 * user (even an 'admin') is forbidden.
 *
 * Returns 401 (no session) / 403 (authenticated but not a superadmin) as JSON.
 */
async function requireSuperadmin(): Promise<NextResponse | null> {
  if (MOCK_MODE) {
    // Mock session is always "authenticated"; gate on the mock profile's tenant.
    const u = currentUser();
    if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (u.tenant_id !== null) {
      return NextResponse.json({ error: "forbidden", detail: "superadmin only" }, { status: 403 });
    }
    return null;
  }
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const profile = await getAuthProfile();
  if (!profile || profile.tenant_id !== null) {
    return NextResponse.json({ error: "forbidden", detail: "superadmin only" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await requireSuperadmin();
  if (denied) return denied;
  const store = getStore();
  // Spread each entry to guarantee plain-object serialization
  const payload: Record<string, object> = {};
  for (const [k, v] of Object.entries(store.moduleStates)) {
    payload[k] = { enabled: v.enabled, maintenanceNote: v.maintenanceNote, disabledAt: v.disabledAt, disabledBy: v.disabledBy };
  }
  return NextResponse.json(payload);
}

export async function POST(req: Request) {
  const denied = await requireSuperadmin();
  if (denied) return denied;
  const { module: mod, enabled, maintenanceNote, disabledBy } = await req.json() as {
    module: string;
    enabled: boolean;
    maintenanceNote: string;
    disabledBy: string;
  };

  const store = getStore();
  const prev = store.moduleStates[mod];
  if (!prev) {
    return NextResponse.json({ error: "Unknown module" }, { status: 400 });
  }

  store.moduleStates[mod] = {
    enabled,
    maintenanceNote: maintenanceNote ?? prev.maintenanceNote,
    disabledAt: enabled ? null : (prev.disabledAt ?? new Date().toISOString()),
    disabledBy: enabled ? "" : (disabledBy ?? prev.disabledBy),
  };

  return NextResponse.json(store.moduleStates[mod]);
}
