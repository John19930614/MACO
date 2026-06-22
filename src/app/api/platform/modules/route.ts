import { NextResponse } from "next/server";
import { getStore } from "@/lib/data/store";

export async function GET() {
  const store = getStore();
  // Spread each entry to guarantee plain-object serialization
  const payload: Record<string, object> = {};
  for (const [k, v] of Object.entries(store.moduleStates)) {
    payload[k] = { enabled: v.enabled, maintenanceNote: v.maintenanceNote, disabledAt: v.disabledAt, disabledBy: v.disabledBy };
  }
  return NextResponse.json(payload);
}

export async function POST(req: Request) {
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
